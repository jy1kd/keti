# 浮动窗口原生菜单四类重排 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将浮动窗口的原生菜单入口重排为 行情/交易/查询/设置 四类；无限下单加入交易菜单并补齐 IPC 链路；旧「查询窗口」菜单入口移除（查询解散收尾）；FPS 监控完整下线；托盘镜像同步。

**Architecture:** 唯一菜单真源 `frontend/electron/menuTemplate.ts` 的 `getAppMenuDef()` 重排为四组；托盘与顶部菜单同源镜像（`buildMenuFromDef` + `omitIds: ['app-quit']`），改一处即双菜单生效。无限下单复用现有 `open-floating infinite` IPC 链路（preload → App switch → `openInfiniteFloating()`）。FPS 监控自菜单 action 到 Web 端按钮/组件/IPC 全链路删除。

**Tech Stack:** Electron（原生菜单/IPC）、React 18 + TypeScript 5 + Zustand + Vitest（前端）。

## Global Constraints

- **资金查询窗口 `query-account` 视为已存在**，本次不改其实现。
- **只动原生菜单 + 托盘 + FPS 下线链 + 无限下单 IPC 链**。BottomBar/TabBar 工具按钮除 FPS 移除外**不动**。
- **`query` 标签类型 / `openQueryFloating` / `QueryPanel` / store 瘦身不在此计划内**（留给查询解散后续 Task）；但 `menuTemplate.ts` 的 `FloatingTab` 删 `'query'`、`App.tsx` 删失效 `case 'query'`（消除既有 TS2678）在本计划内。
- **后端零改动**。
- 菜单 label 沿用「窗口」后缀（新增项为 `♾️ 无限下单窗口`）。
- 每个 Task 结束：`git status` 干净、相关测试绿、代码可编译（TS 严格模式）。删除 `'toggle-perf'` 时必须同步删完 `menuActions.ts` 的 case（否则 TS2678）。
- Commit 一次只针对一个功能点，禁攒大量改动一次性提交。
- 参考设计文档：`docs/superpowers/specs/2026-08-14-floating-menu-reorg-design.md`。

---

### Task 1: 菜单四类重排（menuTemplate + menuActions + 测试）

**Files:**
- Modify: `frontend/electron/menuTemplate.ts`
- Modify: `frontend/electron/menuActions.ts`
- Test: `frontend/electron/__tests__/menuTemplate.test.ts`
- Test: `frontend/electron/__tests__/menuActions.test.ts`

**Interfaces:**
- Produces: `FloatingTab` 含 `'infinite'`、不含 `'query'`；`MenuAction` 不含 `'toggle-perf'`；`getAppMenuDef()` 返回四组（id：`market`/`trade`/`query`/`settings`）；`app-quit` 移至设置组底部（托盘 `omitIds` 机制不变）。
- Consumes: 无（首 Task）。

- [ ] **Step 1: 写失败测试（menuTemplate.test.ts 替换 + menuActions.test.ts 删 toggle-perf 用例）**

`frontend/electron/__tests__/menuTemplate.test.ts` 整体替换为：

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
  it('返回四组一级菜单：行情/交易/查询/设置', () => {
    const def = getAppMenuDef();
    expect(def.map((d) => d.label)).toEqual(['行情', '交易', '查询', '设置']);
  });

  it('行情子菜单：期货/期权/自选/K线窗口/T型报价/新窗口', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const labels = market.submenu!
      .filter((i) => i.type !== 'separator')
      .map((i) => i.label);
    expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '📈 K线窗口', '📉 T型报价', '🪟 在新窗口打开']);
  });

  it('行情「📈 K线窗口」action 为 open-floating kline（在首个分隔符后）', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const kline = market.submenu!.find((i) => i.id === 'market-kline')!;
    expect(kline.label).toBe('📈 K线窗口');
    expect(kline.action).toEqual({ type: 'open-floating', tab: 'kline' });
    const sep = market.submenu!.find((i) => i.type === 'separator')!;
    expect(market.submenu!.indexOf(kline)).toBeGreaterThan(market.submenu!.indexOf(sep));
  });

  it('行情「📉 T型报价」action 为 open-floating tquote（在首个分隔符后）', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const tquote = market.submenu!.find((i) => i.id === 'market-tquote')!;
    expect(tquote.label).toBe('📉 T型报价');
    expect(tquote.action).toEqual({ type: 'open-floating', tab: 'tquote' });
    const sep = market.submenu!.find((i) => i.type === 'separator')!;
    expect(market.submenu!.indexOf(tquote)).toBeGreaterThan(market.submenu!.indexOf(sep));
  });

  it('行情「在新窗口打开」action 为 open-market-window', () => {
    const market = getAppMenuDef().find((d) => d.id === 'market')!;
    const newWindow = market.submenu!.find((i) => i.id === 'market-new-window')!;
    expect(newWindow.action).toEqual({ type: 'open-market-window' });
  });

  it('交易子菜单：报单窗口 / 无限下单窗口', () => {
    const trade = getAppMenuDef().find((d) => d.id === 'trade')!;
    const labels = trade.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📝 报单窗口', '♾️ 无限下单窗口']);
  });

  it('交易「无限下单窗口」action 为 open-floating infinite', () => {
    const trade = getAppMenuDef().find((d) => d.id === 'trade')!;
    const infinite = trade.submenu!.find((i) => i.id === 'trade-infinite')!;
    expect(infinite.action).toEqual({ type: 'open-floating', tab: 'infinite' });
  });

  it('查询子菜单：报单查询/持仓查询/资金查询', () => {
    const query = getAppMenuDef().find((d) => d.id === 'query')!;
    const labels = query.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口']);
  });

  it('设置子菜单：设置/网络监控/退出，app-quit 在设置组', () => {
    const settings = getAppMenuDef().find((d) => d.id === 'settings')!;
    const labels = settings.submenu!.filter((i) => i.type !== 'separator').map((i) => i.label);
    expect(labels).toEqual(['⚙ 设置', '🔌 网络监控', '退出']);
    expect(settings.submenu!.some((i) => i.id === 'app-quit')).toBe(true);
  });

  it('菜单不含 FPS 监控 / 性能监控组 / 旧「📋 查询窗口」', () => {
    const all = JSON.stringify(getAppMenuDef());
    expect(all).not.toContain('⚡FPS 监控');
    expect(all).not.toContain('性能监控');
    expect(all).not.toContain('📋 查询窗口');
  });
});

describe('buildMenuFromDef', () => {
  const ctx = { mainWindow: {} as any, windowManager: {} as any };

  it('分隔符渲染为 { type: separator }', () => {
    const def: MenuItemDef[] = [
      { id: 'a', label: 'A', action: { type: 'open-floating', tab: 'order' } },
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

`frontend/electron/__tests__/menuActions.test.ts` 删 toggle-perf 用例（第 54-59 行）：

```ts
  it('toggle-perf: 发送 menu:toggle-perf 但不 show/focus', () => {
    resolveAction({ type: 'toggle-perf' }, ctx);
    expect(ctx.mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_TOGGLE_PERF);
    expect(ctx.mainWindow.show).not.toHaveBeenCalled();
    expect(ctx.mainWindow.focus).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts`
Expected: `menuTemplate.test.ts` FAIL（旧实现仍返回 行情/功能/设置/性能监控，行情无 K线、交易/查询组不存在）；`menuActions.test.ts` 删用例后 PASS。

- [ ] **Step 3: 实现 menuTemplate.ts**

`frontend/electron/menuTemplate.ts` 顶部类型与 `getAppMenuDef()` 替换（`buildMenuFromDef` 不变）：

```ts
export type MarketView = 'all' | 'options' | 'favorites';
export type FloatingTab = 'order' | 'kline' | 'infinite' | 'tquote' | 'settings' | 'ipc-monitor' | 'query-orders' | 'query-positions' | 'query-account';

export type MenuAction =
  | { type: 'market-view'; view: MarketView }
  | { type: 'open-floating'; tab: FloatingTab }
  | { type: 'open-market-window' }
  | { type: 'quit' };
```

文件头注释「四组原生菜单定义」同步更新为「行情/交易/查询/设置」，`omitIds` 注释里的「功能」改「设置」。

`getAppMenuDef()` 整体替换为：

```ts
export function getAppMenuDef(): MenuItemDef[] {
  return [
    {
      id: 'market',
      label: '行情',
      submenu: [
        { id: 'market-all', label: '📊 期货', action: { type: 'market-view', view: 'all' } },
        { id: 'market-options', label: '📉 期权', action: { type: 'market-view', view: 'options' } },
        { id: 'market-favorites', label: '⭐ 自选行情', action: { type: 'market-view', view: 'favorites' } },
        { id: 'market-sep1', type: 'separator' },
        { id: 'market-kline', label: '📈 K线窗口', action: { type: 'open-floating', tab: 'kline' } },
        { id: 'market-tquote', label: '📉 T型报价', action: { type: 'open-floating', tab: 'tquote' } },
        { id: 'market-sep2', type: 'separator' },
        { id: 'market-new-window', label: '🪟 在新窗口打开', action: { type: 'open-market-window' } },
      ],
    },
    {
      id: 'trade',
      label: '交易',
      submenu: [
        { id: 'trade-order', label: '📝 报单窗口', action: { type: 'open-floating', tab: 'order' } },
        { id: 'trade-infinite', label: '♾️ 无限下单窗口', action: { type: 'open-floating', tab: 'infinite' } },
      ],
    },
    {
      id: 'query',
      label: '查询',
      submenu: [
        { id: 'query-orders', label: '📋 报单查询窗口', action: { type: 'open-floating', tab: 'query-orders' } },
        { id: 'query-positions', label: '📋 持仓查询窗口', action: { type: 'open-floating', tab: 'query-positions' } },
        { id: 'query-account', label: '💰 资金查询窗口', action: { type: 'open-floating', tab: 'query-account' } },
      ],
    },
    {
      id: 'settings',
      label: '设置',
      submenu: [
        { id: 'settings-main', label: '⚙ 设置', action: { type: 'open-floating', tab: 'settings' } },
        { id: 'settings-sep1', type: 'separator' },
        { id: 'settings-ipc', label: '🔌 网络监控', action: { type: 'open-floating', tab: 'ipc-monitor' } },
        { id: 'settings-sep2', type: 'separator' },
        { id: 'app-quit', label: '退出', action: { type: 'quit' } },
      ],
    },
  ];
}
```

> 删除原「功能」（`function`）组、「性能监控」（`performance`）组及 `perf-fps` 菜单项。

- [ ] **Step 4: 同步 menuActions.ts 删 toggle-perf case**

`frontend/electron/menuActions.ts` 删（MenuAction 类型已无 `toggle-perf`，TS 严格模式下必须同步）：

```ts
    case 'toggle-perf':
      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_PERF);
      }
      return;
```

> `IPC_CHANNELS` import 仍被 market-view / open-floating 使用，保留。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run electron/__tests__/menuTemplate.test.ts electron/__tests__/menuActions.test.ts`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add frontend/electron/menuTemplate.ts frontend/electron/menuActions.ts
git add frontend/electron/__tests__/menuTemplate.test.ts frontend/electron/__tests__/menuActions.test.ts
git commit -m "refactor(menu): 浮动窗口原生菜单四类重排（行情/交易/查询/设置）"
```

---

### Task 2: 无限下单 IPC 链路 + 查询窗口失效 case 清理

**Files:**
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/services/electron.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `openInfiniteFloating(): boolean`（已存在于 `utils/openFloatingTab.ts`，有选中合约则定位）。
- Produces: `onOpenFloatingTab` 回调类型含 `'infinite'`（preload 2 处 + electron.ts 1 处）；App 的 `onOpenFloatingTab` switch 处理 `'infinite'`；移除失效 `case 'query'`。

- [ ] **Step 1: 写失败测试**

`frontend/src/App.test.tsx` 的 `describe('顶部菜单 IPC')` 内，`onOpenFloatingTab tquote` 用例之后加：

```tsx
    it('onOpenFloatingTab infinite 打开无限下单浮动窗', () => {
      const onOpenFloatingTab = vi.fn()
      setElectronAPI({ onOpenFloatingTab })
      render(<App />)
      const callback = onOpenFloatingTab.mock.calls[0][0]
      act(() => {
        callback('infinite')
      })
      expect(useFloatingWindowStore.getState().windows['tab-infinite']).toBeDefined()
      delete (window as any).electronAPI
    })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/App.test.tsx -t "infinite"`
Expected: FAIL（App 未处理 `'infinite'`，`windows['tab-infinite']` 不存在）。

- [ ] **Step 3: preload.ts / electron.ts 类型加 'infinite'**

`frontend/electron/preload.ts` 两处（接口第 32 行 + 实现 handler 第 83-84 行）把回调 tab 联合类型 `'order' | 'kline' | 'settings' | ...` 中的 `'kline' |` 改为 `'kline' | 'infinite' |`：

```ts
  onOpenFloatingTab: (callback: (tab: 'order' | 'kline' | 'infinite' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account') => void) => () => void;
```

实现 handler 的 `tab` 参数类型同步改为同一联合类型。

`frontend/src/services/electron.ts` 第 118 行 `onOpenFloatingTab` 回调类型同样在 `'kline' |` 后加 `'infinite' |`。

- [ ] **Step 4: App.tsx 加 case 'infinite'、删 case 'query'**

`frontend/src/App.tsx` import 块（第 18-28 行）删 `openQueryFloating,`、加 `openInfiniteFloating,`：

```ts
import {
  openOrderFloating,
  openKlineFloating,
  openSettingsFloating,
  openIpcMonitorFloating,
  openOrdersQueryFloating,
  openPositionsQueryFloating,
  openAccountQueryFloating,
  openInfiniteFloating,
  openTQuoteFloating,
} from '@/utils/openFloatingTab'
```

`onOpenFloatingTab` switch（第 97-125 行）：删 `case 'query'`（已无入口触发 + 既有 TS2678），加 `case 'infinite'`：

```ts
        case 'infinite':
          openInfiniteFloating()
          break
```

> 放在 `case 'kline'` 之后即可。`openQueryFloating` 函数仍保留在 `utils/openFloatingTab.ts`（未使用导出不报错），留给查询解散后续 Task 删除。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: 全绿（含新增 infinite 用例）。

Run: `cd frontend && npx vitest run src/utils/openFloatingTab.test.ts src/services/electron.test.ts 2>/dev/null || true`
Expected: 无回归（electron.ts 类型变更不影响运行时；如无 electron.test.ts 则跳过）。

- [ ] **Step 6: Commit**

```bash
git add frontend/electron/preload.ts frontend/src/services/electron.ts frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(menu): 无限下单加入交易菜单并补齐 IPC 链路，清理失效 case 'query'"
```

---

### Task 3: FPS 监控完整下线

**Files:**
- Modify: `frontend/electron/ipc/index.ts`
- Modify: `frontend/electron/preload.ts`
- Modify: `frontend/src/services/electron.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/BottomBar/index.tsx`
- Modify: `frontend/src/components/BottomBar/styles.css`
- Delete: `frontend/src/components/PerfMonitor/index.tsx`
- Delete: `frontend/src/components/PerfMonitor/index.test.tsx`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/BottomBar/index.test.tsx`

**Interfaces:**
- 删除类改动，测试与实现同步更新（无"先红后绿"）。消费方：`App.tsx`（perfVisible / onTogglePerf / Ctrl+Shift+M）、`BottomBar`（FPS 按钮/徽标/props）、`PerfMonitor`（仅 BottomBar 引用）。

- [ ] **Step 1: Electron 侧删 IPC**

`frontend/electron/ipc/index.ts` 删：
```ts
  MENU_TOGGLE_PERF: 'menu:toggle-perf',
```

`frontend/electron/preload.ts` 删接口声明（第 34-35 行）：
```ts
  // Menu (main → renderer): 切换 FPS 监控
  onTogglePerf: (callback: () => void) => () => void;
```
删实现（第 89-94 行）：
```ts
  // Menu (main → renderer): 切换 FPS 监控
  onTogglePerf: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('menu:toggle-perf', handler);
    return () => ipcRenderer.removeListener('menu:toggle-perf', handler);
  },
```

`frontend/src/services/electron.ts` 删第 121 行：
```ts
      onTogglePerf: (callback: () => void) => () => void;
```

- [ ] **Step 2: App.tsx 删 FPS 相关**

`frontend/src/App.tsx`：
- 第 1 行 `import { useState, useEffect, useRef } from 'react'` → `import { useEffect, useRef } from 'react'`
- 删第 31 行 `const [perfVisible, setPerfVisible] = useState(false)`
- 删 onTogglePerf effect（第 131-140 行）：
```ts
  // Electron IPC — 顶部菜单切换 FPS 监控
  useEffect(() => {
    if (!isElectron()) return

    const cleanup = window.electronAPI?.onTogglePerf?.(() => {
      setPerfVisible((v) => !v)
    })

    return () => cleanup?.()
  }, [])
```
- 删 Ctrl+Shift+M 快捷键 effect（第 158-168 行）：
```ts
  // Ctrl+Shift+M 切换性能监控
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setPerfVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
```
- `BottomBar` 调用（第 184-187 行）`<BottomBar perfVisible={perfVisible} onTogglePerf={() => setPerfVisible((v) => !v)} />` → `<BottomBar />`

- [ ] **Step 3: BottomBar 删 FPS 按钮/徽标/props**

`frontend/src/components/BottomBar/index.tsx`：
- 删第 3 行 `import { PerfMonitor } from '@/components/PerfMonitor'`
- 删 props 接口（第 13-18 行）：
```ts
interface BottomBarProps {
  /** 性能监控（⚡FPS）是否可见 */
  perfVisible: boolean
  /** 切换性能监控 */
  onTogglePerf: () => void
}
```
- 第 28 行 `export function BottomBar({ perfVisible, onTogglePerf }: BottomBarProps) {` → `export function BottomBar() {`
- 第 25 行注释 `中：全局工具（报单/K线/查询/设置/FPS/网络监控，图标 + 中文名）` → `中：全局工具（报单/K线/无限下单/设置/网络监控，图标 + 中文名）`
- 删 FPS 按钮 JSX（第 82-92 行）：
```tsx
        <button
          type="button"
          className={`bottom-bar__tool${perfVisible ? ' bottom-bar__tool--active' : ''}`}
          aria-label="FPS 监控"
          title="FPS 监控 (Ctrl+Shift+M)"
          aria-pressed={perfVisible}
          onClick={onTogglePerf}
        >
          <span className="bottom-bar__tool-icon">⚡</span>
          <span className="bottom-bar__tool-label">FPS 监控</span>
        </button>
```
- 删 FPS 徽标 JSX（第 98-103 行）：
```tsx
        {/* FPS 徽标：仅 perfVisible 时内联显示 */}
        {perfVisible && (
          <span className="bottom-bar__fps" data-testid="bottom-bar-fps" title="FPS 监控 (Ctrl+Shift+M)">
            ⚡<PerfMonitor visible />
          </span>
        )}
```

`frontend/src/components/BottomBar/styles.css` 删（第 76-90 行）：
```css
/* FPS 徽标：仅 perfVisible 时内联显示 */
.bottom-bar__fps {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: #3fb950;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: rgba(63, 185, 80, 0.08);
  white-space: nowrap;
}
```

- [ ] **Step 4: 删除 PerfMonitor 组件与测试**

```bash
git rm frontend/src/components/PerfMonitor/index.tsx frontend/src/components/PerfMonitor/index.test.tsx
```

- [ ] **Step 5: 更新 App.test.tsx**

`frontend/src/App.test.tsx`：
- 删 rAF stub 声明（第 32-34 行）：
```ts
// rAF stub（BottomBar FPS 徽标内 PerfMonitor visible=true 时使用）
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0
```
- `beforeEach` 内删 rAF/performance 打桩（第 38-47 行，保留 store setState 部分）：
```ts
    rafCallbacks = []
    rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks = rafCallbacks.filter((_, i) => i + 1 !== id)
    })
    vi.stubGlobal('performance', { now: () => 0 })
```
- 删 `describe('性能监控', ...)` 块（第 109-122 行）：
```tsx
  describe('性能监控', () => {
    it('默认不显示 FPS 徽标（FPS 监控按钮常驻）', () => {
      render(<App />)
      expect(screen.getByLabelText('FPS 监控')).toBeInTheDocument()
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
    })

    it('Ctrl+Shift+M 切换性能监控（显示 FPS 徽标）', () => {
      render(<App />)
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
      fireEvent.keyDown(window, { key: 'M', ctrlKey: true, shiftKey: true })
      expect(screen.getByTestId('bottom-bar-fps')).toBeInTheDocument()
    })
  })
```
- `setElectronAPI`（第 129 行）删 `onTogglePerf: vi.fn(),`
- 删 `onTogglePerf 切换 FPS 监控` 用例（第 197-208 行）：
```tsx
    it('onTogglePerf 切换 FPS 监控', () => {
      const onTogglePerf = vi.fn()
      setElectronAPI({ onTogglePerf })
      render(<App />)
      expect(screen.queryByTestId('bottom-bar-fps')).toBeNull()
      const callback = onTogglePerf.mock.calls[0][0]
      act(() => {
        callback()
      })
      expect(screen.getByTestId('bottom-bar-fps')).toBeInTheDocument()
      delete (window as any).electronAPI
    })
```
> `afterEach(() => vi.unstubAllGlobals())` 保留（无打桩时无害）。

- [ ] **Step 6: 更新 BottomBar.test.tsx**

`frontend/src/components/BottomBar/index.test.tsx` 整体替换为：

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from './index'
import { useConnectionStore } from '@/stores/connection'
import { useMarketStore } from '@/modules/market/store'

// Mock 统一浮动窗入口（BottomBar 工具入口委托给 helper；helper 自身的打开选项在
// utils/openFloatingTab.test.ts 覆盖，此处只验证按钮→helper 的接线）
const {
  mockOpenFloatingTab,
  mockOpenOrderFloating,
  mockOpenKlineFloating,
  mockOpenSettingsFloating,
  mockOpenIpcMonitorFloating,
} = vi.hoisted(() => ({
  mockOpenFloatingTab: vi.fn(),
  mockOpenOrderFloating: vi.fn(),
  mockOpenKlineFloating: vi.fn(),
  mockOpenSettingsFloating: vi.fn(),
  mockOpenIpcMonitorFloating: vi.fn(),
}))

vi.mock('@/utils/openFloatingTab', () => ({
  openFloatingTab: mockOpenFloatingTab,
  ORDER_FLOATING_SIZE: { w: 620, h: 540 },
  openOrderFloating: mockOpenOrderFloating,
  openKlineFloating: mockOpenKlineFloating,
  openSettingsFloating: mockOpenSettingsFloating,
  openIpcMonitorFloating: mockOpenIpcMonitorFloating,
}))

describe('BottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({
      md: { phase: 'connected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      mdConnected: true,
      td: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      tdConnected: false,
    })
    useMarketStore.setState({ selectedInstrument: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('布局', () => {
    it('渲染左区连接状态（MD/TD 指示灯）', () => {
      render(<BottomBar />)
      expect(screen.getByText('MD')).toBeInTheDocument()
      expect(screen.getByText('TD')).toBeInTheDocument()
    })

    it('工具按钮含图标 + 中文名', () => {
      render(<BottomBar />)
      const cases: Array<[string, string, string]> = [
        ['报单', '📝', '报单'],
        ['K线', '📈', 'K线'],
        ['设置', '⚙', '设置'],
        ['网络监控', '🔌', '网络监控'],
      ]
      for (const [label, icon, name] of cases) {
        const btn = screen.getByLabelText(label)
        expect(btn.textContent).toContain(icon)
        expect(btn.textContent).toContain(name)
      }
    })
  })

  describe('工具操作', () => {
    it('点击 📝 报单调用 openOrderFloating（选中合约细节由 helper 测试覆盖）', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('报单'))
      expect(mockOpenOrderFloating).toHaveBeenCalled()
    })

    it('点击 📈 K线调用 openKlineFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('K线'))
      expect(mockOpenKlineFloating).toHaveBeenCalled()
    })

    it('点击 ⚙ 设置按钮调用 openSettingsFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('设置'))
      expect(mockOpenSettingsFloating).toHaveBeenCalled()
    })

    it('点击 🔌 网络监控按钮调用 openIpcMonitorFloating', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByLabelText('网络监控'))
      expect(mockOpenIpcMonitorFloating).toHaveBeenCalled()
    })
  })

  describe('箭头展开/收起', () => {
    it('默认展开：工具区可见，箭头显示 <', () => {
      render(<BottomBar />)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('<')
    })

    it('点击箭头收起：工具区加 collapsed 类，箭头变 >', () => {
      render(<BottomBar />)
      fireEvent.click(screen.getByTestId('bottom-bar-toggle'))
      expect(screen.getByTestId('bottom-bar-tools')).toHaveClass('bottom-bar__tools--collapsed')
      expect(screen.getByTestId('bottom-bar-toggle')).toHaveTextContent('>')
    })

    it('再次点击展开：移除 collapsed 类，箭头变回 <', () => {
      render(<BottomBar />)
      const toggle = screen.getByTestId('bottom-bar-toggle')
      fireEvent.click(toggle)
      fireEvent.click(toggle)
      expect(screen.getByTestId('bottom-bar-tools')).not.toHaveClass('bottom-bar__tools--collapsed')
      expect(toggle).toHaveTextContent('<')
    })
  })
})
```

> 无限下单按钮测试不在本次范围（BottomBar 除 FPS 外不动）；`openInfiniteFloating` 未被 mock 也不影响现有用例（无用例点击该按钮）。

- [ ] **Step 7: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/App.test.tsx src/components/BottomBar/index.test.tsx`
Expected: 全绿。

Run: `cd frontend && grep -rn "onTogglePerf\|perfVisible\|PerfMonitor\|bottom-bar-fps\|toggle-perf\|MENU_TOGGLE_PERF" src/ --include=*.ts --include=*.tsx --include=*.css`
Expected: 无匹配（`src/` 内 FPS 全部清除）。

Run: `cd frontend && npx vitest run electron/__tests__/preload.test.ts electron/__tests__/menuActions.test.ts`
Expected: 全绿（preload 无 FPS 断言，已核对）。

- [ ] **Step 8: Commit**

```bash
git add frontend/electron/ipc/index.ts frontend/electron/preload.ts frontend/src/services/electron.ts frontend/src/App.tsx frontend/src/components/BottomBar/index.tsx frontend/src/components/BottomBar/styles.css frontend/src/App.test.tsx frontend/src/components/BottomBar/index.test.tsx
git commit -m "refactor(fps): FPS 监控完整下线（菜单/托盘/按钮/快捷键/PerfMonitor 组件/IPC）"
```
（PerfMonitor 两文件已在 Step 4 `git rm`，随 `git add` 不重复；若未暂存，用 `git add -u` 一并提交删除。）

---

### Task 4: 托盘与菜单行为测试同步

**Files:**
- Modify: `frontend/electron/trayManager.ts`（仅注释）
- Test: `frontend/electron/__tests__/trayManager.test.ts`
- Test: `frontend/electron/__tests__/menuManager.test.ts`

**Interfaces:**
- 消费 Task 1 的 `getAppMenuDef()` 四组结构；托盘仍 `omitIds: ['app-quit']`。

- [ ] **Step 1: trayManager.ts 注释更新**

`frontend/electron/trayManager.ts` 第 60 行 `// 托盘菜单 = 共享四组定义（剔除「功能」内嵌退出 app-quit）+ 一级底部退出` → `// 托盘菜单 = 共享四组定义（剔除「设置」内嵌退出 app-quit）+ 一级底部退出`

- [ ] **Step 2: 更新 trayManager.test.ts**

`frontend/electron/__tests__/trayManager.test.ts`：
- 第 90 行一级结构断言 → `expect(sig).toEqual(['行情', '交易', '查询', '设置', '---', '退出']);`
- 第 93-99 行「功能子菜单不包含退出」→ 替换为：
```ts
  it('设置子菜单不包含退出（已提到一级底部）', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const settingsMenu = getTemplate().find((i) => i.label === '设置')!;
    const labels = settingsMenu.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['⚙ 设置', '🔌 网络监控']);
  });
```
- 第 106 行行情子菜单断言 → `expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '📈 K线窗口', '📉 T型报价', '🪟 在新窗口打开']);`
- 第 101-107 行用例之后加交易/查询子菜单用例：
```ts
  it('交易子菜单包含 报单窗口/无限下单窗口', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const trade = getTemplate().find((i) => i.label === '交易')!;
    const labels = trade.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📝 报单窗口', '♾️ 无限下单窗口']);
  });

  it('查询子菜单包含 报单查询/持仓查询/资金查询', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const query = getTemplate().find((i) => i.label === '查询')!;
    const labels = query.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口']);
  });
```
- 删「点击FPS监控发送 menu:toggle-perf」用例（第 159-164 行）：
```ts
  it('点击FPS监控发送 menu:toggle-perf', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('⚡FPS 监控');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_TOGGLE_PERF);
  });
```
> 其余点击用例（报单/K线/资金查询/设置/网络监控/退出）按 label 递归查找，跨组后仍通过，不改。

- [ ] **Step 3: 更新 menuManager.test.ts**

`frontend/electron/__tests__/menuManager.test.ts`：
- 第 67 行 → `expect(labels).toEqual(['行情', '交易', '查询', '设置', undefined]);`
- `describe('行情')` 内 labels 断言（第 87 行）→ `['📊 期货', '📉 期权', '⭐ 自选行情', '📈 K线窗口', '📉 T型报价', '🪟 在新窗口打开']`；并在该 describe 内加 K线 点击用例：
```ts
    it('点击K线窗口发送 menu:open-floating kline', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '📈 K线窗口');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'kline');
    });
```
- `describe('功能')`（第 126-163 行）整体替换为 `交易` + `查询` 两个 describe：
```ts
  describe('交易', () => {
    it('包含 报单窗口/无限下单窗口', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      const labels = getMenu('交易')
        .submenu!.map((i) => i.label)
        .filter(Boolean);
      expect(labels).toEqual(['📝 报单窗口', '♾️ 无限下单窗口']);
    });

    it('点击报单窗口发送 menu:open-floating order', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('交易', '📝 报单窗口');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'order');
    });

    it('点击无限下单窗口发送 menu:open-floating infinite', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('交易', '♾️ 无限下单窗口');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'infinite');
    });
  });

  describe('查询', () => {
    it('包含 报单查询窗口/持仓查询窗口/资金查询窗口', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      const labels = getMenu('查询')
        .submenu!.map((i) => i.label)
        .filter(Boolean);
      expect(labels).toEqual(['📋 报单查询窗口', '📋 持仓查询窗口', '💰 资金查询窗口']);
    });

    it('点击资金查询窗口发送 menu:open-floating query-account', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('查询', '💰 资金查询窗口');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query-account');
    });
  });
```
- `describe('设置')`（第 165-172 行）整体替换为：
```ts
  describe('设置', () => {
    it('包含 ⚙ 设置 / 🔌 网络监控 / 退出', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      const labels = getMenu('设置')
        .submenu!.map((i) => i.label)
        .filter(Boolean);
      expect(labels).toEqual(['⚙ 设置', '🔌 网络监控', '退出']);
    });

    it('点击 ⚙ 设置 发送 menu:open-floating settings', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('设置', '⚙ 设置');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'settings');
    });

    it('点击 🔌 网络监控 发送 menu:open-floating ipc-monitor', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('设置', '🔌 网络监控');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'ipc-monitor');
    });

    it('点击退出调用 app.quit', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('设置', '退出');
      expect(app.quit).toHaveBeenCalled();
    });
  });
```
- 删 `describe('性能监控')`（第 174-197 行）。
- 第 203 行 `clickItem('功能', '📝 报单窗口')` → `clickItem('交易', '📝 报单窗口')`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npx vitest run electron/__tests__/trayManager.test.ts electron/__tests__/menuManager.test.ts`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add frontend/electron/trayManager.ts frontend/electron/__tests__/trayManager.test.ts frontend/electron/__tests__/menuManager.test.ts
git commit -m "test(menu): 托盘与菜单行为测试同步四类结构"
```

---

### Task 5: 全量回归 + 重建 dist-electron

**Files:**
- Modify: `frontend/dist-electron/`（`main.cjs`/`preload.cjs`/`menuTemplate.cjs`/`menuActions.cjs`/`ipc/index.cjs` 等，由编译生成）

**Interfaces:**
- 菜单模板/预加载类型改动需反映到 Electron 构建产物（沿用 `d517579` 先例提交 dist-electron）。

- [ ] **Step 1: 前端全量测试**

Run: `cd frontend && npm test`
Expected: 全绿（469− 用例，含 Electron 目录测试）。

- [ ] **Step 2: 类型检查 + 前端构建**

Run: `cd frontend && npm run build`
Expected: `tsc` 无类型错误（含 Task 2 已删 `case 'query'`）+ vite build 成功。

- [ ] **Step 3: 重新编译 dist-electron**

Run: `cd frontend && npm run electron:compile`
Expected: 重新生成 `dist-electron/`（`menuTemplate.cjs` 含四组、`preload.cjs` 无 `onTogglePerf`）。

- [ ] **Step 4: 核对产物菜单**

Run: `cd frontend && grep -n "无限下单窗口\|FPS 监控\|性能监控\|📋 查询窗口" dist-electron/menuTemplate.cjs`
Expected: 命中 `♾️ 无限下单窗口`；不命中 `⚡FPS 监控` / `性能监控` / `📋 查询窗口`。

- [ ] **Step 5: Commit 构建产物**

```bash
git add frontend/dist-electron/
git commit -m "chore(electron): 更新构建产物以匹配四类菜单入口"
```

---

## Self-Review

**1. Spec 覆盖：**
- 菜单四类结构（行情/交易/查询/设置）→ Task 1。
- 无限下单加入交易 + IPC 链路 → Task 1（菜单项）+ Task 2（preload/electron/App）。
- 查询窗口菜单入口移除（`func-query` + `FloatingTab 'query'` + App `case 'query'`）→ Task 1、Task 2。
- FPS 完整下线（菜单/托盘/IPC/App/BottomBar/PerfMonitor）→ Task 1（菜单项+action）、Task 3（全链）、Task 4（托盘测试）。
- 托盘镜像四类（方案 A）→ 自动生效；测试同步 → Task 4。
- 全量回归 + 重建 dist-electron → Task 5。

**2. 占位符扫描：** 所有改动含精确代码，无 TBD/TODO。

**3. 类型一致性：**
- `'infinite'`：FloatingTab（Task 1）、preload 接口 + handler（Task 2）、electron.ts（Task 2）、App switch（Task 2）统一；menuActions 透传不感知具体值。
- `'toggle-perf'`：Task 1 从 `MenuAction` 与 `menuActions.ts` case 同时删，`menuActions.test.ts` 同步删用例；`MENU_TOGGLE_PERF` 通道在 Task 3 删。
- `'query'`：Task 1 从 `FloatingTab` 删；Task 2 从 App switch 删并移除 `openQueryFloating` import；`tabs.ts` 的 `TabType 'query'` 与 `openQueryFloating` 函数保留（查询解散后续 Task 处理）。
- 托盘 `omitIds: ['app-quit']` 机制不变（Task 1 仅移动 app-quit 位置）。
