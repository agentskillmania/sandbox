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

import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExecResult } from './types.js';
import { TimeoutError } from '../types.js';

/**
 * Recursively copy directory contents (Node 16.7+ has fs.cpSync).
 * Used to populate the virtual root's workspace/ before wasmtime launch.
 */
function cpRecursive(src: string, dest: string): void {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true, force: true });
}

export interface WasmRuntimeConfig {
  wasmtimePath: string;
  sandboxDir: string;
  timeout: number;
  allowNetwork: boolean;
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

      // Ensure AOT precompiled module exists (compile on-demand if missing)
      let modulePathToRun = modulePath;
      if (!modulePath.endsWith('.cwasm')) {
        const cwasmPath = modulePath.replace(/\.wasm$/, '.cwasm');
        if (!existsSync(cwasmPath)) {
          try {
            execSync(
              `"${wasmtimePath}" compile -W exceptions=y "${modulePath}" -o "${cwasmPath}"`,
              { encoding: 'utf-8', stdio: 'ignore' }
            );
            modulePathToRun = cwasmPath;
          } catch {
            // compilation failed, fall back to JIT
          }
        } else {
          modulePathToRun = cwasmPath;
        }
      }

      // Create a virtual root directory for this wasmtime instance.
      // The root contains workspace/ and tmp/ as real subdirectories.
      // Mapping root::/ as a single preopen lets `ls -la` stat `..`
      // (which resolves to /) without EPERM — previously each dir was
      // a separate preopen, making `..` unreachable.
      const rootDir = join(tmpdir(), `sandbox-root-${randomUUID()}`);
      const tmpDir = join(rootDir, 'tmp');
      const wsDir = join(rootDir, 'workspace');
      mkdirSync(tmpDir, { recursive: true });
      mkdirSync(wsDir, { recursive: true });
      // Copy workspace contents into the virtual root's workspace/
      // (symlinks don't work — wasmtime doesn't follow them across preopen boundaries)
      cpRecursive(sandboxDir, wsDir);

      const cleanup = () => {
        try {
          rmSync(rootDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      };

      const wasmtimeArgs = [
        '-W',
        'exceptions=y',
        '-S',
        'cli=y',
        '--dir',
        `${rootDir}::/`,
        ...this._buildNetworkArgs(allowNetwork),
        ...(modulePathToRun.endsWith('.cwasm') ? ['--allow-precompiled'] : []),
        modulePathToRun,
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
        cleanup();
        if (timedOut) return;
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        cleanup();
        reject(error);
      });
    });
  }

  private _buildNetworkArgs(allowNetwork: boolean): string[] {
    if (!allowNetwork) return [];
    return ['-S', 'tcp=y', '-S', 'udp=y', '-S', 'inherit-network', '-S', 'allow-ip-name-lookup=y'];
  }
}
