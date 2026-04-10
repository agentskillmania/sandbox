#!/usr/bin/env node
/**
 * @agentskillmania/sandbox CLI entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Sandbox } from '../lib/Sandbox.js';
import { initializeSecurityConfig } from '../lib/config.js';
import { getRuntimeVersions } from '../lib/runtime.js';
import type { SandboxConfig } from '../lib/types.js';

const program = new Command();

program
  .name('exec-in-sandbox')
  .description('@agentskillmania/sandbox - unified WASM sandbox tool')
  .version('0.1.0');

// Global options
program
  .option('--config <path>', 'Configuration file path')
  .option('--sandbox-dir <dir>', 'Sandbox directory (default: auto temp dir)')
  .option('--timeout <ms>', 'Execution timeout (milliseconds)', '5000')
  .option('--allow-network', 'Allow network access')
  .option('--command-allowlist <cmds>', 'Command allowlist (comma-separated)')
  .option('--command-blocklist <cmds>', 'Command blocklist (comma-separated)')
  .option('--network-allowlist <domains>', 'Network allowlist (comma-separated)')
  .option('--network-blocklist <domains>', 'Network blocklist (comma-separated)');

// busybox subcommand
program
  .command('busybox')
  .description('Execute Shell commands via busybox.wasm')
  .argument('[command...]', 'Command or script (e.g., "ls -la", "--list")')
  .option('-c, --code <command>', 'Execute command string')
  .action(async (command, options) => {
    try {
      // Initialize security configuration
      const securityConfig = await initializeSecurityConfig();
      const commandSecurity = securityConfig.getCommandSecurity();
      const networkSecurity = securityConfig.getNetworkSecurity();

      // Build config with security defaults
      const sandboxConfig = buildSandboxConfig(program.opts(), {
        commandMode: commandSecurity.mode,
        commandList: commandSecurity.list,
        networkMode: networkSecurity.mode,
        networkList: networkSecurity.list,
      });

      const sandbox = new Sandbox(sandboxConfig);

      let result;

      if (options.code) {
        // -c mode: execute command string
        result = await sandbox.runShell(options.code, []);
      } else if (command && command.length > 0) {
        // Execute with command and args
        const cmd = command[0];
        const args = command.slice(1);
        result = await sandbox.runShell(cmd, args);
      } else {
        // No command specified, run busybox to show its built-in help
        result = await sandbox.runShell('', []);
      }

      // Output result
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }

      process.exit(result.exitCode);
    } catch (error: any) {
      handleError(error);
    }
  });

// python subcommand
program
  .command('python')
  .description('Execute Python code')
  .argument('[script...]', 'Python script')
  .option('-c, --code <code>', 'Execute Python code')
  .action(async (script, options) => {
    try {
      // Initialize security configuration
      const securityConfig = await initializeSecurityConfig();
      const commandSecurity = securityConfig.getCommandSecurity();
      const networkSecurity = securityConfig.getNetworkSecurity();

      // Build config with security defaults
      const sandboxConfig = buildSandboxConfig(program.opts(), {
        commandMode: commandSecurity.mode,
        commandList: commandSecurity.list,
        networkMode: networkSecurity.mode,
        networkList: networkSecurity.list,
      });

      const sandbox = new Sandbox(sandboxConfig);

      let result;

      if (options.code) {
        // -c mode: execute code
        result = await sandbox.runPython(options.code);
      } else if (script && script.length > 0) {
        // File mode
        const scriptPath = script[0];
        const args = script.slice(1);
        result = await sandbox.runPythonScript(scriptPath, args);
      } else {
        console.error(chalk.red('Error: No Python code or script specified'));
        process.exit(1);
      }

      // Output result
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }

      process.exit(result.exitCode);
    } catch (error: any) {
      handleError(error);
    }
  });

// version command
program
  .command('version')
  .description('Display runtime version information')
  .action(async () => {
    const versions = getRuntimeVersions();

    console.log(chalk.bold('@agentskillmania/sandbox version: 0.1.0\n'));

    console.log(chalk.bold('Runtimes:'));
    console.log(`  wasmtime: ${formatVersion(versions.wasmtime)}`);
    console.log(`  busybox.wasm: ${formatVersion(versions.busybox)}`);
    console.log(`  micropython.wasm: ${formatVersion(versions.micropython)}`);
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

/**
 * Build SandboxConfig from CLI options and security defaults
 */
function buildSandboxConfig(
  opts: any,
  securityDefaults?: {
    commandMode?: 'whitelist' | 'blacklist';
    commandList?: string[];
    networkMode?: 'whitelist' | 'blacklist';
    networkList?: string[];
  }
): SandboxConfig {
  const config: SandboxConfig = {};

  // Apply sandbox directory if specified
  if (opts.sandboxDir) {
    config.sandboxDir = opts.sandboxDir;
  }

  // Apply timeout if specified
  if (opts.timeout) {
    config.timeout = parseInt(opts.timeout);
  }

  // Apply network setting
  // CLI --allow-network overrides security defaults
  // If not specified, use security defaults (whitelist mode enables network, blacklist disables it)
  if (opts.allowNetwork !== undefined) {
    config.allowNetwork = opts.allowNetwork;
  } else if (securityDefaults?.networkMode) {
    // whitelist mode = enable network + allowlist, blacklist mode = disable network
    config.allowNetwork = securityDefaults.networkMode === 'whitelist';
  }

  // Apply command allowlist/blocklist
  if (opts.commandAllowlist) {
    config.commandAllowlist = opts.commandAllowlist.split(',');
  } else if (opts.commandBlocklist) {
    config.commandBlocklist = opts.commandBlocklist.split(',');
  } else if (securityDefaults?.commandMode && securityDefaults.commandList) {
    // Apply security defaults
    if (securityDefaults.commandMode === 'whitelist') {
      config.commandAllowlist = securityDefaults.commandList;
    } else {
      config.commandBlocklist = securityDefaults.commandList;
    }
  }

  // Apply network allowlist/blocklist
  // CLI parameters override security defaults
  if (opts.networkAllowlist) {
    config.networkAllowlist = opts.networkAllowlist.split(',');
  } else if (opts.networkBlocklist) {
    config.networkBlocklist = opts.networkBlocklist.split(',');
  } else if (securityDefaults?.networkMode && securityDefaults.networkList) {
    // Apply security defaults
    if (securityDefaults.networkMode === 'whitelist') {
      config.networkAllowlist = securityDefaults.networkList;
    } else {
      config.networkBlocklist = securityDefaults.networkList;
    }
  }

  return config;
}

/**
 * Format version information
 */
function formatVersion(info: { found: boolean; version?: string; path?: string }): string {
  if (!info.found) {
    return chalk.red('not found');
  }
  return chalk.green(`${info.version} (${info.path})`);
}

/**
 * Error handling
 */
function handleError(error: any): void {
  if (error.name === 'SecurityError') {
    console.error(chalk.red('Security Error:'), error.message);
    console.error(chalk.yellow('Tip: Use --command-allowlist to enable commands'));
  } else if (error.name === 'TimeoutError') {
    console.error(chalk.red('Timeout Error:'), error.message);
  } else if (error.name === 'ConfigError') {
    console.error(chalk.red('Configuration Error:'), error.message);
  } else {
    console.error(chalk.red('Error:'), error.message);
  }
  process.exit(1);
}

// Parse arguments
program.parse();
