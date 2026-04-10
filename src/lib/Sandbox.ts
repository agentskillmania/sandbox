import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirp } from 'mkdirp';
import type {
  ExecResult,
  SandboxConfig,
} from './types.js';
import { SecurityError, TimeoutError } from './types.js';
import { getWasmtimeExecutable, getWasmPaths, getRuntimeVersions } from './runtime.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<SandboxConfig> = {
  sandboxDir: 'auto', // 'auto' means create temp directory
  timeout: 5000,
  allowNetwork: false,
  commandAllowlist: [],
  commandBlocklist: [],
  networkAllowlist: [],
  networkBlocklist: [],
};

/**
 * Sandbox class - executes WASM modules in isolated environment
 */
export class Sandbox {
  private config: Required<SandboxConfig>;
  private sandboxDir: string;
  private wasmPaths: ReturnType<typeof getWasmPaths>;

  constructor(options: SandboxConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options } as Required<SandboxConfig>;

    // Handle 'auto' for sandbox directory
    if (this.config.sandboxDir === 'auto') {
      // Create temp directory in system temp directory
      this.sandboxDir = mkdtempSync(join(tmpdir(), 'sandbox-'));
    } else {
      this.sandboxDir = this.config.sandboxDir;
    }

    this.wasmPaths = getWasmPaths();

    // Ensure sandbox directory exists
    this._ensureSandboxDir();
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
   * Validate if command is allowed based on whitelist/blacklist
   */
  private _validateCommand(command: string): void {
    // Whitelist mode
    if (this.config.commandAllowlist.length > 0) {
      if (!this.config.commandAllowlist.includes(command)) {
        throw new SecurityError(`Command '${command}' is not in the allowlist`);
      }
      return;
    }

    // Blacklist mode
    if (this.config.commandBlocklist.length > 0) {
      if (this.config.commandBlocklist.includes(command)) {
        throw new SecurityError(`Command '${command}' is in the blocklist`);
      }
    }
  }

  /**
   * Build network-related wasmtime arguments
   */
  private _buildNetworkArgs(): string[] {
    const args: string[] = [];

    if (this.config.allowNetwork) {
      args.push('-S', 'tcp=y', '-S', 'udp=y', '-S', 'inherit-network', '-S', 'allow-ip-name-lookup=y');
    }

    return args;
  }

  /**
   * Execute WASM module with wasmtime
   */
  private async _execWasm(modulePath: string, args: string[]): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Check if module exists
      if (!existsSync(modulePath)) {
        reject(new Error(`WASM module not found: ${modulePath}`));
        return;
      }

      // Get dedicated wasmtime executable
      const wasmtimeExe = getWasmtimeExecutable();
      if (!existsSync(wasmtimeExe)) {
        reject(new Error(
          `Wasmtime not found: ${wasmtimeExe}\nPlease run: npm install @agentskillmania/sandbox`
        ));
        return;
      }

      // Build wasmtime arguments
      const wasmtimeArgs = [
        '-W', 'exceptions=y',
        '-S', 'cli=y',
        '--dir', this.sandboxDir,
        ...this._buildNetworkArgs(),
        modulePath,
        ...args,
      ];

      // Spawn wasmtime process
      const proc = spawn(wasmtimeExe, wasmtimeArgs);

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        reject(new TimeoutError(`Execution timeout (${timeout}ms)`));
      }, timeout);

      // Collect output
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Execute Shell command via busybox.wasm
   * Special commands that bypass validation:
   * - '' (empty): shows busybox help
   * - '--list': lists all busybox commands
   * - '--list-full': lists all commands with full paths
   * - '--help': shows busybox help
   */
  async runShell(command: string, args: string[] = []): Promise<ExecResult> {
    // Skip validation for built-in busybox commands
    const skipValidation = command === '' || command.startsWith('--');

    if (!skipValidation) {
      this._validateCommand(command);
    }

    // Build args: pass command and args directly to busybox
    const wasmArgs = command === '' ? args : [command, ...args];
    return this._execWasm(this.wasmPaths.busybox, wasmArgs);
  }

  /**
   * Execute Python code string
   */
  async runPython(code: string): Promise<ExecResult> {
    return this._execWasm(this.wasmPaths.micropython, ['-c', code]);
  }

  /**
   * Execute Python script file
   */
  async runPythonScript(scriptPath: string, args: string[] = []): Promise<ExecResult> {
    return this._execWasm(this.wasmPaths.micropython, [scriptPath, ...args]);
  }

  /**
   * Get runtime version information
   */
  static getRuntimeVersions() {
    return getRuntimeVersions();
  }
}
