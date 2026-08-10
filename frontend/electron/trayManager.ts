/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */

import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from './ipc/index';

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

  /**
   * Initialize the tray with a main window reference
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

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

    // 显示主窗口并向其发送 IPC（与顶部菜单打开方式同步：行情切主页视图，其余弹浮动窗）
    const showAndSend = (channel: string, ...args: unknown[]) => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.mainWindow.webContents.send(channel, ...args);
      }
    };

    // Build context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '📊 全部行情',
        click: () => showAndSend(IPC_CHANNELS.MENU_MARKET_VIEW, 'all'),
      },
      {
        label: '⭐ 自选行情',
        click: () => showAndSend(IPC_CHANNELS.MENU_MARKET_VIEW, 'favorites'),
      },
      { type: 'separator' },
      {
        label: '📋 查询窗口',
        click: () => showAndSend(IPC_CHANNELS.MENU_OPEN_FLOATING, 'query'),
      },
      {
        label: '⚙ 设置',
        click: () => showAndSend(IPC_CHANNELS.MENU_OPEN_FLOATING, 'settings'),
      },
      {
        label: '📡 网络监控',
        click: () => showAndSend(IPC_CHANNELS.MENU_OPEN_FLOATING, 'ipc-monitor'),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.destroy();
          }
          this.destroy();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

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

    // Handle window close - minimize to tray instead of quitting
    if (this.mainWindow) {
      this.mainWindow.on('close', (event) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
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
