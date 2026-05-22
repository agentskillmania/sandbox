import { describe, it, expect, beforeAll } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';

describe('Sandbox Integration Tests', () => {
  let wasmtimePath: string;

  beforeAll(() => {
    wasmtimePath = getWasmtimeExecutable();
  });

  describe('wasmtime availability', () => {
    it('should have wasmtime installed', () => {
      expect(existsSync(wasmtimePath)).toBe(true);
    });

    it('should verify wasmtime is working', () => {
      const version = execSync(`"${wasmtimePath}" --version`, { encoding: 'utf-8' });
      expect(version).toContain('43.0.0');
    });
  });

  describe('Sandbox initialization', () => {
    it('should create sandbox instance', () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test' });
      expect(sandbox).toBeInstanceOf(Sandbox);
    });
  });

  describe('Sandbox with python', () => {
    it('should execute python', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test' });
      const result = await sandbox.run('python -c \'print("hello")\'');
      expect(result.stdout).toContain('hello');
      expect(result.exitCode).toBe(0);
    }, 10000);
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
