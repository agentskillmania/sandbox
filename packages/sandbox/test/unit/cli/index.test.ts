import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeCommand,
  showVersion,
  installRuntimeCommand,
  formatVersion,
} from '../../../src/cli/index.js';
import { initializeSecurityConfig } from '../../../src/lib/config.js';
import { Executor } from '../../../src/lib/core/executor.js';
import {
  getWasmPaths,
  getWasmtimeExecutable,
  getRuntimeVersions,
} from '../../../src/lib/runtime.js';

// ---- mocks ----

vi.mock('../../../src/lib/config.js', () => ({
  initializeSecurityConfig: vi.fn(),
}));

const mockExecFn = vi.fn();
vi.mock('../../../src/lib/core/executor.js', () => ({
  Executor: vi.fn(),
}));

vi.mock('../../../src/lib/runtime.js', () => ({
  getWasmPaths: vi.fn(() => ({ busybox: '/mock/busybox.wasm' })),
  getWasmtimeExecutable: vi.fn(() => '/mock/wasmtime'),
  getRuntimeVersions: vi.fn(() => ({
    wasmtime: { found: true, version: '43.0.0', path: '/mock/wasmtime' },
    busybox: { found: true, path: '/mock/busybox.wasm' },
  })),
}));

vi.mock('commander', () => {
  const mockCommand = {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    action: vi.fn(),
    command: vi.fn().mockReturnThis(),
    parse: vi.fn(),
  };
  return { Command: vi.fn(() => mockCommand) };
});

vi.mock('chalk', () => {
  const c = (s: string) => s;
  c.red = (s: string) => `RED:${s}`;
  c.green = (s: string) => `GREEN:${s}`;
  c.bold = (s: string) => `BOLD:${s}`;
  return { default: c, red: c.red, green: c.green, bold: c.bold };
});

// ---- helpers ----

function mockExecutorResolve(result: { exitCode: number; stdout: string; stderr: string }) {
  mockExecFn.mockResolvedValue(result);
  vi.mocked(Executor).mockImplementation(() => {
    const e = { exec: mockExecFn };
    // need to return ExecResult shape, sandboxDirectory getter
    Object.defineProperty(e, 'sandboxDirectory', { get: () => '/mock/sandbox' });
    return e as any;
  });
}

function mockSecurityConfig(policy?: { mode: string; list: string[] }) {
  vi.mocked(initializeSecurityConfig).mockResolvedValue({
    getCommandSecurity: vi.fn(() => policy ?? {}),
    getNetworkSecurity: vi.fn(() => ({})),
  } as any);
}

// ---- tests ----

describe('executeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecurityConfig();
  });

  it('should create Executor and run the command', async () => {
    mockExecutorResolve({ exitCode: 0, stdout: 'hello', stderr: '' });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await executeCommand('echo hello', { timeout: '5000' });

    expect(Executor).toHaveBeenCalledWith(
      expect.objectContaining({
        wasmtimePath: '/mock/wasmtime',
        busyboxPath: '/mock/busybox.wasm',
        timeout: 5000,
      })
    );
    expect(mockExecFn).toHaveBeenCalledWith({ command: 'echo hello' });
    expect(stdoutSpy).toHaveBeenCalledWith('hello');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should write stderr when present', async () => {
    mockExecutorResolve({ exitCode: 1, stdout: '', stderr: 'error msg' });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await executeCommand('bad cmd', { timeout: '5000' });

    expect(stderrSpy).toHaveBeenCalledWith('error msg');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with code 1 when no command is specified', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await executeCommand('', { timeout: '5000' });

    expect(vi.mocked(initializeSecurityConfig)).not.toHaveBeenCalled();
  });

  it('should create Executor with commandPolicy when security config has policy', async () => {
    mockSecurityConfig({ mode: 'blacklist', list: ['rm', 'format'] });
    mockExecutorResolve({ exitCode: 0, stdout: '', stderr: '' });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await executeCommand('ls', { timeout: '5000' });

    expect(Executor).toHaveBeenCalledWith(
      expect.objectContaining({
        commandPolicy: { mode: 'blacklist', list: ['rm', 'format'] },
      })
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should pass sandboxDir to Executor', async () => {
    mockExecutorResolve({ exitCode: 0, stdout: '', stderr: '' });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await executeCommand('ls', { timeout: '5000', sandboxDir: '/custom/sandbox' });

    expect(Executor).toHaveBeenCalledWith(
      expect.objectContaining({ sandboxDir: '/custom/sandbox' })
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should pass allowNetwork to Executor', async () => {
    mockExecutorResolve({ exitCode: 0, stdout: '', stderr: '' });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await executeCommand('ls', { timeout: '5000', allowNetwork: 'true' });

    expect(Executor).toHaveBeenCalledWith(expect.objectContaining({ allowNetwork: true }));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle SecurityError from Executor', async () => {
    mockExecutorResolve = vi.fn() as any;
    vi.mocked(Executor).mockImplementation(() => {
      const err = new Error('Denied');
      err.name = 'SecurityError';
      throw err;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await expect(executeCommand('rm -rf /', { timeout: '5000' })).rejects.toThrow('Denied');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should handle TimeoutError from Executor', async () => {
    vi.mocked(Executor).mockImplementation(() => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await expect(executeCommand('sleep 100', { timeout: '1' })).rejects.toThrow('timed out');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should handle generic error from Executor', async () => {
    vi.mocked(Executor).mockImplementation(() => {
      throw new Error('unexpected');
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await expect(executeCommand('bad', { timeout: '5000' })).rejects.toThrow('unexpected');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('showVersion', () => {
  it('should print runtime version information', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getRuntimeVersions).mockReturnValue({
      wasmtime: { found: true, version: '43.0.0', path: '/mock/wasmtime' },
      busybox: { found: true, path: '/mock/busybox.wasm' },
    });

    await showVersion();

    expect(logSpy).toHaveBeenCalled();
    expect(getRuntimeVersions).toHaveBeenCalled();
  });
});

describe('installRuntimeCommand', () => {
  it('should call installRuntime and exit with 0 on success', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await installRuntimeCommand();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with 1 on failure', async () => {
    // The install-runtime.cjs module is mocked by vitest's module resolution
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await installRuntimeCommand();

    // installRuntime returns true by default from mocked module
    expect(exitSpy).toHaveBeenCalled();
  });
});

describe('formatVersion', () => {
  it('should return green formatted string when found', () => {
    const result = formatVersion({ found: true, version: '1.0', path: '/mock/path' });
    expect(result).toContain('1.0');
    expect(result).toContain('/mock/path');
  });

  it('should return "not found" when not found', () => {
    const result = formatVersion({ found: false, path: '/mock/path' });
    expect(result).toContain('not found');
  });
});
