# @agentskillmania/sandbox

WASM sandbox tool supporting busybox and micropython.

## Features

- 🚀 **Lightweight**: Single wasmtime process ~10MB vs Docker's ~1GB
- ⚡ **Fast Cold Start**: <200ms startup time vs Docker's >1s
- 🔒 **Secure Isolation**: WASM sandbox with controlled filesystem access
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

### CLI Tool

```bash
# Execute Shell commands (via busybox.wasm)
exec-in-sandbox busybox ls -la
exec-in-sandbox busybox -c "echo hello | grep h"

# List all available busybox commands (built-in)
exec-in-sandbox busybox --list
exec-in-sandbox busybox --list-full

# Show busybox help (built-in)
exec-in-sandbox busybox

# Execute Python code (via micropython.wasm)
exec-in-sandbox python -c "print('hello from python')"
exec-in-sandbox python -c "import os; print(os.listdir('.'))"

# Execute script files
exec-in-sandbox busybox script.sh
exec-in-sandbox python script.py

# Use shared filesystem
exec-in-sandbox busybox -c "echo 'print(42)' > .sandbox/script.py"
exec-in-sandbox python .sandbox/script.py

# Command-line options
exec-in-sandbox --timeout 10000 --allow-network busybox curl https://example.com
exec-in-sandbox --command-allowlist "ls,cat,echo" busybox ls -la
exec-in-sandbox --network-allowlist "*.github.com,registry.npmjs.org" python -c "import urllib; ..."
```

**Global Options:**

| CLI Option | Config File Path | Description |
|------------|-----------------|-------------|
| `--config <path>` | — | Configuration file path |
| `--sandbox-dir <dir>` | `sandboxDir` | Sandbox directory (default: `auto` = system temp dir like `/tmp/sandbox-xxx`) |
| `--timeout <ms>` | `security.timeout` | Execution timeout in milliseconds (default: `5000`) |
| `--allow-network` | `network.enabled` | Allow network access |
| `--command-allowlist <cmds>` | `modules.busybox.commands.list` | Command allowlist (comma-separated, sets mode to `whitelist`) |
| `--command-blocklist <cmds>` | `modules.busybox.commands.list` | Command blocklist (comma-separated, sets mode to `blacklist`) |
| `--network-allowlist <domains>` | `network.allowlist` | Network allowlist (comma-separated) |
| `--network-blocklist <domains>` | `network.blocklist` | Network blocklist (comma-separated) |

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
```

```

### Configuration

The global configuration file at `~/.agentskillmania/sandbox/config.yaml` contains **security policies only**. It provides default values for command and network security:

```yaml
# Command security policy
commands:
  mode: blacklist        # blacklist = block these, whitelist = only allow these
  list:                  # Commands to apply the mode
    - rm
    - format
    - fdisk
    - mkfs

# Network security policy
network:
  mode: blacklist        # blacklist = block these domains, whitelist = only allow these
  list:                  # Domains to apply the mode
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
**Configuration Priority:**

1. Command-line arguments (highest priority)
2. SDK constructor parameters
3. Global security policy (default values)

**Security Policy Mapping:**

| Security Feature | Global Config | CLI Override | SDK Constructor |
|-----------------|--------------|--------------|-----------------|
| Command filtering | `commands.mode` + `list` | `--command-allowlist/blocklist` | `commandAllowlist/blocklist` |
| Network mode | `network.mode` | `--allow-network` | `allowNetwork` |
| Domain filtering | `network.mode` + `list` | `--network-allowlist/blocklist` | `networkAllowlist/blocklist` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Command Router                          │  │
│  │  - Identify command type (Shell vs Python)          │  │
│  │  - Route to corresponding WASM module              │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            Shared Sandbox Directory                 │  │
│  │  .sandbox/                                          │  │
│  │    ├── tmp/          (temporary files)              │  │
│  │    ├── data/         (data files)                   │  │
│  │    └── scripts/      (script files)                 │  │
│  └─────────────────────────────────────────────────────┘  │
│         ↓                           ↓                    │
│  ┌──────────────┐          ┌─────────────┐             │
│  │ busybox.wasm │          │ micropython │             │
│  │              │          │   .wasm     │             │
│  │ Shell cmd    │          │ Python code │             │
│  └──────────────┘          └─────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

1. **Command Routing**: Automatically selects WASM module based on command type
   - Shell commands → `busybox.wasm`
   - Python code/scripts → `micropython.wasm`

2. **Shared Filesystem**:
   - Creates `.sandbox/` directory
   - Maps to WASM sandbox via `--dir=.sandbox` parameter
   - Both modules can read/write this directory

3. **Process Isolation**:
   - Each execution is a separate wasmtime process
   - Process exits after execution, resources automatically released

## Shell Script Support (wsh)

Shell scripts (`.sh` files) are executed via **wsh**, a custom WASM shell implementation from busybox-wasi.

### Supported Features

✅ **Variables and expansion**: `X=hello; echo $X`
✅ **Command substitution**: `echo $(echo inner)`
✅ **Pipes**: `echo hello | tr a-z A-Z`
✅ **Control flow**: `if/else`, `for` loops, `case` statements
✅ **Logical operators**: `&&`, `||`
✅ **Arithmetic**: `expr 10 + 20` (use `expr`, not `$((...))`)

### Known Limitations

These are **wsh implementation limitations**, not sandbox bugs:

❌ **No `#` comments** — wsh doesn't support shell-style comments
❌ **No function definitions** — `()` syntax not supported
❌ **No `$((...))` arithmetic** — use `expr $X + $Y` instead
❌ **Multiline scripts** — commands must be separated by `;`, not newlines

### Script Format

Due to wsh limitations, shell scripts should:

```bash
# ✅ CORRECT: No shebang, semicolons, no comments
echo "Hello"; echo "World"
X=10; Y=20; result=$(expr $X + $Y); echo $result
if [ "$X" -gt 5 ]; then echo "X is large"; fi

# ❌ WRONG: Uses unsupported features
#!/bin/sh
# This is a comment - will fail!
X=$((10 + 20))  # Arithmetic expansion - will fail!
```

**Tips:**
- Keep scripts single-line or semicolon-separated
- Use `expr` for arithmetic: `result=$(expr 10 + 20)`
- Avoid function definitions — inline commands instead
- No `#` comments needed

## Performance

| Metric       | @agentskillmania/sandbox | Docker |
| ------------ | ------------------------ | ------ |
| Cold Start   | ~200ms                   | >1s    |
| Memory Usage | ~50MB                    | >1GB   |
| Disk Usage   | ~10MB                    | >100MB |

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
