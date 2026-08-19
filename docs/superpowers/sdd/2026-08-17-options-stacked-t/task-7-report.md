## Task 7: OptionsPanel 组头 ⭐ 系列收藏（P2） — 完成报告

### 状态
DONE

### Commit
- `fcda953` feat(options): 组头 ⭐ 系列收藏（P2）

### 变更文件
| 文件 | 变更 |
|------|------|
| `frontend/src/modules/options/OptionChainGroup.tsx` | 新增 `isFavorited` / `onToggleFavorite` 可选 props；组头右侧渲染 ★/☆ 按钮（stopPropagation，不触发折叠） |
| `frontend/src/modules/options/OptionsPanel.tsx` | 新增 `pickerSeries: string[] \| null` 状态；`unionSerializedIds(collections)` 计算 `favoritedSeriesIds`；每组透传 `isFavorited` + `onToggleFavorite`；渲染第二个 `<CollectionPicker seriesIDs={pickerSeries} />` |
| `frontend/src/modules/options/OptionsPanel.test.tsx` | 新增 3 个测试：⭐ 打开 series 模式 picker、已收藏显示 ★、未收藏显示 ☆ |

### 测试汇总
- OptionsPanel.test.tsx: 17/17 pass（14 existing + 3 new）
- OptionChainGroup.test.tsx: 4/4 pass（无破坏）

### 实现细节
- `OptionChainGroup` 的 `onToggleFavorite` 回调参数为 `seriesID`（即 `group.underlyingID`），点击时 stopPropagation 防止触发折叠
- `OptionsPanel` 用两个独立 `CollectionPicker` 实例：一个用于合约模式（高级搜索弹窗入口），一个用于系列模式（组头 ⭐ 入口）
- `favoritedSeriesIds` 通过 `useMemo(() => unionSerializedIds(collections), [collections])` 计算，确保集合变更时组头填充态实时更新
- `CollectionPicker` 接收 `seriesIDs` prop 后自动切换为系列模式（Task 6 已实现），无需额外修改

### Concerns
- 无
