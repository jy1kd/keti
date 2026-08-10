# 全局滚动条统一重构（低调细条）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全站三套割裂的滚动条体系（原生 6px 暗灰、vtable 12px 亮蓝常显、TabBar 3px）统一为"低调细条"风格，并补 Firefox 支持。

**Architecture:** 设计 token 双单源——原生滚动条用 `global.css` 的 CSS 规则，vtable 用 `vtableTheme.ts` 常量，两处值一致。vtable 的 `scrollStyle` 用 `visible: 'focus'` 实现 hover 表格时浮现。TabBar 隐藏滚动条但保留可滚动性。

**Tech Stack:** CSS（webkit scrollbar + Firefox scrollbar-color/width）、TypeScript、@visactor/vtable `ScrollStyle`、vitest。

## Global Constraints

- 滑块静止色 `rgba(139,148,158,0.35)`，hover 色 `rgba(139,148,158,0.6)`，轨道透明，宽/高 6px（来自设计文档第 3 节 token 表）
- vtable 滑块固定色取中间值 `rgba(139,148,158,0.45)`（vtable 无法 hover 变亮）
- vtable `scrollStyle`：`width: 6`、`visible: 'focus'`、`barToSide: true`（`focus` + `barToSide` 组合 = hover 表格浮现）
- TabBar 滚动条完全隐藏，保留 `overflow-x: auto` 可滚动性
- 前端全量单测 469 个，`npm test`（=`vitest run`，非 watch）必须全绿
- 参考设计文档：`docs/superpowers/specs/2026-08-10-scrollbar-refactor-design.md`

---

## File Structure

| 文件 | 责任 | 变更类型 |
|------|------|----------|
| `frontend/src/assets/styles/global.css` | 原生滚动条全局规则 | 修改 `62-78` + 补 Firefox |
| `frontend/src/components/TabBar/styles.css` | 顶部标签栏滚动条隐藏 | 修改 `7-14` |
| `frontend/src/utils/vtableTheme.ts` | vtable 滚动条主题常量（单源） | 修改 |
| `frontend/src/modules/market/MarketTable.tsx` | 行情表，import 改名 + 滚动条命中测试用 `SCROLLBAR_SIZE` | 修改 `6`、`238` |
| `frontend/src/modules/options/TQuoteTable.tsx` | 期权链，import 改名 | 修改 `4`、`153` |
| `frontend/src/modules/market/MarketTable.test.tsx` | 行情表断言 + 2 处过时注释 | 修改 |
| `frontend/src/modules/options/TQuoteTable.test.tsx` | 期权链断言 | 修改 |

---

## Task 1: 全局原生滚动条统一 + Firefox 支持

**Files:**
- Modify: `frontend/src/assets/styles/global.css:62-78`

纯 CSS 变更，无自动化测试。验证手段：`npm run build` 通过 + 最终 Task 4 手动检查。

- [ ] **Step 1: 替换现有滚动条规则**

将 `global.css:62-78` 现有的 `::-webkit-scrollbar` 块（6px 宽、`var(--bg-secondary)` 轨道、`var(--border-color)` 滑块、`var(--text-muted)` hover）替换为低调细灰样式，并在其后追加 Firefox 标准属性支持：

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

/* Firefox 支持（标准 scrollbar-color/width，当前缺失） */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 148, 158, 0.35) transparent;
}
```

- [ ] **Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: `tsc` 无错误、`vite build` 成功

- [ ] **Step 3: 提交**

```bash
git add frontend/src/assets/styles/global.css
git commit -m "style(global): 原生滚动条统一为低调细灰样式并补充 Firefox 支持"
```

---

## Task 2: 顶部标签栏隐藏滚动条

**Files:**
- Modify: `frontend/src/components/TabBar/styles.css:7-14`

纯 CSS 变更，无自动化测试。保留 `overflow-x: auto` 的可滚动性，仅隐藏滚动条视觉。

- [ ] **Step 1: 移除旧规则并隐藏滚动条**

在 `styles.css` 中：

1. 将 `.tab-bar` 规则（第 9 行）的 `scrollbar-width: thin;` 改为 `scrollbar-width: none;`
2. 将 `.tab-bar::-webkit-scrollbar { height: 3px; }`（第 12-14 行）改为 `display: none;`

结果如下：

```css
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  height: 36px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* 隐藏横向滚动条，保留可滚动性 */
}

.tab-bar::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: `tsc` 无错误、`vite build` 成功

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/TabBar/styles.css
git commit -m "style(tabbar): 顶部标签栏隐藏横向滚动条，保留可滚动性"
```

---

## Task 3: vtable 滚动条统一（TDD 红 → 绿）

**Files:**
- Test: `frontend/src/modules/market/MarketTable.test.tsx:197-207`
- Test: `frontend/src/modules/options/TQuoteTable.test.tsx:65-76`
- Modify: `frontend/src/utils/vtableTheme.ts`
- Modify: `frontend/src/modules/market/MarketTable.tsx:6,238`
- Modify: `frontend/src/modules/options/TQuoteTable.tsx:4,153`

**Interfaces:**
- Consumes: `SCROLLBAR_SIZE`（MarketTable.tsx:376-377 滚动条区域命中测试的阈值，12→6 自动对齐）
- Produces: 导出常量从 `PROMINENT_SCROLL_STYLE` 改名为 `SCROLL_STYLE`；`SCROLLBAR_SIZE` 从 12 改 6

- [ ] **Step 1: 更新两处断言（先写失败测试）**

将 `MarketTable.test.tsx:197-207` 的用例整体替换：

```tsx
  it('横向滚动条为低调细灰样式（6px + 灰色滑块 + hover 表格时浮现）', async () => {
    const { ListTable } = await import('@visactor/vtable')
    render(<MarketTable contracts={mockContracts} snapshots={mockSnapshots} />)
    const options = (ListTable as any).mock.calls[0][1]
    const ss = options.theme.scrollStyle
    expect(ss).toBeDefined()
    expect(ss.visible).toBe('focus') // 常显 → hover 表格时浮现
    expect(ss.width).toBe(6) // 6px 细条
    expect(ss.scrollSliderColor).toBe('rgba(139,148,158,0.45)') // 灰色滑块，低调不抢行情数据
    expect(ss.barToSide).toBe(true) // 进度条钉在视口底部，行数少时不跑到上边去
  })
```

将 `TQuoteTable.test.tsx:65-76` 的用例整体替换：

```tsx
  it('采用固定列宽 standard + 低调滚动条（与行情表格一致）', async () => {
    render(<TQuoteTable chain={chain} />)
    const { ListTable } = await import('@visactor/vtable')
    const options = (ListTable as any).mock.calls[0][1]
    expect(options.widthMode).toBe('standard')
    const ss = options.theme.scrollStyle
    expect(ss).toBeDefined()
    expect(ss.visible).toBe('focus')
    expect(ss.width).toBe(6)
    expect(ss.scrollSliderColor).toBe('rgba(139,148,158,0.45)')
    expect(ss.barToSide).toBe(true)
  })
```

- [ ] **Step 2: 运行测试验证失败（红）**

Run: `cd frontend && npm test`
Expected: `MarketTable.test.tsx` 与 `TQuoteTable.test.tsx` 各有断言失败——`ss.visible` 仍是 `'always'`、`ss.width` 仍是 12、`scrollSliderColor` 仍是 `'#4a9eff'`

- [ ] **Step 3: 更新 vtable 主题常量**

将 `frontend/src/utils/vtableTheme.ts` 整体替换为：

```ts
/**
 * vtable 滚动条统一主题 —— 行情表格（MarketTable）与期权链表格（TQuoteTable）共用，
 * 保证两处横向/纵向滚动条观感一致。
 */

/** vtable 滚动条厚度（px）：6px，低调细条，与全局原生滚动条一致 */
export const SCROLLBAR_SIZE = 6

/** 统一的低调滚动条：细灰滑块 + 透明轨道 + hover 表格时浮现 */
export const SCROLL_STYLE = {
  scrollSliderColor: 'rgba(139,148,158,0.45)',
  scrollRailColor: 'rgba(255,255,255,0.03)',
  width: SCROLLBAR_SIZE,
  visible: 'focus' as const,
  /** 进度条钉在表格视口底部（而非内容底部）：行数少时不再跑到上边 */
  barToSide: true,
}
```

- [ ] **Step 4: 同步两处组件 import**

`MarketTable.tsx:6` 改为：

```ts
import { SCROLLBAR_SIZE, SCROLL_STYLE } from '@/utils/vtableTheme'
```

`MarketTable.tsx:238` 改为：

```tsx
        scrollStyle: { ...SCROLL_STYLE },
```

`TQuoteTable.tsx:4` 改为：

```ts
import { SCROLL_STYLE } from '@/utils/vtableTheme'
```

`TQuoteTable.tsx:153` 改为：

```tsx
        scrollStyle: { ...SCROLL_STYLE },
```

- [ ] **Step 5: 更新过时注释（滚动条命中测试阈值 12px → 6px）**

`MarketTable.test.tsx` 中"滚动条区域不触发多选"两个用例的坐标（y=595 / x=795，距边缘 5px）在 6px 带内（y≥594 / x≥794）仍通过，仅注释与标题过时。将 `212`、`240` 行标题与注释中的 `12px` / `600-12=588` / `800-12=788` 更新为 `6px` / `600-6=594` / `800-6=794`：

```tsx
    it('拖拽底部横向进度条（底部 6px 内）不误选合约行', async () => {
      // ...
        // y=595 落在底部进度条带（600-6=594 以下）；无修复时 getCellAt 返回 row1 → 误触发多选
```

```tsx
    it('拖拽右侧纵向滚动条（右侧 6px 内）不误选合约行', async () => {
      // ...
        // x=795 落在右侧滚动条带（800-6=794 右侧）；无修复时 getCellAt 按 y 判行 → 误触发多选
```

- [ ] **Step 6: 运行测试验证通过（绿）**

Run: `cd frontend && npm test`
Expected: 全部测试 PASS（469 个）

- [ ] **Step 7: 提交**

```bash
git add frontend/src/utils/vtableTheme.ts frontend/src/modules/market/MarketTable.tsx frontend/src/modules/options/TQuoteTable.tsx frontend/src/modules/market/MarketTable.test.tsx frontend/src/modules/options/TQuoteTable.test.tsx
git commit -m "style(vtable): 表格滚动条统一为细灰 + hover 浮现，更新测试断言"
```

---

## Task 4: 全量验证

**Files:** 无代码变更

- [ ] **Step 1: 运行完整测试套件**

Run: `cd frontend && npm test`
Expected: 全部 PASS（469 个）

- [ ] **Step 2: 生产构建**

Run: `cd frontend && npm run build`
Expected: `tsc` + `vite build` 无错误

- [ ] **Step 3: 手动视觉检查**

Run: `cd frontend && npm run dev`（→ http://localhost:5173）

逐项检查：
1. **原生滚动条**：设置面板、查询模块、报单模块、合约搜索框——6px 细灰，hover 时变亮，轨道透明
2. **行情表/期权链**：滚动条细灰 6px，鼠标移入表格浮现，移开隐藏
3. **顶部标签栏**：标签溢出时无滚动条可见，但仍可用 shift+滚轮 / 触控板横向手势 / 拖拽滚动
4. **Firefox**（若已安装）：确认 `scrollbar-width: thin` + `scrollbar-color` 生效，暗色主题下灰色细条可见

- [ ] **Step 4: 收尾**

确认 `git status` 干净（除未跟踪的个人文件），分支 `feature/scrollbar-refactor` 就绪可提交 PR。

---

## Self-Review

**Spec coverage:**
- 设计文档 §4.1 原生滚动条 → Task 1 ✓
- 设计文档 §4.2 TabBar 隐藏 → Task 2 ✓
- 设计文档 §4.3 vtable 主题 + import 改名 → Task 3 Step 3-4 ✓
- 设计文档 §4.4 测试更新 → Task 3 Step 1-2, 5-6 ✓
- 设计文档 §6 验证（npm test + dev 手动）→ Task 4 ✓
- 设计文档 §4.3 关键联动（SCROLLBAR_SIZE 命中测试）→ Task 3 已覆盖，坐标仍有效，注释同步 ✓

**Placeholder scan:** 无 TBD/TODO，所有步骤含完整代码。

**Type consistency:** `PROMINENT_SCROLL_STYLE` → `SCROLL_STYLE` 在 vtableTheme.ts、MarketTable.tsx、TQuoteTable.tsx 三处一致；`SCROLLBAR_SIZE` 名称不变，仅值 12→6，MarketTable 命中测试自动对齐。
