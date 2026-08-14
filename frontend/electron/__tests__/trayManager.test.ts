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
    isDestroyed: vi.fn().mockReturnValue(false),
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

  it('一级菜单结构：行情/交易/查询/设置/分隔符/退出', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const sig = getTemplate().map((i) => (i.type === 'separator' ? '---' : i.label));
    expect(sig).toEqual(['行情', '交易', '查询', '设置', '---', '退出']);
  });

  it('设置子菜单不包含退出（已提到一级底部）', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const settingsMenu = getTemplate().find((i) => i.label === '设置')!;
    const labels = settingsMenu.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['⚙ 设置', '🔌 网络监控']);
  });

  it('行情子菜单完整镜像：期货/期权/自选/K线窗口/T型报价/新窗口', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    const market = getTemplate().find((i) => i.label === '行情')!;
    const labels = market.submenu!.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '📈 K线窗口', '📉 T型报价', '🪟 在新窗口打开']);
  });

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

  it('点击期货发送 menu:market-view all 并显示主窗口', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📊 期货');
    expect(mainWindow.show).toHaveBeenCalled();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'all');
  });

  it('点击期权发送 menu:market-view options', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('📉 期权');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'options');
  });

  it('点击在新窗口打开调用 windowManager.openTabWindow', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('🪟 在新窗口打开');
    expect(windowManager.openTabWindow).toHaveBeenCalledWith('market', 'tab-market', '📊 期货');
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

  it('点击资金查询窗口发送 menu:open-floating query-account', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('💰 资金查询窗口');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query-account');
  });

  it('点击设置发送 menu:open-floating settings', () => {
    const manager = new TrayManager();
    manager.initialize(mainWindow, windowManager);
    clickItem('⚙ 设置');
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'settings');
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
