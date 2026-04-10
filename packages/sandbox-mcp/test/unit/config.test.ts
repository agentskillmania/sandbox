/**
 * 单元测试：MCP 配置管理
 * 测试环境变量加载和配置合并逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadEnvConfig, loadConfig, type MCPServerConfig } from '../../src/config.js';

describe('MCP Config: loadEnvConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('should load timeout from env', () => {
    process.env.SANDBOX_TIMEOUT = '10000';
    const config = loadEnvConfig();
    expect(config.timeout).toBe(10000);
  });

  it('should load allowNetwork from env', () => {
    process.env.SANDBOX_ALLOW_NETWORK = 'true';
    const config = loadEnvConfig();
    expect(config.allowNetwork).toBe(true);
  });

  it('should handle allowNetwork false', () => {
    process.env.SANDBOX_ALLOW_NETWORK = 'false';
    const config = loadEnvConfig();
    expect(config.allowNetwork).toBe(false);
  });

  it('should load sandboxDir from env', () => {
    process.env.SANDBOX_SANDBOX_DIR = '/custom/sandbox';
    const config = loadEnvConfig();
    expect(config.sandboxDir).toBe('/custom/sandbox');
  });

  it('should parse command mode whitelist', () => {
    process.env.SANDBOX_COMMAND_MODE = 'whitelist';
    const config = loadEnvConfig();
    expect(config.commandMode).toBe('whitelist');
  });

  it('should parse command mode blacklist', () => {
    process.env.SANDBOX_COMMAND_MODE = 'blacklist';
    const config = loadEnvConfig();
    expect(config.commandMode).toBe('blacklist');
  });

  it('should parse command list', () => {
    process.env.SANDBOX_COMMAND_LIST = 'ls,cat,echo';
    const config = loadEnvConfig();
    expect(config.commandList).toEqual(['ls', 'cat', 'echo']);
  });

  it('should parse network mode whitelist', () => {
    process.env.SANDBOX_NETWORK_MODE = 'whitelist';
    const config = loadEnvConfig();
    expect(config.networkMode).toBe('whitelist');
  });

  it('should parse network mode blacklist', () => {
    process.env.SANDBOX_NETWORK_MODE = 'blacklist';
    const config = loadEnvConfig();
    expect(config.networkMode).toBe('blacklist');
  });

  it('should parse network list', () => {
    process.env.SANDBOX_NETWORK_LIST = 'example.com,test.com';
    const config = loadEnvConfig();
    expect(config.networkList).toEqual(['example.com', 'test.com']);
  });

  it('should handle missing env vars', () => {
    // 清理所有相关环境变量
    delete process.env.SANDBOX_TIMEOUT;
    delete process.env.SANDBOX_ALLOW_NETWORK;
    delete process.env.SANDBOX_SANDBOX_DIR;
    delete process.env.SANDBOX_COMMAND_MODE;
    delete process.env.SANDBOX_COMMAND_LIST;
    delete process.env.SANDBOX_NETWORK_MODE;
    delete process.env.SANDBOX_NETWORK_LIST;

    const config = loadEnvConfig();
    expect(config).toEqual({});
  });

  it('should parse timeout as number', () => {
    process.env.SANDBOX_TIMEOUT = '5000';
    const config = loadEnvConfig();
    expect(typeof config.timeout).toBe('number');
  });

  it('should handle invalid timeout', () => {
    process.env.SANDBOX_TIMEOUT = 'invalid';
    const config = loadEnvConfig();
    expect(config.timeout).toBeNaN();
  });
});

describe('MCP Config: loadConfig integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // 清理环境变量
    delete process.env.SANDBOX_TIMEOUT;
    delete process.env.SANDBOX_ALLOW_NETWORK;
    delete process.env.SANDBOX_COMMAND_MODE;
    delete process.env.SANDBOX_COMMAND_LIST;
    delete process.env.SANDBOX_NETWORK_MODE;
    delete process.env.SANDBOX_NETWORK_LIST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when no config provided', async () => {
    const config = await loadConfig();
    expect(config.timeout).toBe(5000);
    expect(config.allowNetwork).toBeDefined();
  });

  it('should merge user config with defaults', async () => {
    const userConfig: MCPServerConfig = { timeout: 3000 };
    const config = await loadConfig(userConfig);
    expect(config.timeout).toBe(3000); // user config 优先
  });

  it('should handle undefined networkSecurity.list', async () => {
    // 测试空列表情况（修复 TS18048 错误的测试）
    const config = await loadConfig({});
    expect(config.allowNetwork).toBeDefined();
    expect(typeof config.allowNetwork).toBe('boolean');
  });

  it('should prioritize user config over env', async () => {
    process.env.SANDBOX_TIMEOUT = '10000';
    const userConfig: MCPServerConfig = { timeout: 2000 };
    const config = await loadConfig(userConfig);
    expect(config.timeout).toBe(2000);
  });

  it('should prioritize env over global config', async () => {
    process.env.SANDBOX_TIMEOUT = '8000';
    const config = await loadConfig({});
    expect(config.timeout).toBe(8000);
  });
});
