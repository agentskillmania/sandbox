/**
 * PythonRuntime — execute Python code via micropython.wasm.
 *
 * Responsibility: invoke micropython.wasm with code as stdin argument.
 *
 * Note: micropython.wasm expects the code directly as argv[1],
 * not a file path or -c option.
 */

import type { WasmRuntime } from './wasm-runtime.js';
import type { ExecResult } from './types.js';

export class PythonRuntime {
  readonly name = 'micropython';

  constructor(
    private wasm: WasmRuntime,
    private micropythonPath: string
  ) {}

  async exec(argv: string[]): Promise<ExecResult> {
    return this.wasm.spawn(this.micropythonPath, argv);
  }
}
