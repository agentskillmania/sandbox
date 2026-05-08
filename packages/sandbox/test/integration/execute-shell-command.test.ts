import { describe, it, expect, beforeAll } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';

describe('Sandbox Integration Tests', () => {
  let wasmtimePath: string;
  let busyboxExists: boolean;
  let micropythonExists: boolean;

  beforeAll(() => {
    wasmtimePath = getWasmtimeExecutable();
    busyboxExists = existsSync('./wasm/busybox.wasm');
    micropythonExists = existsSync('./wasm/micropython.wasm');
  });

  describe('wasmtime availability', () => {
    it('should have wasmtime installed', () => {
      const exists = existsSync(wasmtimePath);
      if (!exists) {
        console.log('Wasmtime not found at:', wasmtimePath);
      }
      expect(exists).toBe(true);
    });

    it('should verify wasmtime is working', () => {
      try {
        const version = execSync(`"${wasmtimePath}" --version`, { encoding: 'utf-8' });
        expect(version).toContain('43.0.0');
      } catch (error) {
        console.log('Wasmtime not working:', error);
        throw error;
      }
    });
  });

  describe('Sandbox initialization', () => {
    it('should create sandbox instance', () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test' });
      expect(sandbox).toBeInstanceOf(Sandbox);
    });

    it('should throw error when busybox.wasm does not exist', async () => {
      if (busyboxExists) {
        console.log('busybox.wasm exists, skipping error test');
        return;
      }

      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test' });
      await expect(sandbox.run('ls -la')).rejects.toThrow(/WASM module not found/);
    }, 10000);
  });

  describe('Sandbox with python', () => {
    it('should execute python', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test' });
      const result = await sandbox.run('python -c \'print("hello")\'');
      expect(result.stdout).toContain('hello');
      expect(result.exitCode).toBe(0);
    }, 10000);
  });

  describe('Sandbox security (placeholder)', () => {
    it('should allow all commands regardless of allowlist config', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test',
        commandAllowlist: ['ls', 'echo'],
      });

      // SecurityPolicy is currently a no-op; all commands are allowed.
      const result = await sandbox.run('echo test');
      expect(result.exitCode).toBe(0);
    });

    it('should allow all commands regardless of blocklist config', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test',
        commandBlocklist: ['rm', 'format'],
      });

      // SecurityPolicy is currently a no-op; all commands are allowed.
      const result = await sandbox.run('echo test');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Sandbox directory creation', () => {
    it('should create sandbox directory if not exists', () => {
      const testDir = '.sandbox-test-integration';

      // Remove directory if exists
      if (existsSync(testDir)) {
        execSync(`rm -rf "${testDir}"`);
      }

      const sandbox = new Sandbox({ sandboxDir: testDir });
      expect(existsSync(testDir)).toBe(true);

      // Cleanup
      execSync(`rm -rf "${testDir}"`);
    });
  });
});
