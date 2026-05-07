/**
 * 单元测试：run_python 工具
 * 测试 Python 代码执行工具的各项功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runPythonTool } from '../../../src/tools/python.js';
import type { Sandbox } from '@agentskillmania/sandbox';

// Mock Sandbox 类
vi.mock('@agentskillmania/sandbox', () => ({
  Sandbox: vi.fn(),
}));

describe('run_python tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = {
      run: vi.fn(),
    };
  });

  it('should execute Python code via sandbox.run', async () => {
    mockSandbox.run.mockResolvedValue({
      exitCode: 0,
      stdout: '42',
      stderr: '',
    });

    const result = await runPythonTool.handler(mockSandbox, {
      code: 'print(2 + 2)',
    });

    expect(mockSandbox.run).toHaveBeenCalledWith("python -c 'print(2 + 2)'");
    expect(result.content[0].text).toContain('✅');
    expect(result.content[0].text).toContain('42');
    expect(result.isError).toBe(false);
  });

  it('should execute multi-line Python code', async () => {
    const code = 'x = 10\ny = 20\nprint(x + y)';
    mockSandbox.run.mockResolvedValue({
      exitCode: 0,
      stdout: '30',
      stderr: '',
    });

    const result = await runPythonTool.handler(mockSandbox, { code });

    expect(mockSandbox.run).toHaveBeenCalledWith("python -c 'x = 10\ny = 20\nprint(x + y)'");
    expect(result.content[0].text).toContain('30');
  });

  it('should handle Python errors', async () => {
    mockSandbox.run.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'SyntaxError: invalid syntax',
    });

    const result = await runPythonTool.handler(mockSandbox, {
      code: 'invalid python code here',
    });

    expect(result.content[0].text).toContain('❌');
    expect(result.content[0].text).toContain('exit code: 1');
    expect(result.content[0].text).toContain('SyntaxError: invalid syntax');
    expect(result.isError).toBe(true);
  });

  it('should have correct tool definition', () => {
    expect(runPythonTool.definition.name).toBe('run_python');
    expect(runPythonTool.definition.description).toBeDefined();
    expect(runPythonTool.definition.inputSchema).toBeDefined();
    expect(runPythonTool.definition.inputSchema.type).toBe('object');
  });

  it('should require code parameter in schema', () => {
    const schema = runPythonTool.definition.inputSchema;
    expect(schema.properties?.code).toBeDefined();
    expect(schema.required).toContain('code');
  });

  it('should not include timeout or allowNetwork in schema', () => {
    const schema = runPythonTool.definition.inputSchema;
    expect(schema.properties?.timeout).toBeUndefined();
    expect(schema.properties?.allowNetwork).toBeUndefined();
  });

  it('should include stdout in success response', async () => {
    mockSandbox.run.mockResolvedValue({
      exitCode: 0,
      stdout: 'Hello from Python\n42',
      stderr: '',
    });

    const result = await runPythonTool.handler(mockSandbox, {
      code: 'print("Hello from Python"); print(42)',
    });

    expect(result.content[0].text).toContain('Output:');
    expect(result.content[0].text).toContain('Hello from Python');
    expect(result.content[0].text).toContain('42');
  });

  it('should include both stdout and stderr in error response', async () => {
    mockSandbox.run.mockResolvedValue({
      exitCode: 1,
      stdout: 'partial output',
      stderr: 'Traceback (most recent call last):\nError: something went wrong',
    });

    const result = await runPythonTool.handler(mockSandbox, {
      code: 'raise Exception("test")',
    });

    expect(result.content[0].text).toContain('Output:');
    expect(result.content[0].text).toContain('partial output');
    expect(result.content[0].text).toContain('Error:');
    expect(result.content[0].text).toContain('Traceback');
  });
});
