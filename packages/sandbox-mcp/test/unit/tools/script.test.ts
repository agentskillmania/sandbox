/**
 * 单元测试：run_script 工具
 * 测试脚本执行工具的各项功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runScriptTool } from '../../../src/tools/script.js';
import type { Sandbox } from '@agentskillmania/sandbox';
import { writeFile, unlink } from 'node:fs/promises';

// Mock Sandbox 类和文件系统
vi.mock('@agentskillmania/sandbox', () => ({
  Sandbox: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

describe('run_script tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = {
      runShell: vi.fn(),
      config: {},
    };
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(unlink).mockResolvedValue(undefined);
  });

  it('should execute shell script', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'hello world',
      stderr: '',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo hello world',
    });

    expect(writeFile).toHaveBeenCalled();
    expect(mockSandbox.runShell).toHaveBeenCalledWith(
      'busybox',
      expect.arrayContaining([expect.stringContaining('temp_script.sh')])
    );
    expect(result.content[0].text).toContain('✅');
    expect(result.content[0].text).toContain('hello world');
  });

  it('should execute python script', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: '42',
      stderr: '',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'py',
      content: 'print(42)',
    });

    expect(writeFile).toHaveBeenCalled();
    expect(mockSandbox.runShell).toHaveBeenCalledWith(
      'busybox',
      expect.arrayContaining([expect.stringContaining('temp_script.py')])
    );
    expect(result.content[0].text).toContain('42');
  });

  it('should handle script errors', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'script error: command not found',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'invalidcommand',
    });

    expect(result.content[0].text).toContain('❌');
    expect(result.content[0].text).toContain('exit code: 1');
    expect(result.content[0].text).toContain('script error');
    expect(result.isError).toBe(true);
  });

  it('should handle timeout option', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'test',
      stderr: '',
    });

    await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo test',
      timeout: 5000,
    });

    expect(mockSandbox.config?.timeout).toBe(5000);
  });

  it('should clean up temp script file after execution', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'test',
      stderr: '',
    });

    await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo test',
    });

    expect(unlink).toHaveBeenCalled();
  });

  it('should handle cleanup errors gracefully', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'test',
      stderr: '',
    });
    vi.mocked(unlink).mockRejectedValue(new Error('File not found'));

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo test',
    });

    // 应该仍然成功，即使清理失败
    expect(result.content[0].text).toContain('✅');
  });

  it('should have correct tool definition', () => {
    expect(runScriptTool.definition.name).toBe('run_script');
    expect(runScriptTool.definition.description).toBeDefined();
    expect(runScriptTool.definition.inputSchema).toBeDefined();
    expect(runScriptTool.definition.inputSchema.type).toBe('object');
  });

  it('should require language parameter in schema', () => {
    const schema = runScriptTool.definition.inputSchema;
    expect(schema.properties?.language).toBeDefined();
    expect(schema.required).toContain('language');
  });

  it('should require content parameter in schema', () => {
    const schema = runScriptTool.definition.inputSchema;
    expect(schema.properties?.content).toBeDefined();
    expect(schema.required).toContain('content');
  });

  it('should support optional timeout parameter', () => {
    const schema = runScriptTool.definition.inputSchema;
    expect(schema.properties?.timeout).toBeDefined();
    expect(schema.required).not.toContain('timeout');
  });

  it('should support sh and py languages', () => {
    const schema = runScriptTool.definition.inputSchema;
    const languageEnum = schema.properties?.language?.enum;
    expect(languageEnum).toContain('sh');
    expect(languageEnum).toContain('py');
  });

  it('should include stdout in success response', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'line 1\nline 2',
      stderr: '',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo line 1; echo line 2',
    });

    expect(result.content[0].text).toContain('Output:');
    expect(result.content[0].text).toContain('line 1');
    expect(result.content[0].text).toContain('line 2');
  });

  it('should include both stdout and stderr in error response', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 2,
      stdout: 'before error',
      stderr: 'error occurred',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'exit 2',
    });

    expect(result.content[0].text).toContain('Output:');
    expect(result.content[0].text).toContain('before error');
    expect(result.content[0].text).toContain('Error:');
    expect(result.content[0].text).toContain('error occurred');
  });

  it('should handle empty script content', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: '',
    });

    expect(result.content[0].text).toContain('✅');
  });

  it('should handle multi-line shell scripts', async () => {
    mockSandbox.runShell.mockResolvedValue({
      exitCode: 0,
      stdout: 'done',
      stderr: '',
    });

    const result = await runScriptTool.handler(mockSandbox, {
      language: 'sh',
      content: 'echo line1\necho line2\necho done',
    });

    expect(result.content[0].text).toContain('✅');
  });
});
