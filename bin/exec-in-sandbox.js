#!/usr/bin/env node

/**
 * @agentskillmania/sandbox CLI 入口文件
 * CLI 命令: exec-in-sandbox
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// 导入 sandbox 模块
let sandbox;
try {
  sandbox = require('../lib/index.js');
} catch (error) {
  console.error('Error: Sandbox module not found. Make sure you have built the project.');
  process.exit(1);
}

// 配置 CLI 程序
program
  .name('exec-in-sandbox')
  .description('@agentskillmania/sandbox - Unified WASM sandbox for busybox and micropython')
  .version('0.1.0');

// exec 命令：执行命令
program
  .argument('[command...]', 'Command to execute')
  .option('-c, --code <code>', 'Execute Python code')
  .option('-t, --type <type>', 'Runtime type (busybox|python)', 'auto')
  .option('-d, --dir <dir>', 'Sandbox directory', '.sandbox')
  .option('--timeout <ms>', 'Execution timeout in milliseconds', '5000')
  .action(async (command, options) => {
    try {
      const sb = new sandbox.Sandbox({
        sandboxDir: options.dir,
        timeout: parseInt(options.timeout),
      });

      let result;

      if (options.code) {
        // 执行 Python 代码
        result = await sb.runPython(options.code);
      } else if (command && command.length > 0) {
        // 执行命令
        const cmd = command[0];
        const args = command.slice(1);

        if (options.type === 'python') {
          // 执行 Python 脚本
          result = await sb.runPythonScript(cmd, args);
        } else {
          // 执行 Shell 命令（默认）
          result = await sb.runShell(cmd, args);
        }
      } else {
        console.error('Error: No command specified. Use -c for Python code or provide a command.');
        process.exit(1);
      }

      // 输出结果
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }

      process.exit(result.exitCode);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// version 命令：显示运行时版本
program
  .command('version')
  .description('Show runtime versions')
  .action(async () => {
    try {
      const versions = await sandbox.getRuntimeVersions();
      console.log('@agentskillmania/sandbox version:', '0.1.0');
      console.log('');
      console.log('Runtimes:');
      for (const [name, info] of Object.entries(versions)) {
        console.log(`  ${name}:`, info.version || 'not found');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// install-runtime 命令：手动安装运行时
program
  .command('install-runtime')
  .description('Install or update wasmtime runtime')
  .action(async () => {
    const { installRuntime } = require('../scripts/install-runtime.js');
    const success = await installRuntime();
    process.exit(success ? 0 : 1);
  });

// 解析参数
program.parse();
