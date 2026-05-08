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
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
      expect(stdout).toContain('Runtimes');
    });
  });

  describe('command execution', () => {
    it('should execute ls -la', () => {
      const { stdout, stderr } = runCli(['--sandbox-dir=.', '--', 'ls -la']);
      const combined = stdout + stderr;
      expect(combined).toContain('total');
    });

    it('should execute echo -n hello', () => {
      const { stdout } = runCli(['--', 'echo -n hello']);
      expect(stdout.trim()).toBe('hello');
    });

    it('should execute echo hello', () => {
      const { stdout } = runCli(['--', 'echo hello']);
      expect(stdout.trim()).toBe('hello');
    });

    it('should execute arithmetic expression', () => {
      const { stdout } = runCli(['--', 'X=10; Y=20; echo $((X + Y))']);
      expect(stdout.trim()).toBe('30');
    });

    it('should handle comments in script', () => {
      const { stdout } = runCli(['--', '# comment\nX=5\necho $X']);
      expect(stdout.trim()).toBe('5');
    });
  });

  describe('micropython execution', () => {
    it('should execute python -c print', () => {
      const { stdout } = runCli(['--', "python -c 'print(42)'"]);
      expect(stdout.trim()).toBe('42');
    });
  });

  describe('CLI options', () => {
    it('should accept timeout option', () => {
      const { stdout } = runCli(['--timeout=1000', '--', 'echo test']);
      expect(stdout.trim()).toBe('test');
    });

    it('should accept sandbox-dir option', () => {
      const { stdout } = runCli(['--sandbox-dir=.', '--', 'echo test']);
      expect(stdout.trim()).toBe('test');
    });
  });

  describe('error handling', () => {
    it('should error when no command is given', () => {
      const { stderr, exitCode } = runCli([]);
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('No command specified');
    });

    it('should error for unknown command', () => {
      const { stdout, stderr, exitCode } = runCli(['--', 'unknown-runtime']);
      expect(exitCode).not.toBe(0);
      const combined = stdout + stderr;
      expect(combined).toContain('applet not found');
    });
  });
});
