# 审查反馈 — PR-R16: K线标签页

**审查时间**: 2026-08-04
**审查分支**: `feature/redesign-r16-kline-page`
**审查范围**: 6 files, +251 / -40
**提交范围**: `b1cbd80`（feat 实现）→ `021ead4`（状态：开发完成待审查 + R15 状态同步）

---

## 审查结论

**✅ 通过** — 无阻断性问题。1 条改进建议（低优先）、4 条疑问。

---

## 验证执行记录

| 验证项 | 结果 | 说明 |
|--------|:----:|------|
| 全量测试 | ✅ | `vitest run` 全量 73 files / 751 tests 全部通过，无回归 |
| 受影响文件测试 | ✅ | KLinePage.test.tsx（10 条）+ TabContent.test.tsx（17 条）合计 27 条通过 |
| TS 类型检查 | ⚠️ | `tsc --noEmit` 6 个错误，全部位于 R19 快捷键测试文件（见 🔵3），R16 diff 未涉及 |
| TabContent 集成 | ✅ | `index.tsx:33` `case 'kline'` 渲染 `KLinePage`，`getInstrumentID` 运行时类型守卫提取 instrumentID |
| 可选 instrumentID 守卫 | ✅ | `KLinePage.tsx:44` 无合约时 useEffect 提前 return，JSX 显示「请在行情表格中选择合约」占位 |
| CSS 变量 | ✅ | `--bg-primary/--bg-secondary/--border-color/--text-primary/--text-secondary/--text-muted/--font-mono/--accent` 均在 `global.css` `:root` 定义 |
| 标签页标题 | ✅ | TabBar 标题由 `useContractContextMenu.ts:57` 生成 `📈 K线-${instrumentID}`（已有逻辑 + 测试断言）；页内标题栏「📈 K线」+ 合约副标题 |
| formatPrice 一致性 | ✅ | 与 `OrderPage.tsx:26-29` 逐字一致（🟡1 建议后续共享化） |
| 调用点影响 | ✅ | 全仓 KLinePage 仅 TabContent 一处引用，instrumentID 改为可选无破坏性影响 |
| 文档同步 | ✅ | task-redesign.md R16 状态「开发完成，待审查」、验收标准全部 `[x]`、提交文件/范围注记已更新；R15 同步为 ✅ 已完成（与 git log 合并记录一致） |

---

## 🔴 阻断性问题

无。

---

## 🟡 改进建议

### 🟡1 — formatPrice 在 OrderPage 与 KLinePage 重复定义，decimals 公式对小数 tick 多显示一位

**文件**: `frontend/src/pages/KLinePage.tsx:23-26`、`frontend/src/pages/OrderPage.tsx:26-29`
**级别**: 🟡 改进建议（低优先，不阻塞）

KLinePage 复制了 OrderPage 的 `formatPrice`，两处实现逐字一致：

```typescript
function formatPrice(n: number, tick: number): string {
  const decimals = tick < 1 ? String(tick).length - 1 : 0;
  return n.toFixed(decimals);
}
```

公式 `String(tick).length - 1` 对小数 tick 计算的小数位**多一位**：`0.2` → 2 位、`0.05` → 3 位、`0.5` → 2 位（真实精度分别为 1 / 2 / 1）。当前数值正确（`toFixed` 仅补尾零），测试注释「与 OrderPage 约定一致」说明是有意沿用；但「4585.60」这类展示与「保留到 priceTick 精度」的语义不符，且 KLinePage 测试断言 `'4585.60'` 固化了这一行为。

**建议**（供开发窗口决策，非 R16 必改）：
- 抽取共享工具 `utils/formatPrice.ts`，两页共同引用，消除重复
- 若顺带修正 decimals 公式（`String(tick).split('.')[1]?.length ?? 0`），需**同步**修改 OrderPage + KLinePage + 两处相关测试断言（`'4585.60'` → `'4585.6'`），改动面会扩大，可留作独立小 PR

---

## 🔵 疑问

### 🔵1 — `.kline-page__title-bar` 的 sticky 定位不生效

**文件**: `frontend/src/pages/KLinePage.css:11-23`
**级别**: 🔵 确认

`position: sticky; top: 0` 在 `.kline-page`（`overflow: hidden`、flex column、无内部滚动）中不存在滚动场景，sticky 无实际效果。无害，确认可保留或后续移除。

### 🔵2 — 最新价展示边界：快照缺失 '—' / lastPrice=0 显示 '0.00'

**文件**: `frontend/src/pages/KLinePage.tsx:39-40`
**级别**: 🔵 确认

快照缺失时显示 '—'；`lastPrice = 0` 时 `!= null` 判定成立，显示 '0.00'（与 OrderPage 行为一致）。合约信息未加载时 `priceTick` 先按默认 0.2 精度显示，加载后自动纠正。确认均为既有约定、可接受。

### 🔵3 — main 预存 6 个 tsc 错误（与 R16 无关）

**文件**: `QuickKeys/index.test.tsx`(1)、`useHotKeys.test.ts`(3)、`SettingsPage.test.tsx`(1)、`contracts.test.ts`(1)
**级别**: 🔵 信息同步

`tsc --noEmit` 报 6 个 `HotKeyConfig` 缺 `openOrder/openKline/openSettings` 字段错误，源自 R19 快捷键重构（`77d51f9`）扩展了类型但测试 fixture 未同步。这些文件**不在 R16 diff 中**，错误在 main 上即存在，不阻塞 R16。建议另立小 PR 修复测试 fixture。

### 🔵4 — TabContent 测试存在 act() 警告

**文件**: `frontend/src/components/TabContent/index.test.tsx`
**级别**: 🔵 信息

测试运行输出 `An update to TabContent ... not wrapped in act(...)` 警告，来自「切换标签后切回，面板应保持」等既有用例的 `setState` 未包 `act`。非 R16 引入（R16 新增的 KLinePage mock 为静态渲染），可选优化。

---

## 审查维度检查清单

| 维度 | 状态 | 备注 |
|------|:----:|------|
| 功能正确性 | ✅ | 独立K线页（标题栏/合约信息条/最新价）+ KLineChart 集成 + 无合约占位 + TabContent 集成 |
| 测试质量 | ✅ | 新增 4 条（标题栏/最新价/快照缺失占位/无合约边界），mock KLineChart 策略与 R15 一致 |
| 代码质量 | 🟡 | 结构清晰、BEM 式 CSS；formatPrice 重复定义（🟡1） |
| 范围控制 | ✅ | 6 文件 +251/-40，严格限定 R16（KLinePage + TabContent 集成 + 文档） |
| 文档同步 | ✅ | 状态、验收标准 `[x]`、提交文件、范围注记均更新 |
| 潜在风险 | ✅ | 改动量小、调用点唯一；6 个 tsc 错误为 main 预存（🔵3） |
| 任务文件完整性 | ✅ | 状态「开发完成，待审查」、依赖 R11、验收标准齐全 |

---

## 审查结论

**✅ 通过** — 无阻断性问题。实现与 R15 二次审查同等的成熟度：KLinePage 独立页结构与 OrderPage 对齐，可选 instrumentID 守卫完善，TabContent 集成干净，文档（状态/验收标准/范围注记）完整。

**下一步（开发窗口）**：

1. **🟡1 可选项**：formatPrice 共享化（抽取 `utils/formatPrice.ts`）；若修正 decimals 公式需同步 OrderPage + 测试，建议独立小 PR
2. **进入人工验证（第 5 步）**，覆盖场景：
   - 右键合约「打开K线」→ 标签页标题 `📈 K线-{ID}`、页内最新价实时刷新（对照行情表格）
   - 多周期切换（K线图联动）与技术指标切换
   - 未选合约打开K线标签 → 占位提示「请在行情表格中选择合约」
   - 无快照时最新价显示 '—'
3. 验证记录写入 `verify-discussion-redesign-r16.md`，全部通过后更新任务状态为「人工验证通过，待收尾」
4. 🔵3 的 6 个 tsc 预存错误建议另行小 PR 修复（不属于 R16 范围）

---

## 二次审查（Round 2）

**审查时间**: 2026-08-04
**审查分支**: `feature/redesign-r16-kline-page`
**审查范围**: commits `35d40da`（反馈处理）→ `13eb90c`（高度塌陷）→ `fab1339`（空白修复），net 13 files, +400 / -120
**触发背景**: R1 审查通过 + 两项用户反馈必改（K线标签无数据 / 顶部展示栏合并）

### 验证执行记录

| 验证项 | 结果 | 说明 |
|--------|:----:|------|
| 全量测试 | ✅ | `vitest run` 全量 75 files / 761 tests 全部通过 |
| TS 类型检查 | ✅ | R16 相关文件无错误；仅剩 6 个 R19 预存错误（QuickKeys/useHotKeys/SettingsPage/contracts 测试，见 R1 🔵3） |
| 文档同步 | ✅ | task-redesign.md 提交文件清单 + 修复注记更新；review-reply-redesign-r16.md 记录完整 |

### R1 反馈项复核

| 项 | R1 结论 | 复核结果 |
|----|:----:|----------|
| 🟡1 formatPrice 重复 + decimals 公式 | 改进建议 | ✅ 合理推迟（回复中明确另立独立小 PR 及改动面），R16 保持与 OrderPage 一致 |
| 🔵1 sticky 不生效 | 确认 | ✅ 保留无碍 |
| 🔵2 最新价边界 | 确认 | ✅ 既有约定 |
| 🔵3 tsc 预存错误 | 信息 | ✅ 仍存在（R19 遗留），与 R16 无关 |
| 🔵4 act 警告 | 信息 | ✅ 既有 |

### 新实现复核

#### useTabContractLocks（新 hook）🟡

锁定/解锁主逻辑正确（打开 kline/order 标签 → 锁定、关闭 → 解锁、prevRef 仅解锁本 hook 曾锁定的）。但存在**同合约共享锁误删**场景，见 🟡1。

#### KLineChart 懒初始化（chartReady）✅

`display:none` 时挂载 → echarts.init 推迟到容器可见，靠 chartReady state 重放 setOption；数据 effect 有 `klineData.length > 0` 守卫避免空数据重放；ResizeObserver 仅首次成功初始化时 setChartReady，无死循环。测试以 mock RO 延迟触发覆盖竞态 ✅。QueryPanel 的 K线子页共享此修复，无回归。

#### 高度塌陷修复 ✅

根因正确：原 `.tab-content__panel { height: 100% }` 在嵌套 flex 中高度链断裂，`.kline-chart` 的 `flex: 1` 因父级非 flex 容器而失效。修复为 `.tab-content` flex 列 + `.tab-content__panel` flex:1/min-height:0 + `.kline-page__content` flex 列（`.kline-chart` 已有 flex:1）。style test 以 CSS 源码断言防护回归 ✅。

#### 展示栏合并 ✅

KLineChart 新增可选 `name`/`latestPrice` props，QueryPanel 不传 props 保持原样（向后兼容）；KLinePage 移除标题栏+信息条。测试覆盖 name/latest 渲染与缺省隐藏 ✅。

### 🟡 改进建议（新增）

#### 🟡1 — lockedContracts 为 Set，关闭标签会误删 OrderPopup 的同合约锁定

**文件**: `frontend/src/hooks/useTabContractLocks.ts:49-54`、`frontend/src/modules/market/store.ts:107-118`
**级别**: 🟡 改进建议（关键，建议合入前或紧随的独立 PR 修复）

**场景复现**：
1. OrderPopup 打开合约 IF2608 → `addLockedContract('IF2608')` → lockedContracts = {IF2608}
2. 打开 IF2608 的 K线标签 → hook 锁定（Set 已含，无变化）
3. 关闭 K线标签 → hook 调 `removeLockedContract('IF2608')` → **IF2608 从 Set 整体移除**
4. OrderPopup 仍打开，但 IF2608 已离开 lockedContracts；若其不在行情表格可见区/自选 → `useSubscriptionManager` 将其**退订** → 报单弹窗最新价/买卖价冻结

hook 注释声明「只解锁本 hook 曾锁定的合约…不干扰 OrderPopup 等其他来源的锁定，避免误删」，但 store 的 `lockedContracts` 是 **Set** 而非引用计数：`prevRef` 只记录本 hook 是否锁过，无法感知 OrderPopup 等其他锁定源。测试「保留其他来源（OrderPopup）的锁定」只覆盖**不同合约**（AU2608 与 IF2608 并存），未覆盖**同合约被弹窗+标签同时锁定后关标签**的场景，与 hook 声明意图不符。

**建议**：将 `lockedContracts` 改为引用计数 `Map<string, number>`：
- `addLockedContract` → `count = (map.get(id) ?? 0) + 1`
- `removeLockedContract` → `count - 1`，减至 0 才 delete
- `useSubscriptionManager.ts:48` 遍历改为 `lockedContracts.keys()`
- 补充测试：同合约被 OrderPopup + kline 标签同时锁定 → 关标签后仍锁定；两处全部释放后解锁

### 🔵 疑问

#### 🔵1 — chartReady 触发的一次 setOption 重放与数据更新相邻执行

懒初始化成功后 setChartReady → 数据 effect 重放 setOption；随后数据更新再触发 setOption。`isInit` 由 `prevDataLenRef` 区分，幂等无害，确认可接受。

#### 🔵2 — tab.props.instrumentID 仅在开标签时确定

useTabContractLocks 从 tab.props 读合约号；kline/order 标签的合约在打开时固定（标签去重防同合约堆叠），props 不动态变更，确认无遗漏解锁场景。

### 二次审查结论

**✅ 通过（附 🟡 改进项）** — 两项必改已正确修复且测试充分（懒初始化竞态、高度塌陷均有针对性测试），文档同步完整，R1 反馈处理合理。

| 项目 | R1 | Round 2 |
|------|:----:|:----:|
| 🟡1 formatPrice | 改进建议 | ✅ 合理推迟（独立 PR） |
| 🔵1-4 | 确认/信息 | ✅ 无 action |
| 🟡1（新）共享锁误删 | — | 🟡 需修复（引用计数） |

**下一步（开发窗口）**：
1. **处理 🟡1**（建议在 R16 内完成，改动量小）：lockedContracts 引用计数化 + 补充同合约场景测试
2. 处理后可进入人工验证（第 5 步），或先人工验证、🟡1 随独立小 PR 跟进（由开发窗口决策）
3. 验证记录写入 `verify-discussion-redesign-r16.md`，全部通过后更新任务状态为「人工验证通过，待收尾」
