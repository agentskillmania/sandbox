# @agentskillmania/sandbox-monorepo

A monorepo containing WASM sandbox packages for secure code execution in AI agent environments.

## Packages

### [@agentskillmania/sandbox](./packages/sandbox/)

Core WASM sandbox library with CLI tool.

- Lightweight WASM sandbox for shell commands, Python, and Git
- Node.js SDK and CLI interface
- Automatic runtime installation (wasmtime 43.0.0)
- ~10ms per command, 8MB wasm binary, ~50MB peak RSS
- Filesystem isolation via wasmtime `--dir` mappings

**Install**: `npm install @agentskillmania/sandbox`

### [@agentskillmania/sandbox-mcp](./packages/sandbox-mcp/)

MCP (Model Context Protocol) server for Claude Desktop and other MCP-compatible AI agents.

- 7 tools: run_shell, run_python, run_script, read_file, write_file, list_files, delete_file
- Environment variable configuration
- Filesystem isolation
- Network on/off switch

**Install**: `npm install @agentskillmania/sandbox-mcp`

## Quick Start

### Install CLI Tool

```bash
npm install -g @agentskillmania/sandbox

# Execute shell command
exec-in-sandbox -- "ls -la"

# Execute Python code
exec-in-sandbox -- "python -c \"print('Hello WASM!')\""

# Execute Git command
exec-in-sandbox -- "git status"
```

### Use with Node.js

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

const sandbox = new Sandbox();

// Execute any command
const result = await sandbox.run('ls -la');
console.log(result.stdout);

// Execute Python code
const pyResult = await sandbox.run("python -c 'print(2 + 2)'");
console.log(pyResult.stdout);
```

### Use MCP Server with Claude Desktop

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sandbox": {
      "command": "npx",
      "args": ["-y", "@agentskillmania/sandbox-mcp"]
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

Measured on Apple M-series (wasmtime 43.0.0):

| Operation | Time |
|-----------|------|
| Cold start (first run) | ~100ms |
| Shell command | ~10ms |
| Python code | ~10ms |
| Pipe (`echo x \| grep y`) | ~10ms |
| Git command | ~10ms |
| Peak RSS per invocation | ~50MB |
| Binary size (busybox.wasm) | 8MB |

Every invocation is a fresh isolated process — no state leaks between runs.

## License

MIT

## Links

- [Core Library Documentation](./packages/sandbox/README.md)
- [MCP Server Documentation](./packages/sandbox-mcp/README.md)
- 中文文档: [README.zh_CN.md](./README.zh_CN.md)
