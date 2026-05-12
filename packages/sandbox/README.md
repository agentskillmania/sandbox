# @agentskillmania/sandbox

A WASM sandbox for executing shell commands, Python code, and Git operations in isolation. Runs as a single 8MB binary under wasmtime, no Docker needed.

## Why this instead of Docker

| | Docker | @agentskillmania/sandbox |
|---|---|---|
| Image size | ~1GB+ | **8MB** single wasm |
| Cold start | 500ms–2s container create | **~100ms** |
| Per command | ~100ms per command | **~10ms** |
| Memory | ~50–200MB container RSS | **~50MB** |
| Daemon required | yes (dockerd) | **no** |
| Language runtime | install in Dockerfile | shell + Python + Git built-in |
| Isolation | Linux namespaces | WASM capability-based (wasmtime) |

100x smaller, 10x faster, zero daemon.

## Features

- **Shell**: busybox wsh — ls, cat, grep, sed, awk, find, wc, sort, head, tail, pipes, variables, if/for, `&&`/`||`, command substitution
- **Git**: libgit2 1.9.2 — clone, log, status, diff, commit, etc.
- **Python**: MicroPython 1.27 with 30+ stdlib modules frozen in (see below)
- **Network**: TCP/UDP sockets, DNS, TLS (mbedTLS), HTTP (requests library)
- **Filesystem isolation**: only `/workspace` and `/tmp` visible, everything else blocked

## Install

```bash
npm install @agentskillmania/sandbox
```

wasmtime v43 is auto-installed to `~/.agentskillmania/sandbox/wasmtime/` on first use. If auto-install fails:

```bash
npx exec-in-sandbox install-runtime
```

## CLI Usage

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

The `--` separator is required: options before, command after.

| Option | Default | Description |
|--------|---------|-------------|
| `--timeout <ms>` | 5000 | Execution timeout |
| `--sandbox-dir <dir>` | auto temp | Host dir mapped to `/workspace` |
| `--allow-network` | off | Enable network |
| `--command-allowlist <cmds>` | - | Comma-separated allowlist |
| `--command-blocklist <cmds>` | - | Comma-separated blocklist |

## Programmatic Usage

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

Returns `{ stdout: string, stderr: string, exitCode: number }`.

## Python Modules

**Built-in (C):** json, re, hashlib, math, cmath, random, os, sys, io, struct, gc, time, socket, select, errno, binascii, collections (deque, OrderedDict), heapq, array, deflate, uctypes, platform

**Frozen (embedded in wasm):** datetime, itertools, functools, copy, types, string, base64, contextlib, logging, traceback, unittest, pprint, pickle, stat, operator, hmac, zlib, warnings, abc, bisect, fnmatch, shutil, tempfile, pathlib, gzip, asyncio, ssl, requests, collections.defaultdict

## Filesystem Isolation

- `/workspace` → your sandbox directory (read-write)
- `/tmp` → isolated temp dir per execution (auto-cleaned)
- Everything else (`/etc`, `/home`, `../`) is blocked by wasmtime

## Requirements

- Node.js >= 16
- wasmtime v43+ (auto-installed)

## License

MIT
