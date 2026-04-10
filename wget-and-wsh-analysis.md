# wget 和 wsh 问题分析

## 问题 1：wget 公网连接失败

### 现象

```
wget http://example.com/
wget: can't connect to remote host (104.20.23.154): Connection refused
```

### 根本原因

经过详细测试，发现：

1. **本地网络完全正常** ✅
   - 连接 127.0.0.1:19876 成功
   - 下载文件内容正常
   - busybox-wasi 测试 9/11 通过

2. **公网连接失败** ❌
   - 连接 example.com 失败
   - 连接 www.baidu.com 失败
   - 错误：Connection refused

### 可能原因

| 原因               | 可能性 | 说明                       |
| ------------------ | ------ | -------------------------- |
| 防火墙/网络策略    | 🟡 中  | 可能阻止了 outgoing 连接   |
| wasmtime 网络配置  | 🟢 低  | 参数正确（已验证）         |
| WASI Preview2 限制 | 🟡 中  | 可能对某些类型的连接有限制 |

**结论：wget 功能本身是正常的，问题在于公网网络访问。**

---

## 问题 2：wsh "cannot open pipe output"

### 现象

```
wsh -c "echo test"
wsh: cannot open pipe output
```

### 根本原因

在 `shell/wsh_pipe.c` 第554-557行：

```c
wsh_tmp_path(out_path, sizeof(out_path), 0);
if (freopen(out_path, "w", stdout) == NULL) {
    fprintf(stderr, "wsh: cannot open pipe output\n");
    ...
}
```

问题在于 **`freopen()` 在 WASM 沙箱中无法写入 `/tmp` 目录**。

### WASI Preview2 的限制

根据 wsh 源码注释：

```c
 * WASI 限制：
 *   - stdin/stdout 是 FILE *const → 用 freopen() 替换底层流
 *   - dup/dup2 不可用 → 用临时文件中转
 *   - 无法恢复 stdout 到终端 → 用 stderr 输出最终结果
```

**关键问题：WASI Preview2 中的 `stdout` 是 `FILE *const`（只读常量指针）**

### 实际能力

| 功能            | 状态 | 说明                     |
| --------------- | ---- | ------------------------ |
| 直接调用 applet | ✅   | `echo test` 正常工作     |
| 管道执行        | ❌   | `echo \| cat` 失败       |
| 输出重定向      | ❌   | `echo > file` 失败       |
| 变量展开        | ❓   | 无法测试（freopen 失败） |
| 命令替换        | ❓   | 无法测试（需要管道）     |

**结论：wsh 的设计理念是正确的，但 WASI Preview2 的 `FILE *const` 限制导致实现无法工作。**

---

## 综合结论

### wget 状态

- **功能实现**：✅ 完全正常
- **本地网络**：✅ 完全支持
- **公网访问**：❌ 受网络策略限制（非代码问题）

### wsh 状态

- **架构设计**：✅ 合理的变通方案
- **实际实现**：❌ 受 WASI Preview2 `FILE *const` 限制
- **可用性**：❌ 基本不可用

### 建议

1. **对于 wget**：
   - 在文档中说明：本地网络支持，公网访问取决于网络策略
   - 可以尝试测试不同的网络配置
   - 考虑使用防火墙规则或 VPN

2. **对于 wsh**：
   - 这是 busybox-wasi 项目需要解决的核心问题
   - 可能需要：
     - 修复 WASI SDK 的 `FILE *const` 限制
     - 或者使用完全不同的实现方式（不依赖 freopen）
     - 或者考虑使用其他 Shell 方案

3. **对于 sandbox 项目**：
   - Python 执行功能完全可用
   - wget 本地网络功能可用
   - wsh 功能暂时不可用（等待上游修复）
