/**
 * WasmRuntime — pure wasmtime process management.
 *
 * Responsibility:
 *   1. Assemble wasmtime CLI arguments
 *   2. Spawn the wasmtime process
 *   3. Collect stdout/stderr
 *   4. Handle timeout
 *
 * Does NOT know about busybox, wsh, or any runtime-specific hacks.
 * The `argv` parameter is passed VERBATIM after the module path.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ExecResult } from './types.js';
import { TimeoutError } from '../types.js';

export interface WasmRuntimeConfig {
  wasmtimePath: string;
  sandboxDir: string;
  timeout: number;
  allowNetwork: boolean;
  /** Additional --dir mappings for wasmtime */
  extraDirs?: string[];
}

export class WasmRuntime {
  constructor(private config: WasmRuntimeConfig) {}

  async spawn(modulePath: string, argv: string[]): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const { wasmtimePath, sandboxDir, timeout, allowNetwork } = this.config;

      if (!existsSync(modulePath)) {
        reject(new Error(`WASM module not found: ${modulePath}`));
        return;
      }

      if (!existsSync(wasmtimePath)) {
        reject(
          new Error(
            `Wasmtime not found: ${wasmtimePath}\nPlease run: npm install @agentskillmania/sandbox`
          )
        );
        return;
      }

      const extraDirArgs = (this.config.extraDirs ?? []).flatMap((dir) => ['--dir', dir]);

      const wasmtimeArgs = [
        '-W',
        'exceptions=y',
        '-S',
        'cli=y',
        '--dir',
        sandboxDir,
        ...extraDirArgs,
        ...this._buildNetworkArgs(allowNetwork),
        modulePath,
        ...argv,
      ];

      const proc = spawn(wasmtimePath, wasmtimeArgs);
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        reject(new TimeoutError(`Execution timeout (${timeout}ms)`));
      }, timeout);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  private _buildNetworkArgs(allowNetwork: boolean): string[] {
    if (!allowNetwork) return [];
    return ['-S', 'tcp=y', '-S', 'udp=y', '-S', 'inherit-network', '-S', 'allow-ip-name-lookup=y'];
  }
}
