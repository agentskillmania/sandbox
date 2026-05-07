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
  /** Command security policy (preferred over commandAllowlist/commandBlocklist) */
  commandPolicy?: { mode: 'whitelist' | 'blacklist'; list: string[] };
  /** Network security policy (reserved, domain filtering not yet implemented in WASI preview2) */
  networkPolicy?: { mode: 'whitelist' | 'blacklist'; list: string[] };
  /** Command allowlist (backward compatibility, use commandPolicy instead) */
  commandAllowlist?: string[];
  /** Command blocklist (backward compatibility, use commandPolicy instead) */
  commandBlocklist?: string[];
  /** Network allowlist (reserved) */
  networkAllowlist?: string[];
  /** Network blocklist (reserved) */
  networkBlocklist?: string[];
}

/**
 * Global security configuration (from ~/.agentskillmania/sandbox/config.yaml)
 * Only contains security policies, not execution parameters
 */
export interface GlobalSecurityConfig {
  /** Command security policy */
  commands?: {
    /** Mode: whitelist (only allow) or blacklist (only block) */
    mode?: 'whitelist' | 'blacklist';
    /** Command list */
    list?: string[];
  };
  /** Network security policy */
  network?: {
    /** Mode: whitelist (only allow) or blacklist (only block) */
    mode?: 'whitelist' | 'blacklist';
    /** Domain list */
    list?: string[];
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
