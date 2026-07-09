# PR-2 Code Review 反馈

**审查分支**：feature/pr-2-frontend-init
**审查 commit**：978c62e, ec6e566, f729f80, f9587e2
**审查时间**：2026-07-09

---

## 🔴 阻断性问题（必须修改）

无

---

## 🟡 改进建议

1. **【package.json:21】`@visactor/vtable: "latest"` 使用 latest 标签**
   - 原因：latest 标签会拉取最新版本，可能导致不同时间安装的版本不一致，存在兼容性风险
   - 建议：指定具体版本号，如 `"^1.0.0"` 或当前稳定版本

2. **【ws.ts:30-35】onopen 回调为空，未更新连接状态**
   - 原因：连接建立后没有通知外部（如 connection store），UI 无法感知连接状态变化
   - 建议：在 onopen 中触发回调或事件，或在 PR-4 布局框架中与 connection store 联动

3. **【ws.ts:42-44】onerror 只 console.error，无错误上报机制**
   - 原因：WebSocket 错误只打印日志，前端无法感知连接异常
   - 建议：可通过回调或事件通知上层，或在 PR-7 中实现断线重连时一并处理

4. **【api.ts:22】错误拦截器只 console.error，无用户提示**
   - 原因：API 错误只打印日志，用户看不到错误信息
   - 建议：可预留全局错误提示接口（如 toast），在后续 PR 中完善

5. **【types.ts:85-97】OrderRecord 与 OrderStatus 结构完全相同**
   - 原因：两个接口字段完全一致，可能存在冗余
   - 建议：确认是否需要两个独立接口，或合并为一个

---

## 🔵 疑问确认

1. **【format.ts:8】formatPrice 对 price=0 返回 '--'**
   - 疑问：价格为 0 是否一定是无效值？某些场景下 0 可能是合法价格（如涨跌为 0）
   - 建议：确认业务场景，是否需要区分"无数据"和"价格为 0"

2. **【ws.ts:10】WSManager 使用 Map 存储连接**
   - 疑问：如果页面刷新或组件卸载，是否有清理机制？
   - 建议：确认是否需要在 App.tsx 的 useEffect 中调用 disconnectAll()

---

## 审查结论

✅ **通过**

**理由**：
1. 功能实现完整，覆盖 task.md 中 PR-2 的所有验收标准
2. 57 个单元测试全部通过，测试覆盖正常/异常/边界场景
3. 代码结构清晰，命名规范，遵循 TypeScript 严格模式
4. 类型定义与 design.md 一致
5. 文档同步更新（progress.md、dev-record-b.md）
6. 无阻断性问题

**改进建议**：
- 上述 🟡 改进建议可在后续 PR 中逐步完善
- 特别是 vtable 版本锁定建议尽快处理

---

**下一步**：
- 可合并到 main 分支
- 可进入 PR-4（前端布局框架）开发
