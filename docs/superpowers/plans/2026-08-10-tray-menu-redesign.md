# 托盘菜单功能改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 托盘菜单全面镜像顶部原生菜单（四组子菜单 + 一级底部退出），并通过单源共享菜单定义消除两处菜单的漂移；统一退出为 `app.quit()` 并修复被窗口 close 拦截导致无法退出的问题。

**Architecture:** 新增 `menuTemplate.ts`（纯数据菜单定义 + 渲染器）与 `menuActions.ts`（共享点击行为）作为唯一菜单真源；`MenuManager` 与 `TrayManager` 都从同一份定义构建。托盘通过 `omitIds` 剔除「功能」内嵌的退出并放到一级底部；退出统一走 `app.quit()`，配套新增 `isQuitting` 标志（`app.on('before-quit')`）放行窗口关闭。

**Tech Stack:** Electron 43（main process）、TypeScript 5（strict）、Vitest 1.6（jsdom）。

## Global Constraints

- Electron 源码（`frontend/electron/`）由 `npm run electron:compile` 编译（`tsc -p electron/tsconfig.json`，commonjs + strict），**不受 `npm run build` 覆盖**。任务提交前必须通过 `npm run electron:compile`。
- 测试：vitest（jsdom），`frontend/` 下 `npm test`（= `vitest run`）；Electron 测试位于 `frontend/electron/__tests__/`（被 tsc exclude，不参与类型检查）。
- 每个 Electron 测试文件必须 `vi.mock('electron', ...)`（沿用现有模式）。
- 共享行为必须保留守卫：`showAndSend` 内 `mainWindow && !mainWindow.isDestroyed()`；`open-market-window` 内 `if (windowManager)`。删私有方法时守卫一并迁入。
- 菜单 label/emoji 必须与现有断言完全一致：`行情/功能/设置/性能监控`、`📊 全部行情`、`📉 T型期权`、`⭐ 自选行情`、`🪟 在新窗口打开`、`📝 报单窗口`、`📈 K线窗口`、`📋 查询窗口`、`⚙ 设置`、`⚡FPS 监控`、`🔌 网络监控`、`退出`。
- 无新增 IPC 通道，全部复用 `IPC_CHANNELS.MENU_MARKET_VIEW / MENU_OPEN_FLOATING / MENU_TOGGLE_PERF`。
- 提交用 `git add <具体文件>`（**严禁 `git add -A`**）。工作区另有与本任务无关的未提交改动（`frontend/dist-electron/*.cjs`、`*.docx`），不要纳入。
- 提交风格沿用仓库：`feat(electron): ...` / `refactor(electron): ...`。
- 设计文档 `docs/superpowers/specs/2026-08-10-tray-menu-redesign-design.md` 与本文档可随首个任务提交一并纳入。

---

### Task 1: 共享菜单模板与行为（menuTemplate.ts + menuActions.ts）

**Files:**
- Create: `frontend/electron/menuTemplate.ts`
- Create: `frontend/electron/menuActions.ts`
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`
- Test: `frontend/electron/__tests__/menuActions.test.ts`

**Interfaces:**
- Produces:
  - `menuTemplate.ts`: `export type MarketView = 'all' | 'options' | 'favorites'`；`export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor'`；`export type MenuAction = { type:'market-view'; view: MarketView } | { type:'open-floating'; tab: FloatingTab } | { type:'open-market-window' } | { type:'toggle-perf' } | { type:'quit' }`；`export interface MenuItemDef { id: string; label?: string; type?: 'normal'|'separator'; action?: MenuAction; submenu?: MenuItemDef[] }`；`export interface BuildOptions { omitIds?: string[] }`；`export function getAppMenuDef(): MenuItemDef[]`；`export function buildMenuFromDef(def: MenuItemDef[], ctx: MenuContext, options?: BuildOptions): MenuItemConstructorOptions[]`。
  - `menuActions.ts`: `export interface MenuContext { mainWindow: BrowserWindow; windowManager: WindowManager }`；`export function resolveAction(action: MenuAction, ctx: MenuContext): void`。
  - Later tasks consume: `buildMenuFromDef(getAppMenuDef(), ctx)`（顶部）、`buildMenuFromDef([...getAppMenuDef(), sep, tray-quit], ctx, { omitIds: ['app-quit'] })`（托盘）。

- [ ] **Step 1: 编写两个测试文件（红）**

`frontend/electron/__tests__/menuActions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { quit: vi.fn() },
}));

import { app } from 'electron';
import { resolveAction } from '../menuActions';
import { IPC_CHANNELS } from '../ipc/index';

describe('resolveAction', () => {
  let ctx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = {
      mainWindow: {
        show: vi.fn(),
        focus: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: vi.fn() },
      },
      windowManager: { openTabWindow: vi.fn() },
    };
  });

  it('market-view: show+focus 主窗并发送 menu:market-view', () => {
    resolveAction({ type: 'market-view', view: 'all' }, ctx);
    expect(ctx.mainWindow.show).toHaveBeenCalled();
    expect(ctx.mainWindow.focus).toHaveBeenCalled();
    expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'all');
  });

  it('open-floating: show+focus 主窗并发送 menu:open-floating', () => {
    resolveAction({ type: 'open-floating', tab: 'query' }, ctx);
    expect(ctx.mainWindow.show).toHaveBeenCalled();
    expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query');
  });

  it('open-market-window: 调 windowManager.openTabWindow', () => {
    resolveAction({ type: 'open-market-window' }, ctx);
    expect(ctx.windowManager.openTabWindow).toHaveBeenCalledWith('market', 'tab-market', '📊 行情');
  });

  it('toggle-perf: 发送 menu:toggle-perf 但不 show/focus', () => {
    resolveAction({ type: 'toggle-perf' }, ctx);
    expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_TOGGLE_PERF);
    expect(ctx.mainWindow.show).not.toHaveBeenCalled();
    expect(ctx.mainWindow.focus).not.toHaveBeenCalled();
  });

  it('quit: 调用 app.quit', () => {
    resolveAction({ type: 'quit' }, ctx);
    expect(app.quit).toHaveBeenCalled();
  });

  it('主窗口已销毁时 market-view 不发送 IPC 也不 show', () => {
    ctx.mainWindow.isDestroyed.mockReturnValue(true);
    resolveAction({ type: 'market-view', view: 'all' }, ctx);
    expect(ctx.mainWindow.webContents.send).not.toHaveBeenCalled();
    expect(ctx.mainWindow.show).not.toHaveBeenCalled();
  });

  it('windowManager 为 undefined 时 open-market-window 不抛错', () => {
    const bare = { mainWindow: ctx.mainWindow, windowManager: undefined };
    expect(() => resolveAction({ type: 'open-market-window' }, bare)).not.toThrow();
  });
});
```

`frontend/electron/__tests__/menuTemplate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// menuTemplate → menuActions → electron.app，需 mock
vi.mock('electron', () => ({
  app: { quit: vi.fn() },
}));

import { app } from 'electron';
import { getAppMenuDef, buildMenuFromDef } from '../menuTemplate';
import type { MenuItemDef } from '../menuTemplate';

interface TemplateItem {
  label?: string;
  type?: string;
  submenu?: TemplateItem[];
  click?: () => void;
}

describe('getAppMenuDef', () => {
  it('返回四组一级菜单：行情/功能/设置/性能监控', () => {
    const def = getAppMenuDef();
    expect(def.map((d) => d.label)).toEqual(['行情', '功能', '设置', '性能监控']);
  });

  it('行情子菜单完整镜像：全部/T型/自选/分隔符/在新窗口打开', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const labels = market.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📊 全部行情', '📉 T型期权', '⭐ 自选行情', '🪟 在新窗口打开']);
  });

  it('行情「在新窗口打开」action 为 open-market-window', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const newWindow = market.submenu!.find((i) => i.id === 'market-new-window')!;
    expect(newWindow.action).toEqual({ type: 'open-market-window' });
  });

  it('功能子菜单包含报单/K线/查询/分隔符/退出(app-quit)', () => {
    const fnMenu = getAppMenuDef().find((d) => d.id === 'function')!;
    const labels = fnMenu.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 查询窗口', '退出']);
    expect(fnMenu.submenu!.some((i) => i.id === 'app-quit')).toBe(true);
  });

  it('设置子菜单仅 ⚙ 设置', () => {
    const settings = getAppMenuDef().find((d) => d.id === 'settings')!;
    expect(settings.submenu!.map((i) => i.label).filter(Boolean)).toEqual(['⚙ 设置']);
  });

  it('性能监控子菜单包含 FPS 监控 与 网络监控', () => {
    const perf = getAppMenuDef().find((d) => d.id === 'performance')!;
    const labels = perf.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['⚡FPS 监控', '🔌 网络监控']);
  });
});

describe('buildMenuFromDef', () => {
  const ctx = { mainWindow: {} as any, windowManager: {} as any };

  it('分隔符渲染为 { type: separator }', () => {
    const def: MenuItemDef[] = [
      { id: 'a', label: 'A', action: { type: 'toggle-perf' } },
      { id: 's', type: 'separator' },
    ];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    expect(tpl[0].label).toBe('A');
    expect(tpl[1]).toEqual({ type: 'separator' });
  });

  it('子菜单递归渲染', () => {
    const def: MenuItemDef[] = [
      { id: 'g', label: 'G', submenu: [{ id: 'c', label: 'C', action: { type: 'quit' } }] },
    ];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    expect(tpl[0].submenu![0].label).toBe('C');
  });

  it('omitIds 递归剔除指定 id 的条目', () => {
    const def: MenuItemDef[] = [
      { id: 'g', label: 'G', submenu: [{ id: 'drop', label: 'D', action: { type: 'quit' } }] },
    ];
    const tpl = buildMenuFromDef(def, ctx, { omitIds: ['drop'] }) as unknown as TemplateItem[];
    expect(tpl[0].submenu!.length).toBe(0);
  });

  it('点击项 click 触发 resolveAction（quit → app.quit）', () => {
    const def: MenuItemDef[] = [{ id: 'q', label: '退出', action: { type: 'quit' } }];
    const tpl = buildMenuFromDef(def, ctx) as unknown as TemplateItem[];
    tpl[0].click!();
    expect(app.quit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认红**

Run: `npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts`（在 `frontend/` 下）
Expected: FAIL —— 无法解析 `../menuTemplate` / `../menuActions` 模块。

- [ ] **Step 3: 实现 menuActions.ts**

Create `frontend/electron/menuActions.ts`:

```ts
/**
 * Shared Menu Actions
 *
 * Maps MenuAction (menuTemplate.ts) to real behavior shared by the top app menu
 * and the tray context menu. Both menus call resolveAction for every click.
 */

import { app } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc/index';
import type { MenuAction } from './menuTemplate';
import type { WindowManager } from './windowManager';

export interface MenuContext {
  mainWindow: BrowserWindow;
  windowManager: WindowManager;
}

/**
 * show + focus 主窗口并发送 IPC。
 * 守卫与现有私有方法一致：主窗口不存在/已销毁时不操作不发送。
 */
function showAndSend(ctx: MenuContext, channel: string, ...args: unknown[]): void {
  if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
    ctx.mainWindow.webContents.send(channel, ...args);
  }
}

export function resolveAction(action: MenuAction, ctx: MenuContext): void {
  switch (action.type) {
    case 'market-view':
      return showAndSend(ctx, IPC_CHANNELS.MENU_MARKET_VIEW, action.view);
    case 'open-floating':
      return showAndSend(ctx, IPC_CHANNELS.MENU_OPEN_FLOATING, action.tab);
    case 'open-market-window':
      if (ctx.windowManager) {
        ctx.windowManager.openTabWindow('market', 'tab-market', '📊 行情');
      }
      return;
    case 'toggle-perf':
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_PERF);
      }
      return;
    case 'quit':
      app.quit();
      return;
  }
}
```

- [ ] **Step 4: 实现 menuTemplate.ts**

Create `frontend/electron/menuTemplate.ts`:

```ts
/**
 * Shared Menu Template
 *
 * Single source of truth for the application menus.
 * The top app menu and the tray context menu both build from getAppMenuDef(),
 * so adding/removing items in one place keeps both in sync.
 */

import type { MenuItemConstructorOptions } from 'electron';
import { resolveAction } from './menuActions';
import type { MenuContext } from './menuActions';

export type MarketView = 'all' | 'options' | 'favorites';
export type FloatingTab = 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor';

export type MenuAction =
  | { type: 'market-view'; view: MarketView }
  | { type: 'open-floating'; tab: FloatingTab }
  | { type: 'open-market-window' }
  | { type: 'toggle-perf' }
  | { type: 'quit' };

export interface MenuItemDef {
  id: string;
  label?: string;
  type?: 'normal' | 'separator';
  action?: MenuAction;
  submenu?: MenuItemDef[];
}

export interface BuildOptions {
  /** 按 id 递归剔除的条目（托盘把「功能」内嵌的退出移到底部） */
  omitIds?: string[];
}

/**
 * 四组原生菜单定义 —— 唯一的菜单真源。
 * 「功能」子菜单末尾的退出（id 'app-quit'）仅顶部菜单保留；托盘 omitIds: ['app-quit'] 剔除并放到一级底部。
 */
export function getAppMenuDef(): MenuItemDef[] {
  return [
    {
      id: 'market',
      label: '行情',
      submenu: [
        { id: 'market-all', label: '📊 全部行情', action: { type: 'market-view', view: 'all' } },
        { id: 'market-options', label: '📉 T型期权', action: { type: 'market-view', view: 'options' } },
        { id: 'market-favorites', label: '⭐ 自选行情', action: { type: 'market-view', view: 'favorites' } },
        { id: 'market-sep1', type: 'separator' },
        { id: 'market-new-window', label: '🪟 在新窗口打开', action: { type: 'open-market-window' } },
      ],
    },
    {
      id: 'function',
      label: '功能',
      submenu: [
        { id: 'func-order', label: '📝 报单窗口', action: { type: 'open-floating', tab: 'order' } },
        { id: 'func-kline', label: '📈 K线窗口', action: { type: 'open-floating', tab: 'kline' } },
        { id: 'func-query', label: '📋 查询窗口', action: { type: 'open-floating', tab: 'query' } },
        { id: 'func-sep1', type: 'separator' },
        { id: 'app-quit', label: '退出', action: { type: 'quit' } },
      ],
    },
    {
      id: 'settings',
      label: '设置',
      submenu: [
        { id: 'settings-main', label: '⚙ 设置', action: { type: 'open-floating', tab: 'settings' } },
      ],
    },
    {
      id: 'performance',
      label: '性能监控',
      submenu: [
        { id: 'perf-fps', label: '⚡FPS 监控', action: { type: 'toggle-perf' } },
        { id: 'perf-ipc', label: '🔌 网络监控', action: { type: 'open-floating', tab: 'ipc-monitor' } },
      ],
    },
  ];
}

/** 渲染：MenuItemDef[] + MenuContext → Electron 菜单模板 */
export function buildMenuFromDef(
  def: MenuItemDef[],
  ctx: MenuContext,
  options: BuildOptions = {},
): MenuItemConstructorOptions[] {
  const omit = new Set(options.omitIds ?? []);
  const walk = (items: MenuItemDef[]): MenuItemConstructorOptions[] =>
    items
      .filter((item) => !omit.has(item.id))
      .map((item): MenuItemConstructorOptions => {
        if (item.type === 'separator') {
          return { type: 'separator' };
        }
        return {
          label: item.label,
          submenu: item.submenu ? walk(item.submenu) : undefined,
          click: item.action ? () => resolveAction(item.action!, ctx) : undefined,
        };
      });
  return walk(def);
}
```

- [ ] **Step 5: 运行测试确认绿**

Run: `npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts`（在 `frontend/` 下）
Expected: PASS（menuActions 7 个 + menuTemplate 10 个 = 17 个用例）。

- [ ] **Step 6: 编译校验**

Run: `npm run electron:compile`（在 `frontend/` 下）
Expected: 成功，`dist-electron/menuTemplate.js` / `menuActions.js` 生成（重命名为 .cjs）。若有 strict 报错，修正后重跑。

- [ ] **Step 7: 提交**

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/menuActions.ts
git add frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuActions.test.ts
git add docs/superpowers/specs/2026-08-10-tray-menu-redesign-design.md docs/superpowers/plans/2026-08-10-tray-menu-redesign.md
git commit -m "feat(electron): 新增共享菜单定义源 menuTemplate/menuActions"
```

---

### Task 2: 顶部菜单改造（menuManager.ts）

**Files:**
- Modify: `frontend/electron/menuManager.ts`
- Test: `frontend/electron/__tests__/menuManager.test.ts`（仅 mock 微调）

**Interfaces:**
- Consumes: `getAppMenuDef()`、`buildMenuFromDef(def, ctx)`（来自 Task 1）。
- Produces: `MenuManager.initialize(mainWindow, windowManager)` 行为不变（构建 行情/功能/设置/性能监控 + `role:'viewMenu'` 的应用菜单）。

- [ ] **Step 1: 微调测试 mock（补齐 show/focus）**

`menuManager.test.ts` 中 mainWindow mock 增加 `show`/`focus`（共享行为 showAndSend 会调用它们）：

```ts
mainWindow = {
  show: vi.fn(),
  focus: vi.fn(),
  webContents: { send: webContentsSend },
  isDestroyed: () => false,
};
```

其余断言不动。

- [ ] **Step 2: 运行测试确认当前实现下仍绿（作为基线）**

Run: `npx vitest run electron/__tests__/menuManager.test.ts`（在 `frontend/` 下）
Expected: PASS（现有实现 + show/focus mock 不冲突）。

- [ ] **Step 3: 重写 menuManager.ts 使用共享模板**

Replace `frontend/electron/menuManager.ts` entirely with:

```ts
/**
 * Menu Manager
 *
 * Builds the application menu bar from the shared menu template (menuTemplate.ts):
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 * Click behavior lives in menuActions.ts.
 */

import { Menu } from 'electron';
import type { BrowserWindow } from 'electron';
import { buildMenuFromDef, getAppMenuDef } from './menuTemplate';
import type { WindowManager } from './windowManager';

/**
 * MenuManager class
 */
export class MenuManager {
  /**
   * Set the application menu: app menus built from the shared template + default View.
   */
  initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void {
    const appMenu = buildMenuFromDef(getAppMenuDef(), { mainWindow, windowManager });
    Menu.setApplicationMenu(Menu.buildFromTemplate([...appMenu, { role: 'viewMenu' }]));
  }
}
```

删除原 `sendOpenFloating` / `sendMarketView` / `openMarketInNewWindow` / `sendTogglePerf` 私有方法、`IPC_CHANNELS` 与 `MenuItemConstructorOptions` import。

- [ ] **Step 4: 运行测试确认绿**

Run: `npx vitest run electron/__tests__/menuManager.test.ts`（在 `frontend/` 下）
Expected: PASS —— 顶部菜单 label/点击行为/IPC 与改造前一致（「已销毁不发送」用例由共享守卫保证）。

- [ ] **Step 5: 编译校验 + 提交**

```bash
npm run electron:compile   # 期望成功
git add frontend/electron/menuManager.ts frontend/electron/__tests__/menuManager.test.ts
git commit -m "refactor(electron): 顶部菜单改由共享菜单定义构建"
```

---

### Task 3: 托盘菜单改造与退出标志（trayManager.ts + main.ts）

**Files:**
- Modify: `frontend/electron/trayManager.ts`
- Modify: `frontend/electron/main.ts:84-85`
- Test: `frontend/electron/__tests__/trayManager.test.ts`（重写）

**Interfaces:**
- Consumes: `getAppMenuDef()`、`buildMenuFromDef(def, ctx, { omitIds })`、`MenuAction`（来自 Task 1）。
- Produces: `TrayManager.initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void`（新签名）；`app.on('before-quit')` 置 `isQuitting`。

- [ ] **Step 1: 重写 trayManager.test.ts（先红）**

Replace `frontend/electron/__tests__/trayManager.test.ts` entirely with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { quit: vi.fn(), on: vi.fn() },
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    displayBalloon: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn((template) => template),
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({}),
    createEmpty: vi.fn().mockReturnValue({}),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
    isVisible: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    webContents: { send: vi.fn() },
  })),
}));

import { Menu, BrowserWindow, app } from 'electron';
import { TrayManager } from '../trayManager';
import { IPC_CHANNELS } from '../ipc/index';

interface TemplateItem {
  label?: string;
  type?: string;
  submenu?: TemplateItem[];
  click?: () => void;
}

describe('TrayManager', () => {
  const buildFromTemplate = Menu.buildFromTemplate as unknown as ReturnType<typeof vi.fn>;
  let mainWindow: any;
  let windowManager: any;

  const getTemplate = (): TemplateItem[] => buildFromTemplate.mock.calls[0][0];
  const clickItem = (itemLabel: string): void => {
    const findIn = (items: TemplateItem[]): TemplateItem | undefined => {
      for (const i of items) {
        if (i.label === itemLabel) return i;
        if (i.submenu) {
          const found = findIn(i.submenu);
          if (found) return found;
        }
      }
      return undefined;
    };
    const item = findIn(getTemplate());
    item!.click!();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mainWindow = new BrowserWindow() as any;
    windowManager = { openTabWindow: vi.fn() };
  });

  it('should export TrayManager class', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    expect(typeof TM).toBe('function');
  });

  it('should return null for getTray before initialization', () => {
    const manager = new TrayManager();
    expect(manager.getTray()).toBeNull();
  });

  it('initialize 设置托盘上下文菜单', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    expect(manager.getTray()!.setContextMenu).toHaveBeenCalled();
  });

  it('一级菜单结构：行情/功能/设置/性能监控/分隔符/退出', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const sig = getTemplate().map((i) => (i.type === 'separator' ? '---' : i.label));
    expect(sig).toEqual(['行情', '功能', '设置', '性能监控', '---', '退出']);
  });

  it('功能子菜单不包含退出（已提到一级底部）', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const fnMenu = getTemplate().find((i) => i.label === '功能')!;
    const labels = fnMenu.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📝 报单窗口', '📈 K线窗口', '📋 查询窗口']);
  });

  it('行情子菜单完整镜像：全部/T型/自选/新窗口', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const market = getTemplate().find((i) => i.label === '行情')!;
    const labels = market.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📊 全部行情', '📉 T型期权', '⭐ 自选行情', '🪟 在新窗口打开']);
  });

  it('点击全部行情发送 menu:market-view all 并显示主窗口', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📊 全部行情');
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'all');
  });

  it('点击T型期权发送 menu:market-view options', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📉 T型期权');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'options');
  });

  it('点击在新窗口打开调用 windowManager.openTabWindow', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('🪟 在新窗口打开');
    expect(windowManager.openTabWindow).toHaveBeenCalledWith('market', 'tab-market', '📊 行情');
  });

  it('点击报单窗口发送 menu:open-floating order', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📝 报单窗口');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'order');
  });

  it('点击K线窗口发送 menu:open-floating kline', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📈 K线窗口');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'kline');
  });

  it('点击查询窗口发送 menu:open-floating query', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📋 查询窗口');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query');
  });

  it('点击设置发送 menu:open-floating settings', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('⚙ 设置');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'settings');
  });

  it('点击FPS监控发送 menu:toggle-perf', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('⚡FPS 监控');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_TOGGLE_PERF);
  });

  it('点击网络监控发送 menu:open-floating ipc-monitor', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('🔌 网络监控');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'ipc-monitor');
  });

  it('点击退出调用 app.quit', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('退出');
    expect(app.quit).toHaveBeenCalled();
  });

  it('before-quit 置位后主窗口 close 不再被拦截（可正常退出）', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);

    const closeCalls = mainWindow.on.mock.calls as [string, (e: { preventDefault: () => void }) => void][];
    const closeHandler = closeCalls.find(([ch]) => ch === 'close')![1];
    const event = { preventDefault: vi.fn() };

    // 未退出：拦截并隐藏
    closeHandler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);

    // 触发 before-quit
    const beforeQuitCalls = app.on.mock.calls as [string, () => void][];
    const beforeQuitHandler = beforeQuitCalls.find(([ch]) => ch === 'before-quit')![1];
    beforeQuitHandler();

    // 退出中：放行，不再 preventDefault
    closeHandler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认红**

Run: `npx vitest run electron/__tests__/trayManager.test.ts`（在 `frontend/` 下）
Expected: FAIL —— 新断言（一级结构、子菜单镜像、app.quit 等）不满足旧实现。

- [ ] **Step 3: 重写 trayManager.ts**

Replace `frontend/electron/trayManager.ts` entirely with:

```ts
/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * The context menu mirrors the top application menu (shared template, menuTemplate.ts)
 * plus a top-level 退出 item. Supports tray icon, context menu, and notifications.
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { buildMenuFromDef, getAppMenuDef } from './menuTemplate';
import type { MenuItemDef } from './menuTemplate';
import type { WindowManager } from './windowManager';

// Tray notification types
export interface TrayNotification {
  title: string;
  content: string;
}

/**
 * TrayManager class
 */
export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  /**
   * Initialize the tray with a main window and window manager reference.
   * The context menu mirrors the native app menu (shared template) with 退出 at the bottom.
   */
  initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void {
    this.mainWindow = mainWindow;

    // 退出标志：app.quit() 时放行窗口关闭；否则 close 事件会被拦截，应用无法退出
    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    // Create tray icon
    const iconPath = path.join(__dirname, '../build/icon.png');

    // Check if icon file exists
    if (!fs.existsSync(iconPath)) {
      console.warn('[TrayManager] Tray icon not found:', iconPath);
      // Create a simple 16x16 transparent icon as fallback
      const fallbackIcon = nativeImage.createEmpty();
      this.tray = new Tray(fallbackIcon);
    } else {
      const icon = nativeImage.createFromPath(iconPath);
      this.tray = new Tray(icon);
    }

    this.tray.setToolTip('SimNow 交易终端');

    // 托盘菜单 = 共享四组定义（剔除「功能」内嵌退出 app-quit）+ 一级底部退出
    const def: MenuItemDef[] = [
      ...getAppMenuDef(),
      { id: 'tray-sep', type: 'separator' },
      { id: 'tray-quit', label: '退出', action: { type: 'quit' } },
    ];
    const ctx = { mainWindow, windowManager };
    this.tray.setContextMenu(Menu.buildFromTemplate(buildMenuFromDef(def, ctx, { omitIds: ['app-quit'] })));

    // Handle tray click (show/hide window)
    this.tray.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      }
    });

    // Handle window close - minimize to tray instead of quitting (except while quitting)
    if (this.mainWindow) {
      this.mainWindow.on('close', (event) => {
        if (!this.isQuitting && this.mainWindow && !this.mainWindow.isDestroyed()) {
          event.preventDefault();
          this.mainWindow.hide();
        }
      });
    }
  }

  /**
   * Show a balloon notification
   */
  showNotification(notification: TrayNotification): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.displayBalloon({
        title: notification.title,
        content: notification.content,
      });
    }
  }

  /**
   * Get the tray instance
   */
  getTray(): Tray | null {
    return this.tray;
  }

  /**
   * Destroy the tray
   */
  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
```

- [ ] **Step 4: main.ts 传入 windowManager**

Modify `frontend/electron/main.ts` lines 84-85:

```ts
  trayManager = new TrayManager();
  trayManager.initialize(mainWindow, windowManager);
```

- [ ] **Step 5: 运行测试确认绿**

Run: `npx vitest run electron/__tests__/trayManager.test.ts electron/__tests__/main.test.ts`（在 `frontend/` 下）
Expected: PASS（托盘新结构 + 点击行为 + quit 标志；main.test 仅 exports，不受影响）。

- [ ] **Step 6: 编译校验 + 提交**

```bash
npm run electron:compile   # 期望成功
git add frontend/electron/trayManager.ts frontend/electron/main.ts frontend/electron/__tests__/trayManager.test.ts
git commit -m "feat(electron): 托盘菜单全面镜像原生菜单，统一退出并修复 quit 被 close 拦截"
```

---

### Task 4: 全量验证与收尾

**Files:**
- 无代码改动；验证全部既有测试 + 编译。

- [ ] **Step 1: 前端全量测试**

Run: `npm test`（在 `frontend/` 下）
Expected: 全量 PASS（含 menuManager / trayManager / menuTemplate / menuActions / main 及其余 src 用例）。

- [ ] **Step 2: Electron 编译 + 构建**

Run: `npm run electron:compile`，随后 `npm run build`（在 `frontend/` 下）
Expected: 均成功。

- [ ] **Step 3: 手工冒烟（可选，需真实 Electron 窗口）**

`npm run electron:preview` 后验证：托盘右键出现 行情/功能/设置/性能监控 子菜单与底部退出；点击各子项行为与顶部菜单一致；托盘「退出」与顶部「退出」都能真正退出应用（不再被 close 拦截）。

- [ ] **Step 4: 确认无残留**

Grep `sendOpenFloating|sendMarketView|openMarketInNewWindow|sendTogglePerf` 于 `frontend/electron/`（排除 `__tests__`）：应无命中（私有方法已迁入 menuActions）。
Expected: 无输出。

---

## Self-Review

**Spec 覆盖：**
- §1 托盘结构（四组子菜单 + 一级退出）→ Task 3。✓
- §2 单源模板 + 共享行为 + 守卫 + quit 标志 → Task 1（守卫/quit 标志在 Task 3 落实）。✓
- §3 顶部菜单复用共享定义、行为不变 → Task 2。✓
- §4 托盘 initialize 新签名 + windowManager 传入 → Task 3（main.ts Step 4）。✓
- §5 点击映射 → Task 1 的 resolveAction 单测覆盖全部 7 行。✓
- §6 无新 IPC → 全任务无 IPC_CHANNELS 新增。✓
- §7 测试矩阵 → Task 1/2/3 逐个文件覆盖。✓

**Placeholder 扫描：** 无 TBD/TODO；每个代码步骤含完整实现与测试代码。

**类型一致性：**
- `MenuItemDef.id` 在 Task 1 定义为必填，托盘 def 中 `tray-sep`/`tray-quit` 均带 id，`app-quit` 为剔除目标；buildMenuFromDef 的 omit 递归匹配一致。
- `MenuContext`（menuActions）→ `buildMenuFromDef`（menuTemplate）签名一致；`resolveAction(action, ctx)` 两处引用一致。
- `TrayManager.initialize(mainWindow, windowManager)` 新签名在 Task 3 实现、测试、main.ts 三处一致。
- 共享守卫（`!isDestroyed()`、`if (windowManager)`）在 resolveAction 内，menuManager.test「已销毁不发送」与 menuActions.test「isDestroyed」「windowManager undefined」用例对应。
