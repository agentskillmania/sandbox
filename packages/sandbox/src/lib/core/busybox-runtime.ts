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
    // Detect shell scripts and suggest using 'sh' runtime
    if (argv.length > 0 && argv[0].endsWith('.sh')) {
      throw new Error(
        `Shell scripts should be run with the 'sh' runtime.\n` +
          `  Use: exec-in-sandbox -- sh ${argv.join(' ')}\n` +
          `  'busybox' is for single commands like 'ls', 'cat', 'wget'.`
      );
    }
    return this.wasm.spawn(this.busyboxPath, argv);
  }
}
