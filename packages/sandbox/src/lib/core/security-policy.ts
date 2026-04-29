/**
 * Security policy — command and network filtering.
 *
 * Responsibility: validate ExecutionRequest against configured policies.
 * Does NOT know about wasmtime, runtimes, or process management.
 */

import type { ExecutionRequest, CommandPolicyConfig } from './types.js';
import { SecurityError } from '../types.js';

export class SecurityPolicy {
  constructor(private commandPolicy?: CommandPolicyConfig) {}

  validate(request: ExecutionRequest): void {
    this._validateCommand(request);
  }

  private _validateCommand(request: ExecutionRequest): void {
    const policy = this.commandPolicy;
    if (!policy || policy.list.length === 0) return;

    const command = request.argv[0] ?? '';

    // Skip validation for empty commands (busybox help) and -- flags
    if (command === '' || command.startsWith('--')) return;

    if (policy.mode === 'whitelist') {
      if (!policy.list.includes(command)) {
        throw new SecurityError(`Command '${command}' is not in the allowlist`);
      }
    } else {
      if (policy.list.includes(command)) {
        throw new SecurityError(`Command '${command}' is in the blocklist`);
      }
    }
  }
}
