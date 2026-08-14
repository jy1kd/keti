# 浮动窗口原生菜单四类重排 设计方案

> 将浮动窗口的原生菜单入口重新布置为 **行情 / 交易 / 查询 / 设置** 四类；
> 无限下单加入交易菜单；旧「📋 查询窗口」菜单入口移除（查询解散收尾）；
> FPS 监控完整下线；托盘菜单镜像同步（方案 A）。

---

## 一、定位与范围

### 1.1 目标

当前原生菜单为「行情 / 功能 / 设置 / 性能监控」四组，功能与性能监控两组职责混杂、无法归类。本次按浮动窗口业务语义重排为四类：

| 一级菜单 | 内容 | 说明 |
|---------|------|------|
| **行情** | 期货 / 期权 / 自选行情（切视图）、**K线窗口**（移入）、T型报价、在新窗口打开 | 保留原视图项，K线从「功能」移入 |
| **交易** | 报单窗口、**无限下单窗口**（新增） | 「功能」组改名瘦身 |
| **查询** | 报单查询窗口、持仓查询窗口、资金查询窗口 | 原「功能」内查询项独立成组；旧「查询窗口」移除 |
| **设置** | ⚙ 设置、**网络监控**（移入）、退出 | 「性能监控」组解散并入，FPS 下线 |

> 资金查询窗口按**已存在**处理（本分支 Task 1-2 已完成），不重复建设。

### 1.2 基线（当前状态）

- 分支 `feature/query-dissolve-account-window`，已完成查询解散 Task 1-3：
  - `query-account` 标签类型 / 菜单项 / IPC / `AccountQuery` 10s 自刷新已就绪；
  - BottomBar / TabBar / 合约右键 / 托盘导航的查询入口已移除。
- 遗留：原生菜单 `func-query`（📋 查询窗口）仍存在（查询解散 Task 4 未做）；FPS 监控全链路在线。
- 前序参考：`docs/superpowers/specs/2026-08-14-query-dissolve-account-window-design.md`。

### 1.3 范围边界（防漂移）

| 项 | 决策 |
|---|---|
| 后端 | **零改动**。仅前端 UI 与 Electron 菜单层 |
| 资金查询窗口 | **视为已存在**，本次不动其实现 |
| BottomBar / TabBar 工具按钮 | **除 FPS 移除外不动**（报单/K线/无限下单/设置/网络监控按钮保留） |
| `query` 标签类型 / `openQueryFloating` / `QueryPanel` / store 瘦身 | **留给查询解散后续 Task**，本次只清菜单入口（`func-query` 菜单项 + `FloatingTab` 的 `'query'`） |
| FPS 监控 | **完整下线**：菜单 / 托盘 / BottomBar 按钮 / 快捷键 / `PerfMonitor` 组件 / `toggle-perf` IPC 全删 |
| 托盘 | **方案 A**：继续镜像 `getAppMenuDef()`，自动获得四组结构 |

---

## 二、菜单结构设计

### 2.1 顶部菜单四类（`electron/menuTemplate.ts` `getAppMenuDef()`）

```
行情 (market)
├── 📊 期货            (market-view all)
├── 📉 期权            (market-view options)
├── ⭐ 自选行情        (market-view favorites)
├── ─────────────
├── 📈 K线窗口         (open-floating kline)      ← 从「功能」移入
├── 📉 T型报价         (open-floating tquote)
├── ─────────────
└── 🪟 在新窗口打开    (open-market-window)

交易 (trade)                                     ← 原「功能」改名瘦身
├── 📝 报单窗口        (open-floating order)
└── ♾️ 无限下单窗口    (open-floating infinite)   ← 新增

查询 (query)
├── 📋 报单查询窗口    (open-floating query-orders)
├── 📋 持仓查询窗口    (open-floating query-positions)
└── 💰 资金查询窗口    (open-floating query-account)   ← 已存在
   （📋 查询窗口 func-query 移除 —— 查询解散收尾）

设置 (settings)                                  ← 吸收「性能监控」残留项
├── ⚙ 设置            (open-floating settings)
├── ─────────────
├── 🔌 网络监控        (open-floating ipc-monitor)      ← 从「性能监控」移入
├── ─────────────
└── 退出 (app-quit)   ← 仅顶部菜单保留；托盘 omitIds 剔除后底部自加退出
```

> 分组逻辑：**行情** = 行情视图切换 + 行情类浮动窗（K线/T型报价）；**交易** = 报单类；**查询** = 三类独立查询窗；**设置** = 设置 + 诊断类（网络监控）+ 退出。

### 2.2 托盘菜单（方案 A：镜像）

托盘继续 `getAppMenuDef()` + 底部一级退出，`omitIds: ['app-quit']`。四类重排后托盘自动变为：

```
行情 / 交易 / 查询 / 设置 / ─────── / 退出
```

各子菜单与顶部一致（设置子菜单的 `退出` 被 omit 剔除，由托盘底部一级退出承接）。

### 2.3 入口映射（原 → 新）

| 原位置 | 原菜单项 | 新位置 | 新菜单项 |
|--------|---------|--------|---------|
| 功能 | 📝 报单窗口 | 交易 | 📝 报单窗口 |
| 功能 | ♾️ 无限下单（无，新增） | 交易 | ♾️ 无限下单窗口 |
| 功能 | 📈 K线窗口 | 行情 | 📈 K线窗口 |
| 功能 | 📋 查询窗口 | **移除** | — |
| 功能 | 📋 报单查询窗口 | 查询 | 📋 报单查询窗口 |
| 功能 | 📋 持仓查询窗口 | 查询 | 📋 持仓查询窗口 |
| 功能 | 📋 资金查询窗口 | 查询 | 💰 资金查询窗口 |
| 功能 | 退出 (app-quit) | 设置 | 退出 |
| 设置 | ⚙ 设置 | 设置 | ⚙ 设置 |
| 性能监控 | ⚡FPS 监控 | **下线** | — |
| 性能监控 | 🔌 网络监控 | 设置 | 🔌 网络监控 |

---

## 三、关键决策

| # | 决策 | 依据 |
|---|---|---|
| 1 | 资金查询窗口按**已存在**处理，不重复建设 | 用户指定；本分支 Task 1-2 已完成 |
| 2 | 无限下单**加入**交易菜单，补齐 IPC 链路（`App.tsx` 加 `case 'infinite'` → `openInfiniteFloating`） | 用户指定 |
| 3 | 旧「📋 查询窗口」菜单项移除 + `FloatingTab` 删 `'query'`；`query` 代码层删除留给查询解散后续 Task | 查询解散收尾 + 范围边界 |
| 4 | FPS 监控**完整下线**（Electron + Web 全链路） | 用户指定 |
| 5 | 「性能监控」组解散，网络监控并入设置 | 四类化 |
| 6 | 「功能」组解散，报单/无限下单入交易、K线入行情 | 四类化 |
| 7 | 托盘**方案 A**：镜像四组菜单 | 用户指定；改动最小、单一真源 |
| 8 | 退出移入设置组底部，顶部保留、托盘 omit | 沿用现状（托盘 omitIds 机制不变） |

---

## 四、文件改动

### 4.1 `electron/menuTemplate.ts`（核心，整体替换 `getAppMenuDef` 相关）

- `FloatingTab` 删 `'query'`、加 `'infinite'`：
  ```ts
  export type FloatingTab = 'order' | 'kline' | 'infinite' | 'tquote' | 'settings' | 'ipc-monitor' | 'query-orders' | 'query-positions' | 'query-account';
  ```
- `MenuAction` 删 `{ type: 'toggle-perf' }`：
  ```ts
  export type MenuAction =
    | { type: 'market-view'; view: MarketView }
    | { type: 'open-floating'; tab: FloatingTab }
    | { type: 'open-market-window' }
    | { type: 'quit' };
  ```
- `getAppMenuDef()` 重排为四组（结构见 2.1）。菜单 id：`market` / `trade`（新）/ `query`（新顶层）/ `settings`。`app-quit` 移至设置组末尾，`omitIds: ['app-quit']` 托盘剔除机制不变。
- 删除「功能」（`function`）组与「性能监控」（`performance`）组。

### 4.2 无限下单 IPC 链路补齐

| 文件 | 改动 |
|---|---|
| `electron/menuTemplate.ts` | `FloatingTab` 加 `'infinite'`（见 4.1）；交易组 `trade-infinite` 菜单项 |
| `electron/preload.ts` | `onOpenFloatingTab` 类型（接口 + 实现 handler 两处）加 `'infinite'` |
| `src/services/electron.ts` | `onOpenFloatingTab` 回调类型加 `'infinite'` |
| `src/App.tsx` | `onOpenFloatingTab` switch 加 `case 'infinite': openInfiniteFloating(); break`；import 加 `openInfiniteFloating` |

> `openInfiniteFloating()` 已存在于 `utils/openFloatingTab.ts`（有选中合约则定位），无需新增。

### 4.3 FPS 完整下线（Electron 侧）

| 文件 | 改动 |
|---|---|
| `electron/menuTemplate.ts` | 删 `perf-fps` 菜单项与 `toggle-perf` action（见 4.1） |
| `electron/menuActions.ts` | 删 `case 'toggle-perf'` |
| `electron/ipc/index.ts` | 删 `MENU_TOGGLE_PERF: 'menu:toggle-perf'` |
| `electron/preload.ts` | 删 `onTogglePerf` 接口声明（第 34-35 行）与实现（第 89-94 行） |
| `src/services/electron.ts` | 删 `onTogglePerf` 类型声明（第 121 行） |

### 4.4 FPS 完整下线（Web 侧）

| 文件 | 改动 |
|---|---|
| `src/App.tsx` | 删 `perfVisible` state、`onTogglePerf` effect、`Ctrl+Shift+M` 快捷键 effect、`BottomBar` 的 `perfVisible`/`onTogglePerf` props；`useState` import 若不再使用则一并移除 |
| `src/components/BottomBar/index.tsx` | `BottomBarProps` 删 `perfVisible`/`onTogglePerf`；删 FPS 按钮 JSX、FPS 徽标 JSX、`PerfMonitor` import |
| `src/components/BottomBar/styles.css` | 删 FPS 徽标样式（第 76 行附近） |
| `src/components/PerfMonitor/` | `index.tsx` + `index.test.tsx` 整体删除（仅 BottomBar 引用） |

### 4.5 测试

| 文件 | 改动 |
|---|---|
| `electron/__tests__/menuTemplate.test.ts` | 一级菜单改 `['行情','交易','查询','设置']`；行情子菜单加 K线、T型报价改断言为「首个分隔符后」；新增交易/查询子菜单断言；设置子菜单 `['⚙ 设置','🔌 网络监控','退出']`；删「功能」「性能监控」用例；buildMenuFromDef 的 `toggle-perf` 夹具换 `open-floating` |
| `electron/__tests__/menuActions.test.ts` | 删 `toggle-perf` 用例 |
| `electron/__tests__/menuManager.test.ts` | 一级结构 `['行情','交易','查询','设置',undefined]`；「功能」describe 拆为「交易」（报单/无限下单）+「查询」（报单/持仓/资金）；K线点击移入行情；退出点击移入设置；删「性能监控」describe（FPS 用例删、网络监控移入设置） |
| `electron/__tests__/trayManager.test.ts` | 一级结构 `['行情','交易','查询','设置','---','退出']`；行情子菜单加 K线；新增交易/查询子菜单断言；「功能子菜单不包含退出」改「设置子菜单不包含退出」；删 FPS 点击用例 |
| `src/App.test.tsx` | 删 `onTogglePerf` 用例与 rAF stub；setElectronAPI mock 删 `onTogglePerf`；新增 `onOpenFloatingTab infinite` 用例 |
| `src/components/BottomBar/index.test.tsx` | 删 FPS 按钮 / FPS 徽标用例与 rAF stub；所有 `render(<BottomBar .../>)` 调用去掉 `perfVisible`/`onTogglePerf` props |

> `preload.test.ts` 无 FPS/toggle-perf 断言（已核对），无需改。

### 4.6 构建产物

- 重新编译并提交 `frontend/dist-electron/`（`main.cjs` / `preload.cjs` / `menuTemplate.cjs` / `ipc/index.cjs` 等），沿用 `d517579`「更新构建产物以匹配菜单入口」先例。
- 核对 `dist-electron/menuTemplate.cjs`：含「♾️ 无限下单窗口」「🔌 网络监控」，不含「⚡FPS 监控」「📋 查询窗口」「性能监控」。

---

## 五、测试策略

| 类型 | 内容 |
|---|---|
| 更新（Electron） | `menuTemplate` / `menuActions` / `menuManager` / `trayManager` 四类结构 + FPS 移除（见 4.5） |
| 更新（前端） | `App.test.tsx`（删 FPS、加 infinite）、`BottomBar.test.tsx`（删 FPS props/用例） |
| 删除 | `PerfMonitor/index.test.tsx` |
| 回归 | Electron 目录 `npm test`；前端全量 `npm test`（469− 用例）；`tsc` + `npm run build` + `electron:compile` |

---

## 六、迭代路线

- [ ] **Task 1 菜单四类重排**：`menuTemplate.ts` 四组结构 + `FloatingTab`/`MenuAction` 类型 + 无限下单/删查询窗口/删 FPS 菜单项；同步 `menuTemplate.test.ts`
- [ ] **Task 2 无限下单 IPC 链路**：`preload.ts` / `electron.ts` `onOpenFloatingTab` 加 `'infinite'` + `App.tsx` `case 'infinite'`；同步 `App.test.tsx`
- [ ] **Task 3 FPS 完整下线**：`menuActions` / `ipc/index` / `preload onTogglePerf` / `electron.ts` + `App.tsx` / `BottomBar` / `PerfMonitor` 删除；同步 `menuActions` / `App` / `BottomBar` 测试
- [ ] **Task 4 托盘与菜单行为测试同步**：`trayManager.test.ts` / `menuManager.test.ts`
- [ ] **Task 5 全量回归 + 重建 dist-electron**：前端/Electron 全量测试 + `tsc` + 构建 + 重新编译 `dist-electron` 提交

---

## 七、决策记录

| # | 决策 | 依据 |
|---|---|---|
| 1 | 四类分组（行情/交易/查询/设置） | 用户指定 |
| 2 | K线归行情、报单归交易 | 行情图表 vs 报单操作的业务语义 |
| 3 | 无限下单加入交易菜单 | 用户指定；补齐 `open-floating infinite` IPC 链路 |
| 4 | 旧查询窗口菜单项移除，代码层删除留给查询解散 Task | 与 `2026-08-14-query-dissolve-account-window` 计划 Task 4 衔接，避免范围重复 |
| 5 | FPS 完整下线（含 Web 端按钮/快捷键/组件/IPC） | 用户指定「完整下线」 |
| 6 | 性能监控组解散，网络监控并入设置 | 四类化后无独立分组必要 |
| 7 | 托盘镜像四组（方案 A） | 用户指定；单一真源，改动最小 |
| 8 | 退出留在设置组底部，托盘 omit | 沿用现有 omitIds 机制 |

---

*文档版本：v1.0 | 生成日期：2026-08-14*
