# @agentskillmania/sandbox

WASM sandbox tool supporting busybox, shell scripts, and python.

## Features

- 🚀 **Lightweight**: Single wasmtime process ~3MB vs Docker's ~1GB
- ⚡ **Fast Execution**: ~12ms average command time vs Docker's ~100ms
- 🔒 **Secure Isolation**: WASM sandbox with controlled filesystem access
- 🔐 **HTTPS/SSL Support**: Python `ssl` module with mbedTLS for secure connections
- 🛠️ **Easy to Use**: CLI tool and Node.js SDK

## Installation

```bash
npm install -g @agentskillmania/sandbox
```

### Automatic Runtime Installation

When installing the npm package, the script automatically installs a dedicated version of wasmtime:

- 📦 Automatically downloads wasmtime 43.0.0 (fixed version for compatibility)
- 🔒 Installs to `~/.agentskillmania/sandbox/wasmtime/` (dedicated version, doesn't affect system)
- ✅ Doesn't reuse system wasmtime, avoiding version conflicts

**Supported Platforms**:

- macOS (x64, arm64) ✅
- Linux (x64, arm64) ✅
- Windows (x64, arm64) ✅

**Manual Installation** (if automatic installation fails):

```bash
# If you need a proxy, set environment variables
export HTTP_PROXY=http://proxy.example.com:7890
export HTTPS_PROXY=http://proxy.example.com:7890

# Reinstall wasmtime runtime using CLI
exec-in-sandbox install-runtime

# Or manually download wasmtime 43.0.0
# Visit: https://github.com/bytecodealliance/wasmtime/releases/tag/v43.0.0
# Extract and copy to ~/.agentskillmania/sandbox/wasmtime/
```

**Proxy Support**:

The installation script automatically uses `curl` for downloads (if available), which reads these environment variables:

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

## Usage

### CLI Syntax

```bash
exec-in-sandbox [OPTIONS] -- <runtime> [argv...]
```

The `--` separator is required. Everything before `--` are CLI options; everything after `--` is passed to the WASM runtime.

**Supported runtimes:**

| Runtime   | Aliases | Description                                 |
| --------- | ------- | ------------------------------------------- |
| `busybox` | `bb`    | Single commands (ls, cat, echo, wget, etc.) |
| `sh`      | `wsh`   | Shell scripts (pipes, variables, if/for)    |
| `python`  | `py`    | Python interpreter                          |

### CLI Examples

```bash
# Execute single commands
exec-in-sandbox -- busybox ls -la
exec-in-sandbox -- busybox cat file.txt
exec-in-sandbox -- busybox wget https://example.com

# Execute shell scripts
exec-in-sandbox -- sh -c "echo hello | grep h"
exec-in-sandbox -- sh -c "X=10; Y=20; echo \$((X + Y))"
exec-in-sandbox -- sh script.sh

# Execute Python code
exec-in-sandbox -- python -c "print('hello from python')"
exec-in-sandbox -- python -c "import os; print(os.listdir('.'))"
exec-in-sandbox -- python script.py

# Use shared filesystem
exec-in-sandbox -- busybox -c "echo 'print(42)' > .sandbox/script.py"
exec-in-sandbox -- python .sandbox/script.py

# Command-line options (before --)
exec-in-sandbox --timeout=10000 --allow-network -- busybox curl https://example.com
exec-in-sandbox --command-allowlist "ls,cat,echo" -- busybox ls -la
exec-in-sandbox --sandbox-dir=./my-sandbox -- busybox ls -la
```

### MicroPython Features

The bundled MicroPython interpreter supports the following features:

| Module        | Supported Features                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `socket`      | TCP client/server, **UDP** (v0.2.1+), `connect`, `bind`, `listen`, `accept`, `send`/`recv`, `sendto`/`recvfrom` |
| `asyncio`     | async/await, event loops, locks, streams                                                                        |
| `json`        | `dumps`, `loads`                                                                                                |
| `re`          | `match`, `search`, `sub`                                                                                        |
| `hashlib`     | `sha256`, `md5`                                                                                                 |
| `deflate`     | `DeflateIO` (compression)                                                                                       |
| `math`        | `pi`, `e`, `factorial`, `gamma`, `erf`                                                                          |
| `random`      | `random()`, `randint()`, `choice()`                                                                             |
| `time`        | `time()`, `time_ns()`, `gmtime()`, `localtime()`, `mktime()` (v0.2.3+)                                          |
| `sys`         | `exc_info()`, `atexit()` (v0.2.3+)                                                                              |
| `os`          | `listdir`, `mkdir`, `remove`, `stat`                                                                            |
| `heapq`       | `heappush`, `heappop`, `heapify`                                                                                |
| `collections` | `deque`, `OrderedDict`                                                                                          |

**Network capabilities:**

- ✅ TCP sockets (client and server)
- ✅ UDP sockets (v0.2.1+)
- ✅ DNS resolution (v0.2.3+, requires `--allow-network`)
- ❌ HTTPS/SSL — no TLS support

**Python examples:**

```bash
# TCP client
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

**Global Options:**

````

**Global Options:**

| CLI Option                      | Description                                                   |
| ------------------------------- | ------------------------------------------------------------- |
| `--timeout <ms>`                | Execution timeout in milliseconds (default: `5000`)           |
| `--sandbox-dir <dir>`           | Sandbox directory (default: `auto` = system temp dir)         |
| `--allow-network`               | Allow network access                                          |
| `--command-allowlist <cmds>`    | Command allowlist (comma-separated, sets mode to `whitelist`) |
| `--command-blocklist <cmds>`    | Command blocklist (comma-separated, sets mode to `blacklist`) |
| `--network-allowlist <domains>` | Network allowlist (comma-separated)                           |
| `--network-blocklist <domains>` | Network blocklist (comma-separated)                           |

**Configuration Priority:** Command-line arguments > Config file > Default values

### Node.js SDK

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

// Create sandbox instance
const sandbox = new Sandbox({
  sandboxDir: '.sandbox', // Shared filesystem directory
  timeout: 5000, // Timeout (milliseconds)
});

// Execute Shell commands
const result1 = await sandbox.runShell('ls', ['-la']);
console.log(result1.stdout);

// Execute Python code
const result2 = await sandbox.runPython("print('hello')");
console.log(result2.stdout);

// Pass data via filesystem
await sandbox.runShell('sh', ['-c', 'echo "data" > .sandbox/input.txt']);
const result3 = await sandbox.runPython(`
  with open('.sandbox/input.txt') as f:
    data = f.read()
  print(f'Got: {data}')
`);
console.log(result3.stdout);
````

### Configuration

The global configuration file at `~/.agentskillmania/sandbox/config.yaml` contains **security policies only**. It provides default values for command and network security:

```yaml
# Command security policy
commands:
  mode: blacklist # blacklist = block these, whitelist = only allow these
  list: # Commands to apply the mode
    - rm
    - format
    - fdisk
    - mkfs

# Network security policy
network:
  mode: blacklist # blacklist = block these domains, whitelist = only allow these
  list: # Domains to apply the mode
    - '*.malicious.com'
    - '*.ads.com'
```

**Mode semantics:**

- **Blacklist mode**: Block items in the list, allow everything else
  - Commands: Block dangerous commands like `rm`, `format`
  - Network: Block malicious domains, allow all other domains
- **Whitelist mode**: Only allow items in the list, block everything else
  - Commands: Only allow specific commands like `ls`, `cat`
  - Network: Only allow specific domains like `*.github.com`

**Network behavior:**

- No config or `mode: blacklist` with empty list → Network disabled
- `mode: whitelist` → Network enabled + only allow listed domains
- `mode: blacklist` with list → Network enabled + block listed domains

**Execution parameters** (timeout, sandboxDir, etc.) are **not** in the config file. They must be specified via:

- Command-line arguments: `--timeout 10000`
- SDK constructor: `new Sandbox({ timeout: 10000 })`

**Configuration Priority:**

1. Command-line arguments (highest priority)
2. SDK constructor parameters
3. Global security policy (default values)

**Security Policy Mapping:**

| Security Feature  | Global Config            | CLI Override                    | SDK Constructor              |
| ----------------- | ------------------------ | ------------------------------- | ---------------------------- |
| Command filtering | `commands.mode` + `list` | `--command-allowlist/blocklist` | `commandAllowlist/blocklist` |
| Network mode      | `network.mode`           | `--allow-network`               | `allowNetwork`               |
| Domain filtering  | `network.mode` + `list`  | `--network-allowlist/blocklist` | `networkAllowlist/blocklist` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Executor                                │  │
│  │  - Validate security policy                         │  │
│  │  - Dispatch to runtime (busybox / sh / python)│  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            WasmRuntime (wasmtime)                   │  │
│  │  - Spawn wasmtime process                           │  │
│  │  - Map sandbox directory                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌──────────────┐  ┌──────────┐  ┌─────────────┐        │
│  │ busybox.wasm │  │ sh       │  │ python      │        │
│  │ (applets)    │  │ (shell)  │  │ (python)    │        │
│  └──────────────┘  └──────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

1. **Explicit Runtime Selection**: User specifies which runtime to use (`busybox`, `sh`, or `python`)
2. **Security Validation**: Command and network policies are enforced before execution
3. **Shared Filesystem**: Sandbox directory is mapped into the WASM process via `--dir`
4. **Process Isolation**: Each execution is a separate wasmtime process that exits after completion

## Shell Script Support (sh)

Shell scripts (`.sh` files) and inline shell code are executed via **sh** (wsh), a custom WASM shell implementation from busybox-wasi.

### Supported Features

- ✅ **Variables and expansion**: `X=hello; echo $X`
- ✅ **Command substitution**: `echo $(echo inner)`
- ✅ **Pipes**: `echo hello | tr a-z A-Z`
- ✅ **Control flow**: `if/else`, `for` loops, `case` statements
- ✅ **Logical operators**: `&&`, `||`
- ✅ **Comments**: `# this is a comment`
- ✅ **Newline separators**: commands can be on separate lines
- ✅ **Arithmetic expansion**: `echo $((10 + 20))`

### Known Limitations

These are **sh implementation limitations**, not sandbox bugs:

- ❌ **No function definitions** — `()` syntax not supported

### Script Format

```bash
# ✅ CORRECT: Well-formed sh script
echo "Hello"
echo "World"

# Comments are supported
X=10
Y=20
result=$((X + Y))
echo $result

if [ "$X" -gt 5 ]; then
    echo "X is large"
fi

# ❌ WRONG: Uses unsupported features
#!/bin/sh
myfunc() { echo "not supported"; }
```

**Tips:**

- Use `$((...))` for arithmetic
- Comments with `#` are fully supported
- Newlines can separate commands (no need for `;` everywhere)
- Avoid function definitions — inline commands instead

## Performance

| Metric                  | @agentskillmania/sandbox | Docker |
| ----------------------- | ------------------------ | ------ |
| Sandbox Instance Create | ~0.1ms                   | —      |
| First Command Execution | ~20ms                    | >1s    |
| Average Command Time    | ~12ms                    | ~100ms |
| Memory Growth (50 runs) | ~4MB                     | >1GB   |
| Disk Usage              | ~3MB                     | >100MB |

## Development

```bash
# Clone repository
git clone https://github.com/agentskillmania/sandbox.git
cd sandbox

# Install dependencies
npm install

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Contributing

Issues and Pull Requests are welcome!

## License

MIT
