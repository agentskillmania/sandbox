/**
 * 单元测试：文件操作工具
 * 测试 read_file, write_file, list_files, delete_file 工具
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readFileTool,
  writeFileTool,
  listFilesTool,
  deleteFileTool,
} from '../../../src/tools/file.js';
import type { Sandbox } from '@agentskillmania/sandbox';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Mock 文件系统
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}));

describe('read_file tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = { sandboxDir: '.sandbox-test' };
  });

  it('should read file content', async () => {
    vi.mocked(readFile).mockResolvedValue('hello world');

    const result = await readFileTool.handler(mockSandbox, {
      path: 'test.txt',
    });

    expect(readFile).toHaveBeenCalledWith('.sandbox-test/test.txt', 'utf-8');
    expect(result.content[0].text).toContain('📄 File: test.txt');
    expect(result.content[0].text).toContain('hello world');
  });

  it('should handle file not found', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await readFileTool.handler(mockSandbox, {
      path: 'nonexistent.txt',
    });

    expect(result.content[0].text).toContain('❌ Failed to read file');
    expect(result.isError).toBe(true);
  });

  it('should handle read errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

    const result = await readFileTool.handler(mockSandbox, {
      path: 'restricted.txt',
    });

    expect(result.content[0].text).toContain('❌ Failed to read file');
    expect(result.isError).toBe(true);
  });

  it('should have correct tool definition', () => {
    expect(readFileTool.definition.name).toBe('read_file');
    expect(readFileTool.definition.inputSchema.properties?.path).toBeDefined();
    expect(readFileTool.definition.inputSchema.required).toContain('path');
  });
});

describe('write_file tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = { sandboxDir: '.sandbox-test' };
  });

  it('should write file content', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await writeFileTool.handler(mockSandbox, {
      path: 'output.txt',
      content: 'Hello WASM!',
    });

    expect(writeFile).toHaveBeenCalledWith('.sandbox-test/output.txt', 'Hello WASM!', 'utf-8');
    expect(result.content[0].text).toContain('✅ File written successfully: output.txt');
  });

  it('should handle write errors', async () => {
    vi.mocked(writeFile).mockRejectedValue(new Error('Permission denied'));

    const result = await writeFileTool.handler(mockSandbox, {
      path: '/root/restricted.txt',
      content: 'malicious',
    });

    expect(result.content[0].text).toContain('❌ Failed to write file');
    expect(result.isError).toBe(true);
  });

  it('should write empty content', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await writeFileTool.handler(mockSandbox, {
      path: 'empty.txt',
      content: '',
    });

    expect(result.content[0].text).toContain('✅ File written successfully');
  });

  it('should write multi-line content', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await writeFileTool.handler(mockSandbox, {
      path: 'multi.txt',
      content: 'line1\nline2\nline3',
    });

    expect(result.content[0].text).toContain('✅ File written successfully');
  });

  it('should have correct tool definition', () => {
    expect(writeFileTool.definition.name).toBe('write_file');
    expect(writeFileTool.definition.inputSchema.properties?.path).toBeDefined();
    expect(writeFileTool.definition.inputSchema.properties?.content).toBeDefined();
    expect(writeFileTool.definition.inputSchema.required).toContain('path');
    expect(writeFileTool.definition.inputSchema.required).toContain('content');
  });
});

describe('list_files tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = { sandboxDir: '.sandbox-test' };
  });

  it('should list files in root directory', async () => {
    vi.mocked(readdir).mockResolvedValue(['file1.txt', 'file2.txt', 'subdir'] as any);

    const result = await listFilesTool.handler(mockSandbox, {});

    expect(readdir).toHaveBeenCalledWith('.sandbox-test');
    expect(result.content[0].text).toContain('📁 Directory: .');
    expect(result.content[0].text).toContain('file1.txt');
    expect(result.content[0].text).toContain('file2.txt');
  });

  it('should list files in subdirectory', async () => {
    vi.mocked(readdir).mockResolvedValue(['nested.txt'] as any);

    const result = await listFilesTool.handler(mockSandbox, {
      path: 'subdir',
    });

    expect(readdir).toHaveBeenCalledWith(join('.sandbox-test', 'subdir'));
    expect(result.content[0].text).toContain('📁 Directory: subdir');
    expect(result.content[0].text).toContain('nested.txt');
  });

  it('should handle directory not found', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await listFilesTool.handler(mockSandbox, {
      path: 'nonexistent',
    });

    expect(result.content[0].text).toContain('❌ Failed to list directory');
    expect(result.isError).toBe(true);
  });

  it('should handle empty directory', async () => {
    vi.mocked(readdir).mockResolvedValue([] as any);

    const result = await listFilesTool.handler(mockSandbox, {});

    expect(result.content[0].text).toContain('📁 Directory: .');
    // 应该不显示任何文件
  });

  it('should have correct tool definition', () => {
    expect(listFilesTool.definition.name).toBe('list_files');
    expect(listFilesTool.definition.inputSchema.properties?.path).toBeDefined();
    expect(listFilesTool.definition.inputSchema.required).not.toContain('path');
  });
});

describe('delete_file tool', () => {
  let mockSandbox: any;

  beforeEach(() => {
    mockSandbox = { sandboxDir: '.sandbox-test' };
  });

  it('should delete file', async () => {
    vi.mocked(unlink).mockResolvedValue(undefined);

    const result = await deleteFileTool.handler(mockSandbox, {
      path: 'temp.txt',
    });

    expect(unlink).toHaveBeenCalledWith('.sandbox-test/temp.txt');
    expect(result.content[0].text).toContain('✅ File deleted successfully: temp.txt');
  });

  it('should handle file not found', async () => {
    vi.mocked(unlink).mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await deleteFileTool.handler(mockSandbox, {
      path: 'nonexistent.txt',
    });

    expect(result.content[0].text).toContain('❌ Failed to delete file');
    expect(result.isError).toBe(true);
  });

  it('should handle permission errors', async () => {
    vi.mocked(unlink).mockRejectedValue(new Error('EPERM: operation not permitted'));

    const result = await deleteFileTool.handler(mockSandbox, {
      path: 'protected.txt',
    });

    expect(result.content[0].text).toContain('❌ Failed to delete file');
    expect(result.isError).toBe(true);
  });

  it('should handle delete errors gracefully', async () => {
    vi.mocked(unlink).mockRejectedValue(new Error('Unknown error'));

    const result = await deleteFileTool.handler(mockSandbox, {
      path: 'problem.txt',
    });

    expect(result.content[0].text).toContain('❌ Failed to delete file');
    expect(result.isError).toBe(true);
  });

  it('should have correct tool definition', () => {
    expect(deleteFileTool.definition.name).toBe('delete_file');
    expect(deleteFileTool.definition.inputSchema.properties?.path).toBeDefined();
    expect(deleteFileTool.definition.inputSchema.required).toContain('path');
  });
});
