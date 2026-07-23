# PR-15 审查反馈处理记录

## 第 1 轮审查回复

审查时间：2026-07-23
修复时间：2026-07-23

---

### 🔴 阻断性问题修复

| # | 问题 | 方案 | 状态 |
|---|------|------|------|
| 1 | BatchCancel hardcode 假值 | 方案A：扩展 getOrders 返回类型，后端 PR-11 已返回完整字段 | ✅ 已修复 |
| 2 | QuickKeys handleReset 自动保存 | 去掉 onSave 调用，仅恢复 UI，用户手动保存 | ✅ 已修复 |
| 3 | handleReverse/handleLock 重复代码 | 提取 executeAction 公共函数 | ✅ 已修复 |

### 🟡 改进建议处理

| # | 建议 | 处理 |
|---|------|------|
| 1 | BatchCancel 串行→并发 | ✅ 采纳，改为 Promise.allSettled |
| 2 | handleSaveHotKeys 4次store调用 | ✅ 采纳，新增 setHotKeys 批量方法 |
| 3 | cancelAllOrders 死代码 | ✅ 采纳，加 TODO 标注 PR-16 使用 |
| 4 | 快捷键去重校验 | ✅ 采纳，handleSave 中检测重复键绑定 |

### 🔵 疑问回复

| # | 疑问 | 回复 |
|---|------|------|
| 1 | 部分 hotKeys 静默失效 | ✅ 改为合并 DEFAULT_KEYS，缺失键回退默认值 |
| 2 | Promise<unknown> 类型 | 保持。QuickActions 组件不消费返回值，仅依赖 try/catch 判断成败做 toast 提示 |
