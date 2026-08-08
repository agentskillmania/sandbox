#!/usr/bin/env node
/**
 * @agentskillmania/sandbox CLI entry point
 *
 * Syntax: exec-in-sandbox [OPTIONS] -- <command>
 *
 * All commands are executed in an isolated WASM sandbox.
 *
 * Examples:
 *   exec-in-sandbox -- "ls -la"
 *   exec-in-sandbox -- "python -c 'print(42)'"
 *   exec-in-sandbox -- "git status"
 *   exec-in-sandbox -- "cat file.txt | grep hello"
 */

import { createRequire } from 'node:module';

import chalk from 'chalk';
import { Command } from 'commander';

import { initializeSecurityConfig } from '../lib/config.js';
import { getRuntimeVersions } from '../lib/runtime.js';
import { Sandbox } from '../lib/Sandbox.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const program = new Command();

program
  .name('exec-in-sandbox')
  .description('@agentskillmania/sandbox - unified WASM sandbox shell')
  .version(pkg.version);

// Global options
program
  .option('--timeout <ms>', 'Execution timeout (milliseconds)', '5000')
  .option('--sandbox-dir <dir>', 'Sandbox directory (default: auto temp dir)')
  .option('--allow-network', 'Allow network access')
  .argument('[command]', 'Command to execute after --');

export interface CLIOptions {
  timeout: string;
  sandboxDir?: string;
  allowNetwork?: string | boolean;
}

/**
 * Execute a command via the sandbox CLI.
 * Extracted from Commander action handler for testability.
 */
export async function executeCommand(
  command: string | undefined,
  options: CLIOptions
): Promise<void> {
  if (!command || command.length === 0) {
    console.error(chalk.red('Error: No command specified'));
    console.error('Usage: exec-in-sandbox [options] -- <command>');
    console.error('  exec-in-sandbox -- "ls -la"');
    console.error('  exec-in-sandbox -- "python -c \'print(42)\'"');
    console.error('  exec-in-sandbox -- "git status"');
    process.exit(1);
    return; // unreachable in production, guards against mocked exit in tests
  }

  const securityConfig = await initializeSecurityConfig();
  const commandSecurity = securityConfig.getCommandSecurity();

  const commandPolicy =
    commandSecurity.mode && commandSecurity.list && commandSecurity.list.length > 0
      ? { mode: commandSecurity.mode, list: commandSecurity.list }
      : undefined;

  const sandbox = new Sandbox({
    sandboxDir: options.sandboxDir || 'auto',
    timeout: parseInt(options.timeout),
    allowNetwork: options.allowNetwork ? options.allowNetwork !== 'false' : false,
    commandPolicy,
  });

  const result = await sandbox.run(command);

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
  // unreachable in production — return guards against mocked exit in tests
}

/**
 * Display runtime version information.
 */
export async function showVersion(): Promise<void> {
  const versions = getRuntimeVersions();
  console.log(chalk.bold(`@agentskillmania/sandbox version: ${pkg.version}\n`));
  console.log(chalk.bold('Runtimes:'));
  console.log(`  wasmtime: ${formatVersion(versions.wasmtime)}`);
  console.log(`  busybox.wasm: ${formatVersion(versions.busybox)}`);
}

/**
 * Install wasmtime runtime.
 */
export async function installRuntimeCommand(): Promise<void> {
  const { installRuntime } = await import('../../scripts/install-runtime.cjs');
  const success = await installRuntime();
  process.exit(success ? 0 : 1);
}

export function formatVersion(info: { found: boolean; version?: string; path?: string }): string {
  if (!info.found) return chalk.red('not found');
  return chalk.green(`${info.version} (${info.path})`);
}

program.action(async (command, options) => {
  try {
    await executeCommand(command, options);
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
program.command('version').description('Display runtime version information').action(showVersion);

// install-runtime command
program
  .command('install-runtime')
  .description('Install wasmtime runtime')
  .action(installRuntimeCommand);

program.parse();
