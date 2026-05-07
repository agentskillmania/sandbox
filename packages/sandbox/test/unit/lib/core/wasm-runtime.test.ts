import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WasmRuntime } from '../../../../src/lib/core/wasm-runtime.js';
import { spawn } from 'node:child_process';

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
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

describe('WasmRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });
  });

  it('should pass argv verbatim after module path', async () => {
    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['ls', '-la']);

    const args = mockSpawn.mock.calls[0][1];
    const moduleIndex = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIndex + 1]).toBe('ls');
    expect(args[moduleIndex + 2]).toBe('-la');
  });

  it('should include positional arguments after module path', async () => {
    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['--version']);

    const args = mockSpawn.mock.calls[0][1];
    const moduleIndex = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIndex + 1]).toBe('--version');
  });

  it('should include -c as a positional argument', async () => {
    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['-c', 'echo hello']);

    const args = mockSpawn.mock.calls[0][1];
    const moduleIndex = args.indexOf('/mock/busybox.wasm');
    expect(args[moduleIndex + 1]).toBe('-c');
    expect(args[moduleIndex + 2]).toBe('echo hello');
  });

  it('should add network args when allowNetwork is true', async () => {
    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: true,
    });

    await wasm.spawn('/mock/busybox.wasm', ['echo', 'test']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('-S');
    expect(args).toContain('tcp=y');
    expect(args).toContain('inherit-network');
  });

  it('should add extraDirs before module path', async () => {
    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
      extraDirs: ['/tmp'],
    });

    await wasm.spawn('/mock/busybox.wasm', ['echo', 'test']);

    const args = mockSpawn.mock.calls[0][1];
    const sandboxIdx = args.indexOf('/mock/sandbox::/workspace');
    const tmpIdx = args.indexOf('/tmp');
    const moduleIdx = args.indexOf('/mock/busybox.wasm');

    expect(tmpIdx).toBeGreaterThan(sandboxIdx);
    expect(moduleIdx).toBeGreaterThan(tmpIdx);
  });

  it('should reject on timeout', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(), // never calls close
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 50,
      allowNetwork: false,
    });

    await expect(wasm.spawn('/mock/busybox.wasm', ['sleep', '10'])).rejects.toThrow('timeout');
  });
});
