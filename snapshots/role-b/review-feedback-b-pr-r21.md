# PR-R21 审查反馈：Electron 独立窗口支持

**审查人**: 角色A（审查窗口）
**审查时间**: 2026-08-04
**审查轮次**: R1

---

## 改动范围

8 个文件，+228/-20 行：
- `frontend/electron/windowManager.ts` — 添加 `openTabWindow`、`isTabInWindow`、`closeTabWindow`
- `frontend/src/components/TabBar/index.tsx` — 右键菜单「在新窗口打开」
- `frontend/src/components/TabBar/styles.css` — 右键菜单样式
- `frontend/electron/ipc/window.ts` — 注册 IPC handler
- `frontend/electron/preload.ts` — 暴露 `openTabWindow` API
- `frontend/src/services/electron.ts` — 添加 wrapper 函数
- `docs/tasks/task-redesign.md` — 状态更新

## 测试结果

74 test files, 751 tests passed ✅

---

## 发现问题

### 🟡 改进建议

**S1: 标签分离后主窗口未隐藏/标记该标签**

- 位置: `TabBar/index.tsx:108-119`
- 问题: 右键「在新窗口打开」后，新窗口已打开，但主窗口的标签栏仍显示该标签。用户可能同时在主窗口和新窗口操作同一标签页。`tab-window-closed` IPC 消息已发送但主窗口未监听处理。
- 建议: 后续 PR 中：
  1. 主窗口监听 `tab-window-closed` 事件
  2. 标签分离后在主窗口标记为「已在新窗口打开」或暂时隐藏

**S2: `handleKeyDown` 类型断言 `as any`**

- 位置: `TabBar/index.tsx:53-54`
- 问题: `window.addEventListener('keydown', handleKeyDown as any)` 使用 `as any` 绕过类型检查。`handleKeyDown` 的参数类型是 `KeyboardEvent`（React），但 `window.addEventListener` 期望原生 `KeyboardEvent`。
- 建议: 使用原生事件类型：`const handleKeyDown = (e: globalThis.KeyboardEvent) => { ... }`（不阻断）

---

## 审查结论

✅ **通过** — 无阻断性问题，S1/S2 为可选改进
