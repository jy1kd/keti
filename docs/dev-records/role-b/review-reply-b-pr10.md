# PR-10 审查反馈处理记录

## 第 1 轮审查反馈回复

---

### 🔴 阻断性问题 — 全部已修复

| # | 问题 | 修复方式 | Commit |
|---|------|---------|--------|
| 1 | useHotKeys 未集成 | OrderPanel 中调用 useHotKeys，onBuy/onSell 映射到 setOrderForm({direction})，onCancelAll 提示"请使用查询面板撤单" | `6ba0262` |
| 2 | usePriceStep 未集成 | OrderForm + StopOrderForm 接受 priceTick prop，内部调用 usePriceStep Hook 替代硬编码 tick=0.2 | `fb20393` |
| 3 | stopPrice 静默丢弃 | CtpOrderRequest 增加 stopPrice 可选字段，convertOrderRequest 条件透传 | `ba2c6d7` |
| 4 | cancelOrder 未接入 Store | OrderStore 增加 cancelOrder(orderRef) 方法，调用 api.cancelOrder + Toast 反馈 | `6346c79` |

---

### 🟡 改进建议

| # | 建议 | 处理 | 理由 |
|---|------|------|------|
| 1 | 抽取 DirectionToggle/OffsetToggle 等共享子组件 | **保留未采纳** | OrderForm 和 StopOrderForm 差异较大（止损单多止损价输入，限价/市价逻辑不同），强行抽取会导致 props 过多。后续 PR-15（快捷功能）可重新评估 |
| 2 | 提交前缺少前端校验 | **已采纳** | 新增 instrumentID 非空检查（"请选择合约"）、限价单 limitPrice > 0 检查（"请输入有效价格"） | `a7caf33` |
| 3 | Toast 模块级可变状态注释 | **已采纳** | 添加注释说明单例渲染假设、不适用 React 18 Concurrent Features | `a7caf33` |
| 4 | setSelectedInstrument 行为注释 | **已采纳** | 添加注释说明仅更新 instrumentID，保留方向/开平设置 | `a7caf33` |

---

### 🔵 疑问确认

**Q1：IOC 是有意省略还是 task 描述不一致？**

A：实现遵循 task.md 中提供的字段映射代码 `TIME_CONDITION_MAP = { gfd: '1', fok: '2', fak: '3' }`（不含 IOC）。task.md 文字描述"GFD/IOC/FOK/FAK"与代码映射不一致，属于 task.md 自身文档矛盾。当前实现与映射表一致（3 种）。详细讨论见 progress.md 自验证观察项。

**Q2：止损单是否应使用独立 API 端点（如 /api/order/stop）？**

A：当前实现中 StopOrderForm 和 OrderForm 共用 `POST /api/order/insert`，后端通过 `stopPrice` 字段是否存在区分普通单和止损单。task.md PR-10 未要求独立止损 API 端点。独立 `/api/order/stop` 端点在 PR-13（后端止损单服务）中实现，届时前端可相应调整。

---

### 修复统计

- 🔴 阻断性问题：已修复 **4** 条
- 🟡 改进建议：采纳 **3** 条，保留 **1** 条（代码去重，见理由）
- 🔵 疑问确认：已回复 **2** 条

### Commit 列表

- `ba2c6d7` fix(task-10): review反馈 - stopPrice透传到CtpOrderRequest
- `6346c79` fix(task-10): review反馈 - cancelOrder接入Store
- `6ba0262` fix(task-10): review反馈 - useHotKeys集成到OrderPanel
- `fb20393` fix(task-10): review反馈 - usePriceStep集成到表单组件
- `a7caf33` fix(task-10): review反馈 - 前端校验+注释补充
