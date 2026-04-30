/**
 * MCP Server 配置接口
 * 与底层 SandboxConfig 的字段命名保持一致
 */

export interface MCPServerConfig {
  timeout?: number;
  allowNetwork?: boolean;
  sandboxDir?: string;
  commandPolicy?: { mode: 'blacklist' | 'whitelist'; list: string[] };
  networkPolicy?: { mode: 'blacklist' | 'whitelist'; list: string[] };
}
