declare module '@agentskillmania/settings-yaml' {
  export class Settings {
    constructor(configPath: string);
    initialize(options?: { defaultYaml?: string }): Promise<void>;
    getValues<T = any>(): T;
  }
}

declare module '../../scripts/install-runtime.cjs' {
  export function installRuntime(): Promise<boolean>;
  export function checkInstalledWasmtime(): { found: boolean; version?: string; path: string };
  export function getWasmtimePath(): string;
}
