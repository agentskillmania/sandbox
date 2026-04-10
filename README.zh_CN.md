# @agentskillmania/sandbox

WASM 沙箱工具，支持 busybox 和 micropython。

## 特性

- 🚀 **轻量级**：单个 wasmtime 进程 ~10MB，vs Docker 的 ~1GB
- ⚡ **冷启动快**：< 200ms 启动时间，vs Docker 的 >1s
- 🔒 **安全隔离**：WASM 沙箱，文件系统访问受控
- 🛠️ **简单易用**：CLI 工具和 Node.js SDK

## 安装

```bash
npm install -g @agentskillmania/sandbox
```

### 运行时自动安装

安装 npm 包时，脚本会自动安装专用版本的 wasmtime：

- 📦 自动下载 wasmtime 43.0.0（固定版本，确保兼容性）
- 🔒 安装到 `~/.agentskillmania/sandbox/wasmtime/`（专用版本，不影响系统）
- ✅ 不复用系统 wasmtime，避免版本冲突

**支持的平台**：

- macOS (x64, arm64) ✅
- Linux (x64, arm64) ✅
- Windows (x64, arm64) ⚠️ 计划中

**手动安装**（如果自动安装失败）：

```bash
# 如果需要代理，设置环境变量
export HTTP_PROXY=http://proxy.example.com:7890
export HTTPS_PROXY=http://proxy.example.com:7890

# 然后重新安装
npm install @agentskillmania/sandbox

# 或手动下载 wasmtime 43.0.0
# 访问: https://github.com/bytecodealliance/wasmtime/releases/tag/v43.0.0
# 解压后复制到 ~/.agentskillmania/sandbox/wasmtime/
```

**代理支持**：

安装脚本会自动使用 `curl` 下载（如果可用），它会自动读取以下环境变量：

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

## 使用

### CLI 工具

```bash
# 执行 Shell 命令（通过 busybox.wasm）
exec-in-sandbox busybox ls -la
exec-in-sandbox busybox -c "echo hello | grep h"

# 列出所有可用的 busybox 命令（内置功能）
exec-in-sandbox busybox --list
exec-in-sandbox busybox --list-full

# 显示 busybox 帮助（内置功能）
exec-in-sandbox busybox

# 执行 Python 代码（通过 micropython.wasm）
exec-in-sandbox python -c "print('hello from python')"
exec-in-sandbox python -c "import os; print(os.listdir('.'))"

# 执行脚本文件
exec-in-sandbox busybox script.sh
exec-in-sandbox python script.py

# 使用共享文件系统
exec-in-sandbox busybox -c "echo 'print(42)' > .sandbox/script.py"
exec-in-sandbox python .sandbox/script.py
```

### Node.js SDK

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

// 创建沙箱实例
const sandbox = new Sandbox({
  sandboxDir: '.sandbox', // 共享文件系统目录
  timeout: 5000, // 超时时间（毫秒）
});

// 执行 Shell 命令
const result1 = await sandbox.runShell('ls', ['-la']);
console.log(result1.stdout);

// 执行 Python 代码
const result2 = await sandbox.runPython("print('hello')");
console.log(result2.stdout);

// 通过文件系统传递数据
await sandbox.runShell('sh', ['-c', 'echo "data" > .sandbox/input.txt']);
const result3 = await sandbox.runPython(`
  with open('.sandbox/input.txt') as f:
    data = f.read()
  print(f'Got: {data}')
`);
console.log(result3.stdout);
```

### 配置

配置通过 `~/.agentskillmania/sandbox/config.yaml` 管理：

```yaml
# 沙箱目录
sandboxDir: .sandbox

# 模块配置
modules:
  busybox:
    enabled: true
    wasmPath: ./wasm/busybox.wasm
    commands:
      mode: blacklist
      list: ['rm', 'format']
  python:
    enabled: true
    wasmPath: ./wasm/micropython.wasm

# 网络配置
network:
  enabled: false
  allowlist:
    - '*.github.com'
    - registry.npmjs.org
  blocklist:
    - '*.malicious.com'

# 安全配置
security:
  timeout: 5000
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              命令路由器                             │  │
│  │  - 识别命令类型（Shell vs Python）                  │  │
│  │  - 路由到对应的 WASM 模块                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            共享沙箱目录                             │  │
│  │  .sandbox/                                          │  │
│  │    ├── tmp/          (临时文件)                     │  │
│  │    ├── data/         (数据文件)                     │  │
│  │    └── scripts/      (脚本文件)                     │  │
│  └─────────────────────────────────────────────────────┘  │
│         ↓                           ↓                    │
│  ┌──────────────┐          ┌─────────────┐             │
│  │ busybox.wasm │          │ micropython │             │
│  │              │          │   .wasm     │             │
│  │ Shell 命令   │          │ Python 代码 │             │
│  └──────────────┘          └─────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## 工作原理

1. **命令路由**：根据命令类型自动选择 WASM 模块
   - Shell 命令 → `busybox.wasm`
   - Python 代码/脚本 → `micropython.wasm`

2. **共享文件系统**：
   - 创建 `.sandbox/` 目录
   - 通过 `--dir=.sandbox` 参数映射到 WASM 沙箱
   - 两个模块都可以读写这个目录

3. **进程隔离**：
   - 每次执行都是独立的 wasmtime 进程
   - 执行完成后进程退出，资源自动释放

## 性能

| 指标     | @agentskillmania/sandbox | Docker |
| -------- | ------------------------ | ------ |
| 冷启动   | ~200ms                   | >1s    |
| 内存占用 | ~50MB                    | >1GB   |
| 磁盘占用 | ~10MB                    | >100MB |

## 开发

```bash
# 克隆仓库
git clone https://github.com/agentskillmania/sandbox.git
cd sandbox

# 安装依赖
npm install

# 运行测试
npm test

# Lint
npm run lint

# Format
npm run format
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
