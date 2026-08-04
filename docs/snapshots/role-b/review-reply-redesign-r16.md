# 审查回复 — PR-R16: K线标签页

**回复时间**: 2026-08-04
**审查反馈**: `review-feedback-redesign-r16.md`
**状态**: ✅ 审查通过 + 用户反馈已修复，待二次审查

---

## 一、审查反馈处理

### 🔴 阻断性问题
无。

### 🟡 改进建议

| 编号 | 内容 | 处理 | 说明 |
|------|------|:----:|------|
| 🟡1 | `formatPrice` 在 OrderPage/KLinePage 重复定义，decimals 公式对小数 tick 多显示一位 | ⏸️ 推迟 | 认同共享化方向，但修正 decimals 公式需**同步**改动 OrderPage + KLinePage + 多处测试断言，改动面超出 R16 范围。**决定：另立独立小 PR**（抽取 `utils/formatPrice.ts` + 修正公式 + 同步两页测试），R16 保持与 OrderPage 一致的既有约定 |

### 🔵 疑问
全部确认无 action（🔵1 sticky 保留、🔵2 快照边界既有约定、🔵3 tsc 错误属 R19 遗留另立 PR、🔵4 act 警告非 R16 引入）。

---

## 二、用户反馈处理（两项必改）

### 反馈 1：K线标签页没有K线数据

**根因**：打开 K线/报单标签**从未锁定合约订阅**。`addLockedContract`/`removeLockedContract` 只在 OrderPopup（悬浮报单弹窗）调用。K线标签的合约若不在行情表格可见区域，订阅管理器不会订阅 → 后端 `kline_service` 收不到 tick 无法聚合 → K线空白。

**修复**：
- 新增 `hooks/useTabContractLocks.ts`：将打开标签（kline/order）的合约同步到 `lockedContracts`，关闭标签自动解锁
- 只解锁本 hook 曾锁定的合约（prevRef 追踪），不干扰 OrderPopup 等其他来源的锁定
- App.tsx 挂载（全局常驻）
- 设计依据：`docs/specs/redesign-plan.md` 3.5 锁定合约机制

### 反馈 2：顶部三个展示栏合并为一个

**原结构**（3 栏）：KLinePage 标题栏（📈 K线+代码）→ KLinePage 信息条（代码/名称/最新价）→ KLineChart 标题栏（代码+周期+指标）。

**修复**：移除 KLinePage 标题栏和信息条，由 **KLineChart 标题栏**作为单一展示栏，新增可选 props `name`/`latestPrice` 承载合约名称与最新价。布局：`IF2608 沪深300 | 最新 4585.60 | [1m][5m]… [MA][成交量]`。QueryPanel 使用不受影响（未传 props 时保持原样）。

---

## 三、变更文件清单

```
frontend/src/hooks/useTabContractLocks.ts        # 新增：标签合约锁定 hook
frontend/src/hooks/useTabContractLocks.test.ts   # 新增：5 个测试
frontend/src/App.tsx                             # 更新：挂载 useTabContractLocks
frontend/src/modules/market/KLineChart.tsx       # 更新：新增 name/latestPrice props，标题栏合并
frontend/src/modules/market/KLineChart.test.tsx  # 更新：+4 个测试
frontend/src/modules/market/styles.css           # 更新：标题栏新元素样式
frontend/src/pages/KLinePage.tsx                 # 更新：移除标题栏+信息条，传入 name/latest
frontend/src/pages/KLinePage.css                 # 更新：移除无用样式
frontend/src/pages/__tests__/KLinePage.test.tsx  # 更新：mock 适配新 props
```

## 四、测试结果

| 项目 | 结果 |
|------|------|
| useTabContractLocks | 5 tests ✅ |
| KLinePage | 9 tests ✅ |
| KLineChart | 19 tests ✅ |
| App | 9 tests ✅ |
| **全量** | **758 tests / 74 files ✅** |
| tsc | R16 相关文件无类型错误 |

## 五、二次审查请求

请审查窗口对**修复后 diff**做二次审查（重点：useTabContractLocks 锁定/解锁逻辑、KLineChart 标题栏合并、KLinePage 结构调整）。
