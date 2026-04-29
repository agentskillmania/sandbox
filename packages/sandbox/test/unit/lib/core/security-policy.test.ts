import { describe, it, expect } from 'vitest';
import { SecurityPolicy } from '../../../../src/lib/core/security-policy.js';
import { SecurityError } from '../../../../src/lib/types.js';

describe('SecurityPolicy', () => {
  it('should allow all commands when no policy is set', () => {
    const policy = new SecurityPolicy();
    expect(() => policy.validate({ runtime: 'busybox', argv: ['rm', 'file'] })).not.toThrow();
  });

  it('should allow whitelisted commands', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls', 'cat'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: ['ls', '-la'] })).not.toThrow();
  });

  it('should block non-whitelisted commands', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls', 'cat'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: ['rm', 'file'] })).toThrow(
      SecurityError
    );
  });

  it('should block blacklisted commands', () => {
    const policy = new SecurityPolicy({ mode: 'blacklist', list: ['rm', 'format'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: ['rm', 'file'] })).toThrow(
      SecurityError
    );
  });

  it('should allow non-blacklisted commands', () => {
    const policy = new SecurityPolicy({ mode: 'blacklist', list: ['rm', 'format'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: ['ls', '-la'] })).not.toThrow();
  });

  it('should skip validation for -- flags', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: ['--list'] })).not.toThrow();
  });

  it('should skip validation for empty command', () => {
    const policy = new SecurityPolicy({ mode: 'whitelist', list: ['ls'] });
    expect(() => policy.validate({ runtime: 'busybox', argv: [] })).not.toThrow();
  });
});
