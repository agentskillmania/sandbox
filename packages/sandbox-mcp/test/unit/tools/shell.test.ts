/**
 * 单元测试：run_shell 工具
 * 测试 shell 命令执行工具的各项功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runShellTool } from '../../../src/tools/shell.js';
import type { Sandbox } from '@agentskillmania/sandbox';

// Mock Sandbox 类
vi.mock('@agentskillmania/sandbox', () => ({
  Sandbox: vi.fn(),
}));

describe('run_shell tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = {
      runShell: vi.fn(),
    };
  });

  it('should execute simple command', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'hello world',
      stderr: '',
    });

    const result = await runShellTool.handler(mockSandbox, {
      command: 'echo',
      args: ['hello', 'world'],
    });

    expect(mockSandbox.runShell).toHaveBeenCalledWith('echo', ['hello', 'world']);
    expect(result.content[0].text).toContain('✅');
    expect(result.content[0].text).toContain('hello world');
    expect(result.isError).toBe(false);
  });

  it('should execute command with no arguments', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'test',
      stderr: '',
    });

    const result = await runShellTool.handler(mockSandbox, {
      command: 'pwd',
      args: [],
    });

    expect(mockSandbox.runShell).toHaveBeenCalledWith('pwd', []);
    expect(result.content[0].text).toContain('✅');
  });

  it('should handle command failure', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'command not found',
    });

    const result = await runShellTool.handler(mockSandbox, {
      command: 'invalid-command',
    });

    expect(result.content[0].text).toContain('❌');
    expect(result.content[0].text).toContain('Exit code: 1');
    expect(result.content[0].text).toContain('command not found');
    expect(result.isError).toBe(true);
  });

  it('should have correct tool definition', () => {
    expect(runShellTool.definition.name).toBe('run_shell');
    expect(runShellTool.definition.description).toBeDefined();
    expect(runShellTool.definition.inputSchema).toBeDefined();
    expect(runShellTool.definition.inputSchema.type).toBe('object');
  });

  it('should require command parameter in schema', () => {
    const schema = runShellTool.definition.inputSchema;
    expect(schema.properties?.command).toBeDefined();
    expect(schema.required).toContain('command');
  });

  it('should support optional args parameter', () => {
    const schema = runShellTool.definition.inputSchema;
    expect(schema.properties?.args).toBeDefined();
    expect(schema.required).not.toContain('args');
  });

  it('should not include timeout or allowNetwork in schema', () => {
    const schema = runShellTool.definition.inputSchema;
    expect(schema.properties?.timeout).toBeUndefined();
    expect(schema.properties?.allowNetwork).toBeUndefined();
  });

  it('should include stdout in success response', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'output line 1\noutput line 2',
      stderr: '',
    });

    const result = await runShellTool.handler(mockSandbox, {
      command: 'cat',
      args: ['file.txt'],
    });

    expect(result.content[0].text).toContain('STDOUT:');
    expect(result.content[0].text).toContain('output line 1');
  });

  it('should include both stdout and stderr in error response', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 2,
      stdout: 'some output',
      stderr: 'error message',
    });

    const result = await runShellTool.handler(mockSandbox, {
      command: 'failing-command',
    });

    expect(result.content[0].text).toContain('STDOUT:');
    expect(result.content[0].text).toContain('some output');
    expect(result.content[0].text).toContain('STDERR:');
    expect(result.content[0].text).toContain('error message');
  });
});
