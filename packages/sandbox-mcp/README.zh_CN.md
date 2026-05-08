# @agentskillmania/sandbox-mcp

[@agentskillmania/sandbox](https://www.npmjs.com/package/@agentskillmania/sandbox) 的 MCP 服务器。提供 7 个工具，让 AI 智能体在 WASM 沙箱中执行 Shell 命令、Python 代码和文件操作。

完整功能说明（Shell、Python 模块、文件系统隔离、网络能力）请查看 [sandbox 包](https://www.npmjs.com/package/@agentskillmania/sandbox)。

## 工具

| 工具 | 说明 |
|------|------|
| `run_shell` | 执行 Shell 命令 |
| `run_python` | 执行 Python 代码 |
| `run_script` | 执行 Shell 或 Python 脚本内容 |
| `read_file` | 读取沙箱目录中的文件 |
| `write_file` | 写入文件到沙箱目录 |
| `list_files` | 列出沙箱目录中的文件 |
| `delete_file` | 删除沙箱目录中的文件 |

## 安装

```bash
npm install @agentskillmania/sandbox-mcp
```

## 在 Claude Desktop 中使用

添加到 `~/Library/Application Support/Claude/claude_desktop_config.json`：

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

## 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SANDBOX_TIMEOUT` | 600000 | 超时时间（ms） |
| `SANDBOX_ALLOW_NETWORK` | false | 启用网络 |
| `SANDBOX_SANDBOX_DIR` | .sandbox-mcp | 沙箱目录 |
| `SANDBOX_COMMAND_MODE` | - | `blacklist` 或 `whitelist` |
| `SANDBOX_COMMAND_LIST` | - | 逗号分隔的命令列表 |
| `SANDBOX_NETWORK_MODE` | - | `blacklist` 或 `whitelist` |
| `SANDBOX_NETWORK_LIST` | - | 逗号分隔的域名列表 |

## 运行要求

- Node.js >= 18
- wasmtime v43+（自动安装）

## 许可证

MIT
