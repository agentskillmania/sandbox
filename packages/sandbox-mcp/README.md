# @agentskillmania/sandbox-mcp

MCP server for [@agentskillmania/sandbox](https://www.npmjs.com/package/@agentskillmania/sandbox). Provides 7 tools that let AI agents execute shell commands, Python code, and manage files inside a WASM sandbox.

See the [sandbox package](https://www.npmjs.com/package/@agentskillmania/sandbox) for full feature details (supported shells, Python modules, filesystem isolation, network capabilities).

## Tools

| Tool | Description |
|------|-------------|
| `run_shell` | Execute shell command |
| `run_python` | Execute Python code |
| `run_script` | Execute shell or Python script from content |
| `read_file` | Read file from sandbox directory |
| `write_file` | Write file to sandbox directory |
| `list_files` | List files in sandbox directory |
| `delete_file` | Delete file from sandbox directory |

## Install

```bash
npm install @agentskillmania/sandbox-mcp
```

## Use with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_TIMEOUT` | 600000 | Timeout in ms |
| `SANDBOX_ALLOW_NETWORK` | false | Enable network |
| `SANDBOX_SANDBOX_DIR` | .sandbox-mcp | Sandbox directory |
| `SANDBOX_COMMAND_MODE` | - | `blacklist` or `whitelist` |
| `SANDBOX_COMMAND_LIST` | - | Comma-separated command list |
| `SANDBOX_NETWORK_MODE` | - | `blacklist` or `whitelist` |
| `SANDBOX_NETWORK_LIST` | - | Comma-separated domain list |

## Requirements

- Node.js >= 18
- wasmtime v43+ (auto-installed)

## License

MIT
