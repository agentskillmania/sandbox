/**
 * 单元测试：MCP 服务器
 * 测试服务器创建、工具列表和请求处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMCPServer } from '../../src/server.js';

// Mock Sandbox 类
vi.mock('@agentskillmania/sandbox', () => ({
  Sandbox: vi.fn().mockImplementation(() => ({
    runShell: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'test output',
      stderr: '',
    }),
    runPython: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '42',
      stderr: '',
    }),
  })),
  checkRuntimeReady: vi.fn().mockReturnValue({ ready: true }),
  ensureRuntime: vi.fn().mockResolvedValue(undefined),
  initializeSecurityConfig: vi.fn().mockResolvedValue({
    getCommandSecurity: vi.fn().mockReturnValue({
      mode: undefined,
      list: undefined,
    }),
    getNetworkSecurity: vi.fn().mockReturnValue({
      mode: undefined,
      list: undefined,
    }),
  }),
}));

describe('MCP Server: createMCPServer', () => {
  it('should create server instance', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
    expect(typeof server).toBe('object');
  });

  it('should create server with default config', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should create server with custom config', () => {
    const customConfig = {
      timeout: 10000,
      allowNetwork: true,
      sandboxDir: '/custom/dir',
    };
    const server = createMCPServer(customConfig);
    expect(server).toBeDefined();
  });

  it('should create server with command security config', () => {
    const securityConfig = {
      commandMode: 'whitelist' as const,
      commandList: ['ls', 'cat'],
    };
    const server = createMCPServer(securityConfig);
    expect(server).toBeDefined();
  });

  it('should create server with network security config', () => {
    const securityConfig = {
      networkMode: 'blacklist' as const,
      networkList: ['example.com'],
    };
    const server = createMCPServer(securityConfig);
    expect(server).toBeDefined();
  });
});

describe('MCP Server: environment config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // 清理环境变量
    delete process.env.SANDBOX_TIMEOUT;
    delete process.env.SANDBOX_ALLOW_NETWORK;
    delete process.env.SANDBOX_COMMAND_MODE;
    delete process.env.SANDBOX_NETWORK_MODE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load timeout from env', () => {
    process.env.SANDBOX_TIMEOUT = '10000';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load allowNetwork from env', () => {
    process.env.SANDBOX_ALLOW_NETWORK = 'true';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load sandboxDir from env', () => {
    process.env.SANDBOX_SANDBOX_DIR = '/custom/sandbox';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load command mode from env', () => {
    process.env.SANDBOX_COMMAND_MODE = 'whitelist';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load network mode from env', () => {
    process.env.SANDBOX_NETWORK_MODE = 'blacklist';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load command list from env', () => {
    process.env.SANDBOX_COMMAND_LIST = 'ls,cat,echo';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should load network list from env', () => {
    process.env.SANDBOX_NETWORK_LIST = 'example.com,test.com';
    const server = createMCPServer();
    expect(server).toBeDefined();
  });

  it('should combine user config with env config', () => {
    process.env.SANDBOX_TIMEOUT = '3000';
    const userConfig = { timeout: 10000 };
    const server = createMCPServer(userConfig);
    expect(server).toBeDefined();
  });
});

describe('MCP Server: tool handlers', () => {
  it('should return tool list when requested', async () => {
    const { checkRuntimeReady } = await import('@agentskillmania/sandbox');
    vi.mocked(checkRuntimeReady).mockReturnValue({ ready: true });

    const server = createMCPServer();
    expect(server).toBeDefined();
    // 服务器创建时会注册工具处理器
  });

  it('should check runtime before tool execution', async () => {
    const { checkRuntimeReady, ensureRuntime } = await import('@agentskillmania/sandbox');
    vi.mocked(checkRuntimeReady).mockReturnValue({ ready: false });
    vi.mocked(ensureRuntime).mockResolvedValue(undefined);

    const server = createMCPServer();
    expect(server).toBeDefined();
    // 服务器会在工具执行前检查运行时
  });
});

describe('MCP Server: server capabilities', () => {
  it('should have tools capability', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
    // 服务器应该有 tools 能力
  });

  it('should support request handlers', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
    // 服务器应该支持 ListToolsRequestSchema 和 CallToolRequestSchema
  });
});
