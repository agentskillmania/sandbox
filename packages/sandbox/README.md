# @agentskillmania/sandbox

WASM sandbox for secure command execution in isolated environments.

## Features

- 🚀 **Lightweight**: Single wasmtime process ~3MB vs Docker's ~1GB
- ⚡ **Fast Execution**: ~12ms average command time vs Docker's ~100ms
- 🔒 **Secure Isolation**: WASM sandbox with filesystem isolation via wasmtime `--dir` mappings
- 🛠️ **Easy to Use**: CLI tool and Node.js SDK with a single `run(command)` interface

## Installation

```bash
npm install -g @agentskillmania/sandbox
```

### Automatic Runtime Installation

When installing the npm package, wasmtime 43.0.0 is automatically installed to `~/.agentskillmania/sandbox/wasmtime/`.

**Supported Platforms**:

- macOS (x64, arm64) ✅
- Linux (x64, arm64) ✅
- Windows (x64, arm64) ✅

**Manual Installation** (if automatic installation fails):

```bash
exec-in-sandbox install-runtime
```

**Proxy Support**:

The installation script uses `curl` for downloads and reads these environment variables:

- `HTTP_PROXY` / `http_proxy`
- `HTTPS_PROXY` / `https_proxy`
- `NO_PROXY` / `no_proxy`

## Usage

### CLI Syntax

```bash
exec-in-sandbox [OPTIONS] -- <command>
```

The `--` separator is required. Everything before `--` are CLI options; everything after `--` is the command string to execute in the sandbox.

### CLI Examples

```bash
# Execute shell commands
exec-in-sandbox -- "ls -la"
exec-in-sandbox -- "cat file.txt"
exec-in-sandbox -- "echo hello | grep h"

# Execute Python code
exec-in-sandbox -- "python -c \"print('hello from python')\""
exec-in-sandbox -- "python -c \"import os; print(os.listdir('.'))\""

# Execute Git commands
exec-in-sandbox -- "git status"

# Use shared filesystem
exec-in-sandbox -- "echo 'print(42)' > script.py"
exec-in-sandbox -- "python script.py"

# Command-line options (before --)
exec-in-sandbox --timeout=10000 --allow-network -- "curl https://example.com"
exec-in-sandbox --sandbox-dir=./my-sandbox -- "ls -la"
```

### Global Options

| CLI Option            | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `--timeout <ms>`      | Execution timeout in milliseconds (default: `5000`)   |
| `--sandbox-dir <dir>` | Sandbox directory (default: `auto` = system temp dir) |
| `--allow-network`     | Allow network access (default: disabled)              |

### Node.js SDK

```javascript
import { Sandbox } from '@agentskillmania/sandbox';

// Create sandbox instance
const sandbox = new Sandbox({
  sandboxDir: '.sandbox', // Shared filesystem directory
  timeout: 5000, // Timeout (milliseconds)
  allowNetwork: false, // Network access (default: false)
});

// Execute any command
const result1 = await sandbox.run('ls -la');
console.log(result1.stdout);

// Execute Python code
const result2 = await sandbox.run("python -c 'print(42)'");
console.log(result2.stdout);

// Execute Git commands
const result3 = await sandbox.run('git status');
console.log(result3.stdout);

// Pass data via filesystem
await sandbox.run('echo "data" > input.txt');
const result4 = await sandbox.run('cat input.txt');
console.log(result4.stdout);
```

**Result format**:

```typescript
interface ExecResult {
  stdout: string; // Standard output
  stderr: string; // Standard error (usually empty, merged into stdout)
  exitCode: number; // Process exit code
}
```

### Script Files

If the command argument ends with `.sh` or `.py`, the file content is read and executed:

```javascript
// Execute a shell script file
const result = await sandbox.run('./script.sh');

// Execute a Python script file
const result = await sandbox.run('./script.py');
```

## Filesystem Isolation

The sandbox uses wasmtime's `--dir` mappings to provide a controlled filesystem view:

```
/workspace  →  host sandbox directory (read-write)
/tmp        →  host temp directory (read-write, per-execution isolated)
```

- **`/workspace`**: The sandbox working directory. All file operations (unless using absolute paths) happen here.
- **`/tmp`**: A unique temporary directory created for each execution and cleaned up afterward. Used internally for pipe operations.
- **Everything else**: Unmounted and inaccessible. `../`, `/etc/passwd`, `/home`, etc. all return `No such file or directory` or `Operation not permitted`.

**Security boundary**: The real isolation is enforced by wasmtime's directory mapping, not by command filtering.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @agentskillmania/sandbox (Node.js)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Executor / Sandbox                      │  │
│  │  - Validate command (placeholder, currently no-op)  │  │
│  │  - Prefix: cd /workspace && <command>               │  │
│  │  - Spawn wasmtime with isolated /tmp                │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            WasmRuntime (wasmtime)                   │  │
│  │  - Spawn wasmtime process                           │  │
│  │  - Map sandbox dir → /workspace                     │  │
│  │  - Map isolated tmp → /tmp                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ↓                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              busybox.wasm (combined component)      │  │
│  │  - wsh: shell interpreter                           │  │
│  │  - git: version control                             │  │
│  │  - python: Python interpreter                       │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

1. **Unified Command Interface**: User passes a command string (`ls -la`, `python -c "print(42)"`, `git status`)
2. **Directory Prefix**: Commands are automatically prefixed with `cd /workspace &&` so file operations happen in the sandbox directory
3. **Isolated Execution**: Each execution spawns a new wasmtime process with an isolated `/tmp` directory
4. **Cleanup**: The temporary `/tmp` directory is deleted after execution

## Shell Features

Shell scripts (`.sh` files) and inline shell code are executed via **wsh**, a WASM shell implementation embedded in busybox.wasm.

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

- ❌ **No function definitions** — `()` syntax not supported

## Python Features

The bundled Python interpreter (MicroPython) supports:

| Module        | Supported Features                                                      |
| ------------- | ----------------------------------------------------------------------- |
| `socket`      | TCP client/server, `connect`, `bind`, `listen`, `accept`, `send`/`recv` |
| `asyncio`     | async/await, event loops, locks, streams                                |
| `json`        | `dumps`, `loads`                                                        |
| `re`          | `match`, `search`, `sub`                                                |
| `hashlib`     | `sha256`, `md5`                                                         |
| `math`        | `pi`, `e`, `factorial`, `gamma`, `erf`                                  |
| `random`      | `random()`, `randint()`, `choice()`                                     |
| `time`        | `time()`, `time_ns()`, `gmtime()`, `localtime()`, `mktime()`            |
| `sys`         | `exc_info()`, `atexit()`                                                |
| `os`          | `listdir`, `mkdir`, `remove`, `stat`                                    |
| `heapq`       | `heappush`, `heappop`, `heapify`                                        |
| `collections` | `deque`, `OrderedDict`                                                  |

**Network capabilities** (requires `--allow-network`):

- ✅ TCP sockets (client and server)
- ✅ DNS resolution
- ❌ UDP sockets — unstable in wasmtime (may crash)
- ❌ HTTPS/SSL — no TLS support

## Performance

| Metric                  | @agentskillmania/sandbox | Docker |
| ----------------------- | ------------------------ | ------ |
| Sandbox Instance Create | ~0.1ms                   | —      |
| First Command Execution | ~20ms                    | >1s    |
| Average Command Time    | ~12ms                    | ~100ms |
| Memory Growth (50 runs) | ~4MB                     | >1GB   |
| Disk Usage              | ~3MB                     | >100MB |

## Security

### Filesystem Isolation

The primary security mechanism is wasmtime's directory isolation:

- Only `/workspace` (sandbox directory) and `/tmp` (isolated temp) are visible
- `../` path traversal is blocked by wasmtime (`Operation not permitted`)
- Host system files (`/etc`, `/home`, etc.) are completely inaccessible

### Command Security (Placeholder)

A `SecurityPolicy` class exists as a hook for future enhancements but currently **allows all commands**. The real isolation comes from the filesystem boundary, not command filtering.

### Network Security

- Network is **disabled by default**
- Enable with `--allow-network` or `allowNetwork: true`
- When enabled, all network capabilities (TCP, DNS) are available
- **Domain-level filtering is not implemented** — network is either fully on or fully off

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run all tests
pnpm run test

# Run unit tests only
pnpm run test:unit

# Run integration tests only
pnpm run test:integration
```

## Contributing

Issues and Pull Requests are welcome!

## License

MIT
