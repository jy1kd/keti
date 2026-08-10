import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
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

import { Menu, BrowserWindow } from 'electron';
import { TrayManager } from '../trayManager';
import { IPC_CHANNELS } from '../ipc/index';

interface TemplateItem {
  label?: string;
  type?: string;
  click?: () => void;
}

describe('TrayManager', () => {
  const buildFromTemplate = Menu.buildFromTemplate as unknown as ReturnType<typeof vi.fn>;
  let mainWindow: any;

  const getTemplate = (): TemplateItem[] => buildFromTemplate.mock.calls[0][0];
  const clickItem = (label: string): void => {
    const item = getTemplate().find((i) => i.label === label);
    item!.click!();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mainWindow = new BrowserWindow() as any;
  });

  it('should export TrayManager class', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    expect(TM).toBeDefined();
    expect(typeof TM).toBe('function');
  });

  it('should create instance with initialize method', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    const manager = new TM();
    expect(manager.initialize).toBeDefined();
    expect(typeof manager.initialize).toBe('function');
  });

  it('should create instance with destroy method', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    const manager = new TM();
    expect(manager.destroy).toBeDefined();
    expect(typeof manager.destroy).toBe('function');
  });

  it('should create instance with showNotification method', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    const manager = new TM();
    expect(manager.showNotification).toBeDefined();
    expect(typeof manager.showNotification).toBe('function');
  });

  it('should create instance with getTray method', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    const manager = new TM();
    expect(manager.getTray).toBeDefined();
    expect(typeof manager.getTray).toBe('function');
  });

  it('should return null for getTray before initialization', async () => {
    const { TrayManager: TM } = await import('../trayManager');
    const manager = new TM();
    const tray = manager.getTray();
    expect(tray).toBeNull();
  });

  describe('托盘菜单与顶部菜单同步', () => {
    it('initialize 设置托盘上下文菜单', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      expect(manager.getTray()!.setContextMenu).toHaveBeenCalled();
    });

    it('点击全部行情发送 menu:market-view all 并显示主窗口', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      clickItem('📊 全部行情');
      expect(mainWindow.show).toHaveBeenCalled();
      expect(mainWindow.focus).toHaveBeenCalled();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'all');
    });

    it('点击自选行情发送 menu:market-view favorites', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      clickItem('⭐ 自选行情');
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_MARKET_VIEW, 'favorites');
    });

    it('点击查询窗口发送 menu:open-floating query', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      clickItem('📋 查询窗口');
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query');
    });

    it('点击设置发送 menu:open-floating settings', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      clickItem('⚙ 设置');
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'settings');
    });

    it('点击网络监控发送 menu:open-floating ipc-monitor', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      clickItem('📡 网络监控');
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.MENU_OPEN_FLOATING, 'ipc-monitor');
    });

    it('点击退出销毁主窗口与托盘', () => {
      const manager = new TrayManager();
      manager.initialize(mainWindow);
      const tray = manager.getTray();
      clickItem('退出');
      expect(mainWindow.destroy).toHaveBeenCalled();
      expect(tray!.destroy).toHaveBeenCalled();
    });
  });
});
