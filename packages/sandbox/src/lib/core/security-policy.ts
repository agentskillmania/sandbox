/**
 * Security policy — placeholder for future command and network filtering.
 *
 * Currently a no-op: all commands are allowed. The real security boundary
 * is wasmtime's directory isolation (--dir mappings).
 *
 * This class is kept as a hook for future enhancements (path validation,
 * resource limits, domain filtering, etc.) without changing call sites.
 */

import type { ExecutionRequest, CommandPolicyConfig } from './types.js';

export class SecurityPolicy {
  constructor(private commandPolicy?: CommandPolicyConfig) {}

  /** Currently a no-op. All commands are allowed. */
  validate(_request: ExecutionRequest): void {
    // Placeholder: actual security is enforced by wasmtime directory isolation.
    // Future enhancements: path traversal check, resource limits, domain filtering, etc.
  }
}
