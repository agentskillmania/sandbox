import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager, initializeGlobalConfig, getGlobalConfig } from '../../../src/lib/config.js';
import type { SandboxConfig } from '../../../src/lib/types.js';

// Mock @agentskillmania/settings-yaml
vi.mock('@agentskillmania/settings-yaml', () => ({
  Settings: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getValues: vi.fn(() => ({
      sandboxDir: '.sandbox',
      modules: {
        busybox: {
          enabled: true,
          wasmPath: './wasm/busybox.wasm',
          commands: {
            mode: 'blacklist',
            list: ['rm', 'format'],
          },
        },
        python: {
          enabled: true,
          wasmPath: './wasm/micropython.wasm',
        },
      },
      network: {
        enabled: false,
        allowlist: ['*.github.com'],
        blocklist: ['*.malicious.com'],
      },
      security: {
        timeout: 5000,
      },
    })),
  })),
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('constructor', () => {
    it('should create ConfigManager instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('initialize', () => {
    it('should initialize configuration', async () => {
      await configManager.initialize();
      const config = configManager.getConfig();

      expect(config).toHaveProperty('sandboxDir');
      expect(config).toHaveProperty('modules');
      expect(config).toHaveProperty('network');
      expect(config).toHaveProperty('security');
    });

    it('should apply CLI argument overrides', async () => {
      const override: Partial<SandboxConfig> = {
        sandboxDir: '.custom-sandbox',
        timeout: 10000,
        allowNetwork: true,
      };

      await configManager.initialize({ override });
      const config = configManager.getConfig();

      expect(config.sandboxDir).toBe('.custom-sandbox');
      expect(config.security.timeout).toBe(10000);
      expect(config.network.enabled).toBe(true);
    });

    it('should handle command allowlist correctly', async () => {
      const override: Partial<SandboxConfig> = {
        commandAllowlist: ['ls', 'cat', 'echo'],
      };

      await configManager.initialize({ override });
      const sandboxConfig = configManager.getSandboxConfig();

      expect(sandboxConfig.commandAllowlist).toEqual(['ls', 'cat', 'echo']);
    });

    it('should handle command blocklist correctly', async () => {
      const override: Partial<SandboxConfig> = {
        commandBlocklist: ['rm', 'format', 'wipe'],
      };

      await configManager.initialize({ override });
      const sandboxConfig = configManager.getSandboxConfig();

      expect(sandboxConfig.commandBlocklist).toEqual(['rm', 'format', 'wipe']);
    });

    it('should handle network allowlist correctly', async () => {
      const override: Partial<SandboxConfig> = {
        networkAllowlist: ['api.github.com', 'registry.npmjs.org'],
      };

      await configManager.initialize({ override });
      const sandboxConfig = configManager.getSandboxConfig();

      expect(sandboxConfig.networkAllowlist).toEqual(['api.github.com', 'registry.npmjs.org']);
    });
  });

  describe('getSandboxConfig', () => {
    it('should return correct Sandbox configuration', async () => {
      await configManager.initialize();
      const sandboxConfig = configManager.getSandboxConfig();

      expect(sandboxConfig).toMatchObject({
        sandboxDir: '.sandbox',
        timeout: 5000,
        allowNetwork: false,
        commandAllowlist: [],
        commandBlocklist: ['rm', 'format'],
        networkAllowlist: ['*.github.com'],
        networkBlocklist: ['*.malicious.com'],
      });
    });
  });

  describe('getModuleConfig', () => {
    it('should return busybox configuration', async () => {
      await configManager.initialize();
      const busyboxConfig = configManager.getModuleConfig('busybox');

      expect(busyboxConfig).toMatchObject({
        enabled: true,
        wasmPath: './wasm/busybox.wasm',
        commands: {
          mode: 'blacklist',
          list: ['rm', 'format'],
        },
      });
    });

    it('should return python configuration', async () => {
      await configManager.initialize();
      const pythonConfig = configManager.getModuleConfig('python');

      expect(pythonConfig).toMatchObject({
        enabled: true,
        wasmPath: './wasm/micropython.wasm',
      });
    });
  });
});

describe('global configuration', () => {
  it('should initialize global configuration', async () => {
    const config = await initializeGlobalConfig();

    expect(config).toBeInstanceOf(ConfigManager);
    expect(getGlobalConfig()).toBe(config);
  });

  it('should reuse existing global configuration', async () => {
    const config1 = await initializeGlobalConfig();
    const config2 = await initializeGlobalConfig();

    expect(config1).toBe(config2);
  });
});
