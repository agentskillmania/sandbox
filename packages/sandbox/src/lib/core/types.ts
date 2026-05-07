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
 * Execution request — a single shell command string.
 *
 * The command is executed inside the sandbox WASM runtime.
 */
export interface ExecutionRequest {
  /** Shell command string to execute */
  command: string;
}

/**
 * Configuration for the Executor
 */
export interface ExecutorConfig {
  /** Path to wasmtime executable */
  wasmtimePath: string;
  /** Path to busybox.wasm */
  busyboxPath: string;
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
