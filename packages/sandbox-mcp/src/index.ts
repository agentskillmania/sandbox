#!/usr/bin/env node
/**
 * @agentskillmania/sandbox-mcp - MCP Server
 *
 * Model Context Protocol server that provides tools for executing
 * Shell commands and Python code in a secure WASM sandbox.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMCPServer } from './server.js';
import { ensureRuntime } from '@agentskillmania/sandbox';

async function main() {
  // 确保 runtime 已安装
  await ensureRuntime();

  // 创建并启动 MCP server
  const server = createMCPServer();

  // 使用 stdio transport（适合 Claude Desktop 等）
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🚀 @agentskillmania/sandbox-mcp MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
