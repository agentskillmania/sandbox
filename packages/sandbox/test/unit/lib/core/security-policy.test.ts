import { describe, it, expect } from 'vitest';
import { SecurityPolicy } from '../../../../src/lib/core/security-policy.js';

describe('SecurityPolicy', () => {
  it('should allow all commands when no policy is set', () => {
    const policy = new SecurityPolicy();
    expect(() => policy.validate({ command: 'rm file' })).not.toThrow();
  });

  it('should allow all commands regardless of whitelist config', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls', 'cat'] });
    expect(() => policy.validate({ command: 'rm file' })).not.toThrow();
    expect(() => policy.validate({ command: 'ls -la' })).not.toThrow();
  });

  it('should allow all commands regardless of blacklist config', () => {
    const policy = new SecurityPolicy({ mode: 'blacklist', list: ['rm', 'format'] });
    expect(() => policy.validate({ command: 'rm file' })).not.toThrow();
    expect(() => policy.validate({ command: 'ls -la' })).not.toThrow();
  });

  it('should allow all commands including flags and empty', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls'] });
    expect(() => policy.validate({ command: '--list' })).not.toThrow();
    expect(() => policy.validate({ command: '' })).not.toThrow();
  });
});
