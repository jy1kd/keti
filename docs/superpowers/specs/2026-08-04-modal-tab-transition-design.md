# Design: 弹窗与标签页的丝滑转换

**日期**: 2026-08-04
**状态**: 已批准

---

## 1. 背景与目标

当前前端存在两套并行的内容展示形态：

- **标签页**（`TabBar` / `TabContent` + `stores/tabs.ts`）：7 种类型，`market` 固定不可关，其余可关闭。
- **悬浮弹窗**（`OrderPopup` / `QueryPopup`，非模态，`position: fixed`，z-index 1500，标题栏可拖拽）：报单弹窗按合约、查询弹窗全局。

用户希望两套形态**互相转换**，且转换过程平滑（丝滑）：

1. 悬浮弹窗增加「放大」按钮，放大后自动转换为标签页；
2. 拖动标签页的「导航栏」自动变为弹窗展示（两种手势：拖标签栏里的标签、拖页面内容自身的标题栏）。

### 已确认的决策

| 决策点 | 结论 |
|--------|------|
| 作用范围 | 仅 OrderPopup / QueryPopup 两个悬浮弹窗（不含 InstrumentSearchModal 居中模态） |
| 拖拽手势 | 拖标签栏里的标签 + 拖页面内容标题栏，两种都支持 |
| 内容模型 | 弹窗放大后统一到现有标签页布局（报单→OrderPage，查询→新建 `query` 标签页渲染 QueryPanel） |
| 固定标签 | `market` 主区标签不可拖出成弹窗 |

---

## 2. 架构总览

**核心思想：统一「内容宿主」模型。** 一份内容（一个标签）只有两种状态——`docked`（停靠）或 `floating`（悬浮）。转换只改变宿主，**内容组件实例全程保活**（K线 ECharts 实例、vtable 滚动、页面本地 state 均不重挂载），这是「丝滑」的根基。

```
tabs (stores/tabs.ts)                floatingWindows (stores/floatingWindows.ts)
┌───────────────────────┐            ┌────────────────────────────┐
│ tabs: Tab[]           │            │ windows: Record<tabId, {x,y,w,h,z}> │
│  ├ 每个 Tab 有 id/type │◄──派生──►  │  ├ detach(tabId, rect)      │
│  │ title/props/closable│            │  ├ dock(tabId)              │
│  └ activeTabId        │            │  ├ move / resize / focus    │
└──────────┬────────────┘            └────────────┬───────────────┘
           │ 停靠时内联渲染                         │ 浮动时提供几何坐标
           ▼                                       ▼
   TabContent（渲染全部面板）          FloatingWindows（渲染 chrome 壳）
   浮动面板 → position:fixed 位移         浮动面板 DOM 盖在壳上
```

- **内容渲染一次**：`TabContent` 仍渲染所有面板；浮动面板通过 `position: fixed` 脱离主区布局流，视觉上落在对应浮动窗口壳上。
- **窗口壳是轻量 chrome**：只画标题条（拖拽/停靠/关闭）+ 右下角缩放柄，不渲染业务内容。

---

## 3. 数据模型

### 3.1 `stores/tabs.ts` — 新增 `query` 类型

```ts
export type TabType =
  | 'market' | 'favorites' | 'order' | 'kline'
  | 'options' | 'ipc-monitor' | 'settings'
  | 'query'          // 新增

// renderTabContent 新增 case：
case 'query': return <QueryPanel />
```

`query` 为全局账户查询（非按合约），`openTab({ type: 'query', title: '📋 查询' })` 去重 id 为 `tab-query`。

### 3.2 `stores/floatingWindows.ts` — 新建

```ts
interface FloatingRect { x: number; y: number; w: number; h: number; z: number }

interface FloatingWindowStore {
  windows: Record<string /* tabId */, FloatingRect>
  /** 悬浮一个标签；固定标签（closable:false）拒绝。返回是否成功 */
  detach(tabId: string, rect: FloatingRect): boolean
  /** 停靠回标签栏（移除窗口坐标） */
  dock(tabId: string): void
  /** 拖标题条移动窗口 */
  move(tabId: string, pos: { x: number; y: number }): void
  /** 右下角缩放 */
  resize(tabId: string, size: { w: number; h: number }): void
  /** 点击窗口置顶（z 递增） */
  focus(tabId: string): void
}
```

**为何独立 store**：窗口几何态（坐标/尺寸/z）是 UI 状态，与标签语义解耦，便于单独测试。

---

## 4. 内容承载：CSS 位移（无 Portal、无重挂载）

`TabContent` 渲染全部标签面板，浮动标签的面板用内联样式位移：

```tsx
// TabContent 每个面板
const floating = useFloatingWindowStore((s) => s.windows[tab.id])

style={{
  display: floating ? 'block' : (isActive ? 'block' : 'none'),
  ...(floating && {
    position: 'fixed',
    left: rect.x,
    top: rect.y + CHROME_H,      // 面板落在窗口 chrome 之下
    width: rect.w,
    height: rect.h - CHROME_H,
    zIndex: rect.z,
  }),
}}
```

要点：

- 浮动面板 `display: block` 覆盖掉「非活跃隐藏」逻辑（`display: none`），即使它不是活跃标签也可见。
- `position: fixed` 使面板脱离 `.tab-content` 布局流，不占位。
- 组件 React 树位置不变 → **实例保活**。
- 浮动面板加 `tab-content__panel--floating` 类，提供边框/圆角/阴影/背景，构成窗口的视觉主体。

`CHROME_H = 32px`，与窗口壳标题条高度一致。

---

## 5. 浮动窗口 `components/FloatingWindow`（新建）

轻量 chrome 壳，**不渲染业务内容**（业务内容由 CSS 位移的面板盖上来）。

结构：

```
┌──────────────────────────────────────┐
│ 📈 K线-IF2608          [⇩] [×]       │ ← 32px 标题条（拖拽移动）
├──────────────────────────────────────┤
│          （透明 body，面板盖在上面）    │
│                                       │
└──────────────────────────────────┘   │
  ┌─ ResizeHandle（右下角缩放）──────────┘
```

- 标题条：tab 标题 + `⇩` 停靠（`dock`）+ `×` 关闭（`closeTab`，与标签生命周期一致）。
- 拖标题条 → `move()`；`pointerdown` → `focus()` 置顶。
- 右下角复用现有 `components/ResizeHandle` → `resize()`。
- z-index：标题条与面板**上下相邻不重叠**（面板 `top = rect.y + CHROME_H`），故壳整体 `z` 取 `rect.z - 1` 即可，面板视觉盖在壳 body 上、标题条控件始终可点。

`App.tsx` 增加 `<FloatingWindows />`：遍历 `windows` 表，为每个 tabId 渲染 `<FloatingWindow>`，从 `tabs` 读取标题，从 `windows` 读取几何。

---

## 6. 拖拽手势 `hooks/useDetachDrag.ts`（新建，两种手势共用）

```
pointerdown → 记录起点（若 target 是 button/select/input/a 或 [data-no-drag]，忽略）
pointermove 移动 > 6px 阈值 → 进入「脱离中」：
              ghost 跟随光标（标签栏拖 = 药丸克隆；页面标题栏拖 = 整块内容克隆）
pointerup   → 若已脱离：detach(tabId, 光标处默认尺寸) + FLIP 落位 + 清理 ghost
              否则：按普通点击处理（标签切换等）
pointercancel / Esc → 取消，清理 ghost
```

- **默认窗口尺寸**：`min(900, 90vw) × min(620, 80vh)`，夹取到视口内。
- **标签栏手势**：`TabBar` 每个可关闭（非 market）标签绑定 `useDetachDrag`；阈值区分「点击切换」与「拖离」。浮动标签从标签栏隐藏（浏览器式）。
- **页面标题栏手势**：各页顶部条加 `data-drag-handle` 属性（约 7 处小改：OrderPage / KLinePage 内容 / FavoritesPage / SettingsPage / IPCMonitorPage / MarketPanel 头部 / QueryPanel），CSS `cursor: grab`；在 `TabContent` 层用事件委托统一绑定。market 标签虽禁拖，但保留 handle 无副作用。
- **拖离活跃标签**：若被拖标签是活跃标签，`detach` 后自动切活跃到 market 标签，保证主区不空。

---

## 7. 动画：手写 FLIP（无新依赖）

`hooks/useFlip.ts`：源节点 + 起止 rect → transform 插值（约 220ms，ease-out）。三步：First（记起 rect）→ 反向 transform（invert）→ 播放（transform 归零）。

- **弹窗→标签（⤢ 放大）**：捕获弹窗 rect → `openTab` → 等面板挂载（rAF）测面板 rect → 弹窗元素 FLIP 到位 → 末端交叉淡化 → 关闭弹窗。弹窗内容按决策 B 切换为标签布局。
- **标签→弹窗（拖出）**：ghost 跟手 → 松手 `detach` → 面板 fixed 落位于光标 → FLIP 从原 docked rect 补一帧 → ghost 淡出。
- **⇩ 停靠**：捕获窗口 rect → `dock`（`floating=null`）→ 测内联 rect → 反向 FLIP 归位。

---

## 8. 弹窗放大按钮

`OrderPopup` / `QueryPopup` 标题栏各加 `⤢` 按钮（置于标题与 `×` 之间）。

- `OrderPopup` ⤢ → `openTab({ type: 'order', title: '📝 报单-{id}', props: { instrumentID } })`
  - 与平仓流 `order` 标签同 id（`tab-order-{instrumentID}`）去重，同合约直接激活。
  - 报单表单状态已在 `useOrderStore`，天然共享。
- `QueryPopup` ⤢ → `openTab({ type: 'query', title: '📋 查询' })`
- `openTab` 返回 `false`（15 标签上限）→ `toast` 提示 + 弹窗保持打开。

---

## 9. 边界情况

| 场景 | 处理 |
|------|------|
| 固定 market 标签被拖出 | `detach` 直接返回 false（守卫在 store） |
| 拖离活跃标签 | 活跃自动切到 market |
| 窗口尺寸越界 | 夹取到视口内 |
| `position: fixed` 受祖先 `transform` 影响 | 确认 `.tab-content` / `.app` 无 transform；若有则改用该祖先作定位上下文 |
| 多窗口重叠 | 点击窗口 `focus()` 置顶，z 递增 |
| 页头内按钮/输入框 | 事件委托过滤，不触发拖拽 |
| 拖拽中途 pointercancel / Esc | 取消并清理 ghost |
| 15 标签上限时放大 | toast 提示，弹窗保持 |
| 浮动标签关闭（×） | 走 `closeTab`，标签与窗口一并销毁（与标签生命周期一致） |

---

## 10. 测试

- **单元**：`floatingWindows` store — detach/dock/move/resize/focus、固定标签拒绝、去重。
- **单元**：`tabs` store — `query` 类型新增、`openTab` 去重。
- **组件**：`TabContent` — 浮动面板 fixed 定位、非活跃浮动标签可见、`--floating` 类；`TabBar` — 拖拽阈值与点击切换区分、浮动标签隐藏；`FloatingWindow` — 停靠/关闭/缩放/置顶；`OrderPopup`/`QueryPopup` — ⤢ 按钮调用 openTab、上限 toast。
- **Hook**：`useDetachDrag` 指针事件模拟（阈值内 = 点击、超阈值 = 脱离、交互元素忽略、cancel 清理）；`useFlip` rect 数学。
- **回归**：现有 469 个前端单测全绿。

---

## 11. 改动文件清单

| 文件 | 改动 |
|------|------|
| `stores/floatingWindows.ts` | 新建 |
| `stores/tabs.ts` | 新增 `query` 类型 |
| `components/FloatingWindow/index.tsx` + styles | 新建（chrome 壳） |
| `components/TabContent/index.tsx` + styles | 浮动面板 CSS 位移 + `data-drag-handle` 事件委托 |
| `components/TabBar/index.tsx` | 标签拖拽脱离、浮动标签隐藏 |
| `hooks/useDetachDrag.ts` | 新建（共用拖拽） |
| `hooks/useFlip.ts` | 新建（FLIP 动画） |
| `modules/order/OrderPopup.tsx` + css | ⤢ 按钮 |
| `modules/query/QueryPopup.tsx` + css | ⤢ 按钮 |
| `modules/query/QueryPanel.tsx` | 验证/适配标签页内填满（高度 100%） |
| `App.tsx` | 渲染 `<FloatingWindows />` |
| 约 7 处页面头部 | 加 `data-drag-handle` 属性 + `cursor: grab` |

---

## 12. 非目标（YAGNI）

- 标签栏内拖拽排序（另一特性）。
- 原始弹窗（OrderPopup/QueryPopup）本身的可缩放。
- 浮动窗口位置的持久化（会话内有效，不落 localStorage）。
- 键盘快捷键拖出。
- InstrumentSearchModal（居中模态）的放大转换。
