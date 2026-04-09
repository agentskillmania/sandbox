/**
 * @agentskillmania/sandbox SDK
 *
 * 轻量级沙箱执行环境 — 支持 Shell 命令和 Python 代码
 * 基于 WASM/WASI 技术，提供快速启动和低资源占用的执行环境
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 导入运行时工具函数
const { getWasmtimePath } = require('../scripts/install-runtime.js');

// 默认配置
const DEFAULT_CONFIG = {
  sandboxDir: '.sandbox',
  timeout: 5000,
  // WASM 模块路径（相对于此包的安装位置）
  busyboxPath: path.join(__dirname, '..', 'wasm', 'busybox.wasm'),
  micropythonPath: path.join(__dirname, '..', 'wasm', 'micropython.wasm'),
};

/**
 * 获取专用 wasmtime 路径
 * 优先使用自己安装的版本，确保版本兼容性
 */
function getWasmtimeExecutable() {
  return getWasmtimePath();
}

/**
 * 沙箱类
 */
class Sandbox {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.sandboxDir = this.config.sandboxDir;

    // 确保沙箱目录存在
    this._ensureSandboxDir();
  }

  /**
   * 确保沙箱目录存在
   */
  _ensureSandboxDir() {
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }
  }

  /**
   * 执行 Shell 命令（通过 busybox.wasm）
   */
  async runShell(command, args = []) {
    return this._execWasm(this.config.busyboxPath, [command, ...args]);
  }

  /**
   * 执行 Python 代码
   */
  async runPython(code) {
    return this._execWasm(this.config.micropythonPath, ['-c', code]);
  }

  /**
   * 执行 Python 脚本文件
   */
  async runPythonScript(scriptPath, args = []) {
    return this._execWasm(this.config.micropythonPath, [scriptPath, ...args]);
  }

  /**
   * 执行 WASM 模块（内部方法）
   */
  _execWasm(modulePath, args) {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // 检查模块是否存在
      if (!fs.existsSync(modulePath)) {
        reject(new Error(`WASM module not found: ${modulePath}`));
        return;
      }

      // 获取专用 wasmtime 路径
      const wasmtimeExe = getWasmtimeExecutable();
      if (!fs.existsSync(wasmtimeExe)) {
        reject(new Error(
          `Wasmtime not found at: ${wasmtimeExe}\n` +
          `Please run: npm install @agentskillmania/sandbox`
        ));
        return;
      }

      // 启动 wasmtime 进程（使用专用版本）
      const proc = spawn(wasmtimeExe, [
        '-S', 'cli=y',
        '-W', 'exceptions=y',
        '--dir', this.sandboxDir,
        modulePath,
        ...args,
      ]);

      // 设置超时
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      // 收集输出
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        resolve({
          stdout,
          stderr,
          exitCode: code,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * 获取运行时版本信息
   */
  static async getRuntimeVersions() {
    const { execSync } = require('child_process');
    const { checkInstalledWasmtime, CONFIG: installConfig } = require('../scripts/install-runtime.js');

    const versions = {};

    // 检查专用 wasmtime
    const wasmtimeCheck = checkInstalledWasmtime();
    versions.wasmtime = {
      found: wasmtimeCheck.found,
      version: wasmtimeCheck.found ? wasmtimeCheck.version : null,
      path: getWasmtimeExecutable(),
      expectedVersion: `v${installConfig.version}`,
    };

    // 检查 WASM 模块
    versions.busybox = {
      found: fs.existsSync(DEFAULT_CONFIG.busyboxPath),
      path: DEFAULT_CONFIG.busyboxPath,
    };

    versions.micropython = {
      found: fs.existsSync(DEFAULT_CONFIG.micropythonPath),
      path: DEFAULT_CONFIG.micropythonPath,
    };

    return versions;
  }
}

module.exports = { Sandbox };
