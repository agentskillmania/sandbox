import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('Runtime Installation Integration Tests', () => {
  const installDir = join(homedir(), '.agentskillmania', 'sandbox', 'wasmtime');
  const wasmtimePath = join(installDir, 'wasmtime');

  describe('wasmtime installation', () => {
    it('should have wasmtime installed in dedicated directory', () => {
      // Check if wasmtime exists
      const exists = existsSync(wasmtimePath);
      expect(exists).toBe(true);
    });

    it('should verify wasmtime version', () => {
      if (!existsSync(wasmtimePath)) {
        console.log('Wasmtime not installed, skipping version check');
        return;
      }

      // Get version
      const version = execSync(`"${wasmtimePath}" --version`, { encoding: 'utf-8' });
      expect(version).toContain('43.0.0');
    });

    it('should verify wasmtime is executable', () => {
      if (!existsSync(wasmtimePath)) {
        console.log('Wasmtime not installed, skipping executable check');
        return;
      }

      // Try to run wasmtime
      const result = execSync(`"${wasmtimePath}" --version`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have correct installation directory structure', () => {
      const installDir = join(homedir(), '.agentskillmania', 'sandbox');
      const wasmtimeDir = join(installDir, 'wasmtime');

      // Check if directories exist
      expect(existsSync(installDir)).toBe(true);
      expect(existsSync(wasmtimeDir)).toBe(true);
    });
  });

  describe('install-runtime script', () => {
    it('should export installRuntime function', async () => {
      const installRuntimeModule = await import('../../scripts/install-runtime.cjs');
      expect(typeof installRuntimeModule.installRuntime).toBe('function');
    });

    it('should export checkInstalledWasmtime function', async () => {
      const installRuntimeModule = await import('../../scripts/install-runtime.cjs');
      expect(typeof installRuntimeModule.checkInstalledWasmtime).toBe('function');
    });

    it('should export getWasmtimePath function', async () => {
      const installRuntimeModule = await import('../../scripts/install-runtime.cjs');
      expect(typeof installRuntimeModule.getWasmtimePath).toBe('function');
    });

    it('should detect installed wasmtime correctly', async () => {
      const { checkInstalledWasmtime } = await import('../../scripts/install-runtime.cjs');
      const result = checkInstalledWasmtime();

      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('path');

      if (result.found) {
        expect(result).toHaveProperty('version');
        expect(result.version).toContain('43.0.0');
      }
    });
  });
});
