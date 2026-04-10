/**
 * 配置管理
 * 优先级：用户配置 > 环境变量 > 全局配置
 */

import { initializeSecurityConfig } from '@agentskillmania/sandbox';

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
 * 加载配置
 */
export async function loadConfig(userConfig?: MCPServerConfig): Promise<MCPServerConfig> {
  // 1. 加载全局安全配置
  const securityConfig = await initializeSecurityConfig();
  const commandSecurity = securityConfig.getCommandSecurity();
  const networkSecurity = securityConfig.getNetworkSecurity();

  // 2. 从环境变量读取
  const envConfig = loadEnvConfig();

  // 3. 合并配置（优先级：user > env > global）
  return {
    timeout: userConfig?.timeout ?? envConfig.timeout ?? 5000,
    allowNetwork:
      userConfig?.allowNetwork ??
      envConfig.allowNetwork ??
      (networkSecurity.mode === 'whitelist' ||
        (networkSecurity.mode === 'blacklist' && (networkSecurity.list?.length ?? 0) > 0)),
    sandboxDir: userConfig?.sandboxDir ?? envConfig.sandboxDir ?? 'auto',
    commandMode: userConfig?.commandMode ?? commandSecurity.mode,
    commandList: userConfig?.commandList ?? commandSecurity.list,
    networkMode: userConfig?.networkMode ?? networkSecurity.mode,
    networkList: userConfig?.networkList ?? networkSecurity.list,
  };
}

/**
 * 从环境变量加载配置
 */
export function loadEnvConfig(): Partial<MCPServerConfig> {
  const config: Partial<MCPServerConfig> = {};

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

  return config;
}
