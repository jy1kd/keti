# SDD ledger — plan: docs/superpowers/plans/2026-08-14-collections-refactor.md

Workspace: `.superpowers/sdd/2026-08-14-collections-refactor`
Branch: `feature/fav-refactor`
BASE (start): `96e2d7f`（计划预检修正后 HEAD）
Spec: `docs/superpowers/specs/2026-08-14-collections-design.md`

## Pre-flight scan

| Task pair (share file/interface) | Produces → Consumes | Finding |
|---|---|---|
| T1 collections store/userPrefs ↔ T2 CollectionPicker | CRUD actions + Collection → picker 消费 useCollectionsStore | 一致 |
| T2 CollectionPicker ↔ T3 MarketPanel/OptionsPanel/InstrumentSearchModal | `{isOpen,instrumentIDs,onClose}` → 面板渲染 | 一致 |
| T1 unionFavoritedIds ↔ T3 favoritedIds | 纯函数 → 行情页 ⭐ 填充态 | 一致 |
| T3 useContractMenus 新签名 ↔ T6 CollectionPage | `favoriteMode:'folder'` → 夹页消费 | 一致（T3 定义、T6 使用） |
| T4 tabs collectionId dedup ↔ T5 CollectionsPage 打开夹 | `openTab({type:'collection',props:{collectionId}})` → 去重激活 | 一致 |
| T4 tabs/generateTabId ↔ T6 CollectionPage | `getCollectionId(tab.props)` → TabContent 渲染 | 一致 |
| T4 TabContent 去 favorites ↔ 删除 FavoritesPage | 孤儿化 → T4 内一并删除（预检裁定） | **已修**：FavoritesPage 删除移到 T4 |
| T3 面板去 contracts.favorites ↔ T7 contracts 清理 | T3 停止消费 → T7 删字段 | 一致（顺序依赖 T3→T7） |
| T1 userPrefs selectedContracts ↔ T7 移除 | T1 保留废弃字段（contracts.ts 仍消费）→ T7 与 favorites 一并删 | **已修**：T1 保留 selectedContracts |
| T7 App 启动 loadCollections ↔ T1 loadCollections | T1 定义 → T7 换调用 | 一致 |
| T3 onMarketView ↔ T8 改向 | T3 保持内部自选行为 → T8 改向管理页 | **已修**：T3 不改，T8 改 |

| Task | 自身一致性 | 发现 |
|---|---|---|
| T1 | loadCollections 测试播种方式 | **已修**：经 userPrefs.setCollections 播种（直接 set collections store 会被 loadFromLocalStorage 清空） |
| T5 | 删除确认 getByText('删除') 歧义 | **已修**：确认按钮加 data-testid="confirm-delete" |
| T6 | 右键测试无效断言（mock 无右键触发） | **已修**：mock 加 ctx-<id> 按钮，断言「从本夹移除」出现 |

预检结论：6 处计划文本缺陷已在计划文件就地修正并提交（`96e2d7f`），无跨任务架构冲突。

## Task progress

Task 1: in fix loop — review verdict: Spec ✅ compliant, task quality Needs fixes (1 Important)
  - Important #1 (fix round 1 in progress): loadCollections 空夹（all instrumentIDs 空）仍调 getInstrumentsByIds([]) → 后端回退全量市场。守卫 allIds.length===0。
  - minor (deferred): #2 loadCollections 错误路径不 set collections（store 空而 userPrefs 有元数据；loaded=true 但列表空）。最终审查分诊
  - minor (deferred): #3 addToCollections 全重复时仍 persist 写 localStorage + 推新引用（no-op 写穿）。可加 changed 标志
  - minor (deferred): #4 loadCollections 无清理时也重建对象引用（可复用 c）
  - minor (deferred): #5 迁移只内存不写回 localStorage（幂等无害，下次启动重迁移）
  - 实现者备注：丢掉了 brief 未用的 ContractInfo import（noUnusedLocals 会挂 tsc）——合理

Task 1: fix round 1/5 (1 addressed, 0 open — commits 10e9bb7..1bebddc; re-review ADDRESSED 空夹守卫 + 测试, no new breakage)
Task 1: complete (commits 96e2d7f..1bebddc, review clean + 4 deferred minors)

Task 2: complete (commits 1bebddc..4eb97ba, review clean — ✅ spec compliant, Approved)
  - 实现者修了 brief 自带 bug：init effect 依赖 collections → 模态内新建夹重置勾选；改为不依赖（eslint-disable 定向）。审查验证修复正确 + 额外收益（数组字面量重渲染不重置进行中的勾选）
  - minor (deferred): CollectionPicker 整 store 订阅无 selector（line 17），冗余重渲染；可 getState 取 actions
  - minor (deferred): init effect 去 collections 反应性——异步加载/变化不重校预勾选；今日不可达（loadCollections 无外部调用者）。**Task 3 协调注意**：启动 loadCollections 先于任何 ⭐ 点击完成，picker 打开时 collections 已加载，无实际问题
  - minor (deferred): 测试未覆盖 outside-click 关闭、全选反向、单选空勾选确认（移除全部 via 确定）、混合对账（去 A 加 B）——行为经审查确认正确

Task 3: complete (commits 4eb97ba..735fcb9, review clean — ✅ spec compliant, Approved)
  - 五个入口（⭐/单选右键/多选右键/工具栏/搜索弹窗）统一到一个 setPicker 状态；自选聚合视图用任一夹语义；onMarketView 与 contracts store 均未动（验证）
  - minor (deferred): favoriteButtonLabel 对 selectedContracts.size===1（多选来源单选）label 与 action 不一致（selectedInstrument 为 null → 显示「收藏」但打开 picker 收 1 个）——per-brief 代码，无测试覆盖
  - minor (deferred): OptionsPanel 自选聚合无直接测试（仅 MarketPanel.test 证明）
  - minor (deferred): 搜索弹窗下叠 CollectionPicker，双击遮罩双重关闭，未测试（可接受）
  - minor (informational): FavoritesPage 仍驱动旧单收藏 API——Task 4 已计划删除该页 ✓

Task 4: complete (commits 735fcb9..523a0fa, review clean — ✅ spec compliant, Approved)
  - 实现者 deviation 核实正确：TAB_TYPES 实为 13 成员（brief 列表漏了真实存在的 query-orders/query-positions），TabType 并集与 TAB_TYPES 精确一致；CollectionPage 壳解构仅 collectionId（noUnusedParameters）保 props 类型；FavoritesPage 全删零 import（仅 inert vi.mock 工厂 + 一处 JSDoc）
  - minor (deferred): useContractContextMenu.ts:23 JSDoc 仍提 FavoritesPage（陈旧文档）
  - minor (deferred): detachFlow 两测试残留 inert `vi.mock('@/pages/FavoritesPage')`（无害，可清）
  - minor (deferred): CollectionPicker.test 里 `(t.type as string)` 与「Task 4 将加入」注释已冗余

Task 5: complete (commits 523a0fa..c678ed8, review clean — ✅ spec compliant, Approved)
  - minor (deferred, plan-mandated): CollectionsPage.tsx:35 空名重命名 + blur 不退出编辑态（commitRename 空名 return 前未 setRenamingId(null)）；可加 `if (!name) { setRenamingId(null); return }`
  - minor (deferred): 测试未覆盖 Escape 取消、blur 提交、空名 no-op
  - minor (deferred): 删除弹窗打开时夹被删 → 「undefined」名（本 UI 不可达）
  - minor (deferred, 供全分支审查): 删除夹不关闭已开的该夹标签页（死标签）；spec 只要求重命名同步标题，删除不要求关标签——超范围，最终审查分诊

Task 6: complete (commits c678ed8..f3df73d, review clean — ✅ spec compliant, Approved; 中途 API 502 中断已 resume 收尾)
  - minor (deferred, **评审确认 merge 前值得修**): 批量从本夹移除双重相同 toast——useContractMenus folder 多选项内部 toast + CollectionPage onRemoveFromFolderBatch 又 toast（CollectionPage.tsx:83 删即可，hook 已拥有）。列入最终修复波候选
  - minor (deferred): 新逻辑零覆盖——期权段展平 optionRows、可见区并集 reportVisible、批量从本夹移除、「收藏到本夹」加分支、isActive；并集逻辑是任务最险环节
  - minor (deferred, plan-mandated): 空态混淆「夹为空」与「contracts 未加载」（memberContracts 空即显示收藏夹为空）；可加 isLoaded 区分

Task 7: complete (commits f3df73d..b3a4c20, review clean — ✅ spec compliant, Approved)
  - 全部删除到位；迁移读保留精确；App 启动换 loadCollections；6 个额外测试文件编辑纯机械
  - minor (deferred, 供最终审查): services/types.ts:371-375 `UserPreferences.selectedContracts` 真死类型未删（brief grep 要求命中即删/合法；非本任务文件列表）。最终修复波候选
  - minor (deferred): 新「收藏不再自动订阅」回归测试偏窄——旧代码下也会过（未种子 useContractsStore.favorites），不钉死契约；可加可见合约+收藏合约并集断言
  - minor (informational): 报告计数误差（TradeParams 8 vs 实际 5）——编辑本身正确

Task 8: complete (commits b3a4c20..fa4290e, review clean — ✅ spec compliant, Approved)
  - 前端 1302 + tsc + build 全绿；后端 13 失败为 main 既有（server/api/connection.py 无 connect_ctp 符号，测试仍 patch；分支对 server/ 零改动，审查独立核实）
  - 额外提交 menuManager/trayManager 测试 + dist-electron 产物：核实为 npm test 门必需 + git-tracked + 有 d517579 先例 ✓
  - minor (deferred): MarketPanel.test view=favorites 未断言 activeTabId==='tab-collections'（plan 约定如此，非缺陷）
  - minor (deferred): dist-electron 是已提交产物，npm run build 不重新生成（仅 electron:compile）——先例既有，未来源改可能漂移

## 全部 8 任务完成（96e2d7f..fa4290e）

## Final whole-branch review (1a0068f..fa4290e)

Verdict: **With fixes** — 4 FIX BEFORE MERGE（1 个升 Important：loadCollections 错误路径防覆盖数据丢失）+ 全部其余 deferred 分诊为「可后置」。

Final fix wave: commit bb1344e — re-review ADDRESSED all 4 (#1-#4), no new Critical/Important breakage. 分支 CLEAN。
  - 全量 1304/1305；唯一失败 = electron/__tests__/main.test.ts 5s 超时 flake（隔离 3/3 过，本分支只动 src/）——pre-existing
  - 后端 13 失败 = main 既有（connect_ctp 符号已删、测试仍 patch，server/ 零改动）——pre-existing，非本分支
  - 剩余 deferred（post-merge 候选）：T1 错误路径数据丢失已修；其余为 perf/卫生/测试补强（no-op persist、对象复用、迁移写回、整 store 订阅、favoriteButtonLabel 角、OptionsPanel 自选测试、JSDoc/vi.mock 残留、blank-rename blur、delete-confirm 覆盖、并集/期权段测试、空态混淆、窄回归测试、activeTabId 断言、dist-electron 漂移）

## 迭代轮（用户 4 项）— 2026-08-14

用户提出 4 项迭代，设计确认后直接实现（inline TDD）：

| # | 提交 | 内容 |
|---|------|------|
| #3a+#3b | `23a5bd6` | vtable 卸载延迟 release（RO 竞态崩溃）+ TabContent 切标签 blur aria-hidden 焦点 |
| #1 | `75d8784` | 去除行情页 [全部|自选] 内部视图（期货/期权只显示全部） |
| #2 | `78cd38e` | 收藏夹 hover 快速入口（顶栏 📁 + `+` 菜单项两入口）+ 打开改悬浮窗（openCollectionFloating） |
| #4 | `e503029` | 后端 13 个陈旧测试修复（connect_trading/trader_api/档数/preset/stopOrders） |

- 前端 1309/1309 + tsc clean + build 成功；后端 736 passed（原 723+13）
- 用户决策：hover 入口 = 顶栏常驻按钮 + `+` 菜单项（1+2 都要）
- 后端修复均为陈旧测试（登录重构 07a08d9 后未同步 + 3 处响应形状变更）——非本功能引入，用户明确要求解决

## Rulings（完整清单，供收尾报告）

1. **T1 保留废弃 selectedContracts**（contracts.ts 收藏 action 仍消费；T7 与 favorites 一并删）——成本若错：T7 需同删 userPrefs + contracts 两处
2. **T4 一并删 FavoritesPage**（Task 4 孤儿化 + TabType 移除后类型错误；T7 只做订阅/contracts/App 清理）——成本若错：T4 提交含删文件，T7 不再重复
3. **T3 不改 onMarketView**（内部自选视图保留；T8 改向管理页）——成本若错：T3-T8 间菜单行为与旧一致
4. **T1 loadCollections 测试经 userPrefs 播种**（loadCollections 从 userPrefs 读，直接 set store 会被清）——成本若错：测试不覆盖真实读取路径
5. **T5 删除确认按钮加 data-testid="confirm-delete"**（getByText('删除') 歧义）——成本若错：无
6. **T6 加强 QuoteTable mock 右键触发 + 有效断言**（原断言无效）——成本若错：右键菜单无回归防护
7. **spec 偏差：contractsByCollection 解析图移除**，夹内合约从全局 contracts store 派生（避免增删夹后陈旧缓存）；loadCollections 仍用 getInstrumentsByIds 校验清理——成本若错：若全局 contracts 未加载，夹页短暂缺行（启动时序保证）
8. **Task 6 空夹守卫修 brief 自带 bug**（init effect 依赖 collections 重置勾选）——实现者修，审查核实正确
9. **T7 grep 命中 UserPreferences 死类型 deferred** → 最终审查升 FIX BEFORE MERGE → 修复波已清
10. **后端 13 失败 / electron 1 flake 均 pre-existing**（server/ 零改动 + 隔离过）——不阻塞本分支
