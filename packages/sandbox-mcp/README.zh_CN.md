# @agentskillmania/sandbox-mcp

MCP (Model Context Protocol) 服务器，用于在安全的 WASM 沙箱中执行 Shell 命令和 Python 代码。

## 特性

- 🔒 **安全执行**：所有命令在 WASM 沙箱中运行，文件系统访问受控
- ⚡ **快速执行**：使用 wasmtime 运行时，平均执行时间 ~12ms
- 🛠️ **丰富的工具集**：7 个工具，涵盖 Shell、Python、脚本和文件操作
- 🔧 **环境变量配置**：通过环境变量配置，无需配置文件
- 🌐 **网络控制**：可选网络访问，支持域名白名单/黑名单
- 📝 **安全策略**：支持命令和网络的允许列表/阻止列表

## 安装

```bash
npm install @agentskillmania/sandbox-mcp
```

## MCP 工具

### Shell 执行

- `run_shell` - 使用 busybox 执行 Shell 命令
- `run_script` - 从内容执行 Shell/Python 脚本

### Python 执行

- `run_python` - 使用 micropython 执行 Python 代码字符串

### 文件操作

- `read_file` - 读取沙箱目录中的文件
- `write_file` - 写入文件到沙箱目录
- `list_files` - 列出沙箱目录中的文件
- `delete_file` - 删除沙箱目录中的文件

## 配置

通过环境变量配置：

```bash
# 基础设置
export SANDBOX_TIMEOUT=5000
export SANDBOX_ALLOW_NETWORK=false
export SANDBOX_SANDBOX_DIR=".sandbox-mcp"

# 安全策略
export SANDBOX_COMMAND_MODE=whitelist
export SANDBOX_COMMAND_LIST=ls,cat,echo

# 网络策略
export SANDBOX_NETWORK_MODE=blacklist
export SANDBOX_NETWORK_LIST=example.com,dangerous.site
```

## 在 Claude Desktop 中使用

添加到 Claude Desktop 配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sandbox": {
      "command": "node",
      "args": ["/path/to/node_modules/@agentskillmania/sandbox-mcp/dist/index.js"],
      "env": {
        "SANDBOX_ALLOW_NETWORK": "true",
        "SANDBOX_TIMEOUT": "10000"
      }
    }
  }
}
```

## 工具模式

### run_shell

在 WASM 沙箱中执行 Shell 命令。

```json
{
  "command": "ls",
  "args": ["-la"],
  "timeout": 5000,
  "allowNetwork": false
}
```

### run_python

执行 Python 代码字符串。

```json
{
  "code": "print('Hello from WASM!')\nprint(2 + 2)",
  "timeout": 5000
}
```

### run_script

从内容执行 Shell 或 Python 脚本。

```json
{
  "language": "sh",
  "content": "#!/bin/sh\necho 'Hello World'\ndate",
  "timeout": 5000
}
```

### read_file

从沙箱目录读取文件。

```json
{
  "path": "test.txt"
}
```

### write_file

写入内容到文件。

```json
{
  "path": "output.txt",
  "content": "Hello WASM!"
}
```

### list_files

列出沙箱目录中的文件。

```json
{
  "path": "."
}
```

### delete_file

删除沙箱目录中的文件。

```json
{
  "path": "temp.txt"
}
```

## 安全性

### 文件系统隔离

- 所有操作限制在沙箱目录（默认：`.sandbox-mcp`）
- 无法访问父目录或系统文件
- 临时脚本在执行后自动删除

### 命令安全

- 白名单模式：仅允许指定的命令
- 黑名单模式：阻止危险命令
- 默认：允许所有命令（生产环境建议配置）

### 网络安全

- 默认禁用以获得最大安全性
- 通过 `SANDBOX_ALLOW_NETWORK=true` 启用
- 可根据需要白名单/黑名单特定域名

## 性能

典型执行时间：

- 简单 Shell 命令：~12ms
- Python print 语句：~15ms
- 冷启动（首次执行）：~47ms

## 系统要求

- Node.js >= 16.0.0
- wasmtime 43.0.0（自动安装）
- macOS/Linux/Windows

## 许可证

MIT

## 相关包

- [@agentskillmania/sandbox](../sandbox/) - 核心 WASM 沙箱库
