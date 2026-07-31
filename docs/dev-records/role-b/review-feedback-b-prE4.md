# PR-E4 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-28
**审查范围**：PR-E4 commit `6f999e1` vs PR-E3 final `90a0a72`（1 commit, 2 files, +119）
**PR内容**：报单窗口实现

---

## 审查结论

**🟡 需补充后通过** — 1 个阻断性问题需解决，1 个改进建议，2 个疑问。

---

## 改动概览

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/pages/OrderPage.tsx` | 新增 | 独立报单页面（69 行）：复用 OrderForm + 显示合约信息 + Electron 标识 |
| `src/pages/__tests__/OrderPage.test.tsx` | 新增 | 测试（50 行，4 个用例） |

---

## ✅ 正面评价

1. **复用现有组件**：直接使用 `OrderForm` 组件，避免重复实现报单逻辑
2. **数据驱动 priceTick**：从 `contracts` store 读取合约信息获取 priceTick，fallback 到 0.2
3. **实时行情展示**：从 `marketStore.snapshots` 读取最新价展示在 header
4. **Electron 环境感知**：footer 显示「独立窗口模式」标识
5. **测试覆盖合理**：4 个用例覆盖渲染、合约 ID 显示、方向按钮、提交按钮

---

## 🔴 阻断性问题（必须修复）

### F1: 未使用的导入（代码卫生）

**文件**：`frontend/src/pages/OrderPage.tsx:20,22`

```typescript
const orderForm = useOrderStore((s) => s.orderForm);      // 第20行 — 未使用
const resetOrderForm = useOrderStore((s) => s.resetOrderForm); // 第22行 — 未使用
```

**问题**：`orderForm` 和 `resetOrderForm` 被导入但从未在组件中使用。这会导致：
- 每次 orderForm 状态变化触发不必要的重渲染
- ESLint `no-unused-vars` 警告（如启用）
- 代码意图不清晰

**建议修复**：移除未使用的导入：
```typescript
// 移除这两行
// const orderForm = useOrderStore((s) => s.orderForm);
// const resetOrderForm = useOrderStore((s) => s.resetOrderForm);
```

---

## 🟡 改进建议

### I1: 缺少窗口路由集成

**问题**：WindowManager 的 `openOrderWindow` 通过 hash 路由加载页面（`#/order/IF2608`），但当前没有路由配置将 hash 解析为 `instrumentID` prop 传给 OrderPage。需要在后续添加：
- React Router hash 路由配置（如 `<Route path="/order/:id" element={<OrderPage />} />`）
- 或 App.tsx 中根据 hash 手动解析

当前 PR 范围可接受，但应在 PR 描述中明确标注此依赖。

---

## 🔵 疑问

### Q1: 跨窗口数据同步机制

**问题**：验收标准要求「报单结果能同步回主窗口」和「报单窗口能实时显示行情数据」。当前实现依赖 Zustand store 共享：

- **行情数据**：`useMarketStore` 的 snapshots 在所有渲染进程窗口间共享（Electron 同一 renderer bundle），WebSocket 推送更新所有窗口 ✅
- **报单结果**：`useOrderStore` 的 submitOrder 通过 WebSocket `/ws/order` 接收回报，所有窗口同步更新 ✅

这种「store 共享」模式在 Electron 同源窗口下可行。但需确认：如果未来使用 `webContents.send` 做窗口间通信，是否需要额外的同步层？

---

### Q2: OrderPage 未集成到 App 路由

**问题**：当前 App.tsx 中没有 `/order/:instrumentID` 的路由配置，OrderPage 无法通过 URL 访问。这是否留待后续 PR（如 PR-E6 路由集成）处理？

---

## 验收标准核对

| 标准 | 状态 | 说明 |
|------|------|------|
| 点击"报单"按钮能打开独立报单窗口 | ⚠️ 部分 | WindowManager.openOrderWindow 已实现，但 hash 路由→OrderPage 的桥接未完成 |
| 报单窗口能实时显示行情数据 | ✅ | 通过 `useMarketStore.snapshots` 共享，WebSocket 推送自动更新 |
| 报单窗口能正常提交报单 | ✅ | 复用 OrderForm，通过 `useOrderStore.submitOrder` 提交 |
| 报单结果能同步回主窗口 | ✅ | Zustand store 同源共享，回报自动同步 |

---

## 测试状态

- `OrderPage.test.tsx`：4 个用例通过 ✅

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 1 | 未使用的 store 导入导致不必要重渲染 |
| 🟡 建议 | 1 | 缺少 hash 路由集成 |
| 🔵 疑问 | 2 | 跨窗口同步机制确认、路由集成时机 |
