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
        timeout: {
          type: 'number',
          description: 'Execution timeout in milliseconds (default: 5000)',
        },
      },
      required: ['language', 'content'],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { language, content, timeout } = args;

    // 获取 sandbox 目录
    const sandboxDir = (sandbox as any).sandboxDir || '.sandbox-mcp';
    const ext = language === 'sh' ? 'sh' : 'py';
    const scriptPath = join(sandboxDir, `temp_script.${ext}`);

    try {
      // 写入脚本文件
      await writeFile(scriptPath, content, 'utf-8');

      // 更新 sandbox 配置
      if (timeout !== undefined) (sandbox as any).config.timeout = timeout;

      // 执行脚本
      const result =
        language === 'sh'
          ? await sandbox.runShell('busybox', [scriptPath])
          : await sandbox.runShell('busybox', [scriptPath]);

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
      // 清理临时文件
      try {
        await unlink(scriptPath);
      } catch {
        // 忽略删除错误
      }
    }
  },
};
