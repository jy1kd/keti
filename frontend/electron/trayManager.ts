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
