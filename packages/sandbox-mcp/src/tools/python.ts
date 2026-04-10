/**
 * run_python tool
 * 执行 Python 代码
 */

import { Sandbox } from '@agentskillmania/sandbox';

export const runPythonTool = {
  definition: {
    name: 'run_python',
    description: 'Execute Python code in a WASM sandbox with micropython',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute',
        },
        timeout: {
          type: 'number',
          description: 'Execution timeout in milliseconds (default: 5000)',
        },
        allowNetwork: {
          type: 'boolean',
          description: 'Allow network access (default: false)',
        },
      },
      required: ['code'],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { code, timeout, allowNetwork } = args;

    // 更新 sandbox 配置
    if (timeout !== undefined) (sandbox as any).config.timeout = timeout;
    if (allowNetwork !== undefined) (sandbox as any).config.allowNetwork = allowNetwork;

    const result = await sandbox.runPython(code);

    return {
      content: [
        {
          type: 'text',
          text:
            result.exitCode === 0
              ? `✅ Python execution successful\n\nOutput:\n${result.stdout}`
              : `❌ Python execution failed (exit code: ${result.exitCode})\n\nOutput:\n${result.stdout}\n\nError:\n${result.stderr}`,
        },
      ],
      isError: result.exitCode !== 0,
    };
  },
};
