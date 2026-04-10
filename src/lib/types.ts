/**
 * Execution result interface
 */
export interface ExecResult {
  /** Standard output */
  stdout: string;
  /** Standard error output */
  stderr: string;
  /** Exit code */
  exitCode: number;
}

/**
 * Sandbox configuration interface
 */
export interface SandboxConfig {
  /** Sandbox directory path */
  sandboxDir?: string;
  /** Execution timeout (milliseconds) */
  timeout?: number;
  /** Allow network access */
  allowNetwork?: boolean;
  /** Command allowlist (comma-separated) */
  commandAllowlist?: string[];
  /** Command blocklist (comma-separated) */
  commandBlocklist?: string[];
  /** Network allowlist (domain list) */
  networkAllowlist?: string[];
  /** Network blocklist (domain list) */
  networkBlocklist?: string[];
}

/**
 * Module configuration interface
 */
export interface ModuleConfig {
  /** Whether module is enabled */
  enabled: boolean;
  /** WASM file path */
  wasmPath: string;
}

/**
 * Busybox module configuration
 */
export interface BusyboxConfig extends ModuleConfig {
  /** Command filtering configuration */
  commands?: {
    /** Mode: whitelist or blacklist */
    mode?: 'whitelist' | 'blacklist';
    /** Command list */
    list?: string[];
  };
}

/**
 * Python module configuration
 */
export interface PythonConfig extends ModuleConfig {}

/**
 * Global security configuration (from ~/.agentskillmania/sandbox/config.yaml)
 * Only contains security policies, not execution parameters
 */
export interface GlobalSecurityConfig {
  /** Command security policy */
  commands?: {
    /** Default mode: whitelist or blacklist */
    mode?: 'whitelist' | 'blacklist';
    /** Default command list */
    list?: string[];
  };
  /** Network security policy */
  network?: {
    /** Default: allow network access */
    defaultEnabled?: boolean;
    /** Domain allowlist */
    allowlist?: string[];
    /** Domain blocklist */
    blocklist?: string[];
  };
}

/**
 * Runtime version information
 */
export interface RuntimeVersions {
  wasmtime: {
    found: boolean;
    version?: string;
    path?: string;
    expectedVersion?: string;
  };
  busybox: {
    found: boolean;
    path: string;
  };
  micropython: {
    found: boolean;
    path: string;
  };
}

/**
 * Security error class
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Configuration error class
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
