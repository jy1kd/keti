# SDD ledger — plan: docs/superpowers/plans/2026-08-13-market-tab-split-v2.md

Workspace: `.superpowers/sdd/2026-08-13-market-tab-split-v2`
Branch: `feature/md-refactor`
BASE (start): HEAD before V2-1 (`git rev-parse HEAD` = 2323fc1 + plan commit)
Spec: `docs/superpowers/specs/2026-08-12-market-tab-split-design.md`（§7 v2）
Prior plan: `docs/superpowers/plans/2026-08-12-market-tab-split.md`（已完成的 v1，8 任务；本计划是它的迭代）

## Pre-flight scan

| Task pair (share file/interface) | Produces → Consumes | Finding |
|---|---|---|
| V2-1 optionsSpec/QuoteTable ↔ V2-2 OptionsPanel 标底行交互 | 标底行 `kind:'underlying'` 精简 + mergeCells → OptionsPanel 双击/右键 openTQuoteFloating | V2-1 先改行渲染，V2-2 依赖标底行已精简（双击不弹报单而开 T型报价）。V2-1 完成须保持单击选中 + click_cell 行解析正常。一致（顺序依赖 V2-1 → V2-2） |
| V2-2 tabs.ts 'tquote' ↔ TabContent/openFloatingTab | `'tquote'` TabType → TabContent case 渲染 TQuoteView；`generateTabId` 用 props.instrumentID | `tab-tquote-<标底>` 天然去重；空白实例 `tab-tquote`。V2-2 Step 3 加类型 + 渲染 + openTQuoteFloating 一体。一致 |
| V2-2 TQuoteView 自包含化 ↔ 删 options/store.ts | TQuoteView 直连 API 本地 state → 删 store.ts + store.test.ts | 已核实 `useOptionsStore` 仅 TQuoteView 使用（grep 无其他消费者）。删除后无孤儿引用。一致 |
| V2-2 OptionsPanel 移除切换 ↔ V2-1 OptionsPanel 标底交互 | 移除 view state + 加 handleRowDoubleClick/handleRowContextMenu | OptionsPanel 单文件改动集中在 V2-2 Step 5；V2-1 不触碰 OptionsPanel 工具行。一致 |
| V2-3 computeFilterOptions ↔ ContractFilter props | `computeFilterOptions` 签名 → ContractFilter 动态列表 | V2-3 改 ContractFilter props（加 allContracts/getProduct）；两页传入。V2-2 移除切换后 OptionsPanel 工具行稳定，V2-3 只替换 ContractFilter 的 props。一致（V2-3 依赖 V2-2 完成后的 OptionsPanel 结构，但改动点独立） |

| Task | 自身一致性 | 发现 |
|---|---|---|
| V2-1 | 测试断言 buildRecord 精简 + mergeCells 调用 + 合约列样式 | 干净；mergeCells 时序（rAF 兜底）为已知风险，实现时须验证 |
| V2-2 | tquote 类型/渲染/入口/自包含四块改动 + 删 store | 干净；TQuoteView 重构较大，store 删除需跑全量确认无残留 import |
| V2-3 | computeFilterOptions 纯函数 + ContractFilter 动态列表 + 两页接入 | 干净；已选项目须保留显示（交叉过滤不吞已选项） |

预检结论：无跨任务冲突；V2-1 → V2-2 顺序依赖，V2-3 独立。均已记录。

## Task progress

Task 1: fix round 1/5 (4 addressed, 0 open — StrictMode mergedRowsRef 重置 + drift 测试 + 硬编码列断言 + spec 不突变断言; commits d6610cc..3cfb332)
Task 1: complete (commits 5205e2b..3cfb332, review clean — ✅ spec compliant, Approved)
  - out-of-scope (minor): StrictMode 修复无专门自动化测试（套件不渲染在 StrictMode 下），靠代码审查确认；真实 vtable 合并渲染需人工验证（jsdom mock 不覆盖）
Task 2: complete (commits 3cfb332..a21e8e8, review clean — ✅ spec compliant, Approved; volatility 去除获裁定确认)
  - Ruling: 「去 IV」= TQuoteView 不再调 getVolatility、删除实时 IV 刷新 effect、TQuoteTable 去 IV 列与 volatility prop。用户明确要求去 IV，无用户可见回归（getVolatility 成为 app 死代码，保留 API 表面）
  - minor (deferred): OptionsPanel 标底行右键未先 closeMenus()，若已开单/多选菜单会叠两个右键菜单——建议 setUnderlyingMenu 前 closeMenus()
  - minor (deferred): TQuoteView selectUnderlying 无请求时序守卫（pre-existing，慢响应 A 可能覆盖后选的 B）——可用 ref 记录最后请求的标底
  - minor (deferred): getVolatility 成 app 死代码（api.ts:250，仍被 api.test.ts 引用）；若 IV 回归需一并恢复 fetch+refresh
  - minor (deferred): TQuoteView.test.tsx loading 用例依赖 promise 同步执行，可用 deferred 辅助加固

Task 3: complete (commits a21e8e8..b36f1eb, review clean — ✅ spec compliant, Approved)
  - minor (deferred): ContractFilter getProduct 内联箭头导致 useMemo 每渲染失效，computeFilterOptions 每 tick 全量重扫（线性、可忽略；若优化可 useCallback 提升到面板）
  - Ruling (V2-3): brief 样例代码 bug + 排序改为插入序——见 Rulings 节

## Final whole-branch review (v2, 5205e2b..b36f1eb)

Verdict: **With fixes**. Fix in ONE wave:
- **Important #1**: TQuoteView 直连 `subscribeMarket` 无退订 → 订阅泄漏（换标底/关窗不退订，绕过共享 manager 的 LRU/SOFT_LIMIT 账目，多实例放大，重开 v1 已修的 500 上限原子拒绝风险）。修：subscribe effect 跟踪已订 id ref + 返回 cleanup（换标底/卸载时 unsubscribeMarket）。
- **Important #2**: 标底行右键 `setUnderlyingMenu` 未先 `closeMenus()` → 与已开菜单叠加；underlyingMenu 无外部点击关闭。修：`closeMenus(); setUnderlyingMenu(null)` 开头 + 外部点击 dismiss。
- **Minor #3**: 单击合并标底行把报单表单 limitPrice 置 0（underlying 记录无 lastPrice，onOrder price=0 覆盖 pending 价格）。修：underlying 行跳过 onOrder 价格填充或从快照取真实价。
- **Minor #4**: ContractFilter getProduct 内联箭头致 useMemo 每渲染失效。修：面板 useCallback 提升，或 memo deps 去掉 getProduct（纯映射 contracts）。
- **Minor #6**: TQuoteView.test.tsx:18 残留 getVolatility vestigial mock，删掉（getVolatility 保留为 API 表面）。

Deferred with ruling (fix wave 不处理):
- #5 selectUnderlying 请求时序守卫（pre-existing，自愈）
- #7 空 underlyingInstrID 派生出 '' 品种（真实数据均带，边缘）
- #8 TQuoteView.test loading 用例脆弱（可接受）
- v1 遗留：StrictMode 合并无专门测试（代码审查确认）；真实 vtable 合并渲染需人工验收（合并行视觉 + 单击锚点 + 双击/右键开窗 + 无 IV 残留）

Final fix wave: 9212b6e — re-review ADDRESSED all findings (#1-#4, #6), no new Critical/Important breakage
  - parked (minor, fix-introduced): TQuoteView 退订 unsubscribeMarket 会全局移除后端订阅，若同一期权既在列表可见区（manager subscribedRef 跟踪）又在已关闭的 tquote 链中，列表行数据冻结至重连/宽限期。根因是 tquote 直连订阅与 manager 平行通道。修法：把 tquote 订阅走 manager（lockedContracts/applySubscriptionChanges）保持账目一致。非阻塞、自愈（重连 forceResubscribe 或滚出视野 10s grace 后重新订阅）。
  - Ruling: 上述 Minor 停置不修——「无第二个修复波」规则 + 非 load-bearing + 是 #1 泄漏修复的相对改进；呈现给用户决定是否后续路由 tquote 订阅走 manager。

Subfix (user-requested): TQuoteView 订阅走共享 manager — commit 56fdbf7, review clean — ✅ Approved
  - 修复内容：lockedContracts 取代直连 subscribe/unsubscribe；cleanup 覆盖换链+卸载；保留 getSnapshots 立即回填；不锁标底期货（TQuoteTable 不显示其价格）
  - minor (deferred): lock 变更会喂 recentChangesRef 拖拽启发式（锁落在滚动中→延迟 diff 500ms，getSnapshots 兜底显示，无破坏）
  - minor (deferred): 无「manager + TQuoteView 联合挂载」集成测试（dep 链已读代码验证，与 visibleInstrumentIDs 同路径）
  - minor (deferred): 换链后旧链 getSnapshots 迟到 batchUpdate 无害（按 key 覆盖，pre-existing）
  - Ruling: 不锁标底期货——TQuoteTable 只渲染 call/put/strike，锁了只是占用订阅槽无显示收益

Runtime-fix round (user-reported 4 issues): commit e35811c, review clean — ✅ Approved
  - #1 vtable 崩溃：TQuoteTable release 延迟 250ms（覆盖 vtable 内部 100ms 防抖 RO），幂等 release + StrictMode 身份守卫
  - #2a 表格 0 高度：.options-panel flex:1 → height:100%（对齐其它浮动页）
  - #2b 移除到期日：删 selectedExpireDate/handleExpireDateChange/expirations/formatExpireDate + 到期日 select；selectedChain=首个匹配链
  - #3 跳转期货：openFloatingTab 捕获 priorActive，detach 成功后恢复（所有悬浮打开统一行为）
  - #4 下拉排序：.sort() → naturalCompare（大小写不敏感，ad2608 在 FG610 前）
  - minor (deferred): #1 窗口 resize 竞态（resize 落在 close 前 ~150ms 内仍可触发）——任何有限延迟无法完全闭合，需 vtable 层补丁；已文档化
  - minor (deferred): #1 release 定时器未跟踪/取消（快速开合下会话内定时器累积，各自幂等无害）
  - minor (deferred): #1 TQuoteTable.test 用真实定时器调度 250ms release（当前无害，未来断言 release 计数需 fake timers）
  - minor (deferred): #2b 首个链是响应序非最早到期（pre-existing，可排序 expireDate 后取首个）
  - minor (deferred): #3 priorActive 本身是浮动标签的角（TabBar 高亮浮动标签而非 market，极罕见且更准确）

Issue-fix round (user-reported 3 issues): commit d75d85f, review clean — ✅ Approved
  - Issue A 标底行陈旧：vtable mergeCells 合并时捕获 text，applyRowMerges 改为每次 setRecords 全量 unmerge+remerge 重捕获（删 skip 优化）——修复筛选后 ad2609 固定 + 标的/期权不匹配
  - Issue B T型报价标题：TabContent 传 tabId；selectUnderlying 调 updateTab 同步标题/props
  - Issue C 订阅上限 554：runFullDiff 加批次上限（capacity = SOFT_LIMIT - size + unsubscribeIds.length，≤480 有界证明）；修正 brief 公式偏差（退订先行场景），新测试 554→单批480+丢弃告警
  - minor (deferred): useSubscriptionManager.test.ts warnSpy.mockRestore 未放 finally（前置断言失败会泄漏 mock）
  - minor (deferred): 上限测试未断言「丢弃的留待下次 diff 重试」契约（报告承认，建议补）
  - minor (deferred): rAF 重试在同步全成功时仍 re-unmerge+remerge（无害，可 gate 到仅未完成行）
  - minor (informational): 「陈旧合并使 getBodyVisibleCellRange 膨胀」前提未被测试直接证明，Issue C 上限是实际保护

Minor-cleanup round (8 items): commit 2460555, review clean — ✅ Approved
  - minor (deferred): Item 3 dev-StrictMode 孤儿——<250ms 快速关窗时最早 vtable 实例的 release 定时器被后一个 cleanup 取消，实例不释放（dev-only + 250ms 窗口，任务指定「单 pending 定时器」权衡；生产单挂载不受影响）。建议改名测试 + 注释 singleton-mock 局限
  - minor (deferred): TQuoteView selectedChain 对 expireDate undefined 的链 localeCompare 会抛（pre-existing 类型风险，非本次引入）

Final whole-branch review (v2): CLEAN（含 subfix + runtime-fix + issue-fix + minor-cleanup；分支未合并 main——用户自管合并）

## Rulings

- Ruling (V2-2 去 IV): 见 Task 2 完成行——用户明确要求移除 IV，volatility 数据流整体移除是「去 IV」的连贯解释（brief 自相矛盾处唯一 tsc 干净的解法），无功能回归。成本若错：IV 若需回归，须恢复 getVolatility 调用 + 实时刷新 effect + TQuoteTable IV 列。
- Ruling (V2-3 computeFilterOptions): brief 样例代码有 bug——products 列表被「已选品种」额外过滤（test #4 期望只被已选交易所约束）。实现者按测试（可执行 spec）修正：每个列表只被另一维度的已选项约束。另 brief 用 `.sort()` 但测试期望插入序（`['FG','cu','MA']`），实现者保留插入序（来自已排序的合约数组，确定性）。成本若错：若想要更直观的品种排序需另行调整测试。
