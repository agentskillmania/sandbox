/**
 * MCP Server 实现
 * 提供 tools: run_shell, run_python, run_script, read_file, write_file, list_files, delete_file
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Sandbox } from '@agentskillmania/sandbox';
import { SandboxConfig } from '@agentskillmania/sandbox';
import { createToolHandlers } from './tools/index.js';

export interface MCPServerConfig {
  timeout?: number;
  allowNetwork?: boolean;
  sandboxDir?: string;
  commandMode?: 'blacklist' | 'whitelist';
  commandList?: string[];
  networkMode?: 'blacklist' | 'whitelist';
  networkList?: string[];
}

/**
 * 创建 MCP server 实例
 */
export function createMCPServer(userConfig?: MCPServerConfig) {
  // 加载配置（环境变量）
  const config = loadConfigFromEnv(userConfig);

  // 创建 Sandbox 实例
  const sandbox = new Sandbox({
    timeout: config.timeout,
    allowNetwork: config.allowNetwork,
    sandboxDir: config.sandboxDir,
    commandMode: config.commandMode,
    commandList: config.commandList,
    networkMode: config.networkMode,
    networkList: config.networkList,
  } as SandboxConfig);

  // 创建 MCP server
  const server = new Server(
    {
      name: '@agentskillmania/sandbox-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 注册 tool handlers
  const toolHandlers = createToolHandlers(sandbox);

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolHandlers.listTools(),
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // 每次调用前检查 runtime（容错机制）
    const { checkRuntimeReady, ensureRuntime } = await import('@agentskillmania/sandbox');
    const runtimeCheck = checkRuntimeReady();
    if (!runtimeCheck.ready) {
      await ensureRuntime();
    }

    // 执行 tool
    return await toolHandlers.callTool(name, args);
  });

  return server;
}

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(userConfig?: MCPServerConfig): MCPServerConfig {
  const config: MCPServerConfig = {
    timeout: 5000,
    allowNetwork: false,
    sandboxDir: '.sandbox-mcp',
  };

  // Sandbox 基础配置
  if (process.env.SANDBOX_TIMEOUT) {
    config.timeout = parseInt(process.env.SANDBOX_TIMEOUT, 10);
  }
  if (process.env.SANDBOX_ALLOW_NETWORK) {
    config.allowNetwork = process.env.SANDBOX_ALLOW_NETWORK === 'true';
  }
  if (process.env.SANDBOX_SANDBOX_DIR) {
    config.sandboxDir = process.env.SANDBOX_SANDBOX_DIR;
  }

  // 命令安全策略
  if (process.env.SANDBOX_COMMAND_MODE) {
    config.commandMode = process.env.SANDBOX_COMMAND_MODE as 'blacklist' | 'whitelist';
  }
  if (process.env.SANDBOX_COMMAND_LIST) {
    config.commandList = process.env.SANDBOX_COMMAND_LIST.split(',');
  }

  // 网络安全策略
  if (process.env.SANDBOX_NETWORK_MODE) {
    config.networkMode = process.env.SANDBOX_NETWORK_MODE as 'blacklist' | 'whitelist';
  }
  if (process.env.SANDBOX_NETWORK_LIST) {
    config.networkList = process.env.SANDBOX_NETWORK_LIST.split(',');
  }

  // 合并用户配置
  if (userConfig) {
    Object.assign(config, userConfig);
  }

  return config;
}
