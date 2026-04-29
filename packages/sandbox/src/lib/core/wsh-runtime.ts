/**
 * WshRuntime — execute shell scripts via wsh.
 *
 * Responsibility:
 *   1. Invoke busybox.wasm with 'wsh' applet
 *   2. Handle wsh-specific quirks (stderr merge, /tmp dir)
 *
 * Wsh writes pipe output to stderr (freopen cannot restore stdout).
 * This runtime merges stderr into stdout to match the expected behavior.
 */

import type { WasmRuntime } from './wasm-runtime.js';
import type { ExecResult } from './types.js';

export class WshRuntime {
  readonly name = 'wsh';

  constructor(
    private wasm: WasmRuntime,
    private busyboxPath: string
  ) {}

  async exec(argv: string[]): Promise<ExecResult> {
    const raw = await this.wasm.spawn(this.busyboxPath, ['wsh', ...argv]);

    // wsh pipe output goes to stderr (freopen cannot restore stdout)
    // merge stderr into stdout to match busybox-wasi test framework behavior
    const stdout = raw.stderr ? raw.stdout + '\n' + raw.stderr : raw.stdout;

    return {
      stdout,
      stderr: '',
      exitCode: raw.exitCode,
    };
  }
}
