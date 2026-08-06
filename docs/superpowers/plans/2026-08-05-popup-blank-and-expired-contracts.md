# 弹窗背景空白 + 过期合约 修复方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
1. 修复「标签页转为弹窗（浮动窗口）后，弹窗背景空白」。
2. 修复「多弹窗共存时，点击弹窗不能可靠置顶」。
3. 修复「合约列表中过期合约在点击『刷新合约(CTP)』后仍存在」。

**Architecture:**
- 弹窗背景空白 → 将浮动窗口内容统一渲染到顶层 overlay（`createPortal`），使浮动窗口自包含，脱离 `.tab-content` 布局/溢出/层叠干扰。
- 点击置顶 → 捕获阶段 `onPointerDownCapture` 触发 `focus`（不受子组件 stopPropagation 影响）+ 将 OrderPopup/QueryPopup 的 z-index 纳入同一置顶 store（统一 z 计数）。
- 过期合约 → 后端 `MarketService` 在**缓存摄入点**（`load_instruments` / CTP 落盘）过滤 `expireDate < today` 的合约。

**Tech Stack:** React 18 + TypeScript 5 + Vitest + @testing-library/react + Zustand；后端 Python FastAPI + pytest。

## 诊断

### 问题 1：弹窗背景空白

**现象**：拖拽标签（或拖 TabBar 标签 pill）转为浮动弹窗后，标题栏（chrome）正常，但内容区（背景）空白。

**根因（结构）**：浮动窗口被拆成**两个独立渲染层**：

- chrome 壳（32px 标题栏 + 8 方向缩放手柄）由 `FloatingWindows` / `FloatingWindow` 在 App 顶层渲染（`frontend/src/components/FloatingWindow/index.tsx:107-148`）。
- 内容面板由 `TabContent` 渲染（`frontend/src/components/TabContent/index.tsx:69-108`），以 `position: fixed` 位移覆盖在 chrome 之下（`top: rect.y + FLOATING_CHROME_H`）。

内容面板深嵌在 `.tab-content`（`display:flex; flex-direction:column; overflow:hidden`，见 `frontend/src/components/TabContent/styles.css:1-6`）之内。这种「chrome 与内容分属两棵 DOM 子树、内容嵌套在标签页布局中」的结构脆弱：

1. `position: fixed` 面板依赖祖先不产生**包含块**（`transform`/`will-change`/`filter`/`contain`）与不**裁剪**（`overflow:hidden`）。目前 `.tab-content`/`.tab-main` 尚无此类属性，但任何未来改动都会让面板被裁剪/错位 → 内容区空白。
2. chrome 与内容分属两棵子树，任何一方漏渲染（组件异常 / 样式加载顺序）都会呈现「只有标题栏、主体空白」。
3. 内容面板依赖 `.tab-content` 的 flex/overflow 环境，而 chrome 在顶层，两者层叠上下文不同 → z-index 交互脆弱（见问题 1b）。

**根因（次）**：部分页面内容（canvas 图表 / 虚拟滚动表格）在**挂载时容器不可见**（`display:none` 的隐藏标签页）会以 0 尺寸初始化，转为浮动弹窗后仍为空白。K线图已用 ResizeObserver 修复（`frontend/src/modules/market/KLineChart.tsx:279-309`，延迟初始化 + `chartReady` 重放 setOption），但该模式未在浮动容器层统一兜底。

**方案**：让浮动窗口**自包含** —— 将浮动标签的内容面板通过 `createPortal` 渲染到 App 顶层新增的 `#floating-overlay` 容器（与 FloatingWindows 同层）。DOM 落到干净容器，不受 `.tab-content` 布局/溢出/层叠影响；面板在 overlay 内始终可见、尺寸确定，canvas/vtable 可正确测量。

> **实现备注**：转弹窗时面板由「内联 → portal」导致页面组件重挂载一次（页面本地 state 重置，zustand 数据保留）。这恰好让 canvas/表格在可见容器内重新初始化，进一步消除「隐藏时 0 尺寸初始化 → 空白」的成因；核心数据（行情/报单/查询）均在 zustand store，不受影响。

### 问题 1b：多弹窗点击置顶

**现状**：
- FloatingWindow 已有 `focus()`（`frontend/src/stores/floatingWindows.ts:71-78`），chrome 与内容面板的 `onPointerDown` 均会调用。但内容是**冒泡阶段** `onPointerDown`，若页面内部组件 `stopPropagation`（如 vtable 表格行、echarts 画布、右键菜单），点击内容区不会触发置顶。
- OrderPopup / QueryPopup 的 z-index **固定 `1500`**（`frontend/src/modules/order/OrderPopup.css:5`、`frontend/src/modules/query/QueryPopup.css`），不参与置顶。浮动窗口 z 从 1400 起递增，点击后仍可能低于 1500 → 无法压过这两个弹窗。

**方案**：
1. 浮动面板与 chrome 改用**捕获阶段** `onPointerDownCapture` 触发 `focus`（在子组件 stopPropagation 之前执行）。
2. **统一 z-index 管理**：把 OrderPopup/QueryPopup 的 z 也纳入同一置顶 store（复用 floatingWindows 的 zCounter 或新增 `bringToFront(key)`），任意弹窗点击 → z 升到全局最高 → 真正「点击到的弹窗放在最上方」。

### 问题 2：过期合约刷新后仍存在

**根因**：
- 全量合约来源：启动时从 `server/data/instruments.json` 文件加载（`server/main.py:141-142` → `market_service.load_instruments_from_file`）；CTP 连接后 `ReqQryInstrument` 刷新（`server/services/ctp_startup.py:_wire_instrument_query` → `market_service.on_instruments_result`，`server/api/market.py:171-211` POST `/api/instruments/refresh`）。
- **CTP 的合约表包含历史/已过期合约**。`server/data/instruments.json` 实测含 10 个 `expireDate < today` 的合约（如 `fu2608` expire=20260731），且部分 `isTrading=1`（旧数据未更新）。
- 后端 `MarketService` 对全量列表**无任何过期过滤**：`load_instruments`（`market_service.py:60-62`）、`load_instruments_from_file`（`:64-85`）、`get_instruments`（`:87-107`）、`search_instruments`（`:121-136`）、`on_instruments_result`（`:364-389`）均原样保留。
- 点击「刷新合约(CTP)」只是重新 `ReqQryInstrument`，**CTP 仍返回同样的过期合约** → 刷新后依然存在。

**方案**：在后端**缓存摄入点**过滤过期合约，一处过滤、全链路生效：
- `MarketService.load_instruments`（缓存唯一写入点）内过滤 `expireDate < today`。
- `MarketService._save_instruments_to_file`（落盘）同样过滤 → `instruments.json` 也被清理，下次启动即干净。
- `expireDate == today` 的合约保留（当日仍可交易）；`expireDate` 缺失的合约保留（无法判断，避免误杀）。

---

## Global Constraints

- 现有前端测试（`cd frontend && npm test`）与后端测试（`cd server && python -m pytest tests/ -v`）保持全绿。
- 不引入第三方库；沿用现有手写指针事件模式。
- 浮动窗口最小尺寸 `320×200` 不变；尺寸/位置行为不变。
- 提交信息遵循仓库惯例（`feat:` / `fix:` / `test:` / `docs:` 前缀）。
- 不改动 CTP 订阅/行情链路；过期合约过滤只影响**合约列表展示**，不影响已订阅行情。

---

### Task 1: 浮动内容 Portal 到顶层 overlay（修复背景空白）

**Files:**
- Edit: `frontend/src/App.tsx`
- Edit: `frontend/src/components/TabContent/index.tsx`
- Edit: `frontend/src/components/TabContent/index.test.tsx`

**Approach:**
- App 在 `<FloatingWindows />` 旁新增普通容器 `<div id="floating-overlay" />`（无定位、无 overflow、无 z-index，避免产生层叠上下文/包含块）。
- TabContent 对浮动标签的面板改为 `createPortal(<div className="tab-content__panel--floating" style={浮动样式} onPointerDownCapture={focus}>{renderTabContent(tab)}</div>, overlayEl)`。
- overlay 元素解析：`document.getElementById('floating-overlay')`（App 先渲染，TabContent 后挂载，稳定存在）。
- 浮动面板内联样式、`tab-content__panel--floating` 背景（`var(--bg-secondary)`）、边框阴影全部保留，确保主体始终有底色、尺寸确定。

- [ ] **Step 1: 写失败测试**
  - `TabContent` 测试：浮动标签面板应渲染到 `#floating-overlay` 内（`container.ownerDocument.getElementById('floating-overlay').contains(panel)`），且仍带 `position: fixed` + 正确尺寸内联样式。
- [ ] **Step 2: 实现**
  - App 加 overlay 容器；TabContent 用 `createPortal` 渲染浮动面板。
- [ ] **Step 3: 验证**
  - `cd frontend && npm test` 全绿；手动复现：转 K线/设置/查询标签为弹窗，内容区应显示正常背景与内容。

### Task 2: 点击置顶（捕获阶段 + 统一 z-index）

**Files:**
- Edit: `frontend/src/stores/floatingWindows.ts`
- Edit: `frontend/src/components/FloatingWindow/index.tsx`
- Edit: `frontend/src/components/TabContent/index.tsx`
- Edit: `frontend/src/modules/order/OrderPopup.tsx` + `OrderPopup.css`
- Edit: `frontend/src/modules/query/QueryPopup.tsx` + `QueryPopup.css`
- Tests: `floatingWindows.test.ts` / `FloatingWindow/index.test.tsx` / `TabContent/index.test.tsx` / `OrderPopup.test.tsx` / `QueryPopup.test.tsx`

**Approach:**
- `floatingWindows.ts` 新增通用置顶能力：`bringToFront(key: string)`（复用 zCounter，key 可为 `'float-<tabId>'` / `'order'` / `'query'`），并把 OrderPopup/QueryPopup 的 z 也纳入 `windows` 或新增 `popupZ: Record<string, number>`。若改用独立字段，FloatingWindow 读取改为同一来源。
- TabContent 浮动面板：`onPointerDown` → `onPointerDownCapture`。
- FloatingWindow chrome：`handleChromePointerDown` 内 `focus` 保留（标题栏拖拽），并确保 `e.stopPropagation` 不阻断。
- OrderPopup / QueryPopup：打开时调用 `bringToFront('order'|'query')`；CSS `z-index: 1500` 改为读取 store 返回的 z（style 内联覆盖）。

- [ ] **Step 1: 写失败测试**
  - `floatingWindows`：`bringToFront('order')` 后 z 高于现有浮动窗口。
  - `OrderPopup`/`QueryPopup`：打开弹窗即置顶；点击其他弹窗后其 z 高于前者。
  - `TabContent`：浮动面板 `onPointerDownCapture` 触发 focus（子组件 stopPropagation 也触发）。
- [ ] **Step 2: 实现**
  - store 统一 z；各弹窗接线 `bringToFront`；onPointerDownCapture。
- [ ] **Step 3: 验证**
  - `npm test` 全绿；手动：同时开 2 个浮动窗口 + 报单弹窗，交替点击应始终置顶。

### Task 3: 后端过滤过期合约

**Files:**
- Edit: `server/services/market_service.py`
- Test: `server/tests/test_market_service.py`（或新建）

**Approach:**
- 新增私有方法 `_is_expired(inst) -> bool`：`str(inst.get("expireDate", "")).replace("-", "")` 解析为 YYYYMMDD；为空 → 保留；`< today.strftime("%Y%m%d")` → 过期。
- `load_instruments`：`self._instruments = [i for i in instruments if not self._is_expired(i)]`。
- `_save_instruments_to_file`：写入前同样过滤（保证落盘数据干净）。
- `on_instruments_result` 的 is_last 分支：`load_instruments` 已过滤 → 内存干净；`_save_instruments_to_file` 已过滤 → 文件干净。

- [ ] **Step 1: 写失败测试**
  - `load_instruments` 过滤 `expireDate < today` 的合约，保留当天/未来/缺失 expireDate 的合约。
  - `_save_instruments_to_file` 落盘不含过期合约。
  - `load_instruments_from_file` 读取含过期合约的文件后缓存干净。
- [ ] **Step 2: 实现**
  - 按上述过滤逻辑实现。
- [ ] **Step 3: 验证**
  - `cd server && python -m pytest tests/ -v` 全绿；用现有 `server/data/instruments.json` 跑一次过滤确认过期合约消失（`fu2608`/`sc2608` 等）。

---

## Verification（收尾）

- `cd frontend && npm test` 全绿。
- `cd server && python -m pytest tests/ -v` 全绿。
- 手动复现清单：
  1. 行情页选中合约 → 「打开K线」→ 拖 K线页顶部「拖动此栏可转弹窗」→ 弹窗内容区应显示 K线图（非空白）。
  2. 再开一个浮动窗口 + 报单弹窗，交替点击 → 点击者置顶。
  3. 合约搜索弹窗 → 点「刷新合约(CTP)」→ 刷新完成后全量列表不应再出现 `fu2608`/`sc2608` 等过期合约。
