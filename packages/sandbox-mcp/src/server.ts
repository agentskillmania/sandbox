/**
 * MCP Server 实现
 * 提供 tools: run_shell, run_python, run_script, read_file, write_file, list_files, delete_file
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Sandbox, checkRuntimeReady, ensureRuntime } from '@agentskillmania/sandbox';
import { createToolHandlers } from './tools/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { MCPServerConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

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
    commandPolicy: config.commandPolicy,
    networkPolicy: config.networkPolicy,
  });

  // 创建 MCP server
  const server = new Server(
    {
      name: '@agentskillmania/sandbox-mcp',
      version: pkg.version,
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

    // Check runtime before each call (resilience mechanism)
    const runtimeCheck = checkRuntimeReady();
    if (!runtimeCheck.ready) {
      await ensureRuntime();
    }

    // 执行 tool
    return await toolHandlers.callTool(name, args ?? {});
  });

  return server;
}

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(userConfig?: MCPServerConfig): MCPServerConfig {
  const config: MCPServerConfig = {
    timeout: 600_000,
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
  const commandMode = process.env.SANDBOX_COMMAND_MODE;
  const commandList = process.env.SANDBOX_COMMAND_LIST?.split(',').filter(Boolean);
  if (commandMode && commandList?.length) {
    config.commandPolicy = { mode: commandMode as 'blacklist' | 'whitelist', list: commandList };
  }

  // 网络安全策略（预留，WASI preview2 暂不支持域名级过滤）
  const networkMode = process.env.SANDBOX_NETWORK_MODE;
  const networkList = process.env.SANDBOX_NETWORK_LIST?.split(',').filter(Boolean);
  if (networkMode && networkList?.length) {
    config.networkPolicy = { mode: networkMode as 'blacklist' | 'whitelist', list: networkList };
  }

  // 合并用户配置
  if (userConfig) {
    Object.assign(config, userConfig);
  }

  return config;
}
