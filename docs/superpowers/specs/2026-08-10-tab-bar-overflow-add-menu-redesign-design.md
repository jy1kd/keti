# TabBar 标签栏功能重构 — 设计文档

日期：2026-08-10
分支：`feature/TabBar-refactor`

## 背景

当前 TabBar 存在两个待改进点：

1. **新增标签（`+` 按钮）**：`GlobalBar` 传入 `onAddTab={openSettings}`，点击 `+` 直接打开设置**浮动窗**。需求：悬停 `+` 时右侧弹出选择栏，可从底部功能栏的标签（报单/K线/查询/设置）中选择并**作为停靠标签页**打开。
2. **标签溢出**：多标签时 `.tab-bar` 靠 `overflow-x: auto` 产生底部细滚动条（用户称「进度条」）。需求：去掉滚动条，改用**鼠标滚轮**左右移动顶部标签；滚轮范围限制为「屏宽 + 2 个标签」；其余标签收进最右固定的 `▾` 下拉，点击展开隐藏标签列表、点击选择。

## 范围

- 前端 `frontend/src`（无后端改动）。
- 涉及：`components/TabBar/index.tsx`、`components/TabBar/styles.css`、`components/TabBar/index.test.tsx`、`components/GlobalBar/index.tsx`、`components/GlobalBar/index.test.tsx`。
- 可选复用：`.tab-bar__context-menu` / `.tab-bar__context-item` 观感。

## §1 `+` 新增标签选择栏

### TabBar 内部

- 删除 `onAddTab` prop；`+` 按钮改为**悬停展开**选择栏。
- 新增内部状态 `addMenuOpen`（`useState(false)`）。
- 选择栏锚定 `+` 按钮**正下方、右对齐向左展开**（`.tab-bar__add-menu`，绝对定位 `top:100% / right:0`）。
- 4 项映射表（**停靠标签页**，即 `useTabStore.openTab`，非浮动窗）：

| 图标+中文名 | type | title | 打开行为 |
|---|---|---|---|
| 📝 报单 | order | `📝 报单` | `openTab({ type:'order', title:'📝 报单' })` |
| 📈 K线 | kline | `📈 K线` | `openTab({ type:'kline', title:'📈 K线' })` |
| 📋 查询 | query | `📋 查询` | `openTab({ type:'query', title:'📋 查询' })` |
| ⚙ 设置 | settings | `⚙ 设置` | `openTab({ type:'settings', title:'⚙ 设置' })` |

- 点击某项：`openTab(...)`（store 自动去重：同 type+instrumentID 已开则激活现有标签；数量上限 MAX_TABS 拒绝）+ 关闭弹层。
- 弹层打开时 `+` 按钮加 `.tab-bar__add--active` 状态。

### GlobalBar

- 删除 `openSettings` 与 `onAddTab` prop；顶栏渲染 `<TabBar />`（无 props）。

### 行为细节

- **悬停开关**：`+` 与其弹层包在同一个 wrapper 中；wrapper `onMouseEnter` 开、`onMouseLeave` 关。鼠标从 `+` 移到弹层不闪断（弹层是 wrapper 子节点）。
- **键盘**：`+` 按钮可 focus；`Escape` 关闭弹层（onKeyDown）。
- **点击外部关闭**：`document` click 监听，目标不在 wrapper 内则关闭（与 GlobalBar 原 ⋯ 菜单同模式）。
- **可访问性**：弹层 `role="menu"`，每项 `role="menuitem"`；`+` 按钮 `aria-expanded`。

### CSS 新增（`TabBar/styles.css`）

- `.tab-bar__add-menu`：绝对定位，`top: 100%; right: 0;` 下拉列表观感（复用 context-menu 风格：`--bg-secondary` 底、边框、阴影、圆角）。
- `.tab-bar__add-menu-item`：`icon + label` 两 span，hover 高亮。
- `.tab-bar__add--active`：`+` 展开态高亮。

## §2 标签溢出：有界滚轮 + `▾` 下拉

### 布局结构

`.tab-bar` 变为两段：

```
[可滚动标签区（flex:1, overflow-x:hidden）] [▾ 溢出按钮（flex-shrink:0, 有隐藏标签才显示）]
```

### 有界滚轮

- `onWheel` handler（挂 `.tab-bar` 标签区）：`e.preventDefault()`，`el.scrollLeft = clamp(el.scrollLeft + deltaX + deltaY, 0, MAX_SCROLL)`。
- `MAX_SCROLL = 2 × 平均标签宽`（量化「最多比屏幕长度多两个」）。
- 平均标签宽：render 后测量首个标签 `offsetWidth`（标签宽度基本一致；`.tab-bar__tab` 有 padding、无固定 width）。

### `▾` 溢出按钮与隐藏集合

- 测量每个标签相对滚动容器的 `offsetLeft + offsetWidth`（右边缘）。
- **隐藏判定**：标签右边缘超出「视口右缘 + MAX_SCROLL」→ 隐藏，收进 `▾` 列表。
- 抽纯函数 `computeTabOverflow(tabs, containerWidth, tabWidths)` → `{ hiddenTabIds: string[] }`，单测可测（jsdom 下 mock offsetWidth）。

### `▾` 交互

- 点击 `▾` → 展开下拉列表，列出全部隐藏标签（图标 + 标题 + 激活标记）。
- 点击某项 → `setActiveTab(tabId)` + 关闭下拉。
- Escape / 点击外部关闭。
- `aria-label="溢出标签"`、`aria-expanded`。

### 重算时机

- `useEffect` 监听 `tabs` 变化 + `ResizeObserver` 监听容器尺寸。
- `requestAnimationFrame` 后测量（等标签渲染完），避免布局抖动。

### CSS 改动（`TabBar/styles.css`）

- `.tab-bar`：`overflow-x: auto` → `overflow-x: hidden`（去掉滚动条）；保留 `overflow-y: hidden`。
- 移除 `scrollbar-width: thin` 与 `::-webkit-scrollbar { height: 3px }` 规则（不再需要滚动条）。
- 新增 `.tab-bar__overflow-btn`、`.tab-bar__overflow-menu`、`.tab-bar__overflow-item`（复用 context-menu 观感）。

### Keyboard 兼容

- 现有 Home/End / 方向键逻辑保持（只切换 active 标签、不滚屏）；行为不变。
- 滚轮不干预方向键切换。

## §3 测试

| 文件 | 用例 |
|---|---|
| `TabBar/index.test.tsx` | **`+` 选择栏**：悬停显示/移出关闭、4 项内容、点击打开对应停靠标签（断言 `openTab` 以正确 type/title 调用）、Escape 关闭、点击外部关闭；**溢出**：`computeTabOverflow` 纯函数单测（mock 宽度，隐藏判定）、有隐藏标签时 `▾` 显示、点击 `▾` 展开列表、点击某项调 `setActiveTab` + 关闭、无隐藏时 `▾` 不显示；**滚轮**：wheel 事件调 `preventDefault` 且 `scrollLeft` 被 clamp（mock `scrollLeft` 读写）；**回归**：原渲染/切换/关闭/键盘导航/拖拽/无障碍用例保留（`onAddTab` 相关用例改为悬停展开语义） |
| `GlobalBar/index.test.tsx` | 删除「点击 + 打开设置浮动窗」用例；保留「渲染 TabBar」 |
| 全量 | 前端全量测试 + `npm run build` |

## 不做（Out of scope）

- 不做 `+` 选择栏的展开/收起持久化。
- 不做标签拖拽排序（保留现状：拖拽 = 脱离为浮动窗）。
- 不改 `MAX_TABS` 上限。
- 不引入新的标签类型；只开放 order/kline/query/settings 四个已有类型。
- 不做键盘触发 `▾` 下拉的选择（鼠标点击为主；`▾` 本身可 focus + Enter 展开）。
- 滚轮不跨平台配置（不区分触控板/滚轮 deltaMode；统一 `deltaX + deltaY`）。
