/**
 * run_script tool
 * 执行脚本（支持传入内容）
 */

import { Sandbox } from '@agentskillmania/sandbox';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export const runScriptTool = {
  definition: {
    name: 'run_script',
    description: 'Execute a shell or Python script in the sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['sh', 'py'],
          description: 'Script language: "sh" for shell, "py" for python',
        },
        content: {
          type: 'string',
          description: 'Script content to execute',
        },
      },
      required: ['language', 'content'],
    },
  },

  async handler(sandbox: Sandbox, args: { language: 'sh' | 'py'; content: string }) {
    const { language, content } = args;

    const sandboxDir = sandbox.getSandboxDir();
    const ext = language === 'sh' ? 'sh' : 'py';
    const scriptPath = join(
      sandboxDir,
      `temp_script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    );

    try {
      await writeFile(scriptPath, content, 'utf-8');

      const result =
        language === 'sh'
          ? await sandbox.runShell(scriptPath, [])
          : await sandbox.runPythonScript(scriptPath, []);

      return {
        content: [
          {
            type: 'text',
            text:
              result.exitCode === 0
                ? `✅ Script execution successful\n\nOutput:\n${result.stdout}`
                : `❌ Script execution failed (exit code: ${result.exitCode})\n\nOutput:\n${result.stdout}\n\nError:\n${result.stderr}`,
          },
        ],
        isError: result.exitCode !== 0,
      };
    } finally {
      try {
        await unlink(scriptPath);
      } catch {
        // ignore cleanup errors
      }
    }
  },
};
