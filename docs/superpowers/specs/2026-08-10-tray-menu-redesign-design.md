# 托盘菜单功能改造 — 设计文档

日期：2026-08-10
分支：`feature/scrollbar-refactor`
范围：前端 Electron 主进程（无后端、无渲染层业务改动）

## 背景

当前存在两套菜单，功能重叠但结构不一致：

| 项 | 顶部原生菜单（`menuManager.ts`） | 托盘菜单（`trayManager.ts`） |
|---|---|---|
| 行情视图 | 📊 全部行情 / 📉 T型期权 / ⭐ 自选行情 / 🪟 在新窗口打开 | 📊 全部行情 / ⭐ 自选行情（缺 T型期权、缺「在新窗口打开」） |
| 功能窗口 | 📝 报单窗口 / 📈 K线窗口 / 📋 查询窗口 / 退出 | 📋 查询窗口（缺 报单/K线） |
| 设置 | ⚙ 设置 | ⚙ 设置 |
| 性能监控 | ⚡FPS 监控 / 🔌 网络监控 | 🔌 网络监控（缺 FPS） |
| 结构 | 平铺子菜单（4 组） | 完全平铺（无子菜单） |

**两个问题：**

1. **结构漂移**：托盘是顶部菜单的手写子集，顶部菜单增删项时托盘不会自动同步，已出现 5 处缺失。
2. **行为不一致**：托盘「退出」走 `mainWindow.destroy()` + `tray.destroy()`，顶部「退出」走 `app.quit()`，退出语义不统一。

**需求**：托盘菜单全面模仿顶部原生菜单功能 —— 补齐全部缺失项、按原生分组组织成子菜单，并通过单一菜单定义源消除漂移。

## 范围

- 新增：`frontend/electron/menuTemplate.ts`（共享菜单定义）、`menuActions.ts`（共享点击行为）、`__tests__/menuTemplate.test.ts`、`__tests__/menuActions.test.ts`。
- 改造：`trayManager.ts`、`menuManager.ts`、`main.ts`（向托盘传入 `windowManager`）、`__tests__/trayManager.test.ts`、`__tests__/menuManager.test.ts`。
- 不动：`ipc/index.ts` 通道（复用现有 `MENU_*` 通道）、preload、渲染层 `App.tsx` 监听逻辑。

## §1 目标托盘菜单结构

```
Tray 托盘菜单
├── 行情 ▶                     ← 与原生菜单完全一致
│   ├── 📊 全部行情
│   ├── 📉 T型期权
│   ├── ⭐ 自选行情
│   ├── ── separator ──
│   └── 🪟 在新窗口打开
├── 功能 ▶
│   ├── 📝 报单窗口
│   ├── 📈 K线窗口
│   ├── 📋 查询窗口
│   └── ── separator ──
├── 设置 ▶
│   └── ⚙ 设置
├── 性能监控 ▶
│   ├── ⚡FPS 监控
│   └── 🔌 网络监控
├── ── separator ──
└── 退出
```

**与原生菜单的差异（有意为之）：**

1. **「退出」提到一级底部**：原生菜单中「退出」嵌在「功能」子菜单末尾；托盘遵循平台惯例把「退出」放在一级菜单底部，保持可见可点。「功能」子菜单则只保留 报单/K线/查询 三个开窗项。
2. 原生菜单的 `role: 'viewMenu'`（默认缩放/复制/开发者工具）**不进入托盘**——托盘是右键上下文菜单，不需要该组。

## §2 单源共享模板（核心）

新建 `menuTemplate.ts`，用**纯数据**描述四组菜单（行情/功能/设置/性能监控），顶部菜单与托盘都从同一份定义构建，彻底消除漂移。

### 菜单定义（数据）

```ts
// menuTemplate.ts —— 纯结构，无 electron 依赖，可独立单测
export type MarketView = 'all' | 'options' | 'favorites';
export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor';
export type MenuAction =
  | { type: 'market-view'; view: MarketView }        // 行情主页内切视图
  | { type: 'open-floating'; tab: FloatingTab }      // 打开浮动窗
  | { type: 'open-market-window' }                   // 行情「在新窗口打开」
  | { type: 'toggle-perf' }                          // 切换 FPS 监控
  | { type: 'quit' };                                // 退出应用

export interface MenuItemDef {
  id: string;                 // 稳定 id，测试定位用
  label?: string;
  type?: 'normal' | 'separator';
  action?: MenuAction;
  submenu?: MenuItemDef[];
}

// 四组原生菜单定义 —— 唯一的菜单真源
export function getAppMenuDef(): MenuItemDef[] { /* 行情/功能/设置/性能监控 */ }
```

### 共享点击行为

新建 `menuActions.ts`，把每个 `action` 映射到真实行为。顶部与托盘点击行为完全相同（唤出主窗口 + 发 IPC / 调 windowManager），行为只实现一次：

```ts
// menuActions.ts
export interface MenuContext {
  mainWindow: BrowserWindow;
  windowManager: WindowManager;
}
export type ActionHandler = (ctx: MenuContext) => void;

export function resolveAction(action: MenuAction, ctx: MenuContext): void {
  switch (action.type) {
    case 'market-view':   return showAndSend(ctx, IPC_CHANNELS.MENU_MARKET_VIEW, action.view);
    case 'open-floating': return showAndSend(ctx, IPC_CHANNELS.MENU_OPEN_FLOATING, action.tab);
    case 'open-market-window': return ctx.windowManager.openTabWindow('market', 'tab-market', '📊 行情');
    case 'toggle-perf':   return ctx.mainWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_PERF);
    case 'quit':          return app.quit();
  }
}
```

说明：

- `showAndSend` 封装「`show()` + `focus()` + `webContents.send()`」，与当前托盘/顶部菜单行为一致。
- **守卫必须继承**：`showAndSend` 内部保留 `mainWindow && !mainWindow.isDestroyed()` 判断（对应现有 `sendOpenFloating/sendMarketView/sendTogglePerf` 的守卫，以及「主窗口已销毁时不发送 IPC」用例）；`open-market-window` 保留 `if (windowManager)` 存在性判断（对应现有 `openMarketInNewWindow`）。删私有方法时这两处守卫一并迁入共享实现，不可丢失。
- 「退出」统一走 `app.quit()`（顶部与托盘一致，`will-quit` 已统一清理快捷键/通知/后端）。

### 模板 → Electron 菜单

`menuTemplate.ts` 另导出构建函数，把 `MenuItemDef[]` + 当前 `MenuContext` 渲染成 Electron 模板：

```ts
export function buildMenuFromDef(
  def: MenuItemDef[],
  ctx: MenuContext,
): MenuItemConstructorOptions[]
```

点击项：`click: () => action && resolveAction(action, ctx)`；分隔符：`{ type: 'separator' }`；子菜单：递归 `submenu`。

## §3 顶部菜单改造（menuManager.ts）

- `initialize(mainWindow, windowManager)` 内部改为：
  ```ts
  const appMenu = buildMenuFromDef(getAppMenuDef(), { mainWindow, windowManager });
  Menu.setApplicationMenu(Menu.buildFromTemplate([...appMenu, { role: 'viewMenu' }]));
  ```
- 删除 `sendOpenFloating` / `sendMarketView` / `openMarketInNewWindow` 等私有方法（行为已并入 `menuActions.ts`），`sendTogglePerf` 同步移除。
- 对外行为不变：顶部菜单项、label、IPC 通道完全保持现状（现有 `menuManager.test.ts` 断言应继续通过，仅 mock 方式微调）。

## §4 托盘实现（trayManager.ts）

- `initialize` 签名改为 `initialize(mainWindow: BrowserWindow, windowManager: WindowManager)`（`main.ts` 同步传入）。
- 托盘模板 = 托盘专属头尾 + 共享四组定义：

  ```ts
  const def: MenuItemDef[] = [
    ...getAppMenuDef(),          // 行情/功能/设置/性能监控（全部子菜单）
    { type: 'separator' },
    { id: 'quit', label: '退出', action: { type: 'quit' } },
  ];
  this.tray.setContextMenu(Menu.buildFromTemplate(buildMenuFromDef(def, ctx)));
  ```

- 保留：托盘图标点击切换显示/隐藏、关闭主窗口最小化到托盘、`showNotification`、tooltip `'SimNow 交易终端'`。
- **退出必须配套 quit 标志位**：托盘 `initialize` 现注册的 `mainWindow.on('close')` 无条件 `preventDefault()`（最小化到托盘）。而 Electron 的 `app.quit()` 在任一窗口 close 被 preventDefault 时会中止退出 —— 因此当前顶部菜单「退出」实际无法退出（被托盘 close 拦截）。统一走 `app.quit()` 后必须新增 `isQuitting` 标志：`app.on('before-quit', () => { isQuitting = true })`，close 处理改为 `if (!isQuitting) { event.preventDefault(); hide() }`。否则托盘「退出」同样退不掉。

## §5 点击行为映射表

| 菜单项 | Action | 行为 |
|---|---|---|
| 📊 全部行情 / 📉 T型期权 / ⭐ 自选行情 | `market-view` | show+focus 主窗 → send `menu:market-view <view>` |
| 🪟 在新窗口打开 | `open-market-window` | `windowManager.openTabWindow('market','tab-market','📊 行情')` |
| 📝 报单 / 📈 K线 / 📋 查询 | `open-floating` | show+focus 主窗 → send `menu:open-floating <tab>` |
| ⚙ 设置 | `open-floating` | show+focus 主窗 → send `menu:open-floating settings` |
| ⚡FPS 监控 | `toggle-perf` | send `menu:toggle-perf` |
| 🔌 网络监控 | `open-floating` | send `menu:open-floating ipc-monitor` |
| 退出 | `quit` | `app.quit()` |

## §6 IPC / 类型改动

- **无新 IPC 通道**：全部复用 `IPC_CHANNELS.MENU_MARKET_VIEW / MENU_OPEN_FLOATING / MENU_TOGGLE_PERF`。
- 渲染层 `App.tsx` 对 `onMarketView / onOpenFloatingTab / onTogglePerf` 的监听**零改动**（托盘发出的消息与顶部菜单同一通道、同一 payload）。
- `menuActions.ts` 中 `MenuContext` 复用现有 `WindowManager` 类型。

## §7 测试

| 文件 | 改动 |
|---|---|
| `__tests__/menuTemplate.test.ts`（新建） | 断言 `getAppMenuDef()` 四组结构、各子菜单 label 顺序、分隔符位置、action 类型与参数（纯数据，无 electron mock） |
| `__tests__/menuActions.test.ts`（新建） | 逐项断言 `resolveAction` 的 IPC 发送 / `openTabWindow` / `app.quit()`（mock electron） |
| `__tests__/trayManager.test.ts` | 重构为断言新树：一级顺序（行情/功能/设置/性能监控 四组 → 分隔符 → 退出）、子菜单完整镜像、逐项点击行为、退出调 `app.quit()` |
| `__tests__/menuManager.test.ts` | 断言顶部菜单 = `getAppMenuDef()` 渲染 + 末尾 `viewMenu`；原有 label/点击用例保留 |
| `main.ts` 相关用例 | `trayManager.initialize` 调用处传入 `windowManager` |

前端全量测试 + `npm run build` 通过。

## 不做（Out of scope）

- 不改托盘图标点击切换显示/隐藏、最小化到托盘、通知气球逻辑。
- 不做动态/勾选菜单（FPS 状态、连接状态不反映为托盘内 checkmark）——「全面模仿」以原生菜单行为为准，原生 FPS 亦为普通点击。
- 不做 tooltip 动态连接状态（`BackendManager` 状态不接入托盘，tooltip 保持静态文案）。
- 不动渲染层菜单监听与浮动窗/标签逻辑。
- 不引入菜单持久化或配置化（不改 `docs/specs/redesign-plan.md` 既有菜单分组语义）。
