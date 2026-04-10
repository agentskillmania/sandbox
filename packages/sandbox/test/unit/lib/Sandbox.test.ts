import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sandbox } from '../../../src/lib/Sandbox.js';
import { SecurityError, TimeoutError } from '../../../src/lib/types.js';
import { readFileSync, existsSync } from 'node:fs';

// Mock runtime functions
vi.mock('../../../src/lib/runtime.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/runtime.js')>();
  return {
    ...actual,
    getWasmtimeExecutable: vi.fn(() => '/mock/wasmtime'),
    getWasmPaths: vi.fn(() => ({
      busybox: '/mock/busybox.wasm',
      micropython: '/mock/micropython.wasm',
    })),
    getRuntimeVersions: vi.fn(() => ({
      wasmtime: {
        found: true,
        version: '43.0.0',
        path: '/mock/wasmtime',
        expectedVersion: 'v43.0.0',
      },
      busybox: { found: true, path: '/mock/busybox.wasm' },
      micropython: { found: true, path: '/mock/micropython.wasm' },
    })),
  };
});

// Mock child_process with a controllable mock
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  mkdtempSync: vi.fn((prefix) => prefix + '12345'),
  readFileSync: vi.fn((path: string, encoding: string) => {
    if (path.endsWith('.sh')) {
      return '#!/bin/sh\necho "Hello from script"';
    } else if (path.endsWith('.py')) {
      return '#!/usr/bin/env python3\nprint("Hello from Python")';
    }
    return '';
  }),
}));

// Mock os
vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock mkdirp
vi.mock('mkdirp', () => ({
  mkdirp: {
    sync: vi.fn(),
  },
}));

describe('Sandbox', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementation for successful execution
    mockSpawn.mockReturnValue({
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('test output'));
          }
        }),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          // Immediately call close callback
          setImmediate(() => callback(0));
        }
      }),
      kill: vi.fn(),
    });

    sandbox = new Sandbox({ timeout: 5000 });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const sb = new Sandbox();
      expect(sb).toBeInstanceOf(Sandbox);
    });

    it('should accept custom config', () => {
      const sb = new Sandbox({
        sandboxDir: '.custom-sandbox',
        timeout: 10000,
      });
      expect(sb).toBeInstanceOf(Sandbox);
    });
  });

  describe('runShell', () => {
    it('should successfully execute simple shell command', async () => {
      const result = await sandbox.runShell('echo', ['hello']);
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should throw SecurityError when command not in allowlist', async () => {
      const sb = new Sandbox({ commandAllowlist: ['ls', 'cat'] });

      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow(SecurityError);
      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow(
        "Command 'rm' is not in the allowlist"
      );
    });

    it('should throw SecurityError when command in blocklist', async () => {
      const sb = new Sandbox({ commandBlocklist: ['rm', 'format'] });

      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow(SecurityError);
      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow(
        "Command 'rm' is in the blocklist"
      );
    });

    it('should allow command in allowlist', async () => {
      const sb = new Sandbox({ commandAllowlist: ['ls', 'cat'] });
      const result = await sb.runShell('ls', ['-la']);
      expect(result.exitCode).toBe(0);
    });

    it('should allow command not in blocklist', async () => {
      const sb = new Sandbox({ commandBlocklist: ['rm', 'format'] });
      const result = await sb.runShell('ls', ['-la']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('runPython', () => {
    it('should successfully execute Python code', async () => {
      const result = await sandbox.runPython("print('hello')");
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('runPythonScript', () => {
    it('should successfully execute Python script', async () => {
      const result = await sandbox.runPythonScript('script.py', ['arg1']);
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('timeout handling', () => {
    it('should terminate execution on timeout', async () => {
      const sb = new Sandbox({ timeout: 100 });

      // Mock spawn that never closes (simulates timeout)
      mockSpawn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          // Never call close callback to simulate timeout
        }),
        kill: vi.fn(),
      });

      await expect(sb.runShell('sleep', ['10'])).rejects.toThrow(TimeoutError);
    });
  });

  describe('error handling', () => {
    it('should handle spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(sandbox.runShell('echo', ['test'])).rejects.toThrow('Spawn failed');
    });

    it('should handle process error event', async () => {
      mockSpawn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setImmediate(() => callback(new Error('Process error')));
          }
        }),
        kill: vi.fn(),
      });

      await expect(sandbox.runShell('echo', ['test'])).rejects.toThrow('Process error');
    });
  });

  describe('static methods', () => {
    it('should return runtime version information', () => {
      const versions = Sandbox.getRuntimeVersions();
      expect(versions).toHaveProperty('wasmtime');
      expect(versions).toHaveProperty('busybox');
      expect(versions).toHaveProperty('micropython');
    });
  });

  describe('script file execution', () => {
    it('should detect .sh script files', async () => {
      const result = await sandbox.runShell('busybox', ['test.sh']);
      expect(result.exitCode).toBe(0);
      // Should call spawn for script execution
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should detect .py script files', async () => {
      const result = await sandbox.runShell('busybox', ['test.py']);
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should not detect non-script files', async () => {
      const result = await sandbox.runShell('busybox', ['test.txt']);
      expect(result.exitCode).toBe(0);
      // Should call with normal busybox args
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should not treat .pl files as scripts (passes to busybox)', async () => {
      const result = await sandbox.runShell('busybox', ['test.pl']);
      expect(result.exitCode).toBe(0);
      // .pl files are not supported, so they're passed to busybox as normal args
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle different shebang types in shell scripts', async () => {
      // 测试 shebang 解析分支覆盖
      const { readFileSync } = await import('node:fs');

      // 测试不支持的 shebang (行 326-330)
      vi.mocked(readFileSync).mockReturnValueOnce('#!/usr/bin/perl\nprint("test")');
      await expect(sandbox.runShell('busybox', ['test.sh'])).rejects.toThrow();

      // 测试支持的 shebang
      vi.mocked(readFileSync).mockReturnValueOnce('#!/bin/sh\necho test');
      let result = await sandbox.runShell('busybox', ['test.sh']);
      expect(result.exitCode).toBe(0);

      vi.mocked(readFileSync).mockReturnValueOnce('#!/bin/bash\necho test');
      result = await sandbox.runShell('busybox', ['test.sh']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('runPythonScript - error cases', () => {
    it('should handle script file not found', async () => {
      // 测试未覆盖的分支：脚本文件不存在 (行 388-390)
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValueOnce(false);

      await expect(sandbox.runPythonScript('nonexistent.py', [])).rejects.toThrow(
        'Script file not found'
      );
    });

    it('should handle script arguments with warning', async () => {
      // 测试未覆盖的分支：Python 脚本带参数 (行 357-359)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await sandbox.runPythonScript('test.py', ['arg1']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Script arguments are not supported for .py files in WASM sandbox'
      );
      expect(result.exitCode).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});
