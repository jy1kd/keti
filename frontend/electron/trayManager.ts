/**
 * Tray Manager
 *
 * Manages the system tray for the Electron application.
 * Supports tray icon, context menu, and notifications.
 */

import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'path';

// Tray notification types
export interface TrayNotification {
  title: string;
  content: string;
  icon?: string;
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
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(icon);
    this.tray.setToolTip('SimNow 交易终端');

    // Build context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: '行情面板',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            // TODO: Switch to market tab
          }
        },
      },
      {
        label: '报单面板',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            // TODO: Switch to order tab
          }
        },
      },
      {
        label: '查询面板',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            // TODO: Switch to query tab
          }
        },
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            // TODO: Open settings panel
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
        if (!this.mainWindow?.isDestroyed()) {
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
