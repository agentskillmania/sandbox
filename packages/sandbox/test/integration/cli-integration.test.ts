import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';

describe('CLI Integration Tests', () => {
  const cliPath = join(process.cwd(), 'dist/cli/index.js');
  let wasmtimeInstalled: boolean;

  beforeAll(() => {
    wasmtimeInstalled = existsSync(getWasmtimeExecutable());
  });

  const runCli = (args: string[]): { stdout: string; stderr: string; exitCode: number } => {
    const result = spawnSync('node', [cliPath, ...args], {
      encoding: 'utf-8',
    });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.status ?? -1,
    };
  };

  describe('version', () => {
    it('should show version', () => {
      const { stdout } = runCli(['version']);
      expect(stdout).toContain('@agentskillmania/sandbox');
      expect(stdout).toContain('0.2.0');
      expect(stdout).toContain('Runtimes');
    });
  });

  describe('busybox execution', () => {
    it('should pass -la to busybox ls', () => {
      const { stdout, stderr } = runCli(['--sandbox-dir=.', '--', 'busybox', 'ls', '-la']);
      const combined = stdout + stderr;
      expect(combined).toContain('total');
    });

    it('should pass --list to busybox', () => {
      const { stderr } = runCli(['--', 'busybox', '--list']);
      expect(stderr).toContain('ls');
      expect(stderr).toContain('cat');
    });

    it('should pass -n to echo', () => {
      const { stdout } = runCli(['--', 'busybox', 'echo', '-n', 'hello']);
      expect(stdout.trim()).toBe('hello');
    });
  });

  describe('wsh execution', () => {
    it('should execute wsh -c echo hello', () => {
      const { stdout } = runCli(['--', 'wsh', '-c', 'echo hello']);
      expect(stdout.trim()).toBe('hello');
    });

    it('should execute arithmetic expression', () => {
      const { stdout } = runCli(['--', 'wsh', '-c', 'X=10; Y=20; echo $((X + Y))']);
      expect(stdout.trim()).toBe('30');
    });

    it('should handle comments in wsh script', () => {
      const { stdout } = runCli(['--', 'wsh', '-c', '# comment\nX=5\necho $X']);
      expect(stdout.trim()).toBe('5');
    });
  });

  describe('micropython execution', () => {
    it('should execute python -c print', () => {
      const { stdout } = runCli(['--', 'micropython', '-c', 'print(42)']);
      expect(stdout.trim()).toBe('42');
    });
  });

  describe('CLI options', () => {
    it('should accept timeout option', () => {
      const { stdout } = runCli(['--timeout=1000', '--', 'busybox', 'echo', 'test']);
      expect(stdout.trim()).toBe('test');
    });

    it('should accept sandbox-dir option', () => {
      const { stdout } = runCli(['--sandbox-dir=.', '--', 'busybox', 'echo', 'test']);
      expect(stdout.trim()).toBe('test');
    });
  });

  describe('error handling', () => {
    it('should error when no runtime is given', () => {
      const { stderr, exitCode } = runCli([]);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('No runtime specified');
    });

    it('should error for unknown runtime', () => {
      const { stderr, exitCode } = runCli(['--', 'unknown-runtime']);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Unknown runtime');
    });
  });
});
