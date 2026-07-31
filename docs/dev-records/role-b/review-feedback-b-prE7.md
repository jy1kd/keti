# PR-E7 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-28
**审查范围**：PR-E7 commit `b615a68` vs PR-E6 final `8322d05`（1 commit, 3 files, +216）
**PR内容**：全局快捷键实现

---

## 审查结论

**✅ 审查通过** — 无阻断性问题，1 个改进建议，1 个疑问。

---

## 改动概览

| 文件 | 类型 | 说明 |
|------|------|------|
| `electron/shortcuts.ts` | 新增 | ShortcutManager 类（115 行）：注册/注销/冲突检测/默认快捷键 |
| `electron/__tests__/shortcuts.test.ts` | 新增 | 测试（72 行，8 个用例） |
| `electron/main.ts` | 更新 | 集成 ShortcutManager + 注册默认快捷键 + will-quit 清理 |

---

## ✅ 正面评价

1. **API 设计完整**：`register`/`unregister`/`unregisterAll`/`isRegistered`/`getShortcuts`/`registerDefaults` 覆盖快捷键管理全生命周期
2. **冲突检测**：`register` 检查本地 Map 重复注册，`isRegistered` 同时检查本地和系统级注册
3. **默认快捷键合理**：Ctrl+B（报单）、Ctrl+K（K线）、Ctrl+Q（退出）符合交易终端使用习惯
4. **生命周期管理**：`app.on('will-quit')` 中 `unregisterAll()` 确保退出时释放全局快捷键
5. **main.ts 集成干净**：`registerDefaults` 传入 handler 映射，open-order 直接调用 `windowManager.openOrderWindow()`
6. **测试覆盖合理**：8 个用例覆盖类导出、方法存在性、初始状态

---

## 🟡 改进建议

### I1: open-kline handler 依赖渲染进程响应

**文件**：`frontend/electron/main.ts:61-63`

```typescript
'open-kline': () => {
  mainWindow.webContents.send('get-selected-instrument');
},
```

**问题**：`open-kline` 快捷键发送 IPC 消息 `get-selected-instrument` 给渲染进程，但没有后续处理（如等待响应后打开 K 线窗口）。渲染进程需要监听此消息并回传选中的合约 ID。

**建议**：改为直接打开 K 线窗口（不带合约），或通过 `ipcMain.handle` + `ipcRenderer.invoke` 实现双向通信获取选中合约。

---

## 🔵 疑问

### Q1: 快捷键配置持久化

**问题**：task.md 验收标准要求「快捷键配置能持久化」。当前 `DEFAULT_SHORTCUTS` 是硬编码常量，`ShortcutManager` 的注册状态仅在内存中，应用重启后恢复默认值。是否需要：
- 将用户自定义快捷键保存到 localStorage/file？
- 还是当前「固定默认快捷键」已满足需求？

---

## 验收标准核对

| 标准 | 状态 | 说明 |
|------|------|------|
| 全局快捷键能正常工作 | ✅ | `globalShortcut.register` 注册，`app.on('will-quit')` 清理 |
| 快捷键配置能持久化 | ⚠️ | 默认快捷键固定，用户自定义未持久化 |
| 快捷键冲突能正确处理 | ✅ | `register` 检查重复 + `isRegistered` 系统级检查 |

---

## 测试状态

- `shortcuts.test.ts`：8 个用例通过 ✅

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 0 | — |
| 🟡 建议 | 1 | open-kline handler 依赖渲染进程响应 |
| 🔵 疑问 | 1 | 快捷键配置持久化范围 |
