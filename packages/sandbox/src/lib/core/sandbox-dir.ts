/**
 * Sandbox directory lifecycle management.
 *
 * Responsibility: create, validate, and cleanup the sandbox directory.
 * Does NOT know about wasmtime, runtimes, or security.
 */

import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirp } from 'mkdirp';

export interface SandboxDirConfig {
  /** 'auto' = create temp directory; string = use provided path */
  path: string;
}

export class SandboxDirectory {
  readonly path: string;

  constructor(config: SandboxDirConfig) {
    if (config.path === 'auto') {
      this.path = mkdtempSync(join(tmpdir(), 'sandbox-'));
    } else {
      this.path = config.path;
    }

    this._ensureExists();
  }

  private _ensureExists(): void {
    if (!existsSync(this.path)) {
      mkdirp.sync(this.path);
    }
  }
}
