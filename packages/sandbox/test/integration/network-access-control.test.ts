import { describe, it, expect } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';

describe('Network Integration Tests', () => {
  describe('Network permission tests', () => {
    it('should fail when network is disabled', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: false,
      });

      const result = await sandbox.run('wget -q -O - http://example.com/');
      expect(result.stdout).toContain('bad address');
    }, 15000);

    it('should allow network when enabled', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 15000,
      });

      const result = await sandbox.run('wget -q -O - http://example.com/');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Example Domain');
    }, 20000);
  });

  describe('wget functionality', () => {
    it('should download small file via HTTP', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 15000,
      });

      const result = await sandbox.run(
        'wget -q -O .sandbox-test-network/download.txt http://www.baidu.com/'
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    }, 20000);

    it('should handle download errors gracefully', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      const result = await sandbox.run('wget -q -O - http://this-domain-does-not-exist-12345.com/');
      expect(result.stdout).toMatch(/error|bad address|failed/);
    }, 15000);
  });

  describe('Python network capabilities', () => {
    it('should support socket module in python', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      const result = await sandbox.run(
        'python -c \'import socket; print("Socket module available"); print("AF_INET:", socket.AF_INET); print("SOCK_STREAM:", socket.SOCK_STREAM)\''
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Socket module available');
    }, 15000);

    it('should test socket creation', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-network',
        allowNetwork: true,
        timeout: 10000,
      });

      const result = await sandbox.run(
        'python -c \'import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); print("Socket created:", s); print("File descriptor:", s.fileno()); s.close(); print("Socket closed successfully")\''
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Socket created');
    }, 15000);
  });
});
