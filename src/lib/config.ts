import { Settings } from '@agentskillmania/settings-yaml';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalSecurityConfig } from './types.js';

/**
 * Default global security configuration YAML
 * Only contains security policies, not execution parameters
 */
const DEFAULT_SECURITY_YAML = `
# Command security policy
commands:
  mode: blacklist        # blacklist = block these, whitelist = only allow these
  list:                  # Commands to apply the mode
    - rm
    - format
    - fdisk
    - mkfs

# Network security policy
network:
  mode: blacklist        # blacklist = block these domains, whitelist = only allow these
  list:                  # Domains to apply the mode
    - '*.malicious.com'
    - '*.ads.com'
`;

/** Default configuration file path */
const DEFAULT_CONFIG_PATH = join(homedir(), '.agentskillmania', 'sandbox', 'config.yaml');

/**
 * Security configuration manager
 * Only manages security policies from global config file
 */
export class SecurityConfigManager {
  private settings: Settings;
  private securityConfig: GlobalSecurityConfig;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.settings = new Settings(configPath);
    this.securityConfig = {};
  }

  /**
   * Initialize security configuration
   */
  async initialize(): Promise<void> {
    await this.settings.initialize({
      defaultYaml: DEFAULT_SECURITY_YAML,
    });

    // Create a mutable copy of the security config
    this.securityConfig = JSON.parse(JSON.stringify(this.settings.getValues()));
  }

  /**
   * Get global security configuration
   */
  getSecurityConfig(): GlobalSecurityConfig {
    return this.securityConfig;
  }

  /**
   * Get default command security settings
   */
  getCommandSecurity(): { mode?: 'whitelist' | 'blacklist'; list?: string[] } {
    return this.securityConfig.commands || {};
  }

  /**
   * Get default network security settings
   */
  getNetworkSecurity(): { mode?: 'whitelist' | 'blacklist'; list?: string[] } {
    return this.securityConfig.network || {};
  }
}

/**
 * Global security configuration instance
 */
let globalSecurityConfig: SecurityConfigManager | null = null;

/**
 * Initialize global security configuration
 */
export async function initializeSecurityConfig(configPath?: string): Promise<SecurityConfigManager> {
  if (!globalSecurityConfig) {
    globalSecurityConfig = new SecurityConfigManager(configPath);
    await globalSecurityConfig.initialize();
  }
  return globalSecurityConfig;
}

/**
 * Get global security configuration
 */
export function getSecurityConfig(): SecurityConfigManager | null {
  return globalSecurityConfig;
}
