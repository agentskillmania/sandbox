/**
 * 单元测试：MCP 服务器
 * 测试服务器创建、配置传递和工具请求处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMCPServer } from '../../src/server.js';
import { Sandbox } from '@agentskillmania/sandbox';

vi.mock('@agentskillmania/sandbox', () => ({
  Sandbox: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'test output',
      stderr: '',
    }),
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
    getSandboxDir: vi.fn().mockReturnValue('.sandbox-mcp'),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create server instance with default config', () => {
    const server = createMCPServer();
    expect(server).toBeDefined();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 600_000,
        allowNetwork: false,
        sandboxDir: '.sandbox-mcp',
      })
    );
  });

  it('should pass custom config to sandbox', () => {
    createMCPServer({
      timeout: 10000,
      allowNetwork: true,
      sandboxDir: '/custom/dir',
    });
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 10000,
        allowNetwork: true,
        sandboxDir: '/custom/dir',
      })
    );
  });

  it('should pass command security config to sandbox', () => {
    createMCPServer({
      commandPolicy: { mode: 'whitelist', list: ['ls', 'cat'] },
    });
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        commandPolicy: { mode: 'whitelist', list: ['ls', 'cat'] },
      })
    );
  });

  it('should pass network security config to sandbox', () => {
    createMCPServer({
      networkPolicy: { mode: 'blacklist', list: ['example.com'] },
    });
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        networkPolicy: { mode: 'blacklist', list: ['example.com'] },
      })
    );
  });
});

describe('MCP Server: environment config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.SANDBOX_TIMEOUT;
    delete process.env.SANDBOX_ALLOW_NETWORK;
    delete process.env.SANDBOX_SANDBOX_DIR;
    delete process.env.SANDBOX_COMMAND_MODE;
    delete process.env.SANDBOX_COMMAND_LIST;
    delete process.env.SANDBOX_NETWORK_MODE;
    delete process.env.SANDBOX_NETWORK_LIST;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load timeout from env', () => {
    process.env.SANDBOX_TIMEOUT = '10000';
    createMCPServer();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10000 }));
  });

  it('should load allowNetwork from env', () => {
    process.env.SANDBOX_ALLOW_NETWORK = 'true';
    createMCPServer();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({ allowNetwork: true })
    );
  });

  it('should load sandboxDir from env', () => {
    process.env.SANDBOX_SANDBOX_DIR = '/custom/sandbox';
    createMCPServer();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxDir: '/custom/sandbox' })
    );
  });

  it('should load command security from env', () => {
    process.env.SANDBOX_COMMAND_MODE = 'whitelist';
    process.env.SANDBOX_COMMAND_LIST = 'ls,cat,echo';
    createMCPServer();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        commandPolicy: { mode: 'whitelist', list: ['ls', 'cat', 'echo'] },
      })
    );
  });

  it('should load network security from env', () => {
    process.env.SANDBOX_NETWORK_MODE = 'blacklist';
    process.env.SANDBOX_NETWORK_LIST = 'example.com,test.com';
    createMCPServer();
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(
      expect.objectContaining({
        networkPolicy: { mode: 'blacklist', list: ['example.com', 'test.com'] },
      })
    );
  });

  it('should let user config override env config', () => {
    process.env.SANDBOX_TIMEOUT = '3000';
    createMCPServer({ timeout: 10000 });
    expect(vi.mocked(Sandbox)).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10000 }));
  });
});

describe('MCP Server: tool handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check runtime before tool execution when not ready', async () => {
    const { checkRuntimeReady, ensureRuntime } = await import('@agentskillmania/sandbox');
    vi.mocked(checkRuntimeReady).mockReturnValue({ ready: false });
    vi.mocked(ensureRuntime).mockResolvedValue(undefined);

    const server = createMCPServer();
    const handler = (server as any)._requestHandlers.get('tools/call');
    const result = await handler({
      method: 'tools/call',
      params: { name: 'run_shell', arguments: { command: 'echo test' } },
    });

    expect(vi.mocked(ensureRuntime)).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });

  it('should skip ensureRuntime when runtime is ready', async () => {
    const { checkRuntimeReady, ensureRuntime } = await import('@agentskillmania/sandbox');
    vi.mocked(checkRuntimeReady).mockReturnValue({ ready: true });

    const server = createMCPServer();
    const handler = (server as any)._requestHandlers.get('tools/call');
    await handler({
      method: 'tools/call',
      params: { name: 'run_shell', arguments: { command: 'echo test' } },
    });

    expect(vi.mocked(ensureRuntime)).not.toHaveBeenCalled();
  });

  it('should handle tool call with no arguments', async () => {
    const server = createMCPServer();
    const handler = (server as any)._requestHandlers.get('tools/call');
    const result = await handler({
      method: 'tools/call',
      params: { name: 'list_files', arguments: undefined },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });
});
