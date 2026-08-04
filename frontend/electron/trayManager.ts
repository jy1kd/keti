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

    // Build context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '📊 行情',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, 'market');
          }
        },
      },
      {
        label: '⭐ 自选',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, 'favorites');
          }
        },
      },
      {
        label: '📋 查询',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, 'query');
          }
        },
      },
      { type: 'separator' },
      {
        label: '⚙ 设置',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, 'settings');
          }
        },
      },
      {
        label: '🔌 IPC 监控',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, 'ipc-monitor');
          }
        },
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
