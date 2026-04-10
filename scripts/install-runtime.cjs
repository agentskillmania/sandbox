#!/usr/bin/env node

/**
 * @agentskillmania/sandbox Runtime Auto-Installation Script
 *
 * Features:
 * 1. Detect if dedicated wasmtime is installed
 * 2. If not, automatically download platform-specific binaries
 * 3. Install to ~/.agentskillmania/sandbox/wasmtime/ directory (dedicated version, not reusing system version)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const AdmZip = require('adm-zip');
const mkdirp = require('mkdirp');

// Configuration
const CONFIG = {
  runtimeName: 'wasmtime',
  installDir: path.join(os.homedir(), '.agentskillmania', 'sandbox', 'wasmtime'),
  repo: 'bytecodealliance/wasmtime',
  // Fixed version for compatibility
  version: '43.0.0',
};

// Platform mapping
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
 * Get system platform information
 */
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  // Node.js arch mapping to wasmtime arch
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'x86', // wasmtime may not support
  };

  const wasmtimeArch = archMap[arch] || arch;
  const wasmtimePlatform = PLATFORM_MAP[platform]?.[wasmtimeArch];

  if (!wasmtimePlatform) {
    throw new Error('Unsupported platform: ' + platform + '-' + arch);
  }

  return {
    platform,
    arch: wasmtimeArch,
    wasmtimePlatform,
    fileExtension: platform === 'win32' ? 'zip' : 'tar.xz',
  };
}

/**
 * Check if dedicated wasmtime is installed
 */
function checkInstalledWasmtime() {
  const wasmtimePath = path.join(CONFIG.installDir, CONFIG.runtimeName);

  if (!fs.existsSync(wasmtimePath)) {
    return { found: false, path: wasmtimePath };
  }

  try {
    const version = execSync('"' + wasmtimePath + '" --version', { encoding: 'utf-8' });
    return { found: true, version: version.trim(), path: wasmtimePath };
  } catch (error) {
    return { found: false, error: error.message, path: wasmtimePath };
  }
}

/**
 * Get dedicated wasmtime path
 */
function getWasmtimePath() {
  return path.join(CONFIG.installDir, CONFIG.runtimeName);
}

/**
 * Check if system has curl command
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
 * Download file using curl (supports proxy)
 */
function downloadWithCurl(url, destPath) {
  return new Promise((resolve, reject) => {
    // curl automatically reads HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars
    // -L: follow redirects
    // -f: fail on HTTP errors
    // -s: silent mode
    // -S: show errors
    // --connect-timeout: connection timeout
    const cmd = "curl -fLsS --connect-timeout 30 \"" + url + "\" -o \"" + destPath + "\"";

    execSync(cmd, { stdio: 'inherit' });
    resolve(destPath);
  });
}

/**
 * Download file using Node.js native https (fallback)
 */
function downloadWithNative(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(destPath);

    proto.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Handle redirect
        downloadWithNative(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error('Download failed (status ' + res.statusCode + ')'));
        return;
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });

      file.on('error', (error) => {
        fs.unlink(destPath, () => {}); // Delete incomplete file
        reject(error);
      });
    }).on('error', reject);
  });
}

/**
 * Download file (prefer curl, supports proxy)
 */
async function downloadFile(url, destPath) {
  if (hasCurl()) {
    console.log('  Using curl download (supports HTTP_PROXY env vars)');
    return downloadWithCurl(url, destPath);
  } else {
    console.log('  Using native Node.js download (note: does not support proxy env vars)');
    return downloadWithNative(url, destPath);
  }
}

/**
 * Extract downloaded archive (cross-platform)
 */
async function extractArchive(archivePath, destDir) {
  // Ensure target directory exists
  mkdirp.sync(destDir);

  if (archivePath.endsWith('.zip')) {
    // Windows .zip - use adm-zip
    console.log('  Extracting .zip file using adm-zip');
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(destDir, true);
  } else if (archivePath.endsWith('.tar.xz')) {
    // macOS and Linux tar.xz - use tar command
    console.log('  Extracting .tar.xz file using tar');
    execSync('tar -xJf "' + archivePath + '" -C "' + destDir + '"', { stdio: 'inherit' });
  } else {
    throw new Error('Unsupported archive format: ' + archivePath);
  }
}

/**
 * Main installation function
 */
async function installRuntime() {
  try {
    console.log('🔍 Checking wasmtime...');

    // 1. Check if dedicated wasmtime is installed
    const checkResult = checkInstalledWasmtime();
    if (checkResult.found) {
      console.log('✅ wasmtime already installed: ' + checkResult.path);
      console.log('   Version: ' + checkResult.version);
      return true;
    }

    console.log('❌ wasmtime not found, installing...');

    // 2. Get platform information
    const platformInfo = getPlatformInfo();
    console.log('📦 Platform: ' + platformInfo.platform + '-' + platformInfo.arch);

    // 3. Use fixed version
    const version = 'v' + CONFIG.version;
    console.log('📌 Version: ' + version);

    // 4. Build download URL
    // Format: wasmtime-v43.0.0-aarch64-macos.tar.xz
    const filename = CONFIG.runtimeName + '-' + version + '-' + platformInfo.wasmtimePlatform + '.' + platformInfo.fileExtension;
    const downloadUrl = 'https://github.com/' + CONFIG.repo + '/releases/download/' + version + '/' + filename;
    console.log('⬇️  Download URL: ' + downloadUrl);

    // 5. Create temp directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-'));
    const archivePath = path.join(tmpDir, filename);

    // 6. Download file
    await downloadFile(downloadUrl, archivePath);
    console.log('✅ Download complete');

    // 7. Extract archive
    console.log('📂 Extracting archive...');
    await extractArchive(archivePath, tmpDir);

    // 8. Install to target directory
    console.log('📦 Installing to ' + CONFIG.installDir);
    mkdirp.sync(CONFIG.installDir);

    // Find extracted directory and binaries
    // wasmtime tar.xz extracts to: wasmtime-v43.0.0-{platform}/
    // Binaries are directly in that folder (e.g., wasmtime, wasmtime-cli, etc.)
    const tmpFiles = fs.readdirSync(tmpDir);
    const extractedDir = tmpFiles.find((f) => f.startsWith(CONFIG.runtimeName + '-' + version));

    if (!extractedDir) {
      throw new Error('Could not find extracted directory');
    }

    const extractedPath = path.join(tmpDir, extractedDir);
    const files = fs.readdirSync(extractedPath);

    // Copy all files from the official release (wasmtime, wasmtime-min, LICENSE, README.md)
    let binaryFound = false;
    for (const file of files) {
      const srcPath = path.join(extractedPath, file);
      const destPath = path.join(CONFIG.installDir, file);
      const stat = fs.statSync(srcPath);

      if (stat.isFile()) {
        fs.copyFileSync(srcPath, destPath);
        // Make executable files executable
        if (file === 'wasmtime' || file === 'wasmtime-min') {
          fs.chmodSync(destPath, 0o755);
          binaryFound = true;
        }
      }
    }

    if (!binaryFound) {
      throw new Error('No binaries found in extracted archive');
    }

    // 9. Clean up temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // 10. Verify installation
    const installedPath = path.join(CONFIG.installDir, CONFIG.runtimeName);
    try {
      const version = execSync('"' + installedPath + '" --version', { encoding: 'utf-8' });
      console.log('✅ Installation successful: ' + version.trim());
      console.log('📁 Installed at: ' + installedPath);
    } catch (error) {
      throw new Error('Installation verification failed');
    }

    return true;
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.error('\n💡 Tips:');
    console.error('  • If behind a proxy, set HTTP_PROXY or HTTPS_PROXY:');
    console.error('    export HTTP_PROXY=http://127.0.0.1:7897');
    console.error('    export HTTPS_PROXY=http://127.0.0.1:7897');
    console.error('  • Or download manually:');
    console.error('    https://github.com/' + CONFIG.repo + '/releases/download/v' + CONFIG.version + '/');
    console.error('  • Extract and copy to: ' + CONFIG.installDir);
    return false;
  }
}

// If run directly
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
