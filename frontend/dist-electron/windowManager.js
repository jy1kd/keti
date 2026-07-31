"use strict";
/**
 * Window Manager
 *
 * Manages multiple BrowserWindow instances for the Electron application.
 * Supports creating, closing, and switching between windows.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// Default window configurations
const DEFAULT_CONFIGS = {
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
class WindowManager {
    constructor(isDev = false) {
        this.windows = new Map();
        this.windowStates = new Map();
        this.isDev = isDev;
    }
    /**
     * Create the main application window
     */
    createMainWindow() {
        const config = DEFAULT_CONFIGS.main;
        const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
        const mainWindow = new electron_1.BrowserWindow({
            width: Math.min(config.width, width),
            height: Math.min(config.height, height),
            minWidth: config.minWidth,
            minHeight: config.minHeight,
            title: config.title,
            webPreferences: {
                preload: path_1.default.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            show: false,
        });
        // Load the app
        if (this.isDev) {
            mainWindow.loadURL('http://localhost:5173');
            mainWindow.webContents.openDevTools();
        }
        else {
            mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
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
    openOrderWindow(instrumentID) {
        const windowId = instrumentID ? `order-${instrumentID}` : 'order-new';
        // Return existing window if it exists
        const existing = this.windows.get(windowId);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return existing;
        }
        const config = DEFAULT_CONFIGS.order;
        const parent = this.windows.get('main');
        const orderWindow = new electron_1.BrowserWindow({
            width: config.width,
            height: config.height,
            minWidth: config.minWidth,
            minHeight: config.minHeight,
            title: instrumentID ? `${config.title} - ${instrumentID}` : config.title,
            parent,
            modal: false,
            webPreferences: {
                preload: path_1.default.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            show: false,
        });
        // Load the order page
        if (this.isDev) {
            orderWindow.loadURL(`http://localhost:5173#/order/${instrumentID || ''}`);
        }
        else {
            orderWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'), {
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
    openKLineWindow(instrumentID) {
        const windowId = `kline-${instrumentID}`;
        // Return existing window if it exists
        const existing = this.windows.get(windowId);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return existing;
        }
        const config = DEFAULT_CONFIGS.kline;
        const klineWindow = new electron_1.BrowserWindow({
            width: config.width,
            height: config.height,
            minWidth: config.minWidth,
            minHeight: config.minHeight,
            title: `${config.title} - ${instrumentID}`,
            webPreferences: {
                preload: path_1.default.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            show: false,
        });
        // Load the K-line page
        if (this.isDev) {
            klineWindow.loadURL(`http://localhost:5173#/kline/${instrumentID}`);
        }
        else {
            klineWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'), {
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
    getWindow(id) {
        const window = this.windows.get(id);
        if (window && !window.isDestroyed()) {
            return window;
        }
        return null;
    }
    /**
     * Get all active windows
     */
    getAllWindows() {
        return Array.from(this.windows.values()).filter(w => !w.isDestroyed());
    }
    /**
     * Close all windows
     */
    closeAllWindows() {
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
    sendToWindow(windowId, channel, data) {
        const window = this.getWindow(windowId);
        if (window) {
            window.webContents.send(channel, data);
        }
    }
    /**
     * Broadcast message to all windows
     */
    broadcast(channel, data) {
        for (const window of this.windows.values()) {
            if (!window.isDestroyed()) {
                window.webContents.send(channel, data);
            }
        }
    }
    /**
     * Save window state for persistence
     */
    saveWindowState(id) {
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
    getWindowState(id) {
        return this.windowStates.get(id) || null;
    }
    /**
     * Restore window state
     */
    restoreWindowState(id) {
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
}
exports.WindowManager = WindowManager;
//# sourceMappingURL=windowManager.js.map