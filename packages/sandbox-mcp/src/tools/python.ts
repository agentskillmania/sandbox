/**
 * run_python tool
 * 执行 Python 代码
 */

import { Sandbox } from '@agentskillmania/sandbox';

export const runPythonTool = {
  definition: {
    name: 'run_python',
    description: 'Execute Python code in a WASM sandbox via busybox wsh python',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute',
        },
      },
      required: ['code'],
    },
  },

  async handler(sandbox: Sandbox, args: { code: string }) {
    const { code } = args;
    // Escape single quotes in code for shell safety
    const escapedCode = code.replace(/'/g, "'\"'\"'");
    const result = await sandbox.run(`python -c '${escapedCode}'`);

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
