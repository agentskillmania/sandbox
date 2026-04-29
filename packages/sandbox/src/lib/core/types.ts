/**
 * Core execution types for the sandbox runtime layer.
 *
 * This module defines the contracts between CLI, Executor, and Runtime.
 * No implementation details — pure types and interfaces.
 */

/**
 * Result of a WASM execution
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Strongly-typed execution request.
 *
 * The `argv` array is passed **verbatim** to the WASM module.
 * The Executor does NOT parse, modify, or interpret argv.
 */
export interface ExecutionRequest {
  /** Which runtime to use */
  runtime: 'busybox' | 'wsh' | 'micropython';
  /** Arguments passed verbatim to the WASM module */
  argv: string[];
}

/**
 * Configuration for the Executor
 */
export interface ExecutorConfig {
  /** Path to wasmtime executable */
  wasmtimePath: string;
  /** Path to busybox.wasm */
  busyboxPath: string;
  /** Path to micropython.wasm */
  micropythonPath: string;
  /** Sandbox directory path (absolute) */
  sandboxDir: string;
  /** Execution timeout in milliseconds */
  timeout: number;
  /** Allow network access */
  allowNetwork: boolean;
  /** Command security policy */
  commandPolicy?: CommandPolicyConfig;
}

/**
 * Command security policy configuration
 */
export interface CommandPolicyConfig {
  mode: 'whitelist' | 'blacklist';
  list: string[];
}

/**
 * Runtime adapter interface.
 *
 * Each runtime (busybox, wsh, micropython) implements this interface.
 */
export interface Runtime {
  readonly name: string;
  exec(argv: string[]): Promise<ExecResult>;
}
