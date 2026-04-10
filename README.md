# @agentskillmania/sandbox-monorepo

A monorepo containing WASM sandbox packages for secure code execution in AI agent environments.

## Packages

### [@agentskillmania/sandbox](./packages/sandbox/)

Core WASM sandbox library with CLI tool.

- Lightweight WASM sandbox for busybox and micropython
- Node.js SDK and CLI interface
- Automatic runtime installation (wasmtime 43.0.0)
- ~12ms average execution time
- Support for shell commands, Python code, and script execution

**Install**: `npm install @agentskillmania/sandbox`

### [@agentskillmania/sandbox-mcp](./packages/sandbox-mcp/)

MCP (Model Context Protocol) server for Claude Desktop and other MCP-compatible AI agents.

- 7 tools: run_shell, run_python, run_script, read_file, write_file, list_files, delete_file
- Environment variable configuration
- Command and network security policies
- Filesystem isolation

**Install**: `npm install @agentskillmania/sandbox-mcp`

## Quick Start

### Install CLI Tool

```bash
npm install -g @agentskillmania/sandbox

# Execute shell command
exec-in-sandbox busybox ls -la

# Execute Python code
exec-in-sandbox python -c "print('Hello WASM!')"
```

### Use with Node.js

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

const sandbox = new Sandbox();

// Execute shell command
const result = await sandbox.runShell('ls', ['-la']);
console.log(result.stdout);

// Execute Python code
const pyResult = await sandbox.runPython('print(2 + 2)');
console.log(pyResult.stdout);
```

### Use MCP Server with Claude Desktop

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sandbox": {
      "command": "node",
      "args": ["./packages/sandbox-mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Run unit tests only
pnpm run test:unit

# Run integration tests only
pnpm run test:integration
```

## Performance

Typical execution times:

- Shell command: ~12ms
- Python code: ~15ms
- Cold start: ~47ms
- Memory usage: ~4MB per sandbox instance

## License

MIT

## Links

- [Core Library Documentation](./packages/sandbox/README.md)
- [MCP Server Documentation](./packages/sandbox-mcp/README.md)
- 中文文档: [README.zh_CN.md](./README.zh_CN.md)
