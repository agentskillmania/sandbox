import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WasmRuntime } from '../../../../src/lib/core/wasm-runtime.js';
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

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

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(existsSync);
const mockRmSync = vi.mocked(rmSync);

function createSuccessSpawn() {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, callback: Function) => {
      if (event === 'close') setImmediate(() => callback(0));
    }),
    kill: vi.fn(),
  };
}

describe('WasmRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(createSuccessSpawn());
    // Default: execSync throws (simulates compilation not available)
    mockExecSync.mockImplementation(() => {
      throw new Error('mock: no wasmtime');
    });
    // Default: existsSync returns false for .cwasm paths
    mockExistsSync.mockImplementation(
      (p: string) => !p.endsWith('.cwasm')
    );
  });

  // --- existing tests (JIT fallback path) ---

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
      on: vi.fn(),
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 50,
      allowNetwork: false,
    });

    await expect(
      wasm.spawn('/mock/busybox.wasm', ['sleep', '10'])
    ).rejects.toThrow('timeout');
  });

  // --- AOT compilation tests ---

  it('should use cwasm when precompiled file already exists', async () => {
    // existsSync returns true for .cwasm paths
    mockExistsSync.mockReturnValue(true);

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['ls']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('/mock/busybox.cwasm');
    expect(args).toContain('--allow-precompiled');
    expect(args).not.toContain('/mock/busybox.wasm');
    // execSync should NOT be called (cwasm already exists)
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('should compile on-demand when cwasm is missing and use it', async () => {
    // existsSync returns false for .cwasm (default), true for others
    // execSync succeeds (does not throw)
    mockExecSync.mockReturnValue('');

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['ls']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('/mock/busybox.cwasm');
    expect(args).toContain('--allow-precompiled');
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    // Verify compile command format
    const compileCmd = mockExecSync.mock.calls[0][0] as string;
    expect(compileCmd).toContain('compile');
    expect(compileCmd).toContain('/mock/busybox.wasm');
    expect(compileCmd).toContain('/mock/busybox.cwasm');
  });

  it('should fallback to wasm when on-demand compilation fails', async () => {
    // existsSync returns false for .cwasm (default)
    // execSync throws (default)

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['ls']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('/mock/busybox.wasm');
    expect(args).not.toContain('--allow-precompiled');
    expect(args).not.toContain('/mock/busybox.cwasm');
  });

  it('should skip AOT logic when module path is already cwasm', async () => {
    mockExistsSync.mockReturnValue(true);

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.cwasm', ['ls']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('/mock/busybox.cwasm');
    expect(args).toContain('--allow-precompiled');
    // execSync should NOT be called (already cwasm)
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('should not add --allow-precompiled when running wasm without cwasm', async () => {
    // Default mocks: compilation fails, fallback to wasm

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await wasm.spawn('/mock/busybox.wasm', ['ls']);

    const args = mockSpawn.mock.calls[0][1];
    expect(args).not.toContain('--allow-precompiled');
    expect(args).toContain('/mock/busybox.wasm');
  });

  // --- error handling and edge cases ---

  it('should reject when wasm module not found', async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === '/mock/wasmtime'
    );

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await expect(
      wasm.spawn('/nonexistent.wasm', ['ls'])
    ).rejects.toThrow('WASM module not found');
  });

  it('should reject when wasmtime not found', async () => {
    mockExistsSync.mockImplementation(
      (p: string) => p === '/mock/busybox.wasm'
    );

    const wasm = new WasmRuntime({
      wasmtimePath: '/nonexistent/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await expect(
      wasm.spawn('/mock/busybox.wasm', ['ls'])
    ).rejects.toThrow('Wasmtime not found');
  });

  it('should collect stdout output', async () => {
    mockSpawn.mockReturnValue({
      stdout: {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'data') callback(Buffer.from('hello world'));
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    const result = await wasm.spawn('/mock/busybox.wasm', ['echo', 'hello']);
    expect(result.stdout).toBe('hello world');
  });

  it('should collect stderr output', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'data') callback(Buffer.from('warning msg'));
        }),
      },
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'close') setImmediate(() => callback(0));
      }),
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    const result = await wasm.spawn('/mock/busybox.wasm', ['ls']);
    expect(result.stderr).toBe('warning msg');
  });

  it('should handle process error event', async () => {
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'error')
          setImmediate(() => callback(new Error('spawn ENOENT')));
      }),
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    await expect(
      wasm.spawn('/mock/busybox.wasm', ['ls'])
    ).rejects.toThrow('spawn ENOENT');
  });

  it('should not resolve after timeout kill', async () => {
    let closeCallback: Function | undefined;
    mockSpawn.mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'close') closeCallback = callback;
      }),
      kill: vi.fn(),
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 50,
      allowNetwork: false,
    });

    const promise = wasm.spawn('/mock/busybox.wasm', ['sleep']);
    // Prevent unhandled rejection before we await it
    promise.catch(() => {});
    // Let timeout fire first, then close
    await new Promise((r) => setTimeout(r, 100));
    closeCallback!(0);

    await expect(promise).rejects.toThrow('timeout');
  });

  it('should handle cleanup error when rmSync throws', async () => {
    // Make rmSync throw to cover the catch in cleanup
    mockRmSync.mockImplementation(() => {
      throw new Error('cleanup failed');
    });

    const wasm = new WasmRuntime({
      wasmtimePath: '/mock/wasmtime',
      sandboxDir: '/mock/sandbox',
      timeout: 5000,
      allowNetwork: false,
    });

    // Should still resolve successfully despite cleanup error
    const result = await wasm.spawn('/mock/busybox.wasm', ['ls']);
    expect(result.exitCode).toBe(0);
  });
});
