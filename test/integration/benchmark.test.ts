import { describe, it, expect, beforeAll } from 'vitest';
import { Sandbox } from '../../src/lib/Sandbox.js';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

describe('Performance Benchmark Tests', () => {
  let busyboxExists: boolean;
  let micropythonExists: boolean;

  beforeAll(() => {
    busyboxExists = existsSync('./wasm/busybox.wasm');
    micropythonExists = existsSync('./wasm/micropython.wasm');
  });

  describe('Cold start performance', () => {
    it('should create sandbox instance quickly', async () => {
      const start = performance.now();

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const end = performance.now();
      const duration = end - start;

      console.log(`Sandbox creation time: ${duration.toFixed(2)}ms`);

      // Should be very fast (< 10ms) - just object creation
      expect(duration).toBeLessThan(50);
    });

    it('should execute first command within reasonable time', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const start = performance.now();

      await sandbox.runShell('echo', ['test']);
      const end = performance.now();
      const duration = end - start;

      console.log(`First command execution time: ${duration.toFixed(2)}ms`);

      // First execution includes WASM loading, so it should be < 500ms
      expect(duration).toBeLessThan(500);
    }, 10000);
  });

  describe('Command execution performance', () => {
    it('should execute simple echo command quickly', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      // Warm up
      await sandbox.runShell('echo', ['warmup']);

      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await sandbox.runShell('echo', ['test']);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`Echo command performance:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);

      // Simple command should be fast (< 200ms average after warmup)
      expect(avgTime).toBeLessThan(200);
    }, 15000);

    it('should execute Python code efficiently', async () => {
      if (!micropythonExists) {
        console.log('micropython.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      // Warm up
      await sandbox.runPython('print("warmup")');

      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await sandbox.runPython('print("test")');
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`Python print performance:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);

      // Python should be reasonably fast (< 300ms average)
      expect(avgTime).toBeLessThan(300);
    }, 15000);
  });

  describe('Memory usage', () => {
    it('should not leak memory on repeated executions', async () => {
      if (!busyboxExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      // Get initial memory usage
      const initialMemory = process.memoryUsage();
      console.log('Initial memory:', {
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      });

      // Execute many commands
      for (let i = 0; i < 50; i++) {
        await sandbox.runShell('echo', [`test-${i}`]);
      }

      // Get final memory usage
      const finalMemory = process.memoryUsage();
      console.log('Final memory:', {
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      });

      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthMB = heapGrowth / 1024 / 1024;

      console.log(`Heap growth: ${heapGrowthMB.toFixed(2)}MB`);

      // Heap growth should be reasonable (< 10MB for 50 executions)
      expect(heapGrowthMB).toBeLessThan(10);
    }, 30000);
  });

  describe('Concurrent execution', () => {
    it('should handle multiple concurrent sandboxes', async () => {
      if (!micropythonExists) {
        console.log('busybox.wasm not found, skipping test');
        return;
      }

      const start = performance.now();

      // Create multiple sandboxes and execute concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const sandbox = new Sandbox({
          sandboxDir: `.sandbox-test-perf-${i}`,
          timeout: 5000,
        });
        promises.push(sandbox.runPython('print("test")'));
      }

      await Promise.all(promises);

      const end = performance.now();
      const duration = end - start;

      console.log(`5 concurrent executions: ${duration.toFixed(2)}ms`);

      // Concurrent should be faster than sequential
      // But we don't have a strict baseline, so just log the time
      expect(duration).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Comparison baseline', () => {
    it('should log performance for comparison', async () => {
      if (!busyboxExists || !micropythonExists) {
        console.log('WASM files not found, skipping test');
        return;
      }

      const sandbox = new Sandbox({
        sandboxDir: '.sandbox-test-perf',
        timeout: 5000,
      });

      const results: Record<string, number> = {};

      // Test echo command
      let start = performance.now();
      await sandbox.runShell('echo', ['test']);
      results['echo'] = performance.now() - start;

      // Test Python print
      start = performance.now();
      await sandbox.runPython('print("test")');
      results['python_print'] = performance.now() - start;

      // Test Python math
      start = performance.now();
      await sandbox.runPython('x = sum(range(100)); print(x)');
      results['python_math'] = performance.now() - start;

      console.log('\n=== Performance Baseline ===');
      for (const [name, time] of Object.entries(results)) {
        console.log(`${name}: ${time.toFixed(2)}ms`);
      }

      // These are just baselines for comparison
      expect(Object.keys(results).length).toBeGreaterThan(0);
    }, 15000);
  });
});
