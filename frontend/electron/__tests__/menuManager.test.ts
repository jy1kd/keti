import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { quit: vi.fn() },
  Menu: {
    buildFromTemplate: vi.fn((template) => template),
    setApplicationMenu: vi.fn(),
  },
}));

import { app, Menu } from 'electron';
import { MenuManager } from '../menuManager';
import { IPC_CHANNELS } from '../ipc/index';

interface TemplateItem {
  label?: string;
  role?: string;
  submenu?: TemplateItem[];
  click?: () => void;
}

describe('MenuManager', () => {
  const buildFromTemplate = Menu.buildFromTemplate as unknown as ReturnType<typeof vi.fn>;
  const setApplicationMenu = Menu.setApplicationMenu as unknown as ReturnType<typeof vi.fn>;
  let webContentsSend: ReturnType<typeof vi.fn>;
  let mainWindow: {
    show: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    webContents: { send: ReturnType<typeof vi.fn> };
    isDestroyed: () => boolean;
  };
  let windowManager: { openTabWindow: ReturnType<typeof vi.fn> };

  const getTemplate = (): TemplateItem[] => buildFromTemplate.mock.calls[0][0];
  const getMenu = (label: string): TemplateItem => {
    const menu = getTemplate().find((item) => item.label === label);
    return menu!;
  };
  const clickItem = (menuLabel: string, itemLabel: string): void => {
    const item = getMenu(menuLabel).submenu!.find((i) => i.label === itemLabel);
    item!.click!();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    webContentsSend = vi.fn();
    mainWindow = {
      show: vi.fn(),
      focus: vi.fn(),
      webContents: { send: webContentsSend },
      isDestroyed: () => false,
    };
    windowManager = { openTabWindow: vi.fn() };
  });

  it('should set application menu on initialize', () => {
    const manager = new MenuManager();
    manager.initialize(mainWindow, windowManager);
    expect(setApplicationMenu).toHaveBeenCalled();
    expect(setApplicationMenu.mock.calls[0][0]).toBe(getTemplate());
  });

  it('should have five top-level menus: 行情/交易/查询/设置/View', () => {
    const manager = new MenuManager();
    manager.initialize(mainWindow, windowManager);
    const labels = getTemplate().map((item) => item.label);
    expect(labels).toEqual(['行情', '交易', '查询', '设置', undefined]);
    expect(getTemplate()[4].role).toBe('viewMenu');
  });

  it('should not include default File/Edit/Window/Help menus', () => {
    const manager = new MenuManager();
    manager.initialize(mainWindow, windowManager);
    const roles = getTemplate()
      .map((item) => item.role)
      .filter(Boolean);
    expect(roles).toEqual(['viewMenu']);
  });

  describe('行情', () => {
    it('包含 期货/期权/自选行情/K线窗口/T型报价/在新窗口打开', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      const labels = getMenu('行情')
        .submenu!.map((i) => i.label)
        .filter(Boolean);
      expect(labels).toEqual(['📊 期货', '📉 期权', '⭐ 自选行情', '📈 K线窗口', '📉 T型报价', '🪟 在新窗口打开']);
    });

    it('点击 T型报价 发送 menu:open-floating tquote', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '📉 T型报价');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'tquote');
    });

    it('点击K线窗口发送 menu:open-floating kline', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '📈 K线窗口');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'kline');
    });

    it('点击期货发送 menu:market-view all', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '📊 期货');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'all');
    });

    it('点击期权发送 menu:market-view options', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '📉 期权');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'options');
    });

    it('点击自选行情发送 menu:market-view favorites', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '⭐ 自选行情');
      expect(webContentsSend).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'favorites');
    });

    it('点击 🪟 在新窗口打开 打开行情独立窗口', () => {
      const manager = new MenuManager();
      manager.initialize(mainWindow, windowManager);
      clickItem('行情', '🪟 在新窗口打开');
      expect(windowManager.openTabWindow).toHaveBeenCalledWith('market', 'tab-market', '📊 期货');
    });
  });

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

  it('主窗口已销毁时点击菜单项不发送 IPC', () => {
    const manager = new MenuManager();
    manager.initialize(mainWindow, windowManager);
    mainWindow.isDestroyed = () => true;
    clickItem('交易', '📝 报单窗口');
    expect(webContentsSend).not.toHaveBeenCalled();
  });
});
