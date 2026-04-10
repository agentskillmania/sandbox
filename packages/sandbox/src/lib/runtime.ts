import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** Dedicated wasmtime installation directory */
const WASMTIME_INSTALL_DIR = join(homedir(), '.agentskillmania', 'sandbox', 'wasmtime');

/**
 * Get dedicated wasmtime executable path
 */
export function getWasmtimeExecutable(): string {
  return join(WASMTIME_INSTALL_DIR, 'wasmtime');
}

/**
 * Check if dedicated wasmtime is installed
 */
export function checkInstalledWasmtime(): {
  found: boolean;
  version?: string;
  path: string;
} {
  const wasmtimePath = getWasmtimeExecutable();

  if (!existsSync(wasmtimePath)) {
    return { found: false, path: wasmtimePath };
  }

  try {
    const version = execSync(`"${wasmtimePath}" --version`, { encoding: 'utf-8' });
    return { found: true, version: version.trim(), path: wasmtimePath };
  } catch {
    return { found: false, path: wasmtimePath };
  }
}

/**
 * Get WASM module paths
 * These are relative to the current working directory
 */
export function getWasmPaths() {
  return {
    busybox: join(process.cwd(), 'wasm', 'busybox.wasm'),
    micropython: join(process.cwd(), 'wasm', 'micropython.wasm'),
  };
}

/**
 * Get runtime version information
 */
export function getRuntimeVersions() {
  const wasmtimeCheck = checkInstalledWasmtime();
  const wasmPaths = getWasmPaths();

  return {
    wasmtime: {
      found: wasmtimeCheck.found,
      version: wasmtimeCheck.found ? wasmtimeCheck.version : undefined,
      path: wasmtimeCheck.path,
      expectedVersion: 'v43.0.0',
    },
    busybox: {
      found: existsSync(wasmPaths.busybox),
      path: wasmPaths.busybox,
    },
    micropython: {
      found: existsSync(wasmPaths.micropython),
      path: wasmPaths.micropython,
    },
  };
}

/**
 * Ensure runtime is installed
 * If wasmtime doesn't exist, automatically install it
 */
export async function ensureRuntime(): Promise<void> {
  // Fast check
  if (checkRuntimeReady().ready) {
    return;
  }

  // Not installed, install it
  console.error('⏳ Wasmtime not found. Installing...');
  const success = await installRuntime();

  if (!success) {
    throw new Error('Failed to install wasmtime runtime');
  }
  console.error('✅ Wasmtime installed successfully.');
}

/**
 * Fast check if runtime is ready
 * Does not execute any download operations
 */
export function checkRuntimeReady(): { ready: boolean } {
  const wasmtimePath = getWasmtimeExecutable();
  return { ready: existsSync(wasmtimePath) };
}

/**
 * Install runtime (internal)
 * Returns true if successful
 */
async function installRuntime(): Promise<boolean> {
  try {
    const installScript = join(
      process.cwd(),
      'packages',
      'sandbox',
      'scripts',
      'install-runtime.cjs'
    );
    execSync(`node "${installScript}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    return true;
  } catch (error) {
    console.error('Failed to install runtime:', error);
    return false;
  }
}
