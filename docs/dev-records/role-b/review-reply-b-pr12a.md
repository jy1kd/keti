# PR-12a 审查反馈处理记录

## 第 1 轮反馈处理

**处理时间**：2026-07-17
**审查分支**：`feature/pr-12a-frontend-gaps`

---

### 🟡 改进建议处理

| # | 问题 | 处理 | 说明 |
|---|------|------|------|
| 1 | `as any` 类型断言不安全 | ✅ 采纳 | 改用 `MessageHandler` 类型别名，消除 `as any` |
| 2 | 轮询检测断连（每秒 setInterval） | ❌ 保留 | WSManager 不支持 `onClose` 事件回调，轮询是当前可行方案 |
| 3 | snapshotToKline 时间解析 NaN 风险 | ✅ 采纳 | 解构添加默认值 `[h = 0, m = 0, s = 0]` |
| 4 | Ctrl+P 与浏览器打印冲突 | ❌ 保留 | PerfMonitor 是开发调试工具，不影响生产环境 |
| 5 | `\|\|` vs `??` 空值运算符 | ✅ 采纳 | 价格为 0 时应保留，改用 `??` |

---

### 🔵 疑问确认

| # | 问题 | 回复 |
|---|------|------|
| 1 | 指数退避是否需要抖动 | 当前 SimNow 测试环境规模小，重连风暴风险低，暂不需要 |
| 2 | wsBaseUrl 变化后 WSManager 不重建 | wsBaseUrl 来自 `.env` 配置，组件生命周期内固定不变 |
| 3 | onAppLayout 类型变更 | 类型修复。react-resizable-panels v4 的 `onLayoutChange` 回调参数类型为 `Record<string, number>`，之前的 `number[]` 是错误类型 |

---

### 修复 Commit

- `e531b77` fix(task-12a): review反馈 - 类型安全+时间解析+空值运算符

### 验证结果

- 28 test files / 185 tests 全部通过
- TypeScript `tsc --noEmit` 0 errors
