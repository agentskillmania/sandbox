#!/usr/bin/env node

/**
 * @agentskillmania/sandbox 运行时自动下载脚本
 *
 * 功能：
 * 1. 检测专用 wasmtime 是否已安装
 * 2. 如果没有，自动下载对应平台的二进制文件
 * 3. 安装到 ~/.agentskillmania/sandbox/bin/ 目录（专用版本，不复用系统）
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// 配置
const CONFIG = {
  runtimeName: 'wasmtime',
  installDir: path.join(os.homedir(), '.agentskillmania', 'sandbox', 'bin'),
  repo: 'bytecodealliance/wasmtime',
  // 固定版本，确保兼容性
  version: '43.0.0',
};

// 平台映射
const PLATFORM_MAP = {
  darwin: {
    x64: 'x86_64-macos',
    arm64: 'aarch64-macos',
  },
  linux: {
    x64: 'x86_64-linux',
    arm64: 'aarch64-linux',
  },
  win32: {
    x64: 'x86_64-windows',
    arm64: 'aarch64-windows',
  },
};

/**
 * 获取系统平台信息
 */
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  // Node.js 的 arch 映射到 wasmtime 的 arch
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'x86', // wasmtime 可能不支持
  };

  const wasmtimeArch = archMap[arch] || arch;
  const wasmtimePlatform = PLATFORM_MAP[platform]?.[wasmtimeArch];

  if (!wasmtimePlatform) {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }

  return {
    platform,
    arch: wasmtimeArch,
    wasmtimePlatform,
    fileExtension: platform === 'win32' ? 'zip' : 'tar.xz',
  };
}

/**
 * 检测专用 wasmtime 是否已安装
 */
function checkInstalledWasmtime() {
  const wasmtimePath = path.join(CONFIG.installDir, CONFIG.runtimeName);

  if (!fs.existsSync(wasmtimePath)) {
    return { found: false, path: wasmtimePath };
  }

  try {
    const version = execSync(`"${wasmtimePath}" --version`, { encoding: 'utf-8' });
    return { found: true, version: version.trim(), path: wasmtimePath };
  } catch (error) {
    return { found: false, error: error.message, path: wasmtimePath };
  }
}

/**
 * 获取专用 wasmtime 的路径
 */
function getWasmtimePath() {
  return path.join(CONFIG.installDir, CONFIG.runtimeName);
}

/**
 * 检测系统是否有 curl 命令
 */
function hasCurl() {
  try {
    execSync('curl --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 curl 下载文件（支持代理）
 */
function downloadWithCurl(url, destPath) {
  return new Promise((resolve, reject) => {
    // curl 会自动读取 HTTP_PROXY、HTTPS_PROXY、NO_PROXY 等环境变量
    // -L: 跟随重定向
    // -f: HTTP 错误时失败
    // -s: 静默模式
    // -S: 显示错误
    // --connect-timeout: 连接超时
    const cmd = `curl -fLsS --connect-timeout 30 "${url}" -o "${destPath}"`;

    execSync(cmd, { stdio: 'inherit' });
    resolve(destPath);
  });
}

/**
 * 使用 Node.js 原生 https 下载（fallback）
 */
function downloadWithNative(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(destPath);

    proto.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // 处理重定向
        downloadWithNative(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });

      file.on('error', (error) => {
        fs.unlink(destPath, () => {}); // 删除不完整的文件
        reject(error);
      });
    }).on('error', reject);
  });
}

/**
 * 下载文件（优先使用 curl，支持代理）
 */
async function downloadFile(url, destPath) {
  if (hasCurl()) {
    console.log('  Using curl (respects HTTP_PROXY, HTTPS_PROXY)');
    return downloadWithCurl(url, destPath);
  } else {
    console.log('  Using native Node.js (note: does not respect proxy env vars)');
    return downloadWithNative(url, destPath);
  }
}

/**
 * 解压下载的文件
 */
async function extractArchive(archivePath, destDir) {
  // 确保目标目录存在
  fs.mkdirSync(destDir, { recursive: true });

  if (archivePath.endsWith('.tar.xz')) {
    // macOS 和 Linux 的 tar.xz
    execSync(`tar -xJf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  } else if (archivePath.endsWith('.zip')) {
    // Windows 的 zip
    execSync(`unzip "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}

/**
 * 主安装函数
 */
async function installRuntime() {
  try {
    console.log('🔍 Checking for wasmtime...');

    // 1. 检查专用 wasmtime 是否已安装
    const checkResult = checkInstalledWasmtime();
    if (checkResult.found) {
      console.log(`✅ wasmtime already installed at: ${checkResult.path}`);
      console.log(`   Version: ${checkResult.version}`);
      return true;
    }

    console.log('❌ wasmtime not found, installing...');

    // 2. 获取平台信息
    const platformInfo = getPlatformInfo();
    console.log(`📦 Platform: ${platformInfo.platform}-${platformInfo.arch}`);

    // 3. 使用固定版本
    const version = `v${CONFIG.version}`;
    console.log(`📌 Version: ${version}`);

    // 4. 构建下载 URL
    // 格式: wasmtime-v43.0.0-aarch64-macos.tar.xz
    const filename = `${CONFIG.runtimeName}-${version}-${platformInfo.wasmtimePlatform}.${platformInfo.fileExtension}`;
    const downloadUrl = `https://github.com/${CONFIG.repo}/releases/download/${version}/${filename}`;
    console.log(`⬇️  Downloading from: ${downloadUrl}`);

    // 5. 创建临时目录
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-'));
    const archivePath = path.join(tmpDir, filename);

    // 6. 下载文件
    await downloadFile(downloadUrl, archivePath);
    console.log('✅ Download complete');

    // 7. 解压文件
    console.log('📂 Extracting archive...');
    await extractArchive(archivePath, tmpDir);

    // 8. 安装到目标目录
    console.log(`📦 Installing to ${CONFIG.installDir}`);
    fs.mkdirSync(CONFIG.installDir, { recursive: true });

    // 查找解压后的可执行文件
    const extractedDir = path.join(tmpDir, CONFIG.runtimeName + '-' + version);
    const binDir = path.join(extractedDir, CONFIG.runtimeName);

    if (fs.existsSync(binDir)) {
      // 复制可执行文件
      const files = fs.readdirSync(binDir);
      for (const file of files) {
        const srcPath = path.join(binDir, file);
        const destPath = path.join(CONFIG.installDir, file);
        fs.copyFileSync(srcPath, destPath);
        fs.chmodSync(destPath, 0o755); // 确保可执行
      }
    } else {
      throw new Error('Could not find extracted binaries');
    }

    // 9. 清理临时文件
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // 10. 验证安装
    const installedPath = path.join(CONFIG.installDir, CONFIG.runtimeName);
    try {
      const version = execSync(`"${installedPath}" --version`, { encoding: 'utf-8' });
      console.log(`✅ Installation successful: ${version.trim()}`);
      console.log(`📁 Installed at: ${installedPath}`);
    } catch (error) {
      throw new Error('Installation verification failed');
    }

    return true;
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.error('\n💡 Tips:');
    console.error('  • If behind a proxy, set HTTP_PROXY or HTTPS_PROXY:');
    console.error('    export HTTP_PROXY=http://proxy.example.com:7890');
    console.error('    export HTTPS_PROXY=http://proxy.example.com:7890');
    console.error('  • Or download manually:');
    console.error(`    https://github.com/${CONFIG.repo}/releases/download/v${CONFIG.version}/`);
    console.error(`  • Extract and copy to: ${CONFIG.installDir}`);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  installRuntime()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  installRuntime,
  checkInstalledWasmtime,
  getWasmtimePath,
  getPlatformInfo,
  CONFIG,
};
