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
    expect(ctx.windowManager.openTabWindow).toHaveBeenCalledWith('market', 'tab-market', '📊 期货');
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
