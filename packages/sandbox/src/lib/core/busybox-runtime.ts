/**
 * BusyboxRuntime — execute busybox applets.
 *
 * Responsibility: invoke busybox.wasm with an applet name and its arguments.
 *
 * Example:
 *   exec('ls', ['-la']) → wasmtime busybox.wasm ls -la
 */

import type { WasmRuntime } from './wasm-runtime.js';
import type { ExecResult } from './types.js';

export class BusyboxRuntime {
  readonly name = 'busybox';

  constructor(
    private wasm: WasmRuntime,
    private busyboxPath: string
  ) {}

  async exec(argv: string[]): Promise<ExecResult> {
    return this.wasm.spawn(this.busyboxPath, argv);
  }
}
