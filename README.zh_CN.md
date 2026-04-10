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
- Windows (x64, arm64) ✅

**手动安装**（如果自动安装失败）：

```bash
# 如果需要代理，设置环境变量
export HTTP_PROXY=http://proxy.example.com:7890
export HTTPS_PROXY=http://proxy.example.com:7890

# 使用 CLI 命令重新安装 wasmtime 运行时
exec-in-sandbox install-runtime

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

# 命令行选项
exec-in-sandbox --timeout 10000 --allow-network busybox curl https://example.com
exec-in-sandbox --command-allowlist "ls,cat,echo" busybox ls -la
exec-in-sandbox --network-allowlist "*.github.com,registry.npmjs.org" python -c "import urllib; ..."
```

**全局选项：**

| 命令行参数 | 配置文件 | 说明 |
|-----------|----------|------|
| `--config <path>` | — | 配置文件路径 |
| `--sandbox-dir <dir>` | — | 沙箱目录（默认：`auto` = 系统临时目录，如 `/tmp/sandbox-xxx`） |
| `--timeout <ms>` | — | 执行超时时间（毫秒，默认：`5000`） |
| `--allow-network` | `network.mode` | 允许网络访问 |
| `--command-allowlist <cmds>` | `commands.mode` + `list` | 命令白名单（逗号分隔） |
| `--command-blocklist <cmds>` | `commands.mode` + `list` | 命令黑名单（逗号分隔） |
| `--network-allowlist <domains>` | `network.mode` + `list` | 网络白名单（逗号分隔） |
| `--network-blocklist <domains>` | `network.mode` + `list` | 网络黑名单（逗号分隔） |

**配置优先级：** 命令行参数 > 配置文件 > 默认值

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

全局配置文件位于 `~/.agentskillmania/sandbox/config.yaml`，**仅包含安全策略**。它为命令和网络安全提供默认值：

```yaml
# 命令安全策略
commands:
  mode: blacklist        # blacklist = 禁止列表中的命令，whitelist = 只允许列表中的命令
  list:                  # 应用该模式的命令列表
    - rm
    - format
    - fdisk
    - mkfs

# 网络安全策略
network:
  mode: blacklist        # blacklist = 禁止列表中的域名，whitelist = 只允许列表中的域名
  list:                  # 应用该模式的域名列表
    - '*.malicious.com'
    - '*.ads.com'
```

**模式语义：**
- **黑名单模式**：禁止列表中的项目，允许其他所有项目
  - 命令：禁止危险命令如 `rm`、`format`
  - 网络：禁止恶意域名，允许其他所有域名
- **白名单模式**：只允许列表中的项目，禁止其他所有项目
  - 命令：只允许特定命令如 `ls`、`cat`
  - 网络：只允许特定域名如 `*.github.com`

**网络行为：**
- 无配置或 `mode: blacklist` 且列表为空 → 禁用网络
- `mode: whitelist` → 启用网络 + 只允许列表中的域名
- `mode: blacklist` 且有列表 → 启用网络 + 禁止列表中的域名

**执行参数**（timeout、sandboxDir 等）**不在**配置文件中。必须通过以下方式指定：
- 命令行参数：`--timeout 10000`
- SDK 构造函数：`new Sandbox({ timeout: 10000 })`

**配置优先级：**

1. 命令行参数（最高优先级）
2. SDK 构造函数参数
3. 全局安全策略（默认值）

**安全策略映射：**

| 安全功能 | 全局配置 | CLI 覆盖 | SDK 构造函数 |
|---------|----------|----------|-------------|
| 命令过滤 | `commands.mode` + `list` | `--command-allowlist/blocklist` | `commandAllowlist/blocklist` |
| 网络模式 | `network.mode` | `--allow-network` | `allowNetwork` |
| 域名过滤 | `network.mode` + `list` | `--network-allowlist/blocklist` | `networkAllowlist/blocklist` |

## 工作原理

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

## Shell 脚本支持 (wsh)

Shell 脚本（`.sh` 文件）通过 **wsh** 执行，这是来自 busybox-wasi 的自定义 WASM shell 实现。

### 支持的功能

✅ **变量和展开**：`X=hello; echo $X`
✅ **命令替换**：`echo $(echo inner)`
✅ **管道**：`echo hello | tr a-z A-Z`
✅ **控制流**：`if/else`、`for` 循环、`case` 语句
✅ **逻辑运算符**：`&&`、`||`
✅ **算术运算**：`expr 10 + 20`（使用 `expr`，不是 `$((...))`）

### 已知限制

这些是 **wsh 实现限制**，不是 sandbox 的 bug：

❌ **不支持 `#` 注释** — wsh 不支持 shell 风格的注释
❌ **不支持函数定义** — `()` 语法不支持
❌ **不支持 `$((...))` 算术** — 请使用 `expr $X + $Y` 替代
❌ **多行脚本** — 命令必须用 `;` 分隔，不能用换行符

### 脚本格式

由于 wsh 的限制，Shell 脚本应该：

```bash
# ✅ 正确：无 shebang，使用分号，无注释
echo "Hello"; echo "World"
X=10; Y=20; result=$(expr $X + $Y); echo $result
if [ "$X" -gt 5 ]; then echo "X is large"; fi

# ❌ 错误：使用了不支持的功能
#!/bin/sh
# 这是注释 - 会失败！
X=$((10 + 20))  # 算术展开 - 会失败！
```

**提示：**
- 保持脚本单行或用分号分隔
- 使用 `expr` 进行算术运算：`result=$(expr 10 + 20)`
- 避免函数定义 — 使用内联命令
- 不需要 `#` 注释

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
