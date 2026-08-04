# 审查反馈 — PR-R15: 查询标签页

**审查时间**: 2026-08-04
**审查分支**: `feature/redesign-r15-query-page`
**审查范围**: 7 files, +100 / -5 lines
**提交范围**: `e7fcca4`（feat 实现）→ `e4da347`（状态：开发完成待自验证）→ `2b72682`（状态：开发完成待审查）

---

## 审查结论

**✅ 通过** — 无阻断性问题。2 条改进建议，2 条疑问。

---

## 验证执行记录

| 验证项 | 结果 | 说明 |
|--------|:----:|------|
| 全量测试 | ✅ | `vitest run` 全量 72 files / 742 tests 全部通过 |
| QueryPanel 模块 | ✅ | `frontend/src/modules/query/QueryPanel.tsx:26` 导出 `QueryPanel`，路径别名 `@/modules/query/QueryPanel` 与 `vi.mock` 一致 |
| 重复渲染检查 | ✅ | 全仓仅 QueryPage 引用 QueryPanel（无既有布局残留，无重复挂载） |
| 标签页去重 | ✅ | `tabs.ts:74` `generateTabId('query')` → `tab-query`，重复打开会激活既有标签而非堆叠 |
| 布局滚动链路 | ✅ | `.query-page`(flex column / height 100%) → `.query-page__content`(flex:1 / overflow hidden) → `.query-panel`(height:100%) → `.panel-content`(overflow-y auto)，与 OrderPage 已验证模式一致 |
| 状态保持 | ✅ | TabContent 常驻挂载（display:none 隐藏非激活面板），切换标签不丢失查询面板状态 |

---

## 🔴 阻断性问题

无。

---

## 🟡 改进建议

### 🟡1 — 验收标准 checkbox 未勾选

**文件**: `docs/tasks/task-redesign.md` PR-R15 验收标准（L616-620）
**级别**: 🟡 改进建议

```markdown
**验收标准**：
- [ ] 查询标签页正常显示
- [ ] Tab 切换功能正常
- [ ] 数据查询功能正常
- [ ] 所有测试通过
```

状态已标记「开发完成，待审查」（自验证已通过），但 4 项验收标准全部仍是 `[ ]`。对比 PR-R14（4 项全部 `[x]`），惯例是自验证通过后同步勾选验收标准。

**建议**: 开发窗口在下一次 pass 中补齐勾选（`查询标签页正常显示`、`Tab 切换功能正常`、`数据查询功能正常`、`所有测试通过`），反映实际验证结果，避免人工验证阶段遗漏对照项。

### 🟡2 — 提交文件列表不准确

**文件**: `docs/tasks/task-redesign.md` PR-R15「提交文件」（L601-606）
**级别**: 🟡 改进建议

当前列表仅列出 2 个文件：

```
frontend/src/pages/
├── QueryPage.tsx            # 重构：独立查询页面
└── QueryPage.test.tsx       # 更新测试
```

实际改动为 7 个文件，且测试实际路径在 `__tests__/` 子目录下：

```
frontend/src/pages/
├── QueryPage.tsx            # 新增：独立查询页面
├── QueryPage.css            # 新增：页面样式
└── __tests__/QueryPage.test.tsx   # 新增：测试（实际位于 __tests__/ 下）
frontend/src/App.tsx                     # 更新：托盘导航 openTab('query')
frontend/src/components/TabContent/
├── index.tsx                # 更新：集成 QueryPage
└── index.test.tsx           # 更新：mock QueryPage
```

**建议**: 更新为实际文件清单（含 `__tests__/` 路径与 `QueryPage.css`），与 PR-R14 列表格式保持一致。

---

## 🔵 疑问

### 🔵1 — 打开但非激活的查询标签会持续 10s 轮询

**文件**: `frontend/src/modules/query/QueryPanel.tsx:46-57`
**级别**: 🔵 疑问确认

TabContent 采用 `display:none` 常驻挂载（PR-R10 既有设计），QueryPanel 挂载后其 10s 自动刷新 `useEffect` 会持续运行，即使查询标签处于非激活状态也会轮询 `/api/query/*`（关闭标签卸载时才停止）。

**确认**: 这是否为预期行为？行情 MarketPanel 的 WebSocket 同样常驻，10s 轮询频率较低，不构成阻塞问题，但人工验证时可观察非激活查询标签的网络请求情况，后续若需优化可考虑「仅激活标签轮询」方案（非本 PR 范围）。

### 🔵2 — 查询页 K线 Tab 依赖全局选中合约

**文件**: `frontend/src/modules/query/QueryPanel.tsx:111-129`
**级别**: 🔵 疑问确认

查询面板「合约/K线」Tab 的 `selectedInstrument` 来自 `useMarketStore` 全局状态（行情表格选中）。若查询标签打开时尚未在行情表格选中合约，K线 Tab 显示「选择合约查看K线图」占位。

**确认**: 与既有 QueryPanel 行为一致（非 r15 引入），确认此为设计预期即可，人工验证时覆盖「未选合约打开查询页」场景。

---

## 审查维度检查清单

| 维度 | 状态 | 备注 |
|------|:----:|------|
| 功能正确性 | ✅ | QueryPage 集成正确，`openTab` 去重防止标签堆叠，托盘导航接通 |
| 测试质量 | ✅ | QueryPage 3 条包装层测试（页头/集成/结构），mock QueryPanel 策略与 r14 一致；全量 742 tests 通过 |
| 代码质量 | ✅ | 结构简洁，与 OrderPage 模式对齐；CSS 类名命名规范（BEM 式） |
| 范围控制 | ✅ | 严格限定 r15 范围（QueryPage + TabContent + App 托盘导航），+100/-5 行 |
| 文档同步 | 🟡 | 状态已更新；验收标准未勾选 (🟡1)、提交文件列表不完整 (🟡2) |
| 潜在风险 | ✅ | 改动量小、影响面可控；10s 轮询常驻为既有 TabContent 设计下的观察项 (🔵1) |
| 任务文件完整性 | 🟡 | 状态、依赖标记正确；验收标准与文件列表需补齐 |

---

## 审查结论

**✅ 通过** — 无阻断性问题，2 条改进建议（文档同步类，不阻塞合入）、2 条疑问（确认既有行为）。建议开发窗口：

1. 更新 task-redesign.md：勾选验收标准 + 修正提交文件列表（🟡1、🟡2）
2. 人工验证阶段覆盖：查询标签页正常显示、Tab 切换、数据查询、未选合约打开查询页场景（🔵2）

---

## 二次审查（Round 2）

**审查时间**: 2026-08-04
**审查分支**: `feature/redesign-r15-query-page`
**审查范围**: commits `1f0be58`（R1 反馈处理）→ `7c98ccb`（TabBar 快捷入口）→ `7ed1d2e`（查询弹窗重构）→ `ff3ee37`（文档），net 20 files, +497 / -179
**触发背景**: 用户决策——查询面板改为悬浮弹窗（类 OrderPopup），移除整页查询 Tab，右键合约新增「查询」入口

### 验证执行记录

| 验证项 | 结果 | 说明 |
|--------|:----:|------|
| 全量测试 | ✅ | `vitest run` 73 files / 748 tests 全部通过（开发窗口声明属实） |
| TS 类型检查 | ✅ | `tsc --noEmit` 退出码 0，无错误 |
| QueryPage 残留 | ✅ | 全仓无 `QueryPage` 引用残留（文件已删除，导入已清理） |
| query 标签类型残留 | ✅ | `tabs.ts`/`TabContent`/`TabBar` 无 `'query'` TabType 残留 |
| Electron 类型 | ✅ | `windowManager.ts` 的 `WINDOW_CONFIGS.query` 为独立窗口类型（不引用 TabType），不受移除影响 |
| 多选菜单 | ✅ | MarketPanel 多选菜单正确未加「查询」项（查询为单合约语义，符合预期） |

### R1 反馈项复核

| 项 | R1 结论 | 复核结果 |
|----|:----:|----------|
| 🟡1 验收标准 checkbox | 改进建议 | ✅ 已修复（task-redesign.md 勾选） |
| 🟡2 提交文件列表 | 改进建议 | ✅ 已修复（更新为弹窗实际文件清单） |
| 🔵1 10s 轮询常驻 | 疑问 | ✅ **重构后自然解决**：QueryPanel 仅存在于 QueryPopup 内，弹窗关闭即卸载，轮询不再常驻运行 |
| 🔵2 K线 Tab 依赖选中合约 | 疑问 | 🔵 仍适用：QueryPanel 仍读全局 `selectedInstrument`；右键入口通过 `open(id)` 同步全局选中来满足关联 |

### 新实现复核

#### QueryPopup（`frontend/src/modules/query/`）✅

- `popupStore.ts`：`{ isOpen, open(instrumentID?), close }`，`open(id)` 同步全局选中——store 设计简洁，与 OrderPopup 模式对齐
- `QueryPopup.tsx`：非模态、标题栏拖拽、× / ESC 关闭、App.tsx 挂载（`OrderPopup` 之后），完全镜像 OrderPopup 实现
- `popupStore.test.ts`（4 条）覆盖：初始态 / open / open 传合约同步全局选中 / close ✅
- `QueryPopup.test.tsx`（4 条）覆盖：关闭不渲染 / 打开渲染标题+QueryPanel / × 关闭 / ESC 关闭 ✅

#### 入口集成 ✅

- TabBar 📋 按钮 → `useQueryPopupStore.getState().open()`（QUICK_TABS 已移除 query，无残留 openTab('query')）
- App.tsx 托盘 `case 'query'` → 打开弹窗（浏览器/Electron 通用）
- MarketPanel 单选菜单新增 `{ label: '查询', icon: '📋' }`（L286，位于「打开K线」后）
- FavoritesPage 右键菜单新增「📋 查询」（L106-111）
- `useContractContextMenu` 新增 `openQueryPopup(instrumentID)`

#### 移除工作 ✅

- `tabs.ts` 移除 `'query'` 于 `TabType` + `TAB_TYPES`；`tabs.test.ts` query 用例替换为 favorites/settings
- `TabContent` 移除 query case + QueryPage mock；`TabContent/index.test.tsx` QUERY_TAB → SETTINGS_TAB
- 删除 `QueryPage.tsx` / `QueryPage.css` / `__tests__/QueryPage.test.tsx`
- `task-redesign.md` PR-R15 重写为「查询弹窗（重构）」，提交文件/实现方式/验收标准（[x]）同步更新

### 🟡 改进建议（新增）

#### 🟡1 — 右键「查询」菜单项缺少自动化测试

**文件**: `MarketPanel.tsx:286`、`FavoritesPage.tsx:106-111`、`useContractContextMenu.ts:39-42`
**级别**: 🟡 改进建议

`openQueryPopup` Hook、MarketPanel 与 FavoritesPage 的「查询」菜单项均**无测试覆盖**。既有测试为每个右键动作（打开报单 / 打开K线）写了菜单点击测试（`MarketPanel.test.tsx:231-277`、`FavoritesPage.test.tsx:155-172`、`useContractContextMenu.test.ts:25-45`），新增的「查询」链路（点击 → 打开弹窗 → 传入正确合约）缺少同等保护。若 onClick 接线错误（如传错变量、漏传 instrumentID），测试无法发现。

**建议**: 参照既有测试模式补充：
- `useContractContextMenu.test.ts`：`openQueryPopup('IF2608')` → `useQueryPopupStore.getState().isOpen === true` 且全局 `selectedInstrument === 'IF2608'`
- `MarketPanel.test.tsx`：点击右键菜单「查询」→ `useQueryPopupStore` 打开且 instrumentID 正确
- `FavoritesPage.test.tsx`：点击「📋 查询」→ 弹窗打开

#### 🟡2 — 「关联右键合约」在弹窗打开时不可见

**文件**: `frontend/src/modules/query/QueryPopup.tsx`、`frontend/src/modules/query/popupStore.ts`
**级别**: 🟡 改进建议

当前 `open('IF2608')` 仅同步全局选中（K线/合约子页可用），但弹窗打开时停在 QueryPanel 的默认/上次 Tab（通常为「报单」，该 Tab 为全账户视图、不按合约区分）。右键合约 →「查询」的关联在弹窗打开瞬间不可见，需手动切到「合约」或「K线」Tab 才能看到该合约。

**建议**（供用户/开发窗口在人工验证时决策）：
- `open(instrumentID)` 传入合约时，同步 `useQueryStore.setActiveTab('kline')`（或 'contracts'），使弹窗打开即显示该合约图表/详情
- 或维持现状（保持 Tab），但需在人工验证确认「关联」体验符合预期

### 🔵 疑问

#### 🔵1 — 全局选中合约的副作用

`open(id)` 同步 `useMarketStore.selectedInstrument`，会**全局**改变行情表格的选中合约（高亮移动、行情面板内 K线联动切换），影响范围超出弹窗本身。与 FavoritesPage 行点击选中合约的行为一致（项目既有模式），确认此为预期设计即可。

#### 🔵2 — 弹窗 z-index 与 OrderPopup 相同（1500）

两个弹窗均为 `z-index: 1500`，同时打开时依 DOM 顺序堆叠（QueryPopup 在 App 中渲染于 OrderPopup 之后，故在上层）。当前无实际冲突场景，确认可接受。

#### 🔵3 — 弹窗标题未显示关联合约

`OrderPopup` 标题为「📝 报单-{ID}」，`QueryPopup` 标题固定「📋 查询」（store 未持有合约字段）。若希望弹窗打开时标题体现关联合约（如「📋 查询-IF2608」），需在 popupStore 中保留 `instrumentID` 字段。非必须，供确认。

---

### 二次审查结论

**✅ 通过** — 无阻断性问题。重构质量良好：QueryPopup 完全镜像 OrderPopup 成熟模式，`query` 标签类型移除彻底（无残留、无 TS 错误），R1 反馈已处理，748 tests / tsc 全绿。

| 项目 | R1 | Round 2 |
|------|:----:|:----:|
| 🟡1 验收标准 checkbox | 改进建议 | ✅ 已修复 |
| 🟡2 提交文件列表 | 改进建议 | ✅ 已修复 |
| 🔵1 10s 轮询常驻 | 疑问 | ✅ 重构后自然解决 |
| 🔵2 K线依赖选中合约 | 疑问 | 🔵 以全局选中机制满足 |
| 🟡1（新）查询菜单项测试 | — | 🟡 需补充 |
| 🟡2（新）关联可见性 | — | 🟡 待人工验证决策 |
| 🔵1-3（新） | — | 确认既有/低风险 |

**下一步（开发窗口）**：
1. 补充 🟡1 的三处测试（openQueryPopup Hook + MarketPanel + FavoritesPage 菜单点击）
2. 🟡2 在人工验证阶段决策（是否自动切到 K线 Tab）
3. 无 🔴 阻断项，测试补充后可进入人工验证（第 5 步），验证记录写入 `verify-discussion-redesign-r15.md`
