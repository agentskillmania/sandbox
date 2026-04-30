/**
 * run_shell tool
 * 执行 Shell 命令
 */

import { Sandbox } from '@agentskillmania/sandbox';

export const runShellTool = {
  definition: {
    name: 'run_shell',
    description: 'Execute shell commands in a WASM sandbox with busybox',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute (e.g., "ls", "cat", "grep")',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command arguments',
        },
      },
      required: ['command'],
    },
  },

  async handler(sandbox: Sandbox, args: { command: string; args?: string[] }) {
    const { command, args: cmdArgs = [] } = args;
    const result = await sandbox.runShell(command, cmdArgs);

    return {
      content: [
        {
          type: 'text',
          text:
            result.exitCode === 0
              ? `✅ Exit code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}`
              : `❌ Exit code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`,
        },
      ],
      isError: result.exitCode !== 0,
    };
  },
};
