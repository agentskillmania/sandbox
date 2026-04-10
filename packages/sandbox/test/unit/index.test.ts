/**
 * 单元测试：主入口模块导出
 * 测试所有导出是否正确
 */

import { describe, it, expect } from 'vitest';

// 测试所有导出是否正确
describe('Module exports', () => {
  it('should export Sandbox class', async () => {
    const { Sandbox } = await import('../../src/index.js');
    expect(Sandbox).toBeDefined();
    expect(typeof Sandbox).toBe('function');
  });

  it('should export security config functions', async () => {
    const { SecurityConfigManager, initializeSecurityConfig, getSecurityConfig } =
      await import('../../src/index.js');

    expect(SecurityConfigManager).toBeDefined();
    expect(typeof SecurityConfigManager).toBe('function');
    expect(initializeSecurityConfig).toBeDefined();
    expect(typeof initializeSecurityConfig).toBe('function');
    expect(getSecurityConfig).toBeDefined();
    expect(typeof getSecurityConfig).toBe('function');
  });

  it('should export runtime functions', async () => {
    const {
      getRuntimeVersions,
      checkInstalledWasmtime,
      getWasmtimeExecutable,
      checkRuntimeReady,
      ensureRuntime,
    } = await import('../../src/index.js');

    expect(getRuntimeVersions).toBeDefined();
    expect(typeof getRuntimeVersions).toBe('function');

    expect(checkInstalledWasmtime).toBeDefined();
    expect(typeof checkInstalledWasmtime).toBe('function');

    expect(getWasmtimeExecutable).toBeDefined();
    expect(typeof getWasmtimeExecutable).toBe('function');

    expect(checkRuntimeReady).toBeDefined();
    expect(typeof checkRuntimeReady).toBe('function');

    expect(ensureRuntime).toBeDefined();
    expect(typeof ensureRuntime).toBe('function');
  });

  it('should export error classes', async () => {
    const { SecurityError, TimeoutError, ConfigError } = await import('../../src/index.js');

    expect(SecurityError).toBeDefined();
    expect(SecurityError.prototype).toBeInstanceOf(Error);

    expect(TimeoutError).toBeDefined();
    expect(TimeoutError.prototype).toBeInstanceOf(Error);

    expect(ConfigError).toBeDefined();
    expect(ConfigError.prototype).toBeInstanceOf(Error);
  });

  it('should export TypeScript types', async () => {
    // 类型导出测试（编译时检查）
    // 从 src/lib/types.js 导入类型进行验证
    const { ExecResult, SandboxConfig, GlobalSecurityConfig } =
      await import('../../src/lib/types.js');

    const execResult: ExecResult = {
      stdout: '',
      stderr: '',
      exitCode: 0,
    };
    expect(execResult).toBeDefined();

    const sandboxConfig: SandboxConfig = {
      timeout: 5000,
      allowNetwork: false,
    };
    expect(sandboxConfig).toBeDefined();

    const globalConfig: GlobalSecurityConfig = {
      commands: {
        mode: 'whitelist',
        list: ['ls', 'cat'],
      },
    };
    expect(globalConfig).toBeDefined();
  });
});
