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
});
