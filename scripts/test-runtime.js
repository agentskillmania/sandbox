#!/usr/bin/env node

/**
 * 测试运行时检测和下载功能
 */

const { checkWasmtime, getPlatformInfo } = require('./install-runtime.js');

async function test() {
  console.log('🧪 Testing @agentskillmania/sandbox runtime detection...\n');

  // 测试 1: 检测 wasmtime
  console.log('Test 1: Check wasmtime');
  const checkResult = checkWasmtime();
  console.log('  Result:', JSON.stringify(checkResult, null, 2));
  console.log('');

  // 测试 2: 平台检测
  console.log('Test 2: Platform detection');
  try {
    const platformInfo = getPlatformInfo();
    console.log('  Platform:', platformInfo.platform);
    console.log('  Arch:', platformInfo.arch);
    console.log('  Wasmtime platform:', platformInfo.wasmtimePlatform);
    console.log('  File extension:', platformInfo.fileExtension);
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }
  console.log('');

  // 测试 3: 构建下载 URL（不实际下载）
  console.log('Test 3: Download URL construction');
  try {
    const platformInfo = getPlatformInfo();
    const version = 'v43.0.0'; // 使用固定版本用于测试
    const filename = `wasmtime-${version}-${platformInfo.wasmtimePlatform}.${platformInfo.fileExtension}`;
    const downloadUrl = `https://github.com/bytecodealliance/wasmtime/releases/download/${version}/${filename}`;
    console.log('  Version:', version);
    console.log('  Filename:', filename);
    console.log('  Download URL:', downloadUrl);
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }
  console.log('');

  console.log('✅ All tests completed');
}

test().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
