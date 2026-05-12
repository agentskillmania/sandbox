import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirp } from 'mkdirp';
import type { ExecResult, SandboxConfig } from './types.js';
import { TimeoutError } from './types.js';
import { SecurityPolicy } from './core/security-policy.js';
import { getWasmtimeExecutable, getWasmPaths, getRuntimeVersions } from './runtime.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  sandboxDir: 'auto' as string | 'auto',
  timeout: 600_000,
  allowNetwork: false,
  commandAllowlist: [] as string[],
  commandBlocklist: [] as string[],
  networkAllowlist: [] as string[],
  networkBlocklist: [] as string[],
};

/**
 * Sandbox class - executes shell commands in an isolated WASM environment.
 *
 * Supports shell commands, python scripts, git operations,
 * and any other command available inside the sandbox.
 */
export class Sandbox {
  private config: SandboxConfig;
  private sandboxDir: string;
  private busyboxPath: string;
  private wasmtimePath: string;
  private securityPolicy: SecurityPolicy;

  constructor(options: SandboxConfig = {}) {
    // Normalize old array-style fields into unified policy objects
    const commandPolicy =
      options.commandPolicy ??
      (options.commandAllowlist?.length
        ? { mode: 'whitelist' as const, list: options.commandAllowlist }
        : options.commandBlocklist?.length
          ? { mode: 'blacklist' as const, list: options.commandBlocklist }
          : undefined);

    this.config = { ...DEFAULT_CONFIG, ...options, commandPolicy };

    // Handle 'auto' for sandbox directory
    if (this.config.sandboxDir === 'auto') {
      this.sandboxDir = mkdtempSync(join(tmpdir(), 'sandbox-'));
    } else {
      this.sandboxDir = this.config.sandboxDir!;
    }

    const wasmPaths = getWasmPaths();
    this.busyboxPath = wasmPaths.busybox;
    this.wasmtimePath = getWasmtimeExecutable();
    this.securityPolicy = new SecurityPolicy(commandPolicy);

    // Ensure sandbox directory exists
    this._ensureSandboxDir();
  }

  /**
   * Update sandbox configuration at runtime
   */
  updateConfig(updates: Partial<Pick<SandboxConfig, 'timeout' | 'allowNetwork'>>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get the sandbox directory path
   */
  getSandboxDir(): string {
    return this.sandboxDir;
  }

  /**
   * Ensure sandbox directory exists
   */
  private _ensureSandboxDir(): void {
    if (!existsSync(this.sandboxDir)) {
      mkdirp.sync(this.sandboxDir);
    }
  }

  /**
   * Build network-related wasmtime arguments
   */
  private _buildNetworkArgs(): string[] {
    const args: string[] = [];

    if (this.config.allowNetwork) {
      args.push(
        '-S',
        'tcp=y',
        '-S',
        'udp=y',
        '-S',
        'inherit-network',
        '-S',
        'allow-ip-name-lookup=y'
      );
    }

    return args;
  }

  /**
   * Execute a command string in the sandbox.
   *
   * Examples:
   *   sandbox.run('ls -la')
   *   sandbox.run('python -c "print(42)"')
   *   sandbox.run('git status')
   *   sandbox.run('cat file.txt | grep hello')
   *
   * If the command is a path to a script file (.sh or .py), the file content
   * is read and executed.
   */
  async run(command: string): Promise<ExecResult> {
    // Check if command is a script file path
    const trimmed = command.trim();
    if ((trimmed.endsWith('.sh') || trimmed.endsWith('.py')) && !trimmed.includes(' ')) {
      return this._runScriptFile(trimmed);
    }

    // Validate the first token of the command
    const firstToken = trimmed.split(/\s+/)[0] ?? '';
    if (firstToken && !firstToken.startsWith('--')) {
      this.securityPolicy.validate({ command: firstToken });
    }

    return this._execWsh(command);
  }

  /**
   * Execute a script file by reading its content and passing to the sandbox.
   */
  private async _runScriptFile(scriptPath: string): Promise<ExecResult> {
    if (!existsSync(scriptPath)) {
      throw new Error(`Script file not found: ${scriptPath}`);
    }

    const content = readFileSync(scriptPath, 'utf-8');

    // Check for shebang and remove it
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    let scriptContent = content;

    if (firstLine.startsWith('#!')) {
      scriptContent = lines.slice(1).join('\n');
    }

    if (scriptPath.endsWith('.py')) {
      const tmpScript = join(this.sandboxDir, '_sandbox_script.py');
      writeFileSync(tmpScript, scriptContent);
      const result = await this._execWsh('python /workspace/_sandbox_script.py');
      rmSync(tmpScript, { force: true });
      return result;
    }

    // .sh file
    return this._execWsh(scriptContent);
  }

  /**
   * Execute a command via the sandbox WASM runtime.
   */
  private async _execWsh(command: string): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      if (!existsSync(this.busyboxPath)) {
        reject(new Error(`WASM module not found: ${this.busyboxPath}`));
        return;
      }

      if (!existsSync(this.wasmtimePath)) {
        reject(
          new Error(
            `Wasmtime not found: ${this.wasmtimePath}\nPlease run: npm install @agentskillmania/sandbox`
          )
        );
        return;
      }

      // Create an isolated temp directory for this wasmtime instance.
      // wsh uses fixed paths like /tmp/_wsh_p_0 for pipe temp files;
      // without isolation, concurrent instances overwrite each other.
      const tmpDir = join(tmpdir(), `sandbox-tmp-${randomUUID()}`);
      mkdirSync(tmpDir, { recursive: true });

      const cleanup = () => {
        try {
          rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      };

      const wasmtimeArgs = [
        '-W',
        'exceptions=y',
        '-S',
        'cli=y',
        '--dir',
        `${this.sandboxDir}::/workspace`,
        '--dir',
        `${tmpDir}::/tmp`,
        ...this._buildNetworkArgs(),
        this.busyboxPath,
        'wsh',
        '-c',
        `cd /workspace && ${command}`,
      ];

      const proc = spawn(this.wasmtimePath, wasmtimeArgs);

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        reject(new TimeoutError(`Execution timeout (${timeout}ms)`));
      }, timeout);

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        cleanup();
        if (timedOut) return;

        // wsh pipe output goes to stderr (freopen cannot restore stdout)
        // merge stderr into stdout to match expected behavior
        const finalStdout = stderr ? stdout + '\n' + stderr : stdout;

        resolve({
          stdout: finalStdout,
          stderr: '',
          exitCode: code ?? 0,
        });
      });

      proc.on('error', (error: Error) => {
        clearTimeout(timer);
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * Get runtime version information
   */
  static getRuntimeVersions() {
    return getRuntimeVersions();
  }
}
