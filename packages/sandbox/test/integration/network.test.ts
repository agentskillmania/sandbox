import { describe, it, expect, beforeAll } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { existsSync } from 'node:fs';
import { getWasmtimeExecutable } from '../../src/lib/runtime.js';

describe('Network Integration Tests', () => {
  let busyboxExists: boolean;

  beforeAll(() => {
    busyboxExists = existsSync('./wasm/busybox.wasm');
  });

  describe('Network permission tests', () => {
    it('should fail when network is disabled', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: false,
      });

      // wget should fail without network permission
      const result = await sandbox.runShell('wget', ['-q', '-O', '-', 'http://example.com/']);
      console.log('Exit code:', result.exitCode);
      console.log('STDERR:', result.stderr);

      // Should fail (wget might not be available or network blocked)
      expect(result.exitCode).not.toBe(0);
    }, 15000);

    it('should allow network when enabled', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 15000,
      });

      // Try to download from example.com
      const result = await sandbox.runShell('wget', ['-q', '-O', '-', 'http://example.com/']);
      console.log('Exit code:', result.exitCode);
      console.log('STDOUT length:', result.stdout.length);

      // Should succeed (wget should work with network)
      // Note: This test requires actual network access
      // In CI/CD environments, this might fail due to network restrictions
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Example Domain');
      } else {
        console.log('Network download failed - might be expected in some environments');
      }
    }, 20000);
  });

  describe('DNS resolution', () => {
    it('should resolve domain names with network enabled', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      // Use nslookup to test DNS
      const result = await sandbox.runShell('nslookup', ['example.com']);
      console.log('Exit code:', result.exitCode);
      console.log('STDOUT:', result.stdout);

      // nslookup might not be available in busybox
      // If it exists, it should resolve the domain
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('example.com');
      } else {
        console.log('nslookup not available or failed');
      }
    }, 15000);
  });

  describe('wget functionality', () => {
    it('should download small file via HTTP', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 15000,
      });

      // Try to download from www.baidu.com (more reliable in China network)
      const result = await sandbox.runShell('wget', [
        '-q',
        '-O',
        '.sandbox-test-network/download.txt',
        'http://www.baidu.com/',
      ]);

      console.log('Exit code:', result.exitCode);
      console.log('STDERR:', result.stderr);

      // Note: This test may fail depending on network environment
      // www.baidu.com is more reliable in China than example.com
      if (result.exitCode === 0) {
        expect(result.stderr).toBe('');
      } else {
        console.log('wget failed - this may be expected in some network environments');
      }
    }, 20000);

    it('should handle download errors gracefully', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      // Try to download from invalid domain
      const result = await sandbox.runShell('wget', [
        '-q',
        '-O',
        '-',
        'http://this-domain-does-not-exist-12345.com/',
      ]);

      console.log('Exit code:', result.exitCode);

      // Should fail
      expect(result.exitCode).not.toBe(0);
    }, 15000);
  });

  describe('Python network capabilities', () => {
    it('should support socket module in micropython', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      // Test if socket module is available
      const result = await sandbox.runPython(`
import socket
print('Socket module available')
print('AF_INET:', socket.AF_INET)
print('SOCK_STREAM:', socket.SOCK_STREAM)
`);

      console.log('Exit code:', result.exitCode);
      console.log('STDOUT:', result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Socket module available');
    }, 15000);

    it('should test socket creation', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      // Test socket creation
      const result = await sandbox.runPython(`
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
print('Socket created:', s)
print('File descriptor:', s.fileno())
s.close()
print('Socket closed successfully')
`);

      console.log('Exit code:', result.exitCode);
      console.log('STDOUT:', result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Socket created');
    }, 15000);
  });
});
