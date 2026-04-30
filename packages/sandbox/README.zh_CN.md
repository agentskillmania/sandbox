# @agentskillmania/sandbox

WASM 沙箱工具，支持 busybox、sh shell 和 python。

## 特性

- 🚀 **轻量级**：单个 wasmtime 进程 ~3MB，vs Docker 的 ~1GB
- ⚡ **执行快速**：平均命令执行时间 ~12ms，vs Docker 的 ~100ms
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

### CLI 语法

```bash
exec-in-sandbox [选项] -- <运行时> [参数...]
```

`--` 分隔符是必需的。`--` 之前是 CLI 选项，`--` 之后传给 WASM 运行时。

**支持的运行时**：

| 运行时    | 别名               | 说明                                     |
| --------- | ------------------ | ---------------------------------------- |
| `busybox` | `bb`               | Busybox 小程序（ls、cat、echo、wget 等） |
| `sh`      | `wsh`              | Shell 解释器（脚本、管道、变量）         |
| `python`  | `py`、`micropython` | Python 解释器                            |

### CLI 示例

```bash
# 执行 busybox 命令
exec-in-sandbox -- busybox ls -la
exec-in-sandbox -- busybox cat file.txt
exec-in-sandbox -- busybox --list

# 执行 sh shell 脚本
exec-in-sandbox -- sh -c "echo hello | grep h"
exec-in-sandbox -- sh -c "X=10; Y=20; echo \$((X + Y))"
exec-in-sandbox -- sh -c $'echo hello\necho world'

# 执行 Python 代码
exec-in-sandbox -- python -c "print('hello from python')"
exec-in-sandbox -- python -c "import os; print(os.listdir('.'))"

# 执行脚本文件
exec-in-sandbox -- busybox script.sh
exec-in-sandbox -- python script.py

# 使用共享文件系统
exec-in-sandbox -- busybox -c "echo 'print(42)' > .sandbox/script.py"
exec-in-sandbox -- python .sandbox/script.py

# 命令行选项（在 -- 之前）
exec-in-sandbox --timeout=10000 --allow-network -- busybox curl https://example.com
exec-in-sandbox --command-allowlist "ls,cat,echo" -- busybox ls -la
exec-in-sandbox --sandbox-dir=./my-sandbox -- busybox ls -la
```

**全局选项**：

| 命令行参数                      | 说明                                           |
| ------------------------------- | ---------------------------------------------- |
| `--timeout <ms>`                | 执行超时时间（毫秒，默认：`5000`）             |
| `--sandbox-dir <dir>`           | 沙箱目录（默认：`auto` = 系统临时目录）        |
| `--allow-network`               | 允许网络访问                                   |
| `--command-allowlist <cmds>`    | 命令白名单（逗号分隔，设置模式为 `whitelist`） |
| `--command-blocklist <cmds>`    | 命令黑名单（逗号分隔，设置模式为 `blacklist`） |
| `--network-allowlist <domains>` | 网络白名单（逗号分隔）                         |
| `--network-blocklist <domains>` | 网络黑名单（逗号分隔）                         |

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
  mode: blacklist # blacklist = 禁止列表中的命令，whitelist = 只允许列表中的命令
  list: # 应用该模式的命令列表
    - rm
    - format
    - fdisk
    - mkfs

# 网络安全策略
network:
  mode: blacklist # blacklist = 禁止列表中的域名，whitelist = 只允许列表中的域名
  list: # 应用该模式的域名列表
    - '*.malicious.com'
    - '*.ads.com'
```

**模式语义**：

- **黑名单模式**：禁止列表中的项目，允许其他所有项目
  - 命令：禁止危险命令如 `rm`、`format`
  - 网络：禁止恶意域名，允许其他所有域名
- **白名单模式**：只允许列表中的项目，禁止其他所有项目
  - 命令：只允许特定命令如 `ls`、`cat`
  - 网络：只允许特定域名如 `*.github.com`

**网络行为**：

- 无配置或 `mode: blacklist` 且列表为空 → 禁用网络
- `mode: whitelist` → 启用网络 + 只允许列表中的域名
- `mode: blacklist` 且有列表 → 启用网络 + 禁止列表中的域名

**执行参数**（timeout、sandboxDir 等）**不在**配置文件中。必须通过以下方式指定：

- 命令行参数：`--timeout 10000`
- SDK 构造函数：`new Sandbox({ timeout: 10000 })`

**配置优先级**：

1. 命令行参数（最高优先级）
2. SDK 构造函数参数
3. 全局安全策略（默认值）

**安全策略映射**：

| 安全功能 | 全局配置                 | CLI 覆盖                        | SDK 构造函数                 |
| -------- | ------------------------ | ------------------------------- | ---------------------------- |
| 命令过滤 | `commands.mode` + `list` | `--command-allowlist/blocklist` | `commandAllowlist/blocklist` |
| 网络模式 | `network.mode`           | `--allow-network`               | `allowNetwork`               |
| 域名过滤 | `network.mode` + `list`  | `--network-allowlist/blocklist` | `networkAllowlist/blocklist` |

## 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              执行器 (Executor)                      │  │
│  │  - 验证安全策略                                     │  │
│  │  - 分发到运行时 (busybox / sh / python)             │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            WasmRuntime (wasmtime)                   │  │
│  │  - 启动 wasmtime 进程                               │  │
│  │  - 映射沙箱目录                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌──────────────┐  ┌──────────┐  ┌─────────────┐        │
│  │ busybox.wasm │  │ sh       │  │ python      │        │
│  │ (小程序)     │  │ (shell)  │  │ (python)    │        │
│  └──────────────┘  └──────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

1. **显式运行时选择**：用户指定使用哪个运行时（`busybox`、`sh` 或 `python`）
2. **安全验证**：执行前强制执行命令和网络策略
3. **共享文件系统**：沙箱目录通过 `--dir` 映射到 WASM 进程
4. **进程隔离**：每次执行都是独立的 wasmtime 进程，执行完成后退出

## Shell 脚本支持 (sh)

Shell 脚本（`.sh` 文件）和内联 shell 代码通过 **sh**（底层为 wsh）执行，这是来自 busybox-wasi 的自定义 WASM shell 实现。

### 支持的功能

- ✅ **变量和展开**：`X=hello; echo $X`
- ✅ **命令替换**：`echo $(echo inner)`
- ✅ **管道**：`echo hello | tr a-z A-Z`
- ✅ **控制流**：`if/else`、`for` 循环、`case` 语句
- ✅ **逻辑运算符**：`&&`、`||`
- ✅ **注释**：`# 这是注释`
- ✅ **换行分隔**：命令可以写在多行
- ✅ **算术展开**：`echo $((10 + 20))`

### 已知限制

这些是 **wsh 实现限制**，不是 sandbox 的 bug：

- ❌ **不支持函数定义** — `()` 语法不支持

### 脚本格式

```bash
# ✅ 正确：格式良好的 wsh 脚本
echo "Hello"
echo "World"

# 注释已支持
X=10
Y=20
result=$((X + Y))
echo $result

if [ "$X" -gt 5 ]; then
    echo "X is large"
fi

# ❌ 错误：使用了不支持的功能
#!/bin/sh
myfunc() { echo "not supported"; }
```

**提示**：

- 使用 `$((...))` 进行算术运算
- `#` 注释完全支持
- 换行可以分隔命令（不需要到处用 `;`）
- 避免函数定义 — 使用内联命令

### MicroPython 功能

集成的 MicroPython 解释器支持以下功能：

| 模块          | 支持的功能                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `socket`      | TCP 客户端/服务端、**UDP** (v0.2.1+)、`connect`、`bind`、`listen`、`accept`、`send`/`recv`、`sendto`/`recvfrom` |
| `asyncio`     | async/await、事件循环、锁、流                                                                        |
| `json`        | `dumps`、`loads`                                                                                     |
| `re`          | `match`、`search`、`sub`                                                                             |
| `hashlib`     | `sha256`、`md5`                                                                                      |
| `deflate`     | `DeflateIO`（压缩）                                                                                  |
| `math`        | `pi`、`e`、`factorial`、`gamma`、`erf`                                                                |
| `random`      | `random()`、`randint()`、`choice()`                                                                    |
| `time`        | `time()`、`time_ns()`、`gmtime()`、`localtime()`、`mktime()` (v0.2.3+)                                  |
| `sys`         | `exc_info()`、`atexit()` (v0.2.3+)                                                                   |
| `os`          | `listdir`、`mkdir`、`remove`、`stat`                                                                   |
| `heapq`       | `heappush`、`heappop`、`heapify`                                                                       |
| `collections` | `deque`、`OrderedDict`                                                                               |

**网络能力：**

- ✅ TCP sockets（客户端和服务端）
- ✅ UDP sockets (v0.2.1+)
- ✅ DNS 解析 (v0.2.3+，需要 `--allow-network`)
- ❌ HTTPS/SSL — 无 TLS 支持

**Python 示例：**

```bash
# TCP 客户端
exec-in-sandbox --allow-network -- python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('140.82.121.6', 80))
s.send(b'GET / HTTP/1.0\r\n\r\n')
print(s.recv(1024))
s.close()
"

# UDP socket
exec-in-sandbox --allow-network -- python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.sendto(b'hello', ('8.8.8.8', 53))
data, addr = s.recvfrom(1024)
print('Received from', addr)
s.close()
"

# asyncio
exec-in-sandbox -- python -c "
import asyncio
async def main():
    print('hello async')
asyncio.run(main())
"

# JSON
exec-in-sandbox -- python -c "
import json
print(json.dumps({'name': 'sandbox', 'version': 1}))
"
```

## 性能

| 指标                 | @agentskillmania/sandbox | Docker |
| -------------------- | ------------------------ | ------ |
| 沙箱实例创建         | ~0.1ms                   | —      |
| 首次命令执行         | ~20ms                    | >1s    |
| 平均命令执行时间     | ~12ms                    | ~100ms |
| 内存增长（50次执行） | ~4MB                     | >1GB   |
| 磁盘占用             | ~3MB                     | >100MB |

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
