/**
 * Executor — the dispatch engine.
 *
 * Responsibility:
 *   1. Create and configure WasmRuntime and specific Runtimes
 *   2. Validate ExecutionRequest against SecurityPolicy
 *   3. Route the request to the correct Runtime
 *   4. Return the ExecResult
 *
 * This is the single entry point for all execution requests.
 */

import type { ExecutionRequest, ExecResult, ExecutorConfig } from './types.js';
import { SecurityPolicy } from './security-policy.js';
import { SandboxDirectory } from './sandbox-dir.js';
import { WasmRuntime } from './wasm-runtime.js';
import { BusyboxRuntime } from './busybox-runtime.js';
import { WshRuntime } from './wsh-runtime.js';
import { PythonRuntime } from './python-runtime.js';

export class Executor {
  private security: SecurityPolicy;
  private sandboxDir: SandboxDirectory;
  private busybox: BusyboxRuntime;
  private sh: WshRuntime;
  private python: PythonRuntime;

  constructor(config: ExecutorConfig) {
    this.security = new SecurityPolicy(config.commandPolicy);
    this.sandboxDir = new SandboxDirectory({ path: config.sandboxDir });

    // Base wasmtime config (no extra dirs)
    const baseWasm = new WasmRuntime({
      wasmtimePath: config.wasmtimePath,
      sandboxDir: this.sandboxDir.path,
      timeout: config.timeout,
      allowNetwork: config.allowNetwork,
    });

    // wsh needs /tmp for pipe temp files
    const wshWasm = new WasmRuntime({
      wasmtimePath: config.wasmtimePath,
      sandboxDir: this.sandboxDir.path,
      timeout: config.timeout,
      allowNetwork: config.allowNetwork,
      extraDirs: ['/tmp'],
    });

    this.busybox = new BusyboxRuntime(baseWasm, config.busyboxPath);
    this.sh = new WshRuntime(wshWasm, config.busyboxPath);
    this.python = new PythonRuntime(baseWasm, config.micropythonPath);
  }

  async exec(request: ExecutionRequest): Promise<ExecResult> {
    this.security.validate(request);

    switch (request.runtime) {
      case 'busybox':
        return this.busybox.exec(request.argv);
      case 'sh':
        return this.sh.exec(request.argv);
      case 'python':
        return this.python.exec(request.argv);
      default:
        throw new Error(`Unknown runtime: ${(request as any).runtime}`);
    }
  }

  get sandboxDirectory(): string {
    return this.sandboxDir.path;
  }
}
