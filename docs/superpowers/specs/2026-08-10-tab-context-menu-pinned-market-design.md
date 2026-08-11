# TabBar 右键菜单 + 行情标签固定 — 设计文档

日期：2026-08-10
分支：`feature/TobBar-right`

## 背景

当前 TabBar 标签右键菜单只有「🪟 在新窗口打开」（`handleOpenInNewWindow`）。需求：

1. **右键菜单**改为 5 项：关闭 / 关闭其他 / 关闭所有 / 固定 / 窗口化（删除「在新窗口打开」）。
2. **行情标签页**（初始页 `tab-market`，`closable: false`）：固定在左侧、不随鼠标滚轮移动、无右键菜单、无任何图标（无 × 也无 pin）、关闭其他/关闭所有不关它、不可取消固定。去掉与左边框的空白（当前 `GlobalBar` `padding-left: 16px` 造成）。

## 范围

- 前端 `frontend/src`（无后端改动）。
- 涉及：`stores/tabs.ts`、`components/TabBar/index.tsx`、`components/TabBar/styles.css`、`components/TabBar/index.test.tsx`、`stores/tabs.test.ts`、`components/GlobalBar/styles.css`（去 padding）、`components/TabContent/detachFlow.repro.test.tsx`（若引用旧右键菜单行为）。

## §1 Store 扩展（tabs.ts）

`Tab` 增加 `pinned: boolean`：

```ts
export interface Tab {
  id: string
  type: TabType
  title: string
  props: Record<string, unknown>
  closable: boolean
  pinned: boolean   // 新增：固定标签（置左 + 批量关闭跳过）
}
```

- `openTab` 新开标签 `pinned: false` 默认。
- 行情标签（初始页）保持 `closable: false`（天然被批量关闭跳过 + `closeTab` 拒绝），**不设 pinned**（用户要求不显示 📌）。
- `closeTab` 对 `pinned` 标签**仍允许关闭**（固定标签可通过右键「关闭」关闭；UI 上 × 被 📌 替换，右键菜单是唯一关闭入口）。

**新增 action**：

| action | 语义 |
|---|---|
| `closeOthers(tabId)` | 关闭除 `tabId` 外的所有 `closable && !pinned` 标签；`activeTabId` 保持 tabId |
| `closeAll()` | 关闭所有 `closable && !pinned` 标签；`activeTabId` 指向剩余第一个（固定标签或行情） |
| `togglePin(tabId)` | 切换 `pinned`（固定 ↔ 取消固定） |

- 排序：渲染时 `pinned` 标签排在前面（`[...pinned, ...unpinned]`），不改 store 数组顺序。

## §2 TabBar 布局与行情标签固定

布局结构：

```
.tab-bar (flex, align-center)
├── .tab-bar__market          ← 行情标签（初始页）：固定最左，可滚动区之外，不随滚轮
├── .tab-bar__scroll (flex:1) ← 可滚动区：pinned 靠左 + 普通标签，滚轮横滚/▾ 溢出逻辑不变
│     ├── pinned 标签们
│     └── 普通标签们
├── .tab-bar__overflow        ← ▾（有隐藏标签才显示，仅统计可滚动区标签）
├── .tab-bar__separator
└── .tab-bar__add-wrap        ← `+`
```

**行情标签（`.tab-bar__market`）渲染**：
- 从 `visibleTabs` 中**剥离** `type === 'market'` 的标签，作为独立元素渲染在 `.tab-bar__scroll` 之前。
- **不参与**滚轮、`computeTabOverflow`、▾ 溢出、隐藏判定（其 `id` 从 `scrollTabs` 排除）。
- 无 `onContextMenu`（右键不弹菜单，仅 `e.preventDefault()`）。
- 无 × / 📌 / 任何图标。
- 类名 `tab-bar__market`（复用 `.tab-bar__tab` 观感）。

**滚动区数据**：`scrollTabs = visibleTabs.filter(t => t.type !== 'market')`，并按 `pinned` 排序（`[...pinned, ...unpinned]`）。所有现有测量/滚轮/▾/隐藏逻辑改用 `scrollTabs`。

**去掉左边空白**：
- `GlobalBar/styles.css` `.global-bar { padding-left: 16px }` → `0`。
- 行情标签 `padding-left` 设 `8px`（保留少量呼吸）。

**键盘导航**（方向键/Home/End）：基于 `scrollTabs`（行情标签不参与方向键切换，始终固定在最左）。

## §3 右键菜单（5 项）

替换 `.tab-bar__context-menu` 的「在新窗口打开」，改为：

| 菜单项 | onClick |
|---|---|
| 关闭 | `closeTab(tabId)` |
| 关闭其他 | `closeOthers(tabId)` |
| 关闭所有 | `closeAll()` |
| 固定 / 取消固定 | `togglePin(tabId)`（文本按 `tab.pinned` 动态：`📌 固定` / `取消固定`） |
| 窗口化 | `detachTabAt(tabId, { x, y })` → 浮动窗（位置取菜单弹出点，尺寸 `defaultFloatingSize()`） |

**实现要点**：
- `handleContextMenu` 在 `setContextMenu` 时存入 `pinned`（菜单「固定/取消固定」文本动态化）。
- 删除 `handleOpenInNewWindow`、`isElectron` import（若不再使用）、右键菜单旧逻辑。
- 固定标签窗口化：允许（`detach` store 只拒绝 `closable:false`，不影响 `pinned`）；停靠回来仍在左侧固定区。
- 点击菜单项后 `setContextMenu(null)`。
- 行情标签上右键不出现菜单（§2 已剥离 `onContextMenu`）。

**CSS**：复用现有 `.tab-bar__context-item`；菜单项加图标 span 对齐。

## §4 测试

| 文件 | 用例 |
|---|---|
| `stores/tabs.test.ts` | `closeOthers`（跳过 pinned + closable:false，activeTabId 保持）；`closeAll`（保留固定/行情，activeTabId 指向剩余第一个）；`togglePin`（切换）；`openTab` 默认 pinned:false |
| `TabBar/index.test.tsx` | 右键菜单 5 项内容与点击行为（关闭/关闭其他/关闭所有/固定切换/窗口化 detachTabAt）；行情标签不在右键菜单出现；行情标签渲染在滚动区外（`.tab-bar__market` 存在且不在 `.tab-bar__scroll` 内）；`scrollTabs` 排序（pinned 靠左）；固定标签显示 📌、点击取消固定恢复 ×；无隐藏标签时不显示 ▾（回归） |
| 全量 | 前端全量测试 + `npm run build` |

**回归关注**：现有滚动/▾/`+` 菜单/选中合约打开等用例需随 `visibleTabs → scrollTabs` 调整；`detachFlow.repro.test.tsx` 若引用旧右键菜单行为需同步。

## 不做（Out of scope）

- 不做浏览器式固定标签收缩图标（图标不变、不缩小，用户已确认）。
- 不做固定标签拖拽排序（保留现状：拖拽 = 脱离浮动窗）。
- 不做行情标签的「取消固定」（它是初始页，永久固定）。
- 不改变 `+` 悬停选择栏、▾ 溢出、有界滚轮（这些已有行为保留，仅数据源改为 `scrollTabs`）。
- 不改变 `MAX_TABS` 上限。
