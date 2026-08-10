# Design: 全局滚动条统一重构（低调细条）

**日期**: 2026-08-10
**状态**: 已批准

---

## 1. 背景

当前滚动条分三套体系，观感割裂：

| 体系 | 位置 | 现状 | 样式 |
|------|------|------|------|
| 原生浏览器滚动条 | 设置面板、查询、报单、搜索框等 ~15 处 `overflow: auto` 容器 | `global.css:62-78` | 6px 细、暗灰滑块（`#30363d`） |
| vtable 表格滚动条 | 行情表 `MarketTable`、期权链 `TQuoteTable` | `vtableTheme.ts` | 12px 粗、亮蓝滑块（`#4a9eff`）、常显 |
| TabBar 横向条 | 顶部标签栏 | `TabBar/styles.css` | 3px 高、独立规则 |

主要问题：
- vtable 的 12px 亮蓝滚动条与全局 6px 暗灰细条完全割裂
- 亮蓝色与主题琥珀签名色（`--accent: #f0b429`）冲突
- 原生滚动条缺失 Firefox 支持（`scrollbar-color` / `scrollbar-width`）
- TabBar 特例独立于全局体系

**目标**：全站滚动条统一为"低调细条"风格——细灰、不抢行情数据、hover 高亮。对齐文华/无限易等商用交易终端的克制风格。

## 2. 架构决策

**决策 1 — 风格方向：低调细条。** 滑块用中性灰（text-secondary 半透明），静止 35% 透明度，hover 提高到 60%。灰色不与顶部琥珀签名色冲突，不抢行情数据。

**决策 2 — vtable 完全统一。** 行情表/期权链滚动条也改为细灰条，不再是"加粗亮蓝常显"。

**决策 3 — 厚度 6px。** 保持现状宽度，够薄不抢眼又容易点中。

**决策 4 — 顶部标签栏隐藏滚动条。** TabBar 是 36px 的细条，压一条 6px 横条视觉过重，故完全隐藏滚动条但保留可滚动性。

**设计 token 双单源**：原生滚动条颜色用 CSS 变量（`global.css`），vtable 滚动条用 `vtableTheme.ts` 常量，两处值一致。

## 3. 配色 token

| 状态 | 颜色 |
|------|------|
| 滑块静止 | `rgba(139,148,158,0.35)` |
| 滑块 hover | `rgba(139,148,158,0.6)` |
| 轨道 | 透明 |
| 宽度 / 高度 | 6px |

**vtable 例外**：vtable 的滑块颜色由 `scrollSliderColor` 固定，无法像原生滚动条那样 hover 变亮，故取其静止与 hover 的中间值 `rgba(139,148,158,0.45)`，观感上介于原生静止/hover 之间，不会过亮。

## 4. 修改范围

### 4.1 原生滚动条 — `frontend/src/assets/styles/global.css`

替换 `global.css:62-78` 的现有 `::-webkit-scrollbar` 规则，并补 Firefox 支持：

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(139, 148, 158, 0.35);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 148, 158, 0.6);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* Firefox 支持（当前缺失） */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 148, 158, 0.35) transparent;
}
```

### 4.2 顶部标签栏 — `frontend/src/components/TabBar/styles.css`

删除现有规则（`scrollbar-width: thin` 和 3px 高度的 webkit 覆盖），改为隐藏滚动条、保留可滚动性：

```css
.tab-bar {
  /* 隐藏横向滚动条，保留 overflow-x: auto 的可滚动性 */
  scrollbar-width: none;            /* Firefox */
}

.tab-bar::-webkit-scrollbar {
  display: none;                    /* Webkit/Chromium */
}
```

**已知权衡**：隐藏后无可见提示条，溢出标签靠 shift+滚轮 / 触控板横向手势 / 拖拽滚动。TabBar 组件（`index.tsx`）当前无滚轮横滚处理。可选后续项（不在本次范围）：给 TabBar 加 `onWheel` 把垂直滚轮转换为横向滚动。

### 4.3 vtable 滚动条 — `frontend/src/utils/vtableTheme.ts`

```ts
/** vtable 滚动条厚度（px）：6px，低调细条，与全局原生滚动条一致 */
export const SCROLLBAR_SIZE = 6

/** 统一的低调滚动条：细灰滑块 + 透明轨道 + hover 表格时浮现 */
export const SCROLL_STYLE = {
  scrollSliderColor: 'rgba(139,148,158,0.45)',
  scrollRailColor: 'rgba(255,255,255,0.03)',
  width: SCROLLBAR_SIZE,
  visible: 'focus' as const,
  barToSide: true,
}
```

要点：
- `PROMINENT_SCROLL_STYLE` 改名 `SCROLL_STYLE`，同步 `MarketTable.tsx`、`TQuoteTable.tsx` 2 处 import
- `visible: 'focus'`：vtable 的 `focus` 模式 + `barToSide: true` 组合实现 hover 表格时浮现、移开隐藏（已验证 vtable 源码 `event/listener/table-group.js` 中 `shouldShowVScrollOnCanvasHover = barToSide && "focus" === verticalVisible`）
- **关键联动**：`SCROLLBAR_SIZE` 同时被 `MarketTable.tsx:376-377` 用于滚动条区域命中测试（防止拖滚动条误选行），12→6 后阈值自动同步，不会错位

### 4.4 测试更新

以下 2 处断言锁定旧"加粗蓝常显"样式，需改为新值：

| 测试 | 旧断言 | 新断言 |
|------|--------|--------|
| `MarketTable.test.tsx:197-207` | `visible==='always'`、`width>=12`、`scrollSliderColor==='#4a9eff'`、`barToSide` | `visible==='focus'`、`width===6`、灰色滑块 `rgba(139,148,158,0.45)`、`barToSide` |
| `TQuoteTable.test.tsx:65-76` | `visible==='always'`、`width===12`、`scrollSliderColor==='#4a9eff'`、`barToSide` | 同上 |

## 5. 不修改的文件

| 文件 | 原因 |
|------|------|
| `OrderPopup.css` 的 `scrollbar-gutter: stable` | 与滚动条样式无关，保持布局稳定用 |
| `MarketTable.tsx` / `TQuoteTable.tsx` 其余配置 | 仅 scrollStyle 引用改名，表格逻辑不动 |
| 后端代码 | 纯前端样式重构 |

## 6. 验证

1. `cd frontend && npm test` — 469 个单测全绿（含更新后的滚动条断言）
2. `cd frontend && npm run dev` — 手动过一遍以下区域的滚动观感：
   - 设置面板、查询模块、报单模块、搜索框（原生滚动条）
   - 行情表、期权链（vtable，hover 浮现）
   - 顶部标签栏溢出（滚动条隐藏、仍可滚动）
   - Firefox 打开验证 `scrollbar-width` / `scrollbar-color` 生效

## 7. 实施顺序

1. 更新 `global.css` 原生滚动条 + Firefox 支持
2. 更新 `TabBar/styles.css` 隐藏滚动条
3. 更新 `vtableTheme.ts`（`SCROLLBAR_SIZE`、改名 `SCROLL_STYLE`）
4. 同步 `MarketTable.tsx`、`TQuoteTable.tsx` 的 import 引用
5. 更新 2 处测试断言
6. 运行测试 + 手动验证
