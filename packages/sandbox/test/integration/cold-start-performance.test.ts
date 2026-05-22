import { describe, it, expect } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { performance } from 'node:perf_hooks';

describe('Performance Benchmark Tests', () => {
  describe('Cold start performance', () => {
    it('should create sandbox instance quickly', async () => {
      const start = performance.now();

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });

    it('should execute first command within reasonable time', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const start = performance.now();
      await sandbox.run('echo test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    }, 10000);
  });

  describe('Command execution performance', () => {
    it('should execute simple echo command quickly', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      // Warm up
      await sandbox.run('echo warmup');

      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await sandbox.run('echo test');
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(200);
    }, 15000);

    it('should execute Python code efficiently', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      // Warm up
      await sandbox.run('python -c \'print("warmup")\'');

      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await sandbox.run('python -c \'print("test")\'');
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(200);
    }, 15000);
  });

  describe('Memory usage', () => {
    it('should not leak memory on repeated executions', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 50; i++) {
        await sandbox.run(`echo test-${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const heapGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(heapGrowthMB).toBeLessThan(5);
    }, 30000);
  });

  describe('Concurrent execution', () => {
    it('should handle multiple concurrent sandboxes', async () => {
      const start = performance.now();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        const sandbox = new Sandbox({
          sandboxDir: `.sandbox-test-perf-${i}`,
          timeout: 5000,
        });
        promises.push(sandbox.run('python -c \'print("test")\''));
      }

      const results = await Promise.all(promises);
      const duration = performance.now() - start;

      // All sandboxes should succeed
      results.forEach((result) => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('test');
      });

      // Concurrent execution should complete within a reasonable time
      expect(duration).toBeLessThan(10000);
    }, 30000);
  });

  describe('Comparison baseline', () => {
    it('should log performance for comparison', async () => {
      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const results: Record<string, number> = {};

      let start = performance.now();
      await sandbox.run('echo test');
      results['echo'] = performance.now() - start;

      start = performance.now();
      await sandbox.run('python -c \'print("test")\'');
      results['python_print'] = performance.now() - start;

      start = performance.now();
      await sandbox.run("python -c 'x = sum(range(100)); print(x)'");
      results['python_math'] = performance.now() - start;

      // All commands should complete within reasonable time
      expect(results['echo']).toBeLessThan(200);
      expect(results['python_print']).toBeLessThan(200);
      expect(results['python_math']).toBeLessThan(200);
    }, 15000);
  });
});
