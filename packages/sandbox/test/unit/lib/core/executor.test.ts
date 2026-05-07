import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../../../../src/lib/core/executor.js';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
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
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ command: 'ls -la' });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe('cd /workspace && ls -la');
  });

  it('should execute python command via wsh', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ command: "python -c 'print(42)'" });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe("cd /workspace && python -c 'print(42)'");
  });

  it('should execute git command via wsh', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ command: 'git status' });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe('cd /workspace && git status');
  });

  it('should include /tmp dir for all commands', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ command: 'ls' });

    const args = mockSpawn.mock.calls[0][1];
    // /tmp is now mapped via an isolated per-instance directory
    expect(args.some((a: string) => a.includes('::/tmp'))).toBe(true);
  });

  it('should allow all commands regardless of command policy', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
      commandPolicy: { mode: 'whitelist', list: ['ls'] },
    });

    // SecurityPolicy is currently a no-op; all commands are allowed.
    const result = await executor.exec({ command: 'rm file' });
    expect(result.exitCode).toBe(0);
  });
});
