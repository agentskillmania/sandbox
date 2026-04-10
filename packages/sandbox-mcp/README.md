# @agentskillmania/sandbox-mcp

MCP (Model Context Protocol) server for executing shell commands and Python code in a secure WASM sandbox.

## Features

- 🔒 **Secure Execution**: All commands run in WASM sandbox with controlled filesystem access
- ⚡ **Fast**: ~12ms average execution time using wasmtime runtime
- 🛠️ **Rich Tool Set**: 7 tools covering shell, Python, scripts, and file operations
- 🔧 **Environment Config**: Configure via environment variables, no config files needed
- 🌐 **Network Control**: Optional network access with domain whitelist/blacklist
- 📝 **Security Policies**: Command and network allowlist/blocklist support

## Installation

```bash
npm install @agentskillmania/sandbox-mcp
```

## MCP Tools

### Shell Execution

- `run_shell` - Execute shell commands with busybox
- `run_script` - Execute shell/Python scripts from content

### Python Execution

- `run_python` - Execute Python code strings with micropython

### File Operations

- `read_file` - Read files from sandbox directory
- `write_file` - Write files to sandbox directory
- `list_files` - List files in sandbox directory
- `delete_file` - Delete files in sandbox directory

## Configuration

Configure via environment variables:

```bash
# Basic settings
export SANDBOX_TIMEOUT=5000
export SANDBOX_ALLOW_NETWORK=false
export SANDBOX_SANDBOX_DIR=".sandbox-mcp"

# Security policies
export SANDBOX_COMMAND_MODE=whitelist
export SANDBOX_COMMAND_LIST=ls,cat,echo

# Network policies
export SANDBOX_NETWORK_MODE=blacklist
export SANDBOX_NETWORK_LIST=example.com,dangerous.site
```

## Usage with Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Recommended: npx (auto-install)

```json
{
  "mcpServers": {
    "sandbox": {
      "command": "npx",
      "args": ["-y", "@agentskillmania/sandbox-mcp"],
      "env": {
        "SANDBOX_ALLOW_NETWORK": "true",
        "SANDBOX_TIMEOUT": "10000"
      }
    }
  }
}
```

### Alternative: Direct node (local development)

```json
{
  "mcpServers": {
    "sandbox": {
      "command": "node",
      "args": ["./node_modules/@agentskillmania/sandbox-mcp/dist/index.js"],
      "env": {
        "SANDBOX_ALLOW_NETWORK": "true",
        "SANDBOX_TIMEOUT": "10000"
      }
    }
  }
}
```

## Tool Schemas

### run_shell

Execute shell commands in WASM sandbox.

```json
{
  "command": "ls",
  "args": ["-la"],
  "timeout": 5000,
  "allowNetwork": false
}
```

### run_python

Execute Python code strings.

```json
{
  "code": "print('Hello from WASM!')\nprint(2 + 2)",
  "timeout": 5000
}
```

### run_script

Execute shell or Python scripts from content.

```json
{
  "language": "sh",
  "content": "#!/bin/sh\necho 'Hello World'\ndate",
  "timeout": 5000
}
```

### read_file

Read file from sandbox directory.

```json
{
  "path": "test.txt"
}
```

### write_file

Write content to file.

```json
{
  "path": "output.txt",
  "content": "Hello WASM!"
}
```

### list_files

List files in sandbox directory.

```json
{
  "path": "."
}
```

### delete_file

Delete file from sandbox directory.

```json
{
  "path": "temp.txt"
}
```

## Security

### Filesystem Isolation

- All operations restricted to sandbox directory (default: `.sandbox-mcp`)
- No access to parent directories or system files
- Temporary scripts auto-deleted after execution

### Command Security

- Whitelist mode: Only allow specified commands
- Blacklist mode: Block dangerous commands
- Default: All commands allowed (configure for production)

### Network Security

- Disabled by default for maximum security
- Enable with `SANDBOX_ALLOW_NETWORK=true`
- Whitelist/blacklist specific domains as needed

## Performance

Typical execution times:

- Simple shell command: ~12ms
- Python print statement: ~15ms
- Cold start (first execution): ~47ms

## Requirements

- Node.js >= 16.0.0
- wasmtime 43.0.0 (auto-installed)
- macOS/Linux/Windows

## License

MIT

## Related Packages

- [@agentskillmania/sandbox](../sandbox/) - Core WASM sandbox library
