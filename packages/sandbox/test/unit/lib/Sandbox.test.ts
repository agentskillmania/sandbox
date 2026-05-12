import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sandbox } from '../../../src/lib/Sandbox.js';
import { SecurityError, TimeoutError } from '../../../src/lib/types.js';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { mkdirp } from 'mkdirp';

// Mock runtime functions
vi.mock('../../../src/lib/runtime.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/runtime.js')>();
  return {
    ...actual,
    getWasmtimeExecutable: vi.fn(() => '/mock/wasmtime'),
    getWasmPaths: vi.fn(() => ({
      busybox: '/mock/busybox.wasm',
    })),
    getRuntimeVersions: vi.fn(() => ({
      wasmtime: {
        found: true,
        version: '43.0.0',
        path: '/mock/wasmtime',
        expectedVersion: 'v43.0.0',
      },
      busybox: { found: true, path: '/mock/busybox.wasm' },
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
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
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
    vi.clearAllMocks();
    // Reset default mock behaviors (clearAllMocks only clears history, not implementations)
    vi.mocked(existsSync).mockReturnValue(true);

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

  describe('run', () => {
    it('should successfully execute simple shell command', async () => {
      const result = await sandbox.run('echo hello');
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should execute python command', async () => {
      const result = await sandbox.run("python -c 'print(42)'");
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should execute git command', async () => {
      const result = await sandbox.run('git --version');
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should allow all commands regardless of allowlist config', async () => {
      const sb = new Sandbox({ commandAllowlist: ['ls', 'cat'] });
      const result = await sb.run('rm file.txt');
      expect(result.exitCode).toBe(0);
    });

    it('should allow all commands regardless of blocklist config', async () => {
      const sb = new Sandbox({ commandBlocklist: ['rm', 'format'] });
      const result = await sb.run('rm file.txt');
      expect(result.exitCode).toBe(0);
    });

    it('should allow command in allowlist', async () => {
      const sb = new Sandbox({ commandAllowlist: ['ls', 'cat'] });
      const result = await sb.run('ls -la');
      expect(result.exitCode).toBe(0);
    });

    it('should allow command not in blocklist', async () => {
      const sb = new Sandbox({ commandBlocklist: ['rm', 'format'] });
      const result = await sb.run('ls -la');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('script file execution', () => {
    it('should detect .sh script files', async () => {
      const result = await sandbox.run('test.sh');
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should detect .py script files', async () => {
      const result = await sandbox.run('test.py');
      expect(result.exitCode).toBe(0);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should handle script file not found', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValueOnce(false);

      await expect(sandbox.run('nonexistent.sh')).rejects.toThrow('Script file not found');
    });
  });

  describe('timeout handling', () => {
    it('should terminate execution on timeout', async () => {
      const sb = new Sandbox({ timeout: 100 });

      mockSpawn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          // Never call close callback to simulate timeout
        }),
        kill: vi.fn(),
      });

      await expect(sb.run('sleep 10')).rejects.toThrow(TimeoutError);
    });
  });

  describe('error handling', () => {
    it('should handle spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      await expect(sandbox.run('echo test')).rejects.toThrow('Spawn failed');
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

      await expect(sandbox.run('echo test')).rejects.toThrow('Process error');
    });
  });

  describe('static methods', () => {
    it('should return runtime version information', () => {
      const versions = Sandbox.getRuntimeVersions();
      expect(versions).toHaveProperty('wasmtime');
      expect(versions).toHaveProperty('busybox');
      expect(versions).not.toHaveProperty('micropython');
    });
  });

  describe('updateConfig', () => {
    it('should update timeout and allowNetwork', async () => {
      const sb = new Sandbox({ timeout: 5000, allowNetwork: false });
      sb.updateConfig({ timeout: 10000, allowNetwork: true });

      // Verify network args appear in spawn call
      await sb.run('echo test');
      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('tcp=y');
      expect(args).toContain('inherit-network');
    });
  });

  describe('getSandboxDir', () => {
    it('should return sandbox directory path', () => {
      const sb = new Sandbox({ sandboxDir: '/custom/dir' });
      expect(sb.getSandboxDir()).toBe('/custom/dir');
    });
  });

  describe('directory creation', () => {
    it('should create sandbox directory when it does not exist', () => {
      vi.mocked(existsSync).mockImplementation(
        (p: string) => !p.startsWith('/custom')
      );

      new Sandbox({ sandboxDir: '/custom/newdir' });
      expect(vi.mocked(mkdirp.sync)).toHaveBeenCalledWith('/custom/newdir');
    });
  });

  describe('error handling - missing runtime', () => {
    it('should reject when busybox not found', async () => {
      vi.mocked(existsSync).mockImplementation(
        (p: string) => p !== '/mock/busybox.wasm'
      );

      const sb = new Sandbox({ timeout: 5000 });
      await expect(sb.run('echo test')).rejects.toThrow('WASM module not found');
    });

    it('should reject when wasmtime not found', async () => {
      vi.mocked(existsSync).mockImplementation(
        (p: string) => p !== '/mock/wasmtime'
      );

      const sb = new Sandbox({ timeout: 5000 });
      await expect(sb.run('echo test')).rejects.toThrow('Wasmtime not found');
    });
  });

  describe('stderr merging', () => {
    it('should merge stderr into stdout when stderr present', async () => {
      mockSpawn.mockReturnValue({
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') callback(Buffer.from('stdout text'));
          }),
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') callback(Buffer.from('stderr text'));
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') setImmediate(() => callback(0));
        }),
        kill: vi.fn(),
      });

      const result = await sandbox.run('echo test');
      expect(result.stdout).toContain('stdout text');
      expect(result.stdout).toContain('stderr text');
      expect(result.stderr).toBe('');
    });
  });

  describe('cleanup error handling', () => {
    it('should handle rmSync failure gracefully', async () => {
      vi.mocked(rmSync).mockImplementation(() => {
        throw new Error('cleanup failed');
      });

      const result = await sandbox.run('echo test');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('timeout edge case', () => {
    it('should not resolve after timeout kill', async () => {
      const sb = new Sandbox({ timeout: 50 });
      let closeCallback: Function | undefined;

      mockSpawn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') closeCallback = callback;
        }),
        kill: vi.fn(),
      });

      const promise = sb.run('sleep 10');
      promise.catch(() => {});
      await new Promise((r) => setTimeout(r, 100));
      closeCallback!(0);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });

  describe('command validation edge cases', () => {
    it('should skip validation when command starts with --', async () => {
      const result = await sandbox.run('--help');
      expect(result.exitCode).toBe(0);
    });
  });
});
