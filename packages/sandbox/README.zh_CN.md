# @agentskillmania/sandbox

用于在隔离环境中安全执行命令的 WASM 沙箱。

## 特性

- 🚀 **轻量级**：单个 wasmtime 进程 ~3MB，vs Docker 的 ~1GB
- ⚡ **执行快速**：平均命令执行时间 ~12ms，vs Docker 的 ~100ms
- 🔒 **安全隔离**：通过 wasmtime `--dir` 映射实现文件系统隔离
- 🛠️ **简单易用**：CLI 工具和 Node.js SDK，单一 `run(command)` 接口

## 安装

```bash
npm install -g @agentskillmania/sandbox
```

### 运行时自动安装

安装 npm 包时，会自动安装 wasmtime 43.0.0 到 `~/.agentskillmania/sandbox/wasmtime/`。

**支持的平台**：

- macOS (x64, arm64) ✅
- Linux (x64, arm64) ✅
- Windows (x64, arm64) ✅

**手动安装**（如果自动安装失败）：

```bash
exec-in-sandbox install-runtime
```

**代理支持**：

安装脚本使用 `curl` 下载，会自动读取以下环境变量：

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

## 使用

### CLI 语法

```bash
exec-in-sandbox [选项] -- <命令>
```

`--` 分隔符是必需的。`--` 之前是 CLI 选项，`--` 之后是要在沙箱中执行的命令字符串。

### CLI 示例

```bash
# 执行 shell 命令
exec-in-sandbox -- "ls -la"
exec-in-sandbox -- "cat file.txt"
exec-in-sandbox -- "echo hello | grep h"

# 执行 Python 代码
exec-in-sandbox -- "python -c \"print('hello from python')\""
exec-in-sandbox -- "python -c \"import os; print(os.listdir('.'))\""

# 执行 Git 命令
exec-in-sandbox -- "git status"

# 使用共享文件系统
exec-in-sandbox -- "echo 'print(42)' > script.py"
exec-in-sandbox -- "python script.py"

# 命令行选项（在 -- 之前）
exec-in-sandbox --timeout=10000 --allow-network -- "curl https://example.com"
exec-in-sandbox --sandbox-dir=./my-sandbox -- "ls -la"
```

### 全局选项

| 命令行参数            | 说明                                    |
| --------------------- | --------------------------------------- |
| `--timeout <ms>`      | 执行超时时间（毫秒，默认：`5000`）      |
| `--sandbox-dir <dir>` | 沙箱目录（默认：`auto` = 系统临时目录） |
| `--allow-network`     | 允许网络访问（默认：禁用）              |

### Node.js SDK

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

// 创建沙箱实例
const sandbox = new Sandbox({
  sandboxDir: '.sandbox', // 共享文件系统目录
  timeout: 5000, // 超时时间（毫秒）
  allowNetwork: false, // 网络访问（默认：false）
});

// 执行任意命令
const result1 = await sandbox.run('ls -la');
console.log(result1.stdout);

// 执行 Python 代码
const result2 = await sandbox.run("python -c 'print(42)'");
console.log(result2.stdout);

// 执行 Git 命令
const result3 = await sandbox.run('git status');
console.log(result3.stdout);

// 通过文件系统传递数据
await sandbox.run('echo "data" > input.txt');
const result4 = await sandbox.run('cat input.txt');
console.log(result4.stdout);
```

**返回格式**：

```typescript
interface ExecResult {
  stdout: string; // 标准输出
  stderr: string; // 标准错误（通常为空，已合并到 stdout）
  exitCode: number; // 进程退出码
}
```

### 脚本文件

如果命令参数以 `.sh` 或 `.py` 结尾，会自动读取文件内容并执行：

```javascript
// 执行 shell 脚本文件
const result = await sandbox.run('./script.sh');

// 执行 Python 脚本文件
const result = await sandbox.run('./script.py');
```

## 文件系统隔离

沙箱使用 wasmtime 的 `--dir` 映射提供受控的文件系统视图：

```
/workspace  →  host 沙箱目录（读写）
/tmp        →  host 临时目录（读写，每次执行独立隔离）
```

- **`/workspace`**：沙箱工作目录。所有文件操作（除非使用绝对路径）都在此进行。
- **`/tmp`**：每次执行时创建的独立临时目录，执行后自动清理。内部用于管道操作。
- **其他所有路径**：未挂载，不可访问。`../`、`/etc/passwd`、`/home` 等都返回 `No such file or directory` 或 `Operation not permitted`。

**安全边界**：真正的隔离由 wasmtime 的目录映射强制执行，而非命令过滤。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Executor / Sandbox                      │  │
│  │  - 验证命令（占位符，当前无实际操作）               │  │
│  │  - 自动前缀：cd /workspace && <命令>                │  │
│  │  - 生成独立 /tmp 目录并启动 wasmtime                │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            WasmRuntime (wasmtime)                   │  │
│  │  - 启动 wasmtime 进程                               │  │
│  │  - 映射沙箱目录 → /workspace                        │  │
│  │  - 映射独立临时目录 → /tmp                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              busybox.wasm（组合组件）               │  │
│  │  - wsh: shell 解释器                                │  │
│  │  - git: 版本控制                                    │  │
│  │  - python: Python 解释器                            │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 工作原理

1. **统一命令接口**：用户传入命令字符串（`ls -la`、`python -c "print(42)"`、`git status`）
2. **目录前缀**：命令自动加上 `cd /workspace &&` 前缀，确保文件操作在沙箱目录下进行
3. **隔离执行**：每次执行生成新的 wasmtime 进程，附带独立的 `/tmp` 目录
4. **清理**：执行结束后自动删除临时 `/tmp` 目录

## Shell 特性

Shell 脚本（`.sh` 文件）和内联 shell 代码通过 **wsh** 执行，这是 busybox.wasm 内置的 WASM shell 实现。

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

- ❌ **不支持函数定义** — `()` 语法不支持

## Python 特性

内置的 Python 解释器（MicroPython）支持：

| 模块          | 支持的功能                                                              |
| ------------- | ----------------------------------------------------------------------- |
| `socket`      | TCP 客户端/服务端、`connect`、`bind`、`listen`、`accept`、`send`/`recv` |
| `asyncio`     | async/await、事件循环、锁、流                                           |
| `json`        | `dumps`、`loads`                                                        |
| `re`          | `match`、`search`、`sub`                                                |
| `hashlib`     | `sha256`、`md5`                                                         |
| `math`        | `pi`、`e`、`factorial`、`gamma`、`erf`                                  |
| `random`      | `random()`、`randint()`、`choice()`                                     |
| `time`        | `time()`、`time_ns()`、`gmtime()`、`localtime()`、`mktime()`            |
| `sys`         | `exc_info()`、`atexit()`                                                |
| `os`          | `listdir`、`mkdir`、`remove`、`stat`                                    |
| `heapq`       | `heappush`、`heappop`、`heapify`                                        |
| `collections` | `deque`、`OrderedDict`                                                  |

**网络能力**（需要 `--allow-network`）：

- ✅ TCP sockets（客户端和服务端）
- ✅ DNS 解析
- ❌ UDP sockets — wasmtime 中不稳定（可能崩溃）
- ❌ HTTPS/SSL — 无 TLS 支持

## 性能

| 指标                 | @agentskillmania/sandbox | Docker |
| -------------------- | ------------------------ | ------ |
| 沙箱实例创建         | ~0.1ms                   | —      |
| 首次命令执行         | ~20ms                    | >1s    |
| 平均命令执行时间     | ~12ms                    | ~100ms |
| 内存增长（50次执行） | ~4MB                     | >1GB   |
| 磁盘占用             | ~3MB                     | >100MB |

## 安全

### 文件系统隔离

主要安全机制是 wasmtime 的目录隔离：

- 只有 `/workspace`（沙箱目录）和 `/tmp`（独立临时目录）可见
- `../` 路径遍历被 wasmtime 阻止（`Operation not permitted`）
- Host 系统文件（`/etc`、`/home` 等）完全不可访问

### 命令安全（占位符）

`SecurityPolicy` 类作为未来扩展的钩子存在，但当前**允许所有命令**。真正的隔离来自文件系统边界，而非命令过滤。

### 网络安全

- 网络**默认禁用**
- 使用 `--allow-network` 或 `allowNetwork: true` 启用
- 启用后所有网络能力（TCP、DNS）都可用
- **域名级别过滤未实现** — 网络要么全开，要么全关

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm run build

# 运行全部测试
pnpm run test

# 只运行单元测试
pnpm run test:unit

# 只运行集成测试
pnpm run test:integration
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
