import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityConfigManager, initializeSecurityConfig, getSecurityConfig } from '../../../src/lib/config.js';

// Mock @agentskillmania/settings-yaml
vi.mock('@agentskillmania/settings-yaml', () => ({
  Settings: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getValues: vi.fn(() => ({
      commands: {
        mode: 'blacklist',
        list: ['rm', 'format', 'fdisk'],
      },
      network: {
        defaultEnabled: false,
        allowlist: ['*.github.com', 'registry.npmjs.org'],
        blocklist: ['*.malicious.com', '*.ads.com'],
      },
    })),
  })),
}));

describe('SecurityConfigManager', () => {
  let securityConfig: SecurityConfigManager;

  beforeEach(() => {
    // Reset global config
    vi.clearAllMocks();
    securityConfig = new SecurityConfigManager();
  });

  describe('constructor', () => {
    it('should create SecurityConfigManager instance', () => {
      expect(securityConfig).toBeInstanceOf(SecurityConfigManager);
    });
  });

  describe('initialize', () => {
    it('should initialize security configuration', async () => {
      await securityConfig.initialize();
      const config = securityConfig.getSecurityConfig();

      expect(config).toHaveProperty('commands');
      expect(config).toHaveProperty('network');
    });
  });

  describe('getCommandSecurity', () => {
    it('should return command security settings', async () => {
      await securityConfig.initialize();
      const commandSecurity = securityConfig.getCommandSecurity();

      expect(commandSecurity).toEqual({
        mode: 'blacklist',
        list: ['rm', 'format', 'fdisk'],
      });
    });
  });

  describe('getNetworkSecurity', () => {
    it('should return network security settings', async () => {
      await securityConfig.initialize();
      const networkSecurity = securityConfig.getNetworkSecurity();

      expect(networkSecurity).toEqual({
        defaultEnabled: false,
        allowlist: ['*.github.com', 'registry.npmjs.org'],
        blocklist: ['*.malicious.com', '*.ads.com'],
      });
    });
  });
});

describe('global security configuration', () => {
  it('should initialize global security configuration', async () => {
    const config = await initializeSecurityConfig();

    expect(config).toBeInstanceOf(SecurityConfigManager);
    expect(getSecurityConfig()).toBe(config);
  });

  it('should reuse existing global configuration', async () => {
    const config1 = await initializeSecurityConfig();
    const config2 = await initializeSecurityConfig();

    expect(config1).toBe(config2);
  });
});
