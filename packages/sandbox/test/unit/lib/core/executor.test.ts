import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../../../../src/lib/core/executor.js';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
  execSync: vi.fn(() => {
    throw new Error('mock: no wasmtime');
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((p: string) => !p.endsWith('.cwasm')),
  mkdirSync: vi.fn(),
  mkdtempSync: vi.fn((prefix: string) => prefix + '12345'),
  rmSync: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
}));

describe('Executor', () => {
  const defaultConfig = {
    wasmtimePath: '/mock/wasmtime',
    busyboxPath: '/mock/busybox.wasm',
    sandboxDir: 'auto' as const,
    timeout: 5000,
    allowNetwork: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue({
      stdout: {
        on: vi.fn((e, cb) => {
          if (e === 'data') cb(Buffer.from('ok'));
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });
  });

  it('should execute command via wsh', async () => {
    const executor = new Executor(defaultConfig);
    await executor.exec({ command: 'ls -la' });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe('cd /workspace && ls -la');
  });

  it('should execute python command via wsh', async () => {
    const executor = new Executor(defaultConfig);
    await executor.exec({ command: "python -c 'print(42)'" });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe("cd /workspace && python -c 'print(42)'");
  });

  it('should execute git command via wsh', async () => {
    const executor = new Executor(defaultConfig);
    await executor.exec({ command: 'git status' });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe('cd /workspace && git status');
  });

  it('should include /tmp dir for all commands', async () => {
    const executor = new Executor(defaultConfig);
    await executor.exec({ command: 'ls' });

    const args = mockSpawn.mock.calls[0][1];
    expect(args.some((a: string) => a.includes('::/tmp'))).toBe(true);
  });

  it('should expose sandbox directory path', () => {
    const executor = new Executor({
      ...defaultConfig,
      sandboxDir: '/custom/sandbox',
    });
    expect(executor.sandboxDirectory).toBe('/custom/sandbox');
  });

  it('should merge stderr into stdout when stderr present', async () => {
    mockSpawn.mockReturnValue({
      stdout: {
        on: vi.fn((e, cb) => {
          if (e === 'data') cb(Buffer.from('stdout output'));
        }),
      },
      stderr: {
        on: vi.fn((e, cb) => {
          if (e === 'data') cb(Buffer.from('stderr output'));
        }),
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });

    const executor = new Executor(defaultConfig);
    const result = await executor.exec({ command: 'echo test' });
    expect(result.stdout).toContain('stdout output');
    expect(result.stdout).toContain('stderr output');
    expect(result.stderr).toBe('');
  });

  it('should propagate timeout error from WasmRuntime', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    });

    const executor = new Executor({ ...defaultConfig, timeout: 50 });
    await expect(executor.exec({ command: 'sleep 10' })).rejects.toThrow('timeout');
  });

  it('should propagate spawn process error', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'error')
          setImmediate(() => callback(new Error('ENOENT: wasmtime not found')));
      }),
      kill: vi.fn(),
    });

    const executor = new Executor(defaultConfig);
    await expect(executor.exec({ command: 'ls' })).rejects.toThrow('ENOENT');
  });

  it('should handle empty command string', async () => {
    // Empty command passes through WasmRuntime as a shell call with empty string
    mockSpawn.mockReturnValue({
      stdout: {
        on: vi.fn((e, cb) => {
          if (e === 'data') cb(Buffer.from(''));
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });

    const executor = new Executor(defaultConfig);
    const result = await executor.exec({ command: '' });
    expect(result).toBeDefined();
    expect(result.exitCode).toBe(0);
  });

  it('should propagate WasmRuntime module-not-found error', async () => {
    // Make existsSync return false for the busybox module path
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation((p: string) => {
      if (typeof p === 'string' && p.endsWith('busybox.wasm')) return false;
      return true;
    });

    const executor = new Executor(defaultConfig);
    await expect(executor.exec({ command: 'ls' })).rejects.toThrow('WASM module not found');
  });
});
