# PR-E5 代码审查反馈

**审查人**：角色B（审查窗口）
**审查日期**：2026-07-28
**审查范围**：PR-E5 commit `d039ba2` vs PR-E4 final `514dfe3`（1 commit, 2 files, +158）
**PR内容**：K线窗口实现

---

## 审查结论

**✅ 审查通过** — 无阻断性问题，1 个改进建议，1 个疑问。

---

## 改动概览

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/pages/KLinePage.tsx` | 新增 | 独立K线页面（81 行）：复用 KLineChart + 数据获取 + 周期切换 |
| `src/pages/__tests__/KLinePage.test.tsx` | 新增 | 测试（77 行，5 个用例） |

---

## ✅ 正面评价

1. **复用现有组件**：直接使用 `KLineChart`，避免重复实现 K 线渲染逻辑
2. **数据获取完整**：`useEffect` 在 mount 和 `currentPeriod` 变化时自动获取 K 线数据（200 条）
3. **时间戳对齐**：使用 `PERIOD_MS` 将 K 线时间戳对齐到周期边界，与主面板行为一致
4. **跨窗口同步**：通过 Zustand store 共享 `klineData`/`currentPeriod`/`setPeriod`，多窗口实时同步
5. **Props 完全匹配**：传给 KLineChart 的 `instrument`/`klineData`/`period`/`onPeriodChange` 与 `KLineChartProps` 接口完全一致
6. **指标切换内置**：KLineChart 组件内部通过 `useState` 管理主图/副图指标切换（ma/boll + volume/macd/kdj/rsi），无需外部传入
7. **测试覆盖合理**：5 个用例覆盖渲染、合约 ID、合约名、周期选择器、props 传递

---

## 🟡 改进建议

### I1: K 线数据获取错误静默吞没

**文件**：`frontend/src/pages/KLinePage.tsx:45`

```typescript
.catch(() => { /* 静默失败 */ });
```

**问题**：API 调用失败时完全无反馈。在独立窗口场景下，用户无法知道数据加载失败。

**建议**：至少添加 console.warn 或通过 Toast 提示用户：
```typescript
.catch((err) => {
  console.warn('[KLinePage] Failed to fetch kline data:', err);
});
```

---

## 🔵 疑问

### Q1: 技术指标切换验收标准

**问题**：task.md 验收标准要求「技术指标切换正常工作」。当前 KLineChart 组件内部已实现指标切换（主图: MA/BOLL, 副图: VOL/MACD/KDJ/RSI），通过内部 `useState` 管理，未暴露为 KLinePage 的 props。

这是否满足需求？还是需要在 KLinePage 层面添加指标选择 UI？

---

## 验收标准核对

| 标准 | 状态 | 说明 |
|------|------|------|
| 双击合约能打开独立K线窗口 | ⚠️ | WindowManager.openKLineWindow 已实现，hash 路由桥接触发方式待集成 |
| K线图能正常显示 | ✅ | 复用 KLineChart，数据获取 + 时间戳对齐完整 |
| 周期切换正常工作 | ✅ | `currentPeriod` + `setPeriod` 通过 store 共享，切换触发重新获取数据 |
| 技术指标切换正常工作 | ✅ | KLineChart 内部 useState 管理，已内置 MA/BOLL/MACD/KDJ/RSI |

---

## 测试状态

- `KLinePage.test.tsx`：5 个用例通过 ✅

---

## 总结

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 阻断 | 0 | — |
| 🟡 建议 | 1 | 错误静默吞没 |
| 🔵 疑问 | 1 | 指标切换 UI 层级 |
