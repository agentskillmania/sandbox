/**
 * 单元测试：CLI 工具
 * 测试 exec-in-sandbox 命令行工具的各项功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { getWasmtimeExecutable } from '../../../src/lib/runtime.js';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json');

const cliPath = join(process.cwd(), 'dist/cli/index.js');
let wasmtimeInstalled: boolean;

beforeAll(() => {
  wasmtimeInstalled = existsSync(getWasmtimeExecutable());
});

/**
 * 辅助函数：执行 CLI 命令
 */
function execCli(args: string[], options: Record<string, string> = {}): string {
  const result = spawnSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...options },
  });
  return (result.stdout ?? '') + (result.stderr ?? '');
}

describe('CLI: version command', () => {
  it('should show version information', () => {
    const output = execCli(['version']);
    expect(output).toContain('@agentskillmania/sandbox');
    expect(output).toContain(pkg.version);
    expect(output).toContain('Runtimes');
  });

  it('should show runtime status', () => {
    const output = execCli(['version']);
    if (wasmtimeInstalled) {
      expect(output).toContain('wasmtime');
      expect(output).toMatch(/wasmtime|43\.0\.0/);
    } else {
      expect(output).toMatch(/not found|missing/);
    }
  });
});

describe('CLI: command execution', () => {
  it('should execute simple shell command', () => {
    const output = execCli(['--', 'echo hello']);
    expect(output).toContain('hello');
  });

  it('should execute ls command', () => {
    const output = execCli(['--', 'ls -la']);
    expect(output.length).toBeGreaterThan(0);
  });

  it('should execute python command', () => {
    const output = execCli(['--', "python -c 'print(42)'"]);
    expect(output).toContain('42');
  });

  it('should execute git --version', () => {
    const output = execCli(['--', 'git --version']);
    expect(output).toContain('git');
  });
});

describe('CLI: global options', () => {
  it('should accept --timeout option', () => {
    const output = execCli(['--timeout=1000', '--', 'echo test']);
    expect(output).toContain('test');
  });

  it('should accept --sandbox-dir option', () => {
    const output = execCli(['--sandbox-dir=.test-cli', '--', 'echo test']);
    expect(output).toContain('test');
  });

  it('should show version with global options', () => {
    const output = execCli(['--timeout=5000', 'version']);
    expect(output).toContain('@agentskillmania/sandbox');
  });
});

describe('CLI: error handling', () => {
  it('should handle empty command', () => {
    const output = execCli(['--']);
    expect(output).toMatch(/error|No command/);
  });

  it('should handle missing busybox.wasm gracefully', () => {
    if (!existsSync(join(process.cwd(), 'wasm', 'busybox.wasm'))) {
      const output = execCli(['--', 'ls']);
      expect(output).toMatch(/not found|does not exist/);
    }
  });

  it('should handle command execution errors', () => {
    const output = execCli(['--', 'invalid-command-that-does-not-exist-12345']);
    expect(output).toMatch(/error|failed|not found/);
  });
});

describe('CLI: help information', () => {
  it('should show general help', () => {
    const output = execCli(['--help']);
    expect(output).toContain('exec-in-sandbox');
    expect(output).toContain('unified WASM sandbox shell');
  });

  it('should show usage examples in help', () => {
    const output = execCli(['--help']);
    expect(output).toContain('Options');
  });

  it('should show all available commands', () => {
    const output = execCli(['--help']);
    expect(output).toContain('Commands');
  });
});
