#!/usr/bin/env node
/**
 * @agentskillmania/sandbox CLI entry point
 *
 * Syntax: exec-in-sandbox [OPTIONS] -- <runtime> [argv...]
 *
 * Examples:
 *   exec-in-sandbox --timeout 5000 -- busybox ls -la
 *   exec-in-sandbox --sandbox-dir=. -- sh -c "echo hello"
 *   exec-in-sandbox -- python -c "print(42)"
 *   exec-in-sandbox -- busybox --list
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import { Executor } from '../lib/core/executor.js';
import type { ExecutionRequest } from '../lib/core/types.js';
import { initializeSecurityConfig } from '../lib/config.js';
import { getRuntimeVersions, getWasmtimeExecutable, getWasmPaths } from '../lib/runtime.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const program = new Command();

program
  .name('exec-in-sandbox')
  .description('@agentskillmania/sandbox - unified WASM sandbox tool')
  .version(pkg.version);

// Global options
program
  .option('--timeout <ms>', 'Execution timeout (milliseconds)', '5000')
  .option('--sandbox-dir <dir>', 'Sandbox directory (default: auto temp dir)')
  .option('--allow-network', 'Allow network access')
  .option('--command-allowlist <cmds>', 'Command allowlist (comma-separated)')
  .option('--command-blocklist <cmds>', 'Command blocklist (comma-separated)')
  .option('--network-allowlist <domains>', 'Network allowlist (comma-separated)')
  .option('--network-blocklist <domains>', 'Network blocklist (comma-separated)')
  .argument('[args...]', 'Runtime and arguments after --');

program.action(async (args, options) => {
  try {
    if (args.length === 0) {
      console.error(chalk.red('Error: No runtime specified'));
      console.error('Usage: exec-in-sandbox [options] -- <runtime> [args...]');
      console.error('  exec-in-sandbox -- busybox ls -la');
      console.error('  exec-in-sandbox -- sh -c "echo hello"');
      console.error('  exec-in-sandbox -- python -c "print(42)"');
      process.exit(1);
    }

    const [runtimeName, ...argv] = args;

    // Map user-friendly names to internal runtime names
    const runtimeMap: Record<string, ExecutionRequest['runtime']> = {
      busybox: 'busybox',
      bb: 'busybox',
      sh: 'sh',
      wsh: 'sh',
      python: 'python',
      py: 'python',
      micropython: 'python',
    };

    const runtime = runtimeMap[runtimeName];
    if (!runtime) {
      console.error(chalk.red(`Error: Unknown runtime '${runtimeName}'`));
      console.error(`Supported: ${Object.keys(runtimeMap).join(', ')}`);
      process.exit(1);
    }

    const securityConfig = await initializeSecurityConfig();
    const commandSecurity = securityConfig.getCommandSecurity();

    const commandPolicy =
      commandSecurity.mode && commandSecurity.list && commandSecurity.list.length > 0
        ? { mode: commandSecurity.mode, list: commandSecurity.list }
        : undefined;

    const wasmPaths = getWasmPaths();

    const executor = new Executor({
      wasmtimePath: getWasmtimeExecutable(),
      busyboxPath: wasmPaths.busybox,
      micropythonPath: wasmPaths.micropython,
      sandboxDir: options.sandboxDir || 'auto',
      timeout: parseInt(options.timeout),
      allowNetwork: options.allowNetwork || false,
      commandPolicy,
    });

    // python (micropython) does not support -c; it takes code directly
    const normalizedArgv = runtime === 'python' && argv[0] === '-c' ? argv.slice(1) : argv;

    const result = await executor.exec({ runtime, argv: normalizedArgv });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode);
  } catch (error: any) {
    if (error.name === 'SecurityError') {
      console.error(chalk.red('Security Error:'), error.message);
    } else if (error.name === 'TimeoutError') {
      console.error(chalk.red('Timeout Error:'), error.message);
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
  }
});

// version command
program
  .command('version')
  .description('Display runtime version information')
  .action(async () => {
    const versions = getRuntimeVersions();
    console.log(chalk.bold(`@agentskillmania/sandbox version: ${pkg.version}\n`));
    console.log(chalk.bold('Runtimes:'));
    console.log(`  wasmtime: ${formatVersion(versions.wasmtime)}`);
    console.log(`  busybox.wasm: ${formatVersion(versions.busybox)}`);
    console.log(`  python.wasm (micropython): ${formatVersion(versions.micropython)}`);
  });

// install-runtime command
program
  .command('install-runtime')
  .description('Install wasmtime runtime')
  .action(async () => {
    const { installRuntime } = await import('../../scripts/install-runtime.cjs');
    const success = await installRuntime();
    process.exit(success ? 0 : 1);
  });

function formatVersion(info: { found: boolean; version?: string; path?: string }): string {
  if (!info.found) return chalk.red('not found');
  return chalk.green(`${info.version} (${info.path})`);
}

program.parse();
