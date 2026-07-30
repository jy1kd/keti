# PR-E1 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-28
**审查范围**：feature/electron-refactor vs main（4 commits, 12 files, +4383/-57）
**PR内容**：Electron 基础框架搭建

---

## 审查结论

**🟡 需修复后通过** — 3 个阻断性问题需修复，2 个改进建议建议处理。

---

## 🔴 阻断性问题（必须修复）

### F1: main.ts 模块级自动初始化导致测试污染

**文件**：`frontend/electron/main.ts:114-115`

```typescript
// Auto-initialize when imported
initializeApp().catch(console.error);
```

**问题**：模块顶层调用 `initializeApp()` 意味着每次 import 都会触发 Electron 应用初始化。在测试中，`vi.importActual('../main')` 会实际执行初始化逻辑，导致测试间污染且无法单独测试导出函数。

**建议修复**：
```typescript
// 仅在非测试环境自动初始化
if (process.env.NODE_ENV !== 'test') {
  initializeApp().catch(console.error);
}
```
或改为由入口脚本显式调用，不在模块层自动执行。

---

### F2: preload.ts 暴露的 IPC 通道与 main.ts 不匹配

**文件**：`frontend/electron/preload.ts:38-49` vs `frontend/electron/main.ts:82-111`

**问题**：preload 暴露了 6 个 IPC invoke，但 main.ts 只注册了 6 个 handler：

| preload invoke | main handler | 状态 |
|---|---|---|
| `window:minimize` | ✅ | OK |
| `window:maximize` | ✅ | OK |
| `window:close` | ✅ | OK |
| `window:open-order` | ❌ 缺失 | **运行时报错** |
| `window:open-kline` | ❌ 缺失 | **运行时报错** |
| `backend:restart` | ❌ 缺失 | **运行时报错** |
| `backend:status` | ❌ 缺失 | **运行时报错** |
| `app:version` | ✅ | OK |
| `app:platform` | ✅ | OK |
| `app:name` | ✅ | OK |

渲染进程调用 `window.electronAPI.openOrderWindow()` 时会抛出 "No handler registered for 'window:open-order'" 错误。

**建议修复**：在 main.ts 中添加缺失的 IPC handler，或从 preload.ts 中移除未实现的接口（后续 PR-E2/E3 再添加）。

---

### F3: preload.ts 事件监听器存在内存泄漏风险

**文件**：`frontend/electron/preload.ts:53-61`

```typescript
onOrderUpdate: (callback: (data: any) => void) => {
  ipcRenderer.on('order:update', (_, data) => callback(data));
},
```

**问题**：
1. 每次调用 `onOrderUpdate(callback)` 都会注册新的监听器，没有返回移除函数
2. `removeAllListeners(channel)` 移除通道上所有监听器，粒度过粗
3. 多次注册同一回调会导致重复触发

**建议修复**：
```typescript
onOrderUpdate: (callback: (data: any) => void) => {
  const handler = (_: any, data: any) => callback(data);
  ipcRenderer.on('order:update', handler);
  // 返回移除函数，供组件 useEffect cleanup 使用
  return () => ipcRenderer.removeListener('order:update', handler);
},
```
更新 `ElectronAPI` 接口添加返回类型 `() => void`。

---

## 🟡 改进建议（认同则改，不认同记录理由）

### I1: main.test.ts mock 过于宽泛

**文件**：`frontend/electron/__tests__/main.test.ts:6-65`

**问题**：mock 包含 `Tray`、`Menu`、`globalShortcut`、`nativeImage` 等 PR-E1 未使用的模块。这些是后续 PR 的功能，当前测试不需要。

**建议**：精简 mock 到实际使用的模块（`app`、`BrowserWindow`、`ipcMain`），后续 PR 再按需扩展。

---

### I2: electron-is-dev 依赖可移除

**文件**：`frontend/package.json:13`

**问题**：`electron-is-dev` 包的功能等价于 `!app.isPackaged`，已在 `main.ts:14` 使用后者。该依赖冗余。

**建议**：从 dependencies 中移除 `electron-is-dev`。

---

## 🔵 疑问

### Q1: 开发模式 preload 路径

**文件**：`frontend/electron/main.ts:27`

```typescript
preload: path.join(__dirname, 'preload.js'),
```

开发模式下 `tsc -p electron/tsconfig.json` 输出到 `dist-electron/`，`__dirname` 指向 `dist-electron/`，preload.js 也在同目录，路径正确。但需确认：electron-builder 打包后 `__dirname` 是否仍指向 `dist-electron/`？

---

### Q2: vite.config.ts 中 manualChunks: undefined

**文件**：`frontend/vite.config.ts:31-33`

```typescript
rollupOptions: {
  output: {
    manualChunks: undefined,
  },
},
```

设置 `undefined` 是否有意？如无特殊目的建议移除，避免混淆。

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 3 | 自动初始化污染测试、IPC通道不匹配、内存泄漏风险 |
| 🟡 建议 | 2 | mock 精简、冗余依赖 |
| 🔵 疑问 | 2 | preload 路径确认、manualChunks 配置 |
