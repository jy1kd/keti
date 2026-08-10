# 底部状态栏改造 — 设计文档

日期：2026-08-10
分支：`feature/top-tab`

## 背景

当前布局（`App.tsx`）：

```
.app（flex 列）
├── GlobalBar（40px 顶栏）── 左 ConnectionStatus / 中 TabBar / 右工具
├── #floating-overlay
├── main.tab-main（flex:1）── TabContent
└── FloatingWindows
```

GlobalBar 一行承载三层：连接状态（MD/TD）、工作区标签、全局工具。

需求：
1. 将 GlobalBar 中除「打开的行情/报单标签」（TabBar）之外的内容 —— MD/TD 连接状态 + 全部工具按钮 —— 移到应用底部，形成全局常驻的底部状态栏。
2. 工具按钮除图标外，补充功能中文名。
3. 去掉 ⋯「更多」菜单，原菜单内容（FPS 监控 / 网络监控）直接平铺为工具按钮。
4. 工具区加 `>`/`<` 箭头按钮，点击切换「全部展开 / 全部隐藏」，并带展开/收起动画。
5. 修复行情表底部进度条 bug：行情表行数过少时，横向进度条「跑到上边去」不贴视口底部。使其与底部位置绑定，始终钉在表格视口底部。

## 范围

- 前端 `frontend/src`（无后端改动）。
- 涉及：`components/GlobalBar/`、`components/BottomBar/`（新建）、`App.tsx`、`utils/vtableTheme.ts`、`modules/market/MarketTable`（间接，共享常量）、`modules/options/TQuoteTable`（间接，共享常量）。

## §1 组件结构与 App 布局

```
App.tsx (.app flex 列)
├── <GlobalBar />              ← 顶栏：瘦身为只含 TabBar（打开的行情/报单标签）
├── <div id="floating-overlay" />
├── <main class="tab-main"><TabContent /></main>
├── <BottomBar />              ← 新底栏：连接状态 + 带中文名的工具按钮
└── <FloatingWindows />
```

### GlobalBar 瘦身（`components/GlobalBar/index.tsx`）

- 删除 `ConnectionStatus` import 与 JSX、整个 `.global-bar__tools` 区（📝📈📋⚙⋯ / FPS 徽标 / ⋯菜单）。
- 删除 `openOrder`/`openKline`/`openQuery`/`openIpcMonitor` 与 `moreOpen` 菜单状态、点击外部/Escape 关闭逻辑。
- 保留 `<TabBar onAddTab={openSettings} />`（`+` 按钮仍开设置）；顶栏高度保持 40px，z-index 20。
- 迁移后的 `perfVisible`/`onTogglePerf` props 改由 `BottomBar` 接收。

### BottomBar（新建 `components/BottomBar/index.tsx` + `styles.css` + `index.test.tsx`）

```
BottomBar (.bottom-bar, height 40px, border-top, flex-shrink:0, z-index:20)
├── 左区 .bottom-bar__left
│   └── <ConnectionStatus />   ← MD/TD 指示灯（原样迁移）
├── 中区 .bottom-bar__tools    ← 工具按钮，每个 = 图标 + 中文名
│   ├── 📝 报单        ← openOrder
│   ├── 📈 K线         ← openKline
│   ├── 📋 查询        ← openQuery
│   ├── ⚙ 设置        ← openSettings
│   ├── ⚡ FPS 监控    ← toggle（perfVisible 激活态 + 内联 FPS 徽标）
│   └── 🔌 网络监控    ← openIpcMonitor
└── 右端 .bottom-bar__toggle   ← 箭头按钮 `>` / `<`
```

- props：`perfVisible`、`onTogglePerf`（与 GlobalBar 原签名一致）。
- 从 GlobalBar 迁移：`openSettings`/`openIpcMonitor`/`openQuery`/`openOrder`/`openKline` + FPS 徽标（`<PerfMonitor visible />`）。
- 工具按钮渲染：`icon + label` 两个 span，保留 `aria-label`/`title` 可访问性。

## §2 箭头展开/收起

**`>`/`<` 箭头切换逻辑**：
- 展开态（默认）：工具区全部显示，箭头显示 `<`，点击 → 收起。
- 收起态：工具区整体隐藏（宽度→0 + 淡出 + `pointer-events:none`），箭头显示 `>`，点击 → 展开。
- 本地 useState（默认展开，不持久化）。

**动画**（CSS transition）：
```css
.bottom-bar__tools {
  overflow: hidden;
  white-space: nowrap;
  transition: max-width .3s ease, opacity .25s ease;
}
.bottom-bar__tools--collapsed {
  max-width: 0;
  opacity: 0;
  pointer-events: none;
}
```

- 展开/收起仅切换 `--collapsed` 类，宽度与透明度平滑过渡。
- jsdom 测试断言状态类与箭头符号，不做真实动画断言。

## §3 行情表进度条绑定（bug 修复）

**根因**（vtable 1.26.4 `updateScrollBar`）：横向进度条默认 `barToSide` 为空时 Y = `min(视口高, 内容高)`。行情表行数少 → 内容高 < 视口高 → 进度条贴在最后一行下面，远离视口底部。

**修复**：共享常量加 `barToSide: true`：
```ts
// frontend/src/utils/vtableTheme.ts
export const PROMINENT_SCROLL_STYLE = {
  scrollSliderColor: '#4a9eff',
  scrollRailColor: '#21262d',
  width: SCROLLBAR_SIZE,
  visible: 'always' as const,
  barToSide: true,          // ← 新增：进度条永远钉在表格视口底部
}
```

- 行情表（MarketTable）+ T型期权表（TQuoteTable）共用此常量，两处同时修复，观感一致。
- 行为变化：进度条不再跟内容跑，始终停靠在表格底部边缘（正对底部状态栏上方）。

## §4 测试

| 文件 | 改动 |
|---|---|
| `GlobalBar/index.test.tsx` | 删除连接状态/工具/菜单/FPS 用例；保留「渲染 TabBar」「不渲染应用标题」 |
| `BottomBar/index.test.tsx`（新建） | 迁移连接状态、工具、FPS/网络监控用例；新增「按钮含图标+中文名」「箭头展开/收起切换 + collapsed 类」「默认展开」 |
| `App.test.tsx` | 「显示 MD/TD」断言迁至 BottomBar 渲染上下文；确认顶栏 TabBar 存在 |
| `MarketTable.test.tsx` | 新增 `barToSide === true` 断言 |
| `TQuoteTable.test.tsx` | 新增 `barToSide === true` 断言 |

前端全量测试 + `npm run build` 通过。

## 不做（Out of scope）

- 不改连接状态数据流（useSystemWs / useConnectionPoll / connection store 不动）。
- 不做展开/收起状态持久化（localStorage）。
- 不改变 TabBar 拖拽分离 / 浮动窗口 / 右键菜单行为。
- 不改 FLOATING_CHROME_H 与浮动窗口定位（浮动窗独立 fixed 定位，不受底栏影响）。
- 顶栏不引入新的全局工具（`+` 仍开设置，语义保留）。
