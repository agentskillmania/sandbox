import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../../../../src/lib/core/executor.js';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdtempSync: vi.fn((prefix: string) => prefix + '12345'),
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

  it('should route busybox request to busybox runtime', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ runtime: 'busybox', argv: ['ls', '-la'] });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('ls');
    expect(args[moduleIdx + 2]).toBe('-la');
  });

  it('should route sh request with wsh prefix', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ runtime: 'sh', argv: ['-c', 'echo hello'] });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIdx + 1]).toBe('wsh');
    expect(args[moduleIdx + 2]).toBe('-c');
    expect(args[moduleIdx + 3]).toBe('echo hello');
  });

  it('should route python request', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ runtime: 'python', argv: ['print(42)'] });

    const args = mockSpawn.mock.calls[0][1];
    const moduleIdx = args.indexOf('/mock/micropython.wasm');
    expect(args[moduleIdx + 1]).toBe('print(42)');
  });

  it('should include /tmp dir for sh', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ runtime: 'sh', argv: ['-c', 'echo hello'] });

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('/tmp');
  });

  it('should NOT include /tmp dir for busybox', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
    });

    await executor.exec({ runtime: 'busybox', argv: ['ls'] });

    const args = mockSpawn.mock.calls[0][1];
    expect(args).not.toContain('/tmp');
  });

  it('should enforce command policy', async () => {
    const executor = new Executor({
      wasmtimePath: '/mock/wasmtime',
      busyboxPath: '/mock/busybox.wasm',
      micropythonPath: '/mock/micropython.wasm',
      sandboxDir: 'auto',
      timeout: 5000,
      allowNetwork: false,
      commandPolicy: { mode: 'whitelist', list: ['ls'] },
    });

    await expect(executor.exec({ runtime: 'busybox', argv: ['rm', 'file'] })).rejects.toThrow(
      'not in the allowlist'
    );
  });
});
