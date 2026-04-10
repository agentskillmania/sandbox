# @agentskillmania/sandbox-monorepo

包含 WASM 沙箱包的 monorepo，用于在 AI 智能体环境中安全执行代码。

## 包

### [@agentskillmania/sandbox](./packages/sandbox/)

核心 WASM 沙箱库和 CLI 工具。

- 轻量级 WASM 沙箱，支持 busybox 和 micropython
- Node.js SDK 和 CLI 接口
- 自动安装运行时（wasmtime 43.0.0）
- 平均执行时间 ~12ms
- 支持 Shell 命令、Python 代码和脚本执行

**安装**: `npm install @agentskillmania/sandbox`

### [@agentskillmania/sandbox-mcp](./packages/sandbox-mcp/)

MCP (Model Context Protocol) 服务器，用于 Claude Desktop 和其他兼容 MCP 的 AI 智能体。

- 7 个工具：run_shell、run_python、run_script、read_file、write_file、list_files、delete_file
- 环境变量配置
- 命令和网络安全策略
- 文件系统隔离

**安装**: `npm install @agentskillmania/sandbox-mcp`

## 快速开始

### 安装 CLI 工具

```bash
npm install -g @agentskillmania/sandbox

# 执行 Shell 命令
exec-in-sandbox busybox ls -la

# 执行 Python 代码
exec-in-sandbox python -c "print('Hello WASM!')"
```

### 在 Node.js 中使用

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

const sandbox = new Sandbox();

// 执行 Shell 命令
const result = await sandbox.runShell('ls', ['-la']);
console.log(result.stdout);

// 执行 Python 代码
const pyResult = await sandbox.runPython('print(2 + 2)');
console.log(pyResult.stdout);
```

### 在 Claude Desktop 中使用 MCP 服务器

添加到 Claude Desktop 配置文件 (`~/Library/Application Support/Claude/claude_desktop_config.json`)：

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

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm run build

# 运行测试
pnpm run test

# 仅运行单元测试
pnpm run test:unit

# 仅运行集成测试
pnpm run test:integration
```

## 性能

典型执行时间：

- Shell 命令：~12ms
- Python 代码：~15ms
- 冷启动：~47ms
- 内存使用：每个沙箱实例 ~4MB

## 许可证

MIT

## 链接

- [核心库文档](./packages/sandbox/README.zh_CN.md)
- [MCP 服务器文档](./packages/sandbox-mcp/README.zh_CN.md)
- English Documentation: [README.md](./README.md)
