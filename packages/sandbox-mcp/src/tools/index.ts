/**
 * Tool handlers 注册
 */

import { Sandbox } from '@agentskillmania/sandbox';
import { runShellTool } from './shell.js';
import { runPythonTool } from './python.js';
import { runScriptTool } from './script.js';
import { readFileTool, writeFileTool, listFilesTool, deleteFileTool } from './file.js';

export function createToolHandlers(sandbox: Sandbox) {
  return {
    listTools() {
      return [
        runShellTool.definition,
        runPythonTool.definition,
        runScriptTool.definition,
        readFileTool.definition,
        writeFileTool.definition,
        listFilesTool.definition,
        deleteFileTool.definition,
      ];
    },

    async callTool(name: string, args: Record<string, unknown>) {
      switch (name) {
        case 'run_shell':
          return await runShellTool.handler(sandbox, args as { command: string });
        case 'run_python':
          return await runPythonTool.handler(sandbox, args as { code: string });
        case 'run_script':
          return await runScriptTool.handler(
            sandbox,
            args as { language: 'sh' | 'py'; content: string }
          );
        case 'read_file':
          return await readFileTool.handler(sandbox, args as { path: string });
        case 'write_file':
          return await writeFileTool.handler(sandbox, args as { path: string; content: string });
        case 'list_files':
          return await listFilesTool.handler(sandbox, args as { path?: string });
        case 'delete_file':
          return await deleteFileTool.handler(sandbox, args as { path: string });
        default:
          return {
            content: [
              {
                type: 'text',
                text: `❌ Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    },
  };
}
