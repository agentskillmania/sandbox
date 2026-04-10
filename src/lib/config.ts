import { Settings } from '@agentskillmania/settings-yaml';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Config, SandboxConfig } from './types.js';

/**
 * Default YAML configuration
 */
const DEFAULT_YAML = `
# Sandbox directory (auto = create temp directory)
sandboxDir: auto

# Module configuration
modules:
  busybox:
    enabled: true
    wasmPath: ./wasm/busybox.wasm
    commands:
      mode: blacklist
  python:
    enabled: true
    wasmPath: ./wasm/micropython.wasm

# Network configuration
network:
  enabled: false
  allowlist:
    - '*.github.com'
    - registry.npmjs.org
  blocklist:
    - '*.malicious.com'
    - '*.ads.com'

# Security configuration
security:
  timeout: 5000
`;

/** Default configuration file path */
const DEFAULT_CONFIG_PATH = join(homedir(), '.agentskillmania', 'sandbox', 'config.yaml');

/**
 * Configuration manager
 */
export class ConfigManager {
  private settings: Settings;
  private config: Config;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.settings = new Settings(configPath);
    this.config = {} as Config;
  }

  /**
   * Initialize configuration
   */
  async initialize(options?: {
    defaultYaml?: string;
    override?: Partial<SandboxConfig>;
  }): Promise<void> {
    await this.settings.initialize({
      defaultYaml: options?.defaultYaml || DEFAULT_YAML,
    });

    // Create a mutable copy of the config
    this.config = JSON.parse(JSON.stringify(this.settings.getValues()));

    // Apply CLI argument overrides
    if (options?.override) {
      this._applyOverride(options.override);
    }
  }

  /**
   * Apply CLI argument overrides
   */
  private _applyOverride(override: Partial<SandboxConfig>): void {
    if (override.sandboxDir) {
      this.config.sandboxDir = override.sandboxDir;
    }
    if (override.timeout !== undefined) {
      this.config.security.timeout = override.timeout;
    }
    if (override.allowNetwork !== undefined) {
      this.config.network.enabled = override.allowNetwork;
    }
    if (override.commandAllowlist) {
      this.config.modules.busybox.commands!.list = override.commandAllowlist;
      this.config.modules.busybox.commands!.mode = 'whitelist';
    }
    if (override.commandBlocklist) {
      this.config.modules.busybox.commands!.list = override.commandBlocklist;
      this.config.modules.busybox.commands!.mode = 'blacklist';
    }
    if (override.networkAllowlist) {
      this.config.network.allowlist = override.networkAllowlist;
    }
    if (override.networkBlocklist) {
      this.config.network.blocklist = override.networkBlocklist;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Get Sandbox configuration
   */
  getSandboxConfig(): SandboxConfig {
    return {
      sandboxDir: this.config.sandboxDir,
      timeout: this.config.security.timeout,
      allowNetwork: this.config.network.enabled,
      commandAllowlist: this.config.modules.busybox.commands?.mode === 'whitelist'
        ? this.config.modules.busybox.commands.list
        : [],
      commandBlocklist: this.config.modules.busybox.commands?.mode === 'blacklist'
        ? this.config.modules.busybox.commands.list
        : [],
      networkAllowlist: this.config.network.allowlist || [],
      networkBlocklist: this.config.network.blocklist || [],
    };
  }

  /**
   * Get module configuration
   */
  getModuleConfig(module: 'busybox' | 'python') {
    return this.config.modules[module];
  }
}

/**
 * Global configuration instance
 */
let globalConfig: ConfigManager | null = null;

/**
 * Initialize global configuration
 */
export async function initializeGlobalConfig(options?: {
  configPath?: string;
  defaultYaml?: string;
  override?: Partial<SandboxConfig>;
}): Promise<ConfigManager> {
  if (!globalConfig) {
    globalConfig = new ConfigManager(options?.configPath);
    await globalConfig.initialize(options);
  }
  return globalConfig;
}

/**
 * Get global configuration
 */
export function getGlobalConfig(): ConfigManager | null {
  return globalConfig;
}
