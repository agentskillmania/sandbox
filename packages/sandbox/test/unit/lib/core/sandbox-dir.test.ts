import { describe, it, expect, vi } from 'vitest';
import { SandboxDirectory } from '../../../../src/lib/core/sandbox-dir.js';
import { existsSync } from 'node:fs';
import { mkdirp } from 'mkdirp';

const mockMkdtempSync = vi.fn();
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdtempSync: (...args: any[]) => mockMkdtempSync(...args),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
}));

vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}));

vi.mock('mkdirp', () => ({
  mkdirp: { sync: vi.fn() },
}));

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirpSync = vi.mocked(mkdirp.sync);

describe('SandboxDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create temp directory when path is auto', () => {
    mockExistsSync.mockReturnValue(true);
    mockMkdtempSync.mockReturnValue('/tmp/sandbox-abc');

    const dir = new SandboxDirectory({ path: 'auto' });

    expect(mockMkdtempSync).toHaveBeenCalledTimes(1);
    expect(dir.path).toBe('/tmp/sandbox-abc');
  });

  it('should use provided path when not auto', () => {
    mockExistsSync.mockReturnValue(true);

    const dir = new SandboxDirectory({ path: '/custom/path' });

    expect(mockMkdtempSync).not.toHaveBeenCalled();
    expect(dir.path).toBe('/custom/path');
  });

  it('should create directory when it does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const dir = new SandboxDirectory({ path: '/new/dir' });

    expect(mockMkdirpSync).toHaveBeenCalledWith('/new/dir');
    expect(dir.path).toBe('/new/dir');
  });

  it('should skip creation when directory already exists', () => {
    mockExistsSync.mockReturnValue(true);

    new SandboxDirectory({ path: '/existing/dir' });

    expect(mockMkdirpSync).not.toHaveBeenCalled();
  });
});
