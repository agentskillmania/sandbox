# @agentskillmania/sandbox

WASM 沙箱，用于在隔离环境中执行 Shell 命令、Python 代码和 Git 操作。单个 ~8MB 二进制文件，通过 wasmtime 运行，不需要 Docker。

## 为什么不用 Docker

| | Docker | @agentskillmania/sandbox |
|---|---|---|
| 体积 | ~1GB 镜像 | ~8MB wasm |
| 启动时间 | ~100ms+ 容器创建 | ~55ms 每条命令 |
| 需要守护进程 | 是 | 否 |
| 文件系统隔离 | 容器 fs | wasmtime --dir 映射 |

体积小 ~18 倍，速度快 ~2 倍，零守护进程开销。

## 功能

- **Shell**: busybox wsh — ls、cat、grep、sed、awk、find、wc、sort、head、tail、管道、变量、if/for、`&&`/`||`、命令替换
- **Git**: libgit2 1.9.2 — clone、log、status、diff、commit 等
- **Python**: MicroPython 1.27，内置 30+ 标准库模块（见下方列表）
- **网络**: TCP/UDP 套接字、DNS、TLS（mbedTLS）、HTTP（requests 库）
- **文件系统隔离**: 仅可见 `/workspace` 和 `/tmp`，其余全部阻断

## 安装

```bash
npm install @agentskillmania/sandbox
```

wasmtime v43 会在首次使用时自动安装到 `~/.agentskillmania/sandbox/wasmtime/`。如果自动安装失败：

```bash
npx exec-in-sandbox install-runtime
```

## 命令行使用

```bash
# Shell
exec-in-sandbox -- "ls -la"
exec-in-sandbox -- "cat file.txt | grep hello"

# Python
exec-in-sandbox -- "python -c 'print(42)'"
exec-in-sandbox -- "python script.py"

# Git
exec-in-sandbox -- "git log --oneline"
```

`--` 分隔符是必需的：选项在前，命令在后。

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--timeout <ms>` | 5000 | 执行超时时间 |
| `--sandbox-dir <dir>` | 自动临时目录 | 映射到 `/workspace` 的宿主目录 |
| `--allow-network` | 关闭 | 启用网络 |
| `--command-allowlist <cmds>` | - | 逗号分隔的白名单 |
| `--command-blocklist <cmds>` | - | 逗号分隔的黑名单 |

## 编程使用

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

const sandbox = new Sandbox({
  sandboxDir: '.sandbox',
  timeout: 10000,
  allowNetwork: false,
  commandPolicy: { mode: 'blacklist', list: ['rm'] },
});

const result = await sandbox.run('python -c "print(42)"');
console.log(result.stdout);   // "42"
console.log(result.exitCode); // 0
```

返回 `{ stdout: string, stderr: string, exitCode: number }`。

## Python 模块

**内置（C）:** json, re, hashlib, math, cmath, random, os, sys, io, struct, gc, time, socket, select, errno, binascii, collections (deque, OrderedDict), heapq, array, deflate, uctypes, platform

**冻结（嵌入 wasm）:** datetime, itertools, functools, copy, types, string, base64, contextlib, logging, traceback, unittest, pprint, pickle, stat, operator, hmac, zlib, warnings, abc, bisect, fnmatch, shutil, tempfile, pathlib, gzip, asyncio, ssl, requests, collections.defaultdict

## 文件系统隔离

- `/workspace` → 你的沙箱目录（读写）
- `/tmp` → 每次执行独立的临时目录（自动清理）
- 其余所有路径（`/etc`、`/home`、`../`）被 wasmtime 阻断

## 运行要求

- Node.js >= 16
- wasmtime v43+（自动安装）

## 许可证

MIT
