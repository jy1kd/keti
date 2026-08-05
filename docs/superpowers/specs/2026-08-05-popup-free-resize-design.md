# Design: 弹窗自由调整大小

**日期**: 2026-08-05
**状态**: 已批准

---

## 1. 背景与目标

上一份设计 [2026-08-04-modal-tab-transition-design.md](./2026-08-04-modal-tab-transition-design.md) 实现了标签页⇄弹窗互相转换，但明确把"原始弹窗本身的可缩放"列为非目标。本次补上它：

所有可做标签页⇄弹窗转换的弹窗，支持**从任意边/角自由调整大小**：

| 弹窗 | 现状 | 目标 |
|------|------|------|
| `FloatingWindow`（脱出标签的浮动窗口） | 仅右下角一个缩放柄，只改 w/h（左上角锚定），最小 320×200 | 8 方向缩放（n/s/e/w + 四角），从边/角拖动时窗口在对应方向移动 |
| `QueryPopup` / `OrderPopup`（悬浮查询/报单弹窗） | 无任何缩放，固定尺寸（880×620 / 740×auto） | 8 方向缩放 |

### 已确认的决策

| 决策点 | 结论 |
|--------|------|
| 作用范围 | `FloatingWindow` + `QueryPopup` + `OrderPopup`（三者均可标签页⇄弹窗转换） |
| 实现路线 | 复用现有手写拖拽模式与 `ResizeHandle` 组件，不引入第三方库、不用 CSS `resize` |
| 尺寸记忆 | **不记忆**。QueryPopup/OrderPopup 每次打开回到默认尺寸；FloatingWindow 尺寸随窗口生命周期存在于 store（会话内） |
| 最小尺寸 | FloatingWindow 320×200；QueryPopup 480×320；OrderPopup 680×400 |

---

## 2. 架构总览

**核心思想：一个统一的缩放手势入口 + 一个通用的 8 方向手柄组件，各处接线复用。**

```
指针事件 (pointerdown/move/up)
      │
      ▼
utils/resizeDrag.ts  startResizeDrag({ dir, rect, minW, minH, onResize })
      │  按方向计算新矩形 + min/视口钳制 + Esc/pointercancel 取消
      ▼
onResize({x,y,w,h})
      ├── FloatingWindow → floatingWindows store.resize(tabId, rect)
      │                     → chrome 壳 + TabContent 内容区自动跟随
      └── QueryPopup / OrderPopup → 局部 state（size + position）重渲染
```

- **手柄外观**：增强 `components/ResizeHandle`，`direction` 支持 8 向，对应 CSS 8 种 cursor。
- **缩放数学**：集中在 `utils/resizeDrag.ts`，纯函数式可单测，与 `utils/detachDrag.ts` 的指针事件模式一致。
- **内容与壳分离**（FloatingWindow 沿用现有模型）：壳只画标题条 + 手柄，业务内容由 `TabContent` 的 fixed 面板盖上来；store 更新 rect 后壳与内容**自动同时跟随**，无需改 TabContent。

---

## 3. `components/ResizeHandle` 增强

### 3.1 `direction` 扩展

```ts
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
```

- 旧值 `'horizontal' | 'vertical'` 全局仅 `FloatingWindow` 使用过（且已确认为 bug，见 §4），直接迁移为 8 向，无其他引用需兼容。
- `ResizeHandle` 只负责**外观**（cursor + indicator），缩放逻辑在调用方 —— 保持现有职责划分。

### 3.2 外观与 cursor 映射（`global.css`）

新增类名 `.resize-handle--{n,s,e,w,ne,nw,se,sw}`：

| 方向 | 尺寸 | cursor | indicator |
|------|------|--------|-----------|
| `n` / `s` | 6px 高横条 | `row-resize` | 24×2 横线（复用现有横条 indicator） |
| `e` / `w` | 6px 宽竖条 | `col-resize` | 2×24 竖线（复用现有竖条 indicator） |
| `ne` / `sw` | 12×12 方块 | `nesw-resize` | 无 |
| `nw` / `se` | 12×12 方块 | `nwse-resize` | 无 |

- 边条带 indicator 沿用现有 `.resize-handle__indicator` 的 hover/active 高亮规则；四角仅靠 hover 背景变色提示可拖区。

---

## 4. 新增 `utils/resizeDrag.ts` —— 统一缩放数学

照 `utils/detachDrag.ts` 的指针事件模式（window 级监听、内部 cleanup、Esc/pointercancel 取消）：

```ts
export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface ResizeDragParams {
  /** 底层 PointerEvent（React 事件用 e.nativeEvent 传入） */
  event: PointerEvent
  /** 缩放方向 */
  dir: ResizeDir
  /** 起始矩形 */
  rect: { x: number; y: number; w: number; h: number }
  /** 最小尺寸（默认 320×200） */
  minW?: number
  minH?: number
  /** 每次移动回调（已钳制） */
  onResize: (r: { x: number; y: number; w: number; h: number }) => void
}

export function startResizeDrag(p: ResizeDragParams): void
```

### 4.1 方向数学

记 `dx = cx - sx`、`dy = cy - sy`：

| 方向 | 新矩形 |
|------|--------|
| `e` | `w = ow + dx` |
| `w` | `w = ow - dx`，`x = ox + dx` |
| `s` | `h = oh + dy` |
| `n` | `h = oh - dy`，`y = oy + dy` |
| 组合 | 四角 = 相应两条边合并 |

### 4.2 钳制（关键：锚定对侧边缘）

对含 `w`/`n` 的方向，先算宽度/高度、钳制到 `[min, 视口]`，**再反推 x/y 使对侧边缘固定**，保证顶到最小尺寸或视口边界时窗口不跳、不溢出：

```
含 w 的方向：w = clamp(ow - dx, minW, ox + ow)          // 右缘锚定在 ox+ow
             x = ox + ow - w
含 n 的方向：h = clamp(oh - dy, minH, oy + oh)          // 下缘锚定在 oy+oh
             y = oy + oh - h
含 e/s 的方向：上限 = 视口右/下沿 − 窗口左/上沿，w/h 不超出
```

- 边界情况：`window.innerWidth - x` 可能小于 `minW`（视口极小）→ 此时取 `max(minW, 视口剩余)` 导致最小尺寸优先、允许轻微越界，属可接受退化。

---

## 5. `floatingWindows` store 扩展

`resize` 从只收 `{w, h}` 扩展为收完整 `{x, y, w, h}`（从左边/上边/左上角拖时需同步移动窗口）：

```ts
/** 缩放窗口（含移动，允许从任意边/角调整） */
resize: (tabId: string, rect: { x: number; y: number; w: number; h: number }) => void
```

- `TabContent` 已订阅 `windows[tabId]` 的 x/y/w/h，内容区**自动跟随，无需改动**。
- 现有 `move`（仅位置）与 `detach`（含初始 rect）保持不变。

---

## 6. `FloatingWindow` 接线

- **删除**现有单柄 `handleResizePointerDown`（右下角，`direction="horizontal"` + 同时改 w/h 的对角逻辑）。
- 改为渲染 **8 个 `position: fixed` 手柄**，位置由 store rect 推导：

```
            ┌── n 边条 (贯穿窗口宽, y-3) ──┐
            │ nw                  ne      │
            w                              e
            边                              边
            条                              条
            │ sw                  se      │
            └── s 边条 (贯穿窗口宽) ────────┘
            每条 6px 条带；四角 12×12
```

- 每个手柄 `onPointerDown` → `focus(tabId)` + `startResizeDrag({ dir, rect, onResize: (r) => resize(tabId, r) })`。
- 手柄 zIndex 取 `rect.z + 1`（盖在面板之上可点）。

---

## 7. `QueryPopup` / `OrderPopup` 接线

### 7.1 局部尺寸状态

- 新增 `size: { w: number; h: number } | null`（默认 `null` → 使用 CSS 默认尺寸并居中）。
- **首次缩放先物化位置**：若 `position === null`（居中态，靠 `transform: translate(-50%,-50%)`），先用 `getBoundingClientRect()` 算出真实 x/y 并 `setPosition`，再开始拖拽 —— 避免从左边/上边拖时跳动。

### 7.2 手柄布局

容器内渲染 **8 个内部绝对定位手柄**（不穿透边框，`overflow: hidden` 下不出界）：

- 边：贴内沿 6px 条带（`n`: top:0 / `s`: bottom:0 / `e`: right:0 / `w`: left:0，贯穿对应全边）
- 角：贴角 12×12（`nw`/`ne`/`sw`/`se` 内角）
- 手柄 z-index 高于弹窗内容，`pointerdown` → `startResizeDrag` → 更新 `size`/`position` state。

### 7.3 样式与最小尺寸

| 弹窗 | 默认尺寸（CSS） | 最小尺寸 | 说明 |
|------|----------------|----------|------|
| QueryPopup | 880×620 | **480×320** | 单栏查询面板 |
| OrderPopup | 740×auto | **680×400** | 双栏 grid `minmax(280,5fr)+minmax(360,7fr)+gap 12+padding 24` 内容下限 ≈676 |

- `size` 非 null 时内联 `width/height` 覆盖 CSS 默认值；`position` 照旧。

---

## 8. 数据流

```
FloatingWindow:
  pointerdown(手柄, dir) → startResizeDrag → onResize → store.resize(tabId, {x,y,w,h})
    → chrome 壳手柄重定位（读 store） + TabContent 面板重定位（读 store）

QueryPopup/OrderPopup:
  pointerdown(手柄, dir) → startResizeDrag → setSize / setPosition → 重渲染
```

---

## 9. 边界与错误处理

| 场景 | 处理 |
|------|------|
| 拖拽中途 `pointercancel` / Esc | `startResizeDrag` 内部清理监听并取消（与 detachDrag 一致） |
| 顶到最小尺寸 | 反推 x/y（对侧锚定），窗口不跳 |
| 窗口拖出视口 | 视口钳制：`e/s` 不超出右/下沿；`n/w` 使左/上沿 ≥ 0 |
| 与「放大为标签页」flip 动画共存 | flip 用 `transform`，缩放改 `width/height/left/top`，互不干扰；flip 结束后弹窗关闭 |
| 手柄盖住内容 | 手柄 `pointerdown` 即 `stopPropagation`，不触发弹窗标题栏拖动/面板点击 |
| OrderPopup 缩到接近最小宽度 | 双栏 grid 有 `minmax` 下限，body `overflow:hidden` 兜底不破版 |
| FloatingWindow 从左边拖 | 只改 x 与 w（右缘锚定），内容区因 store 更新自动跟随 |

---

## 10. 测试

- **单元** `utils/resizeDrag.test.ts`：
  - 8 方向数学（`e/s` 只改尺寸、`w/n` 同时移动、四角合并）
  - min 钳制 + 对侧锚定（顶到 minW 时 x 不再右移）
  - 视口钳制（`e/s` 不越界、`n/w` 上/左沿 ≥ 0）
  - Esc / pointercancel 取消清理
- **组件** `FloatingWindow/index.test.tsx`：
  - 新增 8 个手柄存在（`aria-label` 区分方向）
  - 各方向拖拽 → store rect 正确更新（含 `w`/`n` 方向 x/y 变化）
  - 保留现有：停靠/关闭/标题条移动/右下角缩放
- **组件** `ResizeHandle/index.test.tsx` + `style.test.tsx`：8 方向 class 与 cursor 映射
- **组件** `QueryPopup.test.tsx` / `OrderPopup.test.tsx`：
  - 缩放手势更新尺寸；从左边/上边拖同时更新位置
  - 居中态首拖不跳动（先物化位置）
- **回归**：现有前端 469 个单测全绿。

---

## 11. 改动文件清单

| 文件 | 改动 |
|------|------|
| `components/ResizeHandle/index.tsx` | `direction` 扩展 8 向 |
| `assets/styles/global.css` | `.resize-handle--{n,s,e,w,ne,nw,se,sw}` cursor/indicator 样式 |
| `utils/resizeDrag.ts` | 新建：`startResizeDrag` 统一缩放数学 + 钳制 |
| `stores/floatingWindows.ts` | `resize` 接收 `{x,y,w,h}` |
| `components/FloatingWindow/index.tsx` | 8 个 fixed 手柄替代单柄；`direction="se"` 修正右下角 cursor |
| `modules/query/QueryPopup.tsx` + css | 内部 8 手柄 + `size` state + 首拖物化位置；最小尺寸 |
| `modules/order/OrderPopup.tsx` + css | 同上 |
| 测试文件 | 上表对应 5 处 |

---

## 12. 非目标（YAGNI）

- 尺寸/位置持久化到 localStorage（FloatingWindow 会话内有效，QueryPopup/OrderPopup 每次重置）。
- 最大化/还原按钮（已有「放大为标签页」）。
- 触摸/触屏手势优化（桌面应用，仅鼠标/指针）。
- 分屏吸附、等比缩放锁定（Shift 约束）。
- InstrumentSearchModal / ConfirmDialog 等**居中模态**（不可标签页⇄弹窗转换）。
