const { spawn } = require('child_process');
const wasmtime = '/Users/yusangeng/.agentskillmania/sandbox/wasmtime/wasmtime';
const wasm = './wasm/busybox.wasm';

// Test 1: Direct wasmtime call
console.log('Test 1: Direct wasmtime');
const proc1 = spawn(wasmtime, ['-W', 'exceptions=y', '--dir=.sandbox', '--dir=/tmp', wasm, 'wsh', '-c', 'echo test1']);
proc1.stdout.on('data', d => process.stdout.write(d));
proc1.stderr.on('data', d => process.stderr.write(d));
proc1.on('close', (code) => console.log('Exit code:', code));

setTimeout(() => {
  // Test 2: With quoted string (as shell would pass it)
  console.log('\nTest 2: Single string argument');
  const proc2 = spawn(wasmtime, ['-W', 'exceptions=y', '--dir=.sandbox', '--dir=/tmp', wasm, 'wsh', '-c', 'echo test2']);
  proc2.stdout.on('data', d => process.stdout.write(d));
  proc2.stderr.on('data', d => process.stderr.write(d));
  proc2.on('close', (code) => console.log('Exit code:', code));
}, 500);
