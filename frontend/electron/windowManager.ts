/**
 * Window Manager
 *
 * Manages multiple BrowserWindow instances for the Electron application.
 * Supports creating, closing, and switching between windows.
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';

// Window configuration
export interface WindowConfig {
  id: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  parent?: BrowserWindow;
  modal?: boolean;
}

// Window state for persistence
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

// Default window configurations
const DEFAULT_CONFIGS: Record<string, Partial<WindowConfig>> = {
  main: {
    title: 'SimNow 交易终端',
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
  },
  order: {
    title: '报单',
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 500,
  },
  kline: {
    title: 'K线图',
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
  },
  query: {
    title: '查询',
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
  },
};

/**
 * WindowManager class
 */
export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private windowStates: Map<string, WindowState> = new Map();
  private isDev: boolean;

  constructor(isDev: boolean = false) {
    this.isDev = isDev;
  }

  /**
   * Create the main application window
   */
  createMainWindow(): BrowserWindow {
    const config = DEFAULT_CONFIGS.main;
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const mainWindow = new BrowserWindow({
      width: Math.min(config.width!, width),
      height: Math.min(config.height!, height),
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      title: config.title,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    // Load the app
    if (this.isDev) {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Track window
    this.windows.set('main', mainWindow);

    // Handle window close
    mainWindow.on('closed', () => {
      this.windows.delete('main');
    });

    return mainWindow;
  }

  /**
   * Open order window for a specific instrument
   */
  openOrderWindow(instrumentID?: string): BrowserWindow {
    const windowId = instrumentID ? `order-${instrumentID}` : 'order-new';

    // Return existing window if it exists
    const existing = this.windows.get(windowId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const config = DEFAULT_CONFIGS.order;
    const parent = this.windows.get('main');

    const orderWindow = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      title: instrumentID ? `${config.title} - ${instrumentID}` : config.title,
      parent,
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    // Load the order page
    if (this.isDev) {
      orderWindow.loadURL(`http://localhost:5173#/order/${instrumentID || ''}`);
    } else {
      orderWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        hash: `#/order/${instrumentID || ''}`,
      });
    }

    // Show window when ready
    orderWindow.once('ready-to-show', () => {
      orderWindow.show();
    });

    // Track window
    this.windows.set(windowId, orderWindow);

    // Handle window close
    orderWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    return orderWindow;
  }

  /**
   * Open K-line window for a specific instrument
   */
  openKLineWindow(instrumentID: string): BrowserWindow {
    const windowId = `kline-${instrumentID}`;

    // Return existing window if it exists
    const existing = this.windows.get(windowId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const config = DEFAULT_CONFIGS.kline;

    const klineWindow = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      title: `${config.title} - ${instrumentID}`,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    // Load the K-line page
    if (this.isDev) {
      klineWindow.loadURL(`http://localhost:5173#/kline/${instrumentID}`);
    } else {
      klineWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        hash: `#/kline/${instrumentID}`,
      });
    }

    // Show window when ready
    klineWindow.once('ready-to-show', () => {
      klineWindow.show();
    });

    // Track window
    this.windows.set(windowId, klineWindow);

    // Handle window close
    klineWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    return klineWindow;
  }

  /**
   * Get a window by ID
   */
  getWindow(id: string): BrowserWindow | null {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      return window;
    }
    return null;
  }

  /**
   * Get all active windows
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).filter(w => !w.isDestroyed());
  }

  /**
   * Close all windows
   */
  closeAllWindows(): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }

  /**
   * Send message to a specific window
   */
  sendToWindow(windowId: string, channel: string, data: any): void {
    const window = this.getWindow(windowId);
    if (window) {
      window.webContents.send(channel, data);
    }
  }

  /**
   * Broadcast message to all windows
   */
  broadcast(channel: string, data: any): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    }
  }

  /**
   * Save window state for persistence
   */
  saveWindowState(id: string): void {
    const window = this.getWindow(id);
    if (window) {
      const bounds = window.getBounds();
      this.windowStates.set(id, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: window.isMaximized(),
      });
    }
  }

  /**
   * Get saved window state
   */
  getWindowState(id: string): WindowState | null {
    return this.windowStates.get(id) || null;
  }

  /**
   * Restore window state
   */
  restoreWindowState(id: string): void {
    const window = this.getWindow(id);
    const state = this.windowStates.get(id);
    if (window && state) {
      window.setBounds({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
      });
      if (state.isMaximized) {
        window.maximize();
      }
    }
  }

  /**
   * Open a tab in a new window (detach from main window)
   */
  openTabWindow(tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>): BrowserWindow {
    const windowId = `tab-${tabId}`;

    // Return existing window if it exists
    const existing = this.windows.get(windowId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const config = DEFAULT_CONFIGS[tabType] || DEFAULT_CONFIGS.main;
    const parent = this.windows.get('main');

    const tabWindow = new BrowserWindow({
      width: config.width || 800,
      height: config.height || 600,
      minWidth: config.minWidth || 400,
      minHeight: config.minHeight || 300,
      title: tabTitle,
      parent,
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    // Load the tab page with props in hash
    const propsStr = props ? encodeURIComponent(JSON.stringify(props)) : '';
    const hash = `#/tab/${tabType}/${tabId}${propsStr ? `?props=${propsStr}` : ''}`;

    if (this.isDev) {
      tabWindow.loadURL(`http://localhost:5173${hash}`);
    } else {
      tabWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash });
    }

    // Show window when ready
    tabWindow.once('ready-to-show', () => {
      tabWindow.show();
    });

    // Track window
    this.windows.set(windowId, tabWindow);

    // Handle window close - notify main window to update tab state
    tabWindow.on('closed', () => {
      this.windows.delete(windowId);
      // Notify main window that this tab window was closed
      const mainWindow = this.windows.get('main');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tab-window-closed', { tabId, tabType });
      }
    });

    return tabWindow;
  }

  /**
   * Check if a tab is open in a separate window
   */
  isTabInWindow(tabId: string): boolean {
    const windowId = `tab-${tabId}`;
    const window = this.windows.get(windowId);
    return window !== undefined && !window.isDestroyed();
  }

  /**
   * Close a tab window
   */
  closeTabWindow(tabId: string): void {
    const windowId = `tab-${tabId}`;
    const window = this.windows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
}
