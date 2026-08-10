/**
 * Menu Manager
 *
 * Manages the application menu bar for the Electron application.
 * Replaces Electron's default File/Edit/Window/Help menus with app menus:
 * 行情 / 功能 / 设置 / 性能监控 + default View.
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from './ipc/index';
import { WindowManager } from './windowManager';

/**
 * MenuManager class
 */
export class MenuManager {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager | null = null;

  /**
   * Set the application menu: app menus + the default View menu.
   */
  initialize(mainWindow: BrowserWindow, windowManager: WindowManager): void {
    this.mainWindow = mainWindow;
    this.windowManager = windowManager;

    const template: MenuItemConstructorOptions[] = [
      {
        label: '行情',
        submenu: [
          { label: '📊 全部行情', click: () => this.sendMarketView('all') },
          { label: '📉 T型期权', click: () => this.sendMarketView('options') },
          { label: '⭐ 自选行情', click: () => this.sendMarketView('favorites') },
          { type: 'separator' },
          { label: '🪟 在新窗口打开', click: () => this.openMarketInNewWindow() },
        ],
      },
      {
        label: '功能',
        submenu: [
          { label: '📝 报单窗口', click: () => this.sendOpenFloating('order') },
          { label: '📈 K线窗口', click: () => this.sendOpenFloating('kline') },
          { label: '📋 查询窗口', click: () => this.sendOpenFloating('query') },
          { type: 'separator' },
          { label: '退出', click: () => app.quit() },
        ],
      },
      {
        label: '设置',
        submenu: [{ label: '⚙ 设置', click: () => this.sendOpenFloating('settings') }],
      },
      {
        label: '性能监控',
        submenu: [
          { label: '⚡FPS 监控', click: () => this.sendTogglePerf() },
          { label: '🔌 网络监控', click: () => this.sendOpenFloating('ipc-monitor') },
        ],
      },
      { role: 'viewMenu' },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  /**
   * Open the market tab in a separate window (mirrors TabBar 右键「在新窗口打开」).
   */
  private openMarketInNewWindow(): void {
    if (this.windowManager) {
      this.windowManager.openTabWindow('market', 'tab-market', '📊 行情');
    }
  }

  /**
   * Send a request to the main window's renderer to open a floating tab.
   */
  private sendOpenFloating(tab: 'order' | 'kline' | 'query' | 'settings' | 'ipc-monitor'): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_FLOATING, tab);
    }
  }

  /**
   * Send a request to the main window's renderer to switch the market home view
   * (全部/自选/T型期权) without creating new tabs.
   */
  private sendMarketView(view: 'all' | 'favorites' | 'options'): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.MENU_MARKET_VIEW, view);
    }
  }

  /**
   * Send a request to the main window's renderer to toggle FPS monitor.
   */
  private sendTogglePerf(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.MENU_TOGGLE_PERF);
    }
  }
}
