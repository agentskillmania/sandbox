import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sandbox } from '../../../src/lib/Sandbox.js';
import { SecurityError, TimeoutError } from '../../../src/lib/types.js';

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
      wasmtime: { found: true, version: '43.0.0', path: '/mock/wasmtime', expectedVersion: 'v43.0.0' },
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
      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow("Command 'rm' is not in the allowlist");
    });

    it('should throw SecurityError when command in blocklist', async () => {
      const sb = new Sandbox({ commandBlocklist: ['rm', 'format'] });

      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow(SecurityError);
      await expect(sb.runShell('rm', ['file.txt'])).rejects.toThrow("Command 'rm' is in the blocklist");
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
});
