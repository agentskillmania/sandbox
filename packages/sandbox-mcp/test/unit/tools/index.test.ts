/**
 * 单元测试：工具处理器注册表
 * 测试工具注册、列表和调用功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolHandlers } from '../../../src/tools/index.js';
import type { Sandbox } from '@agentskillmania/sandbox';

// Mock 所有工具模块
vi.mock('../../../src/tools/shell.js', () => ({
  runShellTool: {
    definition: {
      name: 'run_shell',
      description: 'Execute shell commands',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'shell output' }],
    }),
  },
}));

vi.mock('../../../src/tools/python.js', () => ({
  runPythonTool: {
    definition: {
      name: 'run_python',
      description: 'Execute Python code',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'python output' }],
    }),
  },
}));

vi.mock('../../../src/tools/script.js', () => ({
  runScriptTool: {
    definition: {
      name: 'run_script',
      description: 'Execute scripts',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'script output' }],
    }),
  },
}));

vi.mock('../../../src/tools/file.js', () => ({
  readFileTool: {
    definition: {
      name: 'read_file',
      description: 'Read file',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'file content' }],
    }),
  },
  writeFileTool: {
    definition: {
      name: 'write_file',
      description: 'Write file',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'file written' }],
    }),
  },
  listFilesTool: {
    definition: {
      name: 'list_files',
      description: 'List files',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'files listed' }],
    }),
  },
  deleteFileTool: {
    definition: {
      name: 'delete_file',
      description: 'Delete file',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'file deleted' }],
    }),
  },
}));

describe('createToolHandlers', () => {
  let mockSandbox: Sandbox;

  beforeEach(() => {
    mockSandbox = {
      runShell: vi.fn(),
      runPython: vi.fn(),
    } as any;
  });

  it('should create tool handlers instance', () => {
    const handlers = createToolHandlers(mockSandbox);
    expect(handlers).toBeDefined();
    expect(typeof handlers.listTools).toBe('function');
    expect(typeof handlers.callTool).toBe('function');
  });

  it('should list all available tools', () => {
    const handlers = createToolHandlers(mockSandbox);
    const tools = handlers.listTools();

    expect(tools).toHaveLength(7);
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should include correct tool names', () => {
    const handlers = createToolHandlers(mockSandbox);
    const tools = handlers.listTools();
    const toolNames = tools.map((t: any) => t.name);

    expect(toolNames).toEqual([
      'run_shell',
      'run_python',
      'run_script',
      'read_file',
      'write_file',
      'list_files',
      'delete_file',
    ]);
  });

  it('should provide tool definitions with required fields', () => {
    const handlers = createToolHandlers(mockSandbox);
    const tools = handlers.listTools();

    tools.forEach((tool: any) => {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  it('should dispatch run_shell to correct handler', async () => {
    const { runShellTool } = await import('../../../src/tools/shell.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('run_shell', { command: 'echo test' });

    expect(runShellTool.handler).toHaveBeenCalled();
  });

  it('should dispatch run_python to correct handler', async () => {
    const { runPythonTool } = await import('../../../src/tools/python.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('run_python', { code: 'print(1)' });

    expect(runPythonTool.handler).toHaveBeenCalled();
  });

  it('should dispatch run_script to correct handler', async () => {
    const { runScriptTool } = await import('../../../src/tools/script.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('run_script', { language: 'sh', content: 'echo test' });

    expect(runScriptTool.handler).toHaveBeenCalled();
  });

  it('should dispatch read_file to correct handler', async () => {
    const { readFileTool } = await import('../../../src/tools/file.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('read_file', { path: 'test.txt' });

    expect(readFileTool.handler).toHaveBeenCalled();
  });

  it('should dispatch write_file to correct handler', async () => {
    const { writeFileTool } = await import('../../../src/tools/file.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('write_file', { path: 'out.txt', content: 'test' });

    expect(writeFileTool.handler).toHaveBeenCalled();
  });

  it('should dispatch list_files to correct handler', async () => {
    const { listFilesTool } = await import('../../../src/tools/file.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('list_files', { path: '.' });

    expect(listFilesTool.handler).toHaveBeenCalled();
  });

  it('should dispatch delete_file to correct handler', async () => {
    const { deleteFileTool } = await import('../../../src/tools/file.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('delete_file', { path: 'temp.txt' });

    expect(deleteFileTool.handler).toHaveBeenCalled();
  });

  it('should handle unknown tool name', async () => {
    const handlers = createToolHandlers(mockSandbox);

    const result = await handlers.callTool('unknown_tool' as any, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should pass sandbox instance to tool handlers', async () => {
    const { runShellTool } = await import('../../../src/tools/shell.js');
    const handlers = createToolHandlers(mockSandbox);

    await handlers.callTool('run_shell', { command: 'test' });

    // 验证 sandbox 实例被传递给处理器
    expect(runShellTool.handler).toHaveBeenCalledWith(mockSandbox, { command: 'test' });
  });

  it('should pass args to tool handlers', async () => {
    const { runShellTool } = await import('../../../src/tools/shell.js');
    const handlers = createToolHandlers(mockSandbox);

    const args = { command: 'ls', args: ['-la'] };
    await handlers.callTool('run_shell', args);

    expect(runShellTool.handler).toHaveBeenCalledWith(mockSandbox, args);
  });

  it('should return handler results', async () => {
    const handlers = createToolHandlers(mockSandbox);
    const result = await handlers.callTool('run_shell', { command: 'test' });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });
});
