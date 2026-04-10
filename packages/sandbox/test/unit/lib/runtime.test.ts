import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWasmtimeExecutable,
  checkInstalledWasmtime,
  getWasmPaths,
  getRuntimeVersions,
  checkRuntimeReady,
  ensureRuntime,
} from '../../../src/lib/runtime.js';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock os
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

describe('runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homedir).mockReturnValue('/mock/home');
  });

  describe('getWasmtimeExecutable', () => {
    it('should return correct wasmtime path', () => {
      const path = getWasmtimeExecutable();
      expect(path).toBe('/mock/home/.agentskillmania/sandbox/wasmtime/wasmtime');
    });
  });

  describe('checkInstalledWasmtime', () => {
    it('should return found: true when wasmtime exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue('wasmtime 43.0.0\n');

      const result = checkInstalledWasmtime();
      expect(result.found).toBe(true);
      expect(result.version).toBe('wasmtime 43.0.0');
      expect(result.path).toBe('/mock/home/.agentskillmania/sandbox/wasmtime/wasmtime');
    });

    it('should return found: false when wasmtime does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = checkInstalledWasmtime();
      expect(result.found).toBe(false);
      expect(result.path).toBe('/mock/home/.agentskillmania/sandbox/wasmtime/wasmtime');
    });

    it('should return found: false when wasmtime exists but version check fails', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = checkInstalledWasmtime();
      expect(result.found).toBe(false);
    });
  });

  describe('getWasmPaths', () => {
    it('should return correct WASM paths', () => {
      const originalCwd = process.cwd;
      process.cwd = vi.fn(() => '/mock/cwd') as any;

      const paths = getWasmPaths();
      expect(paths.busybox).toBe('/mock/cwd/wasm/busybox.wasm');
      expect(paths.micropython).toBe('/mock/cwd/wasm/micropython.wasm');

      process.cwd = originalCwd;
    });
  });

  describe('getRuntimeVersions', () => {
    it('should return runtime version information', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === 'string') {
          return (
            path.includes('wasmtime') || path.includes('busybox') || path.includes('micropython')
          );
        }
        return false;
      });
      vi.mocked(execSync).mockReturnValue('wasmtime 43.0.0\n');

      const versions = getRuntimeVersions();
      expect(versions).toHaveProperty('wasmtime');
      expect(versions).toHaveProperty('busybox');
      expect(versions).toHaveProperty('micropython');
      expect(versions.wasmtime.expectedVersion).toBe('v43.0.0');
    });

    it('should handle when wasmtime is not found', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const versions = getRuntimeVersions();
      expect(versions.wasmtime.found).toBe(false);
    });

    it('should handle when busybox.wasm is not found', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === 'string') {
          return !path.includes('busybox');
        }
        return true;
      });
      vi.mocked(execSync).mockReturnValue('wasmtime 43.0.0\n');

      const versions = getRuntimeVersions();
      expect(versions.busybox.found).toBe(false);
    });

    it('should handle when micropython.wasm is not found', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        if (typeof path === 'string') {
          return !path.includes('micropython');
        }
        return true;
      });
      vi.mocked(execSync).mockReturnValue('wasmtime 43.0.0\n');

      const versions = getRuntimeVersions();
      expect(versions.micropython.found).toBe(false);
    });
  });

  describe('checkRuntimeReady', () => {
    it('should return ready: true when wasmtime exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = checkRuntimeReady();
      expect(result.ready).toBe(true);
    });

    it('should return ready: false when wasmtime does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = checkRuntimeReady();
      expect(result.ready).toBe(false);
    });
  });

  describe('ensureRuntime', () => {
    it('should skip installation if runtime exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(ensureRuntime()).resolves.not.toThrow();
      expect(execSync).not.toHaveBeenCalled();
    });

    it('should install runtime if missing', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execSync).mockReturnValue('');

      await expect(ensureRuntime()).resolves.not.toThrow();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('install-runtime'),
        expect.objectContaining({
          stdio: 'inherit',
        })
      );
    });

    it('should throw error if installation fails', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Installation failed');
      });

      await expect(ensureRuntime()).rejects.toThrow('Failed to install wasmtime runtime');
    });

    it('should use correct install script path', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const originalCwd = process.cwd;
      process.cwd = vi.fn(() => '/mock/cwd') as any;
      vi.mocked(execSync).mockReturnValue('');

      await ensureRuntime();

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('/mock/cwd/packages/sandbox/scripts/install-runtime.cjs'),
        expect.any(Object)
      );

      process.cwd = originalCwd;
    });
  });
});
