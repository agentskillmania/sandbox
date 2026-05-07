# @agentskillmania/sandbox-monorepo

包含 WASM 沙箱包的 monorepo，用于在 AI 智能体环境中安全执行代码。

## 包

### [@agentskillmania/sandbox](./packages/sandbox/)

核心 WASM 沙箱库和 CLI 工具。

- 轻量级 WASM 沙箱，支持 Shell 命令、Python 和 Git
- Node.js SDK 和 CLI 接口
- 自动安装运行时（wasmtime 43.0.0）
- 平均执行时间 ~12ms
- 通过 wasmtime `--dir` 映射实现文件系统隔离

**安装**: `npm install @agentskillmania/sandbox`

### [@agentskillmania/sandbox-mcp](./packages/sandbox-mcp/)

MCP (Model Context Protocol) 服务器，用于 Claude Desktop 和其他兼容 MCP 的 AI 智能体。

- 7 个工具：run_shell、run_python、run_script、read_file、write_file、list_files、delete_file
- 环境变量配置
- 文件系统隔离
- 网络开关控制

**安装**: `npm install @agentskillmania/sandbox-mcp`

## 快速开始

### 安装 CLI 工具

```bash
npm install -g @agentskillmania/sandbox

# 执行 Shell 命令
exec-in-sandbox -- "ls -la"

# 执行 Python 代码
exec-in-sandbox -- "python -c \"print('Hello WASM!')\""

# 执行 Git 命令
exec-in-sandbox -- "git status"
```

### 在 Node.js 中使用

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

const sandbox = new Sandbox();

// 执行任意命令
const result = await sandbox.run('ls -la');
console.log(result.stdout);

// 执行 Python 代码
const pyResult = await sandbox.run("python -c 'print(2 + 2)'");
console.log(pyResult.stdout);
```

### 在 Claude Desktop 中使用 MCP 服务器

添加到 Claude Desktop 配置文件（`~/Library/Application Support/Claude/claude_desktop_config.json`）：

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

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm run build

# 运行测试
pnpm run test

# 只运行单元测试
pnpm run test:unit

# 只运行集成测试
pnpm run test:integration
```

## 性能

典型执行时间：

- Shell 命令: ~12ms
- Python 代码: ~15ms
- 冷启动: ~47ms
- 内存占用: ~4MB 每沙箱实例

## 许可证

MIT

## 链接

- [核心库文档](./packages/sandbox/README.md)
- [MCP 服务器文档](./packages/sandbox-mcp/README.md)
- English: [README.md](./README.md)
