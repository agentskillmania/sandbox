/**
 * Executor — the unified execution engine.
 *
 * Responsibility:
 *   1. Create and configure WasmRuntime
 *   2. Validate ExecutionRequest against SecurityPolicy
 *   3. Execute commands via the sandbox WASM runtime
 *   4. Return the ExecResult
 *
 * All commands are executed through the WASM sandbox shell.
 * This includes shell commands, python scripts, and git operations.
 */

import { SandboxDirectory } from './sandbox-dir.js';
import { SecurityPolicy } from './security-policy.js';
import type { ExecutionRequest, ExecResult, ExecutorConfig } from './types.js';
import { WasmRuntime } from './wasm-runtime.js';

export class Executor {
  private security: SecurityPolicy;
  private sandboxDir: SandboxDirectory;
  private wasm: WasmRuntime;
  private busyboxPath: string;

  constructor(config: ExecutorConfig) {
    this.security = new SecurityPolicy(config.commandPolicy);
    this.sandboxDir = new SandboxDirectory({ path: config.sandboxDir });

    this.wasm = new WasmRuntime({
      wasmtimePath: config.wasmtimePath,
      sandboxDir: this.sandboxDir.path,
      timeout: config.timeout,
      allowNetwork: config.allowNetwork,
      // /tmp isolation is handled by WasmRuntime.spawn() per-instance
    });

    this.busyboxPath = config.busyboxPath;
  }

  async exec(request: ExecutionRequest): Promise<ExecResult> {
    this.security.validate(request);

    const command = request.command.trim();

    const raw = await this.wasm.spawn(this.busyboxPath, [
      'wsh',
      '-c',
      `cd /workspace && ${command}`,
    ]);

    // wasmtime's preopen model makes the parent of /workspace (= sandbox
    // root /) return EPERM on stat. busybox's `ls -a` stats `..` and emits
    // "ls: ./..: Operation not permitted". This is a known wasmtime
    // sandboxing artifact, not a real error — filter it from output so the
    // AI doesn't get confused by noise.
    const NOISE_PATTERNS = [
      /^ls: \.\/\.\.: Operation not permitted\r?\n?/m,
      /^ls: \.\.: Operation not permitted\r?\n?/m,
    ];

    // wsh pipe output goes to stderr (freopen cannot restore stdout)
    // merge stderr into stdout to match expected behavior
    let stdout = raw.stderr ? raw.stdout + '\n' + raw.stderr : raw.stdout;
    for (const pattern of NOISE_PATTERNS) {
      stdout = stdout.replace(pattern, '');
    }

    return {
      stdout,
      stderr: '',
      exitCode: raw.exitCode,
    };
  }

  get sandboxDirectory(): string {
    return this.sandboxDir.path;
  }
}
