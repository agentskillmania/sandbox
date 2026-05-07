/**
 * run_shell tool
 * 执行 Shell 命令
 */

import { Sandbox } from '@agentskillmania/sandbox';

export const runShellTool = {
  definition: {
    name: 'run_shell',
    description:
      'Execute shell commands in a WASM sandbox with busybox wsh. Supports any command available inside the combined busybox component including git, python, ls, cat, grep, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description:
            'Shell command to execute (e.g., "ls -la", "python -c \'print(42)\'", "git status")',
        },
      },
      required: ['command'],
    },
  },

  async handler(sandbox: Sandbox, args: { command: string }) {
    const result = await sandbox.run(args.command);

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
