# Design: 自选合约重构 → 收藏夹（多夹多标签）

**日期**: 2026-08-14
**状态**: 已批准（brainstorming 设计确认）

---

## 1. 背景

当前「自选合约」是**扁平单集合**：

- `useContractsStore.favorites: ContractInfo[]` 全局一个收藏集，`userPrefs.selectedContracts: string[]` 持久化
- `useSubscriptionManager.shouldSubscribe` = 可见区 + **全部收藏（无条件后台保活）** + 锁定
- `type:'favorites'` 标签 → `FavoritesPage`（futuresSpec 平铺）；顶部菜单「⭐ 自选行情」→ 切期货页内部自选视图
- 收藏入口分散：⭐ 列（futures/options spec 末列，点击即切）、右键单选/多选、工具栏批量、搜索弹窗「收藏」按钮

问题：

1. 所有收藏混在一个集合里，无法按主题/策略分组（如「农产品」「主力活跃」「套利组」）
2. 收藏入口只能「加进唯一集合」，不能选择去向
3. 无法同时查看多个分组（只能打开一个自选页）

**目标**：把自选重构为**收藏夹**（文件夹/书签心智）：

- 用户可新建收藏夹并命名；一个收藏夹存一批合约；可建多个夹并存多批
- 收藏时可选择存入哪个/哪些收藏夹（多选、全选）
- 打开收藏夹 = 打开一个标签页 → 可同时打开多个收藏夹

---

## 2. 设计决策（brainstorming 已确认）

**决策 1 — 纯收藏夹模型，合约可同时属于多个夹。** 无隐式「默认全局收藏」；⭐ 语义变为「该合约存在于 ≥1 个夹」。

**决策 2 — ⭐ 列上下文区分：行情页弹选夹面板；夹页直接切本夹。**
- 行情页（期货/期权）：点 ⭐ → 弹「收藏夹选择面板」（预勾选所在夹，确认即对账）；填充态 = 任一夹（☆/⭐）
- 夹页：点 ⭐ → 直接切换本夹收藏态；填充态 = 在本夹

**决策 3 — 只订阅已打开的收藏夹。** 收藏不再后台保活；打开夹页（活跃）时可见区订阅 + 快照回填，秒出行情；`shouldSubscribe` 去掉 favorites → 只 = 可见区 + 锁定。

**决策 4 — 夹内按类型分段/切换。** 夹页提供 `[全部|期货|期权]` 切换；期货用 `futuresSpec`、期权用 `optionsSpec`（含标底分组）。

---

## 3. 数据模型与持久化

```ts
interface Collection {
  id: string               // 'coll-<nanoid>'
  name: string             // 用户命名
  instrumentIDs: string[]  // 加入顺序（插入序）
}
```

- `userPrefs`：`selectedContracts: string[]` **→** `collections: Collection[]`
- **迁移**（`loadCollections` 内）：`collections` 缺失/为空 且 旧 `selectedContracts` 非空 → 自动建 `{ id:'coll-default', name:'默认收藏夹', instrumentIDs: selectedContracts }`，随后清空旧字段
- 合约可同时在多个夹；夹内顺序 = 加入顺序
- 新增 **`stores/collections.ts`** 作为单一状态源：
  - state：`collections: Collection[]`（元数据）、`contractsByCollection: Record<string, ContractInfo[]>`（已解析合约）、`loaded: boolean`
  - actions：
    - `loadCollections(): Promise<void>` — 读 userPrefs + 迁移 + **union 所有夹 ID → `getInstrumentsByIds` 一次拉取 → 按夹分发** + 清理无效 ID（已下架合约从各夹剔除并回写）
    - `createCollection(name): string` — 生成 id、push、持久化
    - `renameCollection(id, name)` — 更新 + 持久化 + **同步已打开的夹标签标题**
    - `deleteCollection(id)` — 移除夹 + 持久化 + 清理 `contractsByCollection[id]`；删除确认由 UI 层负责
    - `addToCollections(instrumentIDs: string[], collectionIds: string[])` — 每个目标夹去重追加 + 持久化
    - `removeFromCollection(instrumentID, collectionId)` — 持久化
    - `removeFromAllCollections(instrumentID)` — 从所有夹移除 + 持久化
  - 派生：`isInAnyCollection(id)`、`collectionFavoritedIds(collectionId): Set<string>`
- 持久化写穿 `useUserPrefsStore`（新增 `collections` 字段，纳入现有 `saveToLocalStorage`/`loadFromLocalStorage`；单一 storage key `simnow-user-prefs`）

---

## 4. 收藏入口统一 → 「收藏夹选择面板」

**新组件 `CollectionPicker`**（modal）：

- 列出所有夹 + checkbox 多选；「全选 / 全不选」
- 「+ 新建收藏夹」输入行（回车创建并勾选）
- 单选模式含「移除全部收藏」按钮（清空该合约所有夹）
- 「管理收藏夹」链接 → 打开收藏夹管理页标签
- 点击外部 / Esc 关闭
- props：`{ isOpen, initialInstrumentIDs: string[], onClose }`；`initialInstrumentIDs.length === 1` 为单选，`>1` 为批量

**两种模式语义**：

| 模式 | 预勾选 | 确认行为 |
|---|---|---|
| 单选（1 个合约） | 该合约所在夹 | 对账：勾选且未在 → 加入；已勾选未勾 → 移除；「移除全部收藏」一键清空 |
| 批量（N 个合约） | 全部不勾选 | 把 N 个合约全部加入勾选的夹；顶部显示「已选 N 个合约」；未勾选任何夹 → toast 提示 |

**入口改造表**：

| 入口 | 现行为 | 新行为 |
|---|---|---|
| ⭐ 列（期货/期权页） | 直接切换收藏 | 弹面板（单选） |
| ⭐ 列（夹页） | — | **直接切换本夹**（不弹面板） |
| 右键单选「收藏/取消收藏」 | 切换 | 「收藏到收藏夹…」→ 弹面板；夹页为「从本夹移除」 |
| 右键多选「批量收藏」 | 全部加入唯一集合 | 「批量收藏到收藏夹…」→ 弹面板（批量）；「批量取消收藏」→ `removeFromAllCollections` 逐个（保留现状一键清） |
| 工具栏「收藏/批量收藏」 | 直接收藏 | 弹面板（单选/批量） |
| 搜索弹窗「收藏」按钮 | 直接收藏 | 弹面板（单选）；已收藏徽标 = 任一夹 |

`useContractMenus` 增加收藏模式参数：行情页 `'picker'`（打开面板），夹页 `'folder'`（本夹直切 + 移除项）；标签与 handler 随模式派生。

---

## 5. 管理页 + 夹标签页

### 5.1 标签系统改造

- `TabType`：**删除 `'favorites'`**，新增 `'collections'`（管理页）+ `'collection'`（单个夹）
- `generateTabId`：suffix 支持 `props.collectionId`（优先）→ `tab-collection-<id>`
- `openTab` 去重：扩展 type+instrumentID 匹配 → 增加 type+collectionId 匹配
- `TabContent`：`case 'collections'` → `<CollectionsPage />`；`case 'collection'` → `<CollectionPage collectionId={getCollectionId(tab.props)} tabId={tab.id} />`

### 5.2 管理页 `CollectionsPage`（📁 收藏夹）

- 顶部「+ 新建收藏夹」输入行
- 夹列表：名称 + 合约数 + `[打开]` `[重命名]` `[删除]`
  - 打开 → `openTab({ type:'collection', title:'📁 <夹名>', props:{ collectionId } })`（按 collectionId 去重，已开则激活）
  - 重命名 → 小弹窗/行内编辑；保存后同步所有已打开的该夹标签标题
  - 删除 → **确认弹窗**；仅从该夹移除合约，不影响其他夹与合约本身
- 空态：提示去行情页收藏

### 5.3 夹页 `CollectionPage`

- props：`{ collectionId, tabId }`
- 数据：从 collections store 取夹元数据 + `contractsByCollection[id]`
- 工具行 `[全部|期货|期权]` 切换（默认「全部」）：
  - 「全部」：仅含一种类型 → 单表；两种都有 → 上下两段（期货区 + 期权区，各带小标题），各用对应 spec
  - 「期货」/「期权」：单类型单表（futuresSpec / optionsSpec）
- ⭐ 列 = 本夹态（`collectionFavoritedIds`），点击直接切换
- 右键菜单：打开报单 / K线 / 查询 / 复制 + 「从本夹移除」（替换收藏项）
- 空夹态：提示「收藏夹为空，去行情页收藏合约」

### 5.4 期货页内部 `[全部|自选]` 保留

- 自选视图 = 聚合**所有夹**的期货（`favoritedIds` = 任一夹）；点 ⭐ 仍弹面板
- 顶部菜单 `market-view: 'favorites'` 语义改向 → 打开收藏夹**管理页**标签（不再切期货页内部自选）

---

## 6. 订阅调整

- `useSubscriptionManager.calculateShouldSubscribe`：**去掉 favorites** → `可见区 ∪ 锁定`
- 收藏不再后台保活；打开夹页（活跃，`isActive=true`）→ 可见区订阅 + 快照回填；切走 → 宽限期退订（与期货/期权页一致）
- 管理页不展示行情，不参与订阅
- `App.tsx` 启动加载：`loadFavoriteContracts()` **→** `loadCollections()`

---

## 7. 菜单 / IPC

- `menuTemplate.ts`：「⭐ 自选行情」→「📁 收藏夹」（label 改），action 仍是 `market-view: 'favorites'`
- `MarketPanel` `onMarketView`：`'favorites'` → 打开管理页 tab（不再 `setActiveTab('favorites')`）；`'all'` → 期货页；`'options'` → 期权页
- `App.tsx` `onNavigateTab 'favorites'` → 打开管理页 tab
- 类型面同步：`electron.ts`/`preload.ts`/`menuTemplate.ts` 中 `MarketView`/注释

---

## 8. 测试计划

| 范围 | 新增/更新用例 |
|------|---------------|
| `stores/collections.test.ts`（新） | CRUD、迁移（旧 selectedContracts → 默认夹）、无效 ID 清理回写、union 解析分发、addToCollections 去重、removeFromAllCollections |
| `userPrefs.test.ts` | `collections` 字段 save/load、迁移、旧数据兼容 |
| `CollectionPicker.test.tsx`（新） | 单选预勾选对账（勾加/取消移除）、批量只加不预勾、全选/全不选、新建夹创建并勾选、移除全部、管理链接、外部点击/Esc |
| `CollectionsPage.test.tsx`（新，重写 FavoritesPage 测试） | 新建、重命名同步已开标签标题、删除确认、打开夹去重、空态 |
| `CollectionPage.test.tsx`（新） | [全部/期货/期权] 切换、分段/单表、本夹 ⭐ 直接切、右键「从本夹移除」、多夹同时打开 |
| `useContractMenus` 相关 | picker/folder 两模式标签与 handler 断言 |
| `MarketPanel.test.tsx` | favoritedIds=任一夹、onFavoriteChange 弹面板、`onMarketView 'favorites'` 打开管理页 |
| `InstrumentSearchModal.test.tsx` | 收藏按钮弹面板、徽标=任一夹 |
| `useSubscriptionManager.test.ts` | favorites 移除后 shouldSubscribe=可见+锁定（回归） |
| `tabs.test.ts` / `TabContent` | `'collections'`/`'collection'` 类型、generateTabId collectionId、去重 |
| `menuTemplate.test.ts` | label 断言「📁 收藏夹」 |
| 既有前端 1241 + 后端 108 | 全量回归，不得回归 |

---

## 9. 验收标准（人工）

1. 顶部菜单「📁 收藏夹」打开管理页；可新建命名夹、重命名、删除（确认）
2. 行情页点 ⭐ → 弹面板选择夹（多选/全选/新建）；确认后合约进入所选夹，⭐ 点亮
3. 打开一个收藏夹 = 打开一个标签；可同时打开多个夹，各自独立
4. 夹页显示夹内合约，`[全部|期货|期权]` 切换正常；⭐ 在本夹内直接切换
5. 打开夹页即出行情（可见区订阅 + 快照回填）；关闭夹页后不再保活订阅
6. 重启应用：收藏夹结构与各夹合约保留；旧版自选数据迁移为「默认收藏夹」
7. 订阅上限不受多夹影响（只订阅打开的夹）

---

## 10. 删除项

- `FavoritesPage`（tsx/test/css）与 `'favorites'` tab type
- `userPrefs.selectedContracts`（迁移后）
- `contracts.ts` 的 `favorites` 相关 action（`loadFavoriteContracts`/`addToFavorites`/`removeFromFavorites`）与 `useSubscriptionManager` 的 favorites 依赖
