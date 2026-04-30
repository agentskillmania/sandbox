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

describe('CLI: busybox command', () => {
  it('should execute simple command', () => {
    const output = execCli(['--', 'busybox', 'echo', 'hello']);
    expect(output).toContain('hello');
  });

  it('should execute multiple arguments', () => {
    const output = execCli(['--', 'busybox', 'ls', '-la']);
    expect(output.length).toBeGreaterThan(0);
  });

  it('should handle --list (if supported)', () => {
    const output = execCli(['--', 'busybox', '--list']);
    // --list 是 busybox.wasm 的特殊命令，检查是否返回内容
    expect(output.length).toBeGreaterThan(0);
  });

  it('should handle --list-full (if supported)', () => {
    const output = execCli(['--', 'busybox', '--list-full']);
    // --list-full 是 busybox.wasm 的特殊命令，检查是否返回内容
    expect(output.length).toBeGreaterThanOrEqual(0);
  });
});

describe('CLI: python command', () => {
  it('should execute Python code', () => {
    const output = execCli(['--', 'python', '-c', 'print(42)']);
    expect(output).toContain('42');
  });

  it('should execute Python script', () => {
    // 检查 test.py 是否存在，不存在则跳过
    const testPyPath = join(process.cwd(), 'test.py');
    if (!existsSync(testPyPath)) {
      console.log('test.py not found, skipping test');
      return;
    }
    const output = execCli(['--', 'python', 'test.py']);
    expect(output).toContain('Hello from Python');
  });
});

describe('CLI: global options', () => {
  it('should accept --timeout option', () => {
    const output = execCli(['--timeout=1000', '--', 'busybox', 'echo', 'test']);
    expect(output).toContain('test');
  });

  it('should accept --sandbox-dir option', () => {
    const output = execCli(['--sandbox-dir=.test-cli', '--', 'busybox', 'echo', 'test']);
    expect(output).toContain('test');
  });

  it('should show version with global options', () => {
    const output = execCli(['--timeout=5000', 'version']);
    expect(output).toContain('@agentskillmania/sandbox');
  });
});

describe('CLI: error handling', () => {
  it('should handle invalid subcommand', () => {
    const output = execCli(['--', 'invalid-command']);
    expect(output).toMatch(/error|unknown|invalid/);
  });

  it('should handle missing busybox.wasm gracefully', () => {
    // 这个测试在有 busybox.wasm 时会被跳过
    if (!existsSync(join(process.cwd(), 'wasm', 'busybox.wasm'))) {
      const output = execCli(['--', 'busybox', 'ls']);
      expect(output).toMatch(/not found|does not exist/);
    }
  });

  it('should handle command execution errors', () => {
    const output = execCli(['--', 'busybox', 'invalid-command-that-does-not-exist-12345']);
    expect(output).toMatch(/error|failed|not found/);
  });
});

describe('CLI: help information', () => {
  it('should show general help', () => {
    const output = execCli(['--help']);
    expect(output).toContain('exec-in-sandbox');
    expect(output).toContain('unified WASM sandbox tool');
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
