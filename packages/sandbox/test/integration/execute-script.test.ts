import { describe, it, expect, beforeAll } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { existsSync, copyFileSync } from 'node:fs';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';
import { join } from 'node:path';

describe('Script Execution Integration Tests', () => {
  let wasmtimePath: string;
  const fixturesDir = join(process.cwd(), 'test/fixtures');
  const scriptsDir = join(fixturesDir, 'scripts');

  beforeAll(() => {
    wasmtimePath = getWasmtimeExecutable();
  });

  describe('wasmtime availability', () => {
    it('should have wasmtime installed', () => {
      expect(existsSync(wasmtimePath)).toBe(true);
    });
  });

  describe('Shell script execution', () => {
    it('should execute simple shell script', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'simple.sh');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from shell script');
    }, 10000);

    it('should execute script with variables and conditions', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'variables.sh');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello, World!');
      expect(result.stdout).toContain('Count is: 5');
      expect(result.stdout).toContain('Count is greater than 3');
    }, 10000);

    it('should execute script with advanced features', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'functions.sh');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Simple arithmetic: 30');
      expect(result.stdout).toContain('Command substitution: nested');
    }, 10000);
  });

  describe('Python script execution', () => {
    it('should execute simple Python script', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'simple.py');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from Python script');
    }, 10000);

    it('should execute Python data processing script', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'data_processing.py');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('total: 9');
      expect(result.stdout).toContain('sum: 195');
      expect(result.stdout).toContain('avg:');
    }, 10000);
  });

  describe('Shebang parsing', () => {
    it('should handle standard sh shebang', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'various-shebangs.sh');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Standard sh shebang');
    }, 10000);

    it('should handle bash shebang', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'shebang-bash.sh');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Bash shebang');
    }, 10000);

    it('should handle env wrapper shebang for Python', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });
      const scriptPath = join(scriptsDir, 'shebang-env-python.py');

      const result = await sandbox.run(scriptPath);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Env wrapper Python shebang');
    }, 10000);
  });

  describe('runPython SDK method', () => {
    it('should execute Python code string', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });

      const result = await sandbox.run('python -c \'print("Hello from SDK")\'');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Hello from SDK');
    }, 10000);

    it('should execute Python code with variables', async () => {
      const sandbox = new Sandbox({ sandboxDir: '.sandbox-test-script' });

      const result = await sandbox.run("python -c 'x = 10; y = 20; print(x + y)'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('30');
    }, 10000);
  });

  describe('runPythonScript SDK method', () => {
    it('should execute Python script file', async () => {
      const sandboxDir = '.sandbox-test-script';
      const sandbox = new Sandbox({ sandboxDir });
      const scriptPath = join(scriptsDir, 'simple.py');

      copyFileSync(scriptPath, join(sandboxDir, 'simple.py'));

      const result = await sandbox.run('python /simple.py');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from Python script');
    }, 10000);
  });
});
