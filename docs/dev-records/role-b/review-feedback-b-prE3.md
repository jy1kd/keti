# PR-E3 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-28
**审查范围**：PR-E3 commit `9db9aaf` vs PR-E2 final `ede584b`（1 commit, 5 files, +454/-68）
**PR内容**：窗口管理器实现

---

## 审查结论

**✅ 审查通过** — 无阻断性问题，2 个改进建议，2 个疑问。

---

## 改动概览

| 文件 | 类型 | 说明 |
|------|------|------|
| `electron/windowManager.ts` | 新增 | WindowManager 类（328 行）：多窗口创建/管理/通信/状态持久化 |
| `electron/__tests__/windowManager.test.ts` | 新增 | WindowManager 测试（98 行，9 个用例） |
| `electron/ipc/window.ts` | 更新 | `registerWindowManagementHandlers` 改为接收 WindowManager 实例，移除占位代码 |
| `electron/main.ts` | 重构 | 移除 `createMainWindow`/`APP_CONFIG`，委托给 WindowManager，导出 `getWindowManager` |
| `electron/__tests__/main.test.ts` | 更新 | 测试对齐新导出（`getWindowManager`/`isDev`） |

---

## ✅ 正面评价

1. **WindowManager 设计优秀**：统一管理 main/order/kline/query 四类窗口，每类有独立配置（DEFAULT_CONFIGS），窗口 ID 按类型+合约动态生成（如 `order-IF2608`、`kline-IF2608`）
2. **窗口去重逻辑健壮**：`openOrderWindow`/`openKLineWindow` 先检查 `isDestroyed()`，已存在则 `focus()` 返回，避免重复创建
3. **父子窗口关系**：报单窗口设置 `parent: mainWindow`，保持层级关系
4. **屏幕适配**：`createMainWindow` 使用 `screen.getPrimaryDisplay().workAreaSize` 限制窗口不超过屏幕
5. **生命周期管理完善**：每个窗口 `on('closed')` 清理 Map 引用，`closeAllWindows` 遍历并关闭
6. **窗口通信基础设施**：`sendToWindow`（单窗口）和 `broadcast`（全窗口）为后续跨窗口通信做好准备
7. **main.ts 大幅精简**：从 88 行减到 57 行，只保留生命周期和 IPC 注册
8. **ipc/window.ts 干净移除占位代码**：`registerWindowManagementHandlers` 改为接收 WindowManager 参数，直接调用

---

## 🟡 改进建议（认同则改，不认同记录理由）

### I1: windowManager.ts 导入了未使用的 IPC_CHANNELS

**文件**：`frontend/electron/windowManager.ts:10`

```typescript
import { IPC_CHANNELS } from './ipc/index';
```

**问题**：`IPC_CHANNELS` 在 windowManager.ts 中从未使用。通道常量仅在 `ipc/window.ts` 的 handler 注册中使用。

**建议**：移除该 import，保持依赖关系清晰。

---

### I2: windowManager 测试偏重接口存在性检查

**文件**：`frontend/electron/__tests__/windowManager.test.ts`

**问题**：9 个测试中 7 个仅检查方法是否存在（`toBeDefined` + `typeof function`），只有 2 个测试验证行为（`getAllWindows` 返回空数组、`getWindow` 返回 null）。缺少对核心功能的行为测试：
- `createMainWindow` 创建窗口后 `getAllWindows` 返回长度为 1
- `openOrderWindow` 重复调用返回同一窗口（去重）
- `openOrderWindow` 设置了正确的 parent
- `closeAllWindows` 清空所有窗口

**建议**：补充行为测试，利用已有的 BrowserWindow mock 验证实际逻辑。

---

## 🔵 疑问

### Q1: windowStates 仅内存存储，是否满足「窗口状态持久化」验收标准？

**文件**：`frontend/electron/windowManager.ts:72`

```typescript
private windowStates: Map<string, WindowState> = new Map();
```

`saveWindowState`/`restoreWindowState` 仅在内存 Map 中保存，应用重启后状态丢失。task.md 验收标准要求「窗口状态能持久化」。是否计划在后续 PR 中接入 localStorage/file 持久化？当前实现可作为接口预留。

---

### Q2: registerWindowControlHandlers 仍绑定初始 mainWindow

**文件**：`frontend/electron/ipc/window.ts:16` + `frontend/electron/main.ts:47`

```typescript
// main.ts
registerWindowControlHandlers(mainWindow);  // 绑定初始窗口

// ipc/window.ts
export function registerWindowControlHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();  // 始终操作这个窗口
  });
```

如果主窗口关闭后通过 macOS `activate` 重新创建（`windowManager.createMainWindow()`），minimize/maximize/close 仍指向已销毁的旧窗口。是否需要改为从 WindowManager 获取当前主窗口？

---

## 验收标准核对

| 标准 | 状态 | 说明 |
|------|------|------|
| 能创建多个独立窗口 | ✅ | `createMainWindow`/`openOrderWindow`/`openKLineWindow` 各创建独立 BrowserWindow |
| 窗口间能正常通信 | ✅ | `sendToWindow`/`broadcast` 已实现，通过 webContents.send 通信 |
| 窗口状态能持久化 | ⚠️ | 接口已实现（`saveWindowState`/`restoreWindowState`），但仅内存存储，重启丢失 |
| 窗口关闭不影响其他窗口 | ✅ | 每个窗口独立 `on('closed')` 清理，`getAllWindows` 过滤 destroyed |

---

## 测试状态

- `windowManager.test.ts`：9 个用例通过 ✅
- `main.test.ts`：3 个用例通过（更新为新导出） ✅

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 0 | — |
| 🟡 建议 | 2 | 未使用的 import、测试偏重接口检查 |
| 🔵 疑问 | 2 | 状态持久化范围、control handler 绑定 |
