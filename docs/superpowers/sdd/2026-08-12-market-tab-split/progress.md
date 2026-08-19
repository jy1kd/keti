# SDD ledger — plan: docs/superpowers/plans/2026-08-12-market-tab-split.md

Workspace: `.superpowers/sdd/2026-08-12-market-tab-split`
Branch: `feature/md-refactor`
BASE (start): `02e5625` (docs: 行情表拆分期货/期权双标签实现计划)
Spec: `docs/superpowers/specs/2026-08-12-market-tab-split-design.md`

## Pre-flight scan

| Task pair (share file/interface) | Produces → Consumes | Finding |
|---|---|---|
| T1 sort.ts → T6 optionsSpec / T7 filter | `groupOptionsByUnderlying`/`deriveUnderlyingProduct` → 期权 spec 与筛选 | T1 已定义 `OptionGroup.underlying`（`ContractInfo \| undefined`）；T6 用 `g.underlying` 判断标底行；T7 用 `deriveUnderlyingProduct`。一致 |
| T1 types.ts → 全局 | `ContractInfo` 增 `underlyingInstrID?/optionsType?/strikePrice?` | 现有 `ContractInfo` 类型不含这三字段，T1 补全；期权 spec/分组/筛选依赖。一致 |
| T2 tabs.ts → T5/T6 TabContent/TabBar | 双固定标签 → 面板渲染 | T2 改 `DEFAULT_TAB`→`DEFAULT_TABS` 并改 `closeTab` 内兜底 `DEFAULT_TAB.id`；T5 未改 TabContent market 分支；T6 改 options 分支渲染 OptionsPanel。一致 |
| T4 App.tsx ↔ MarketPanel.tsx | 上移 useMarketWs/useSubscriptionManager/合约加载 | T4 从 MarketPanel 移除 `loadedRef`/加载 effect/`API_BASE`/`useMarketWs`/`useSubscriptionManager`；T5 面板只改 QuoteTable 渲染，不 reintroduce hooks。一致（T4 前置 T5 依赖） |
| T5 MarketTable→QuoteTable ↔ T6 optionsSpec | `QuoteTableSpec`/`QuoteRecord`/`ColumnDef` → 期权 spec | T5 定义 spec 类型并在 quoteTable.ts 导出 `PLACEHOLDER/isValidPrice/coloredStyle/statusStyle/shouldRenderAnchor`；T6 期权 spec 复用同一定义。一致 |
| T5 QuoteTable ↔ T6 OptionsPanel | `isActive` prop → 期权面板激活重报 | T5 加 `isActive`；T6 传 `isActive={isActive}`。一致 |
| T7 marketFilter store ↔ T8 工具行 | `futures/options` 两页筛选态 → 工具行 | T7 建 store + `load()` 挂 App 启动 effect；T8 布局重排不触碰筛选逻辑。一致 |

| Task | 自身一致性 | 发现 |
|---|---|---|
| T1 | 测试与实现签名一致（`naturalCompare/sortFutures/deriveUnderlyingProduct/groupOptionsByUnderlying`） | 干净 |
| T2 | 测试断言双标签 + TabBar 固定区泛化 | 干净；`closeTab` 兜底改 `DEFAULT_TABS[0].id` 需注意 |
| T3 | 菜单 label 断言改文案；`menuActions.ts:39` 窗口标题同步 | 干净 |
| T4 | 移除点与 App 挂载点对应 | 干净；MarketPanel 仍用 `contracts/favorites/addToFavorites/removeFromFavorites`，移除加载但保留解构 |
| T5 | `futuresSpec` 列与 buildRecord 从 MarketTable 原样搬；QuoteTable 参数化点（`spec.columns`/`spec.buildRecord`/`spec.rowStyle`） | 干净；`MarketTable.test.tsx` 需改引用 QuoteTable |
| T6 | optionsSpec 列含 contractType/strikePrice；TQuoteView 迁入现 OptionPanel | 干净；OptionsPanel 交互 props（usePointOrder/useContractContextMenu）在 T6 示意、T8 补齐 —— 待观察，T6 完成后须确认表格可交互 |
| T7 | filter 纯函数 + store + ContractFilter 组件；两页接入 | 干净；`App.tsx` 启动 effect 挂 `load()` |
| T8 | 工具行重排 + CSS margin-left:auto + 期权搜索定位 | 干净 |

预检结论：无跨任务冲突。T6 中「交互 props 待 T8 补齐」为计划内顺序依赖，非冲突。

## Task progress

Task 1: complete (commits 02e5625..5c0239a, review clean — ✅ spec compliant, Approved)
  - minor (deferred): sort.ts:50 `groups.get(u)!` 非空断言，可用 get-or-create 替代（风格）
  - minor (deferred): sort.test.ts 到期日排序维度未覆盖（全部默认 expireDate，首个比较键死代码）
  - minor (deferred): naturalCompare sensitivity:'base' 大小写不敏感，未来若同族大小写混用会失序（当前无此数据，Task 6/7 注意）
Task 2: fix round 1/5 (1 addressed, 0 open — 补默认态测试 + build 验证; commits 85856e8..2206a96)
Task 2: complete (commits 5c0239a..2206a96, review clean — ✅ spec compliant, Approved)
  - minor (deferred): tab-bar__market class 现用于期权标签，命名过时（保持兼容，考虑未来改名 tab-bar__fixed）
Task 3: fix round 1/5 (1 addressed, 0 open — 重编 dist-electron + build 验证; commits 9d142d3..f8dee48)
Task 3: complete (commits 2206a96..f8dee48, review clean — ✅ spec compliant, Approved)
  - minor (deferred): App.tsx:43 IPC openTab('market', title:'📊 行情') 会覆盖标签栏标题为旧文案——Task 6 处理标签路由时须改为 '📊 期货'
  - minor (deferred): menuTemplate.test.ts 用例名「行情子菜单完整镜像」措辞（无实质影响）
Task 5: fix round 1/5 (1 addressed, 0 open — spec 稳定性契约 JSDoc + dev 守卫 + 删 as any; commits 34b074f..4068eae)
Task 5: complete (commits 2f74460..4068eae, review clean — ✅ spec compliant, Approved)
  - minor (deferred): QuoteRecord index signature [field:unknown] 使消费点需 as number 强转；可加 num() 辅助函数（quoteTableCore）提升类型安全
  - minor (deferred): App.tsx 加载 effect 无 loadedRef 守卫，StrictMode dev 下双加载（幂等、brief 示例如此；生产无影响）
  - minor (deferred): QueryPanel.tsx:46 注释仍称 useMarketWs 由 MarketPanel 管理，已上移 App，需改注释
  - minor (deferred): App.test.tsx 新 spy 未 mockRestore（当前文件末尾无影响，后续追加测试需恢复）
Task 7: complete (commits 60f961b..8e784ac, review clean — ✅ spec compliant, Approved)
  - minor (deferred): MarketPanel.tsx:49 自选视图未排序（favoriteFutures），全部已排——严格讲管道「排序→全部/自选」应先排；建议 sortFutures(favoriteFutures)
  - minor (deferred): marketFilter.load() 仅 try/catch JSON 解析，未校验形状；损坏但合法 JSON（如 futures:"x"）会崩 exchanges.length——建议 Array.isArray 校验
  - minor (deferred): OptionsPanel 品种列表对缺 underlyingInstrID 的 class-6 合约派生 '' → 空名 checkbox（取决于真实数据是否带该字段）
  - minor (deferred): OptionsPanel ContractFilter 在 T型报价视图仍显示——Task 8 布局时处理隐藏
  - minor (deferred): onChange 两次 setExchanges/setProducts → 两次 localStorage 写入（功能正确，可合并 setPageFilter）
  - minor (deferred): marketFilter store 内联 {exchanges:[],products:[]} 未复用 EMPTY_FILTER（DRY 小优化）
Task 6: complete (commits 4068eae..60f961b, review clean — ✅ spec compliant, Approved)
  - minor (deferred): OptionsPanel 与 MarketPanel 重复 ~80 行 ContextMenu/收藏批量逻辑，可抽共享 hook（useContractMenuBlocks）
  - minor (deferred): OptionsPanel 复用 market/styles.css 的 .market-toolbar 类，跨模块 CSS 隐式耦合（清理 market 工具行 CSS 会误伤期权切换）——建议 co-locate 到 options/styles.css
  - minor (deferred): OptionsPanel.tsx:24 / options styles.css:17 陈旧注释仍写 OptionPanel
  - minor (deferred): ~30 个测试文件用 📊 行情 作 fixture 标题（无行为影响，改名勿假定单一真源）

Task 8: complete (commits 8e784ac..9fa2460, review clean — ✅ spec compliant, Approved)
  - minor (deferred): OptionsPanel.tsx:136-139 指数期权无标底回退路径无测试覆盖（构造上安全，建议补一个 HO/IO 型期权测试锁定）
  - minor (deferred): OptionsPanel 搜索也匹配 instrumentName（超出 brief 字面范围，与 ContractSearch 自身一致，无害）
  - minor (deferred): OptionsPanel 收藏按钮读共享 selectedInstrument，期货页选中会带入期权页（UX 注记，非缺陷，镜像共享 store 模式）

## Final whole-branch review (02e5625..9fa2460)

Verdict: **With fixes**. Findings to fix in ONE fix wave:
- **Critical #1**: 期货表未接 `isActive` → 跨标签订阅抢占：切 期货→期权→期货 后，期货合约进入 10s 宽限期退订且期货表不重报 → 冻结。且期权表隐藏挂载的 mount 重报可能在启动时覆盖期货可见区。修：期货表对称接 `isActive`（MarketPanel + FavoritesPage）+ 非激活时不 mount 重报 + 双面板 TabContent 切换回归测试。
- **Important #2**: 期货自选视图未排序（`sortFutures(favoriteFutures)`）。
- **Important #3**: `marketFilter.load()` 未校验形状，损坏但合法 JSON 会崩 `exchanges.length`。
- **Important #4**: OptionsPanel 与 MarketPanel 重复 ~80 行 ContextMenu/批量收藏逻辑，抽共享 hook。
- 顺带（同文件廉价 Minor）：#6 单 `setFilter` 动作、#8 复用 EMPTY_FILTER、#9 App 启动 effect 加 loadedRef 守卫、#10 sort.test 补到期日排序覆盖。

Deferred with ruling (Minor/UX, 修复波不处理，最终呈现给用户):
- #5 指数期权无期货标底时标底行被丢弃（视觉层偏离 §2「标底行仍可显示」）——合成最小 ContractInfo 标底行留作后续
- #7 class-6 缺 underlyingInstrID → '' 品种（当前数据无害）
- #11 风格/类型 nits（as number 强转、tab-bar__market 命名、跨模块 CSS、App.test spy 未 restore）
- #12 UX 注记：期权收藏按钮读共享 selectedInstrument；搜索选中期权把报单窗口定位到标底（符合「定位分组」语义但可能意外）

Final fix wave: 1a6f7bc (commit) — re-review ADDRESSED all findings (#1-#10), no new Critical/Important breakage
  - out-of-scope (minor): QuoteTable scroll/scroll-end handlers 未按 isActive 门控，隐藏面板在切换窗口内仍可上报（pre-existing，非本波引入）
  - out-of-scope (minor): setExchanges/setProducts 无生产消费者，仅 store 自测保留（API 冗余）
  - out-of-scope (minor): isActive 仍是可选 prop，未来消费者省略它仍会抢占——建议后续改必填
  - fix-introduced (minor): floating 兜底路径下 MarketPanel 的 isActive 读原始 activeTabId=false 而面板可见 → mount 上报被跳（detachTabAt 正常路径会切回 market，scroll 仍上报，影响有限；实现者 concern #3）

**Final whole-branch review: CLEAN (fixes merged into branch commits; branch NOT merged to main — user manages merges)**

## Rulings

- Ruling (Task 5): 类型模块因 Windows 大小写不敏感文件系统，`quoteTable.ts` 与 `QuoteTable.tsx` 同名冲突（`import './QuoteTable'` 会解析到小写类型模块），故类型模块命名为 `quoteTableCore.ts`，导出签名不变。**Task 6 的 optionsSpec 必须 `import ... from './quoteTableCore'`**。成本若错：Task 6 按计划名 `./quoteTable` 导入会编译失败——已在 Task 6 dispatch 中明确携带。
- Ruling (Task 5): `FavoritesPage.tsx`/`FavoritesPage.test.tsx`/`dragSelectAnchor.test.tsx` 消费 `MarketTable`，一并迁移到 `QuoteTable`（纯机械、无行为变化）。计划未列出，但不动则 build/套件失败，属必要范围扩展。
