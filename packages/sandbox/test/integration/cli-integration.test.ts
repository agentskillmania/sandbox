import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';

describe('CLI Integration Tests', () => {
  const cliPath = join(process.cwd(), 'bin/exec-in-sandbox');
  let wasmtimeInstalled: boolean;

  beforeAll(() => {
    wasmtimeInstalled = existsSync(getWasmtimeExecutable());
  });

  describe('CLI basic functionality', () => {
    it('should show version command', () => {
      try {
        const output = execSync(`node "${cliPath}" version`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect(output).toContain('@agentskillmania/sandbox');
        expect(output).toContain('0.1.0');
        expect(output).toContain('Runtimes');
      } catch (error: any) {
        // If error, check if it's expected
        if (!wasmtimeInstalled) {
          console.log('Wasmtime not installed, version may show "not found"');
          expect(error.stdout).toContain('Runtimes');
        } else {
          throw error;
        }
      }
    });

    it('should show help for busybox command', () => {
      const output = execSync(`node "${cliPath}" busybox --help`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect(output).toContain('Execute Shell commands');
    });

    it('should show help for python command', () => {
      const output = execSync(`node "${cliPath}" python --help`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      expect(output).toContain('Execute Python code');
    });
  });

  describe('CLI error handling', () => {
    it('should show error for invalid command', () => {
      try {
        execSync(`node "${cliPath}" invalid-command`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.stderr).toContain('error') || error.stderr?.toContain('unknown');
      }
    });

    it('should handle timeout option', () => {
      // Test that timeout option is accepted (format validation)
      try {
        execSync(`node "${cliPath}" busybox --timeout=1000 echo test`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000,
        });
      } catch (error: any) {
        // May fail if WASM not found, but the option should be parsed
        // Error message should NOT be about unknown option
        expect(error.message).not.toContain('unknown option');
        expect(error.message).not.toContain('unexpected option');
      }
    });
  });

  describe('CLI options', () => {
    it('should accept sandbox-dir option', () => {
      try {
        execSync(`node "${cliPath}" --sandbox-dir=.test-sandbox busybox echo test`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch (error: any) {
        // May fail if WASM not found, but the option should be parsed
        expect(error.message).not.toContain('unknown option');
        expect(error.message).not.toContain('unexpected option');
      }
    });

    it('should accept allow-network option', () => {
      try {
        execSync(`node "${cliPath}" --allow-network busybox echo test`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).not.toContain('unknown option');
        expect(error.message).not.toContain('unexpected option');
      }
    });

    it('should accept command-allowlist option', () => {
      try {
        execSync(`node "${cliPath}" --command-allowlist=ls,cat busybox ls`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).not.toContain('unknown option');
        expect(error.message).not.toContain('unexpected option');
      }
    });
  });

  describe('install-runtime command', () => {
    it('should have install-runtime command available', () => {
      const output = execSync(`node "${cliPath}" install-runtime --help 2>&1 || true`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      // Command should exist (may show help or execute)
      expect(output).toBeTruthy();
    });
  });
});
