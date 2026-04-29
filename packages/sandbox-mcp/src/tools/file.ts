/**
 * File operation tools
 * read_file, write_file, list_files, delete_file
 */

import { Sandbox } from '@agentskillmania/sandbox';
import { writeFile, readFile, unlink, readdir } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';

/**
 * Resolve and validate a path within the sandbox directory.
 * Rejects path traversal attempts that escape the sandbox.
 */
function resolveSandboxPath(sandboxDir: string, relativePath: string): string {
  const fullPath = normalize(resolve(sandboxDir, relativePath));
  const resolvedSandbox = normalize(resolve(sandboxDir));
  const separator = resolvedSandbox.endsWith('/') ? '' : '/';
  if (!fullPath.startsWith(resolvedSandbox + separator) && fullPath !== resolvedSandbox) {
    throw new Error('Path traversal detected: path escapes sandbox directory');
  }
  // Return a normalized path relative to sandboxDir (preserves relative/absolute form)
  return normalize(join(sandboxDir, normalize(relativePath)));
}

// read_file tool
export const readFileTool = {
  definition: {
    name: 'read_file',
    description: 'Read a file from the sandbox directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to sandbox directory',
        },
      },
      required: ['path'],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { path } = args;
    const sandboxDir = (sandbox as any).sandboxDir || '.sandbox-mcp';

    try {
      const fullPath = resolveSandboxPath(sandboxDir, path);
      const content = await readFile(fullPath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `📄 File: ${path}\n\n${content}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to read file: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};

// write_file tool
export const writeFileTool = {
  definition: {
    name: 'write_file',
    description: 'Write content to a file in the sandbox directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to sandbox directory',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { path, content } = args;
    const sandboxDir = (sandbox as any).sandboxDir || '.sandbox-mcp';

    try {
      const fullPath = resolveSandboxPath(sandboxDir, path);
      await writeFile(fullPath, content, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `✅ File written successfully: ${path}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to write file: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};

// list_files tool
export const listFilesTool = {
  definition: {
    name: 'list_files',
    description: 'List files in the sandbox directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to sandbox (default: root)',
        },
      },
      required: [],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { path = '.' } = args;
    const sandboxDir = (sandbox as any).sandboxDir || '.sandbox-mcp';

    try {
      const fullPath = resolveSandboxPath(sandboxDir, path);
      const files = await readdir(fullPath);
      return {
        content: [
          {
            type: 'text',
            text: `📁 Directory: ${path || '/'}\n\n${files.map((f) => `  ${f}`).join('\n')}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to list directory: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};

// delete_file tool
export const deleteFileTool = {
  definition: {
    name: 'delete_file',
    description: 'Delete a file in the sandbox directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to sandbox directory',
        },
      },
      required: ['path'],
    },
  },

  async handler(sandbox: Sandbox, args: any) {
    const { path } = args;
    const sandboxDir = (sandbox as any).sandboxDir || '.sandbox-mcp';

    try {
      const fullPath = resolveSandboxPath(sandboxDir, path);
      await unlink(fullPath);
      return {
        content: [
          {
            type: 'text',
            text: `✅ File deleted successfully: ${path}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to delete file: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
