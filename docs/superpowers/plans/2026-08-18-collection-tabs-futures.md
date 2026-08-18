# 期货页收藏夹 Tab（2026-08-18）

## 背景

期货页（MarketPanel）目前收藏夹入口只有工具栏下拉 `CollectionFilterSelect` + 表格 ⭐ 列。切换收藏夹需「展开下拉→选夹」两步，看不到每个夹的名称+数量全貌。收藏夹数量动态（可增删），需支持 0/1/多/超多场景。

## 决策（已与用户确认）

1. **用 Tab 条替换期货页工具栏下拉**（查询页/期权页下拉不动）
2. **⭐ 列「本夹视角」**：选中某收藏夹 Tab 时，⭐ 仅反映本夹内、点 ⭐ 直接切本夹；「全部」Tab 下维持现状（弹选夹面板）
3. **单行横滚 + 省略截断**：夹多/窄屏时横滚，夹名截断
4. **放置：内联于筛选那一行**（工具栏内，筛选按钮与搜索框之间），不单独占一行（用户 2026-08-18 调整）

## 目标交互

```
[ 筛选 | 全部 | 📁 自选(12) | 📁 黑色金属(8) …  ... ]   [ 搜索🔍 ]
   └──────── 同一工具栏行（收藏夹条自然宽，夹多时内部横滚） ────────┘
```

- 首 Tab「全部」= 不限收藏夹（value=''）
- 每夹 Tab = 夹名 + 合约数角标
- 选中状态走现有 `futuresCollectionId`（持久化，刷新保持）
- 0 个夹 → 整条隐藏

## 数据/过滤

- 点击 Tab → `useMarketFilterStore.getState().setCollectionId('futures', id)`
- 过滤完全复用现有 `filterByCollection` + `futuresCollectionId` 链路，**零新增过滤逻辑**
- stale-id 回退：`collectionId` 不在 `collections` 中 → 自动回退 ''(全部)
- 重命名/增删夹 → store 驱动实时同步

## ⭐ 列本夹视角

| 当前 Tab | 表格 favoritedIds | 点 ⭐ | 右键收藏项 |
|---|---|---|---|
| 全部 | `unionFavoritedIds`（任一夹即亮） | 弹选夹面板（现状） | picker 模式（现状） |
| 某收藏夹 | `collectionFavoritedIds(本夹)` | 直接切本夹（remove/add） | folder 模式 |

实现：MarketPanel 内计算 `favoritedIds` + `favoriteMode` 传给 QuoteTable / useContractMenus。`futuresSpec` / `QuoteTable` 零改动。

## 改动文件

| 文件 | 动作 |
|---|---|
| `frontend/src/modules/market/CollectionFilterTabs.tsx` | **新增**（页面无关，props: value/onChange，读 useCollectionsStore） |
| `frontend/src/modules/market/styles.css` | 新增 tab 条样式（工具栏内联：自然宽 + 收缩横滚 / pill / active / 角标） |
| `frontend/src/modules/market/MarketPanel.tsx` | 工具栏内移除下拉 → 插入 Tab 条（筛选与搜索之间）；stale-id 回退 effect；⭐/右键按当前夹切换 picker↔folder |
| `frontend/src/modules/market/CollectionFilterTabs.test.tsx` | **新增**：渲染/角标/点击/0 夹隐藏/active/stale 回退 |
| `frontend/src/modules/market/MarketPanel.test.tsx` | 更新：tab 条集成、⭐ 本夹视角交互 |

## 测试要点（TDD）

1. CollectionFilterTabs：0 夹不渲染；多夹渲染 + 角标正确 + 点击 onChange + active 高亮
2. MarketPanel：切 Tab 过滤生效；本夹视角 ⭐ 在夹内亮/点击移除；「全部」下弹选夹面板
3. 回归：期权页 / 查询页收藏夹下拉不受影响