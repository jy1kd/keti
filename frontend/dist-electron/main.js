"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = void 0;
exports.getWindowManager = getWindowManager;
exports.getTrayManager = getTrayManager;
exports.getShortcutManager = getShortcutManager;
exports.getNotificationManager = getNotificationManager;
exports.getBackendManager = getBackendManager;
exports.initializeApp = initializeApp;
const electron_1 = require("electron");
const windowManager_1 = require("./windowManager");
const trayManager_1 = require("./trayManager");
const shortcuts_1 = require("./shortcuts");
const notificationManager_1 = require("./notificationManager");
const backendManager_1 = require("./backendManager");
const window_1 = require("./ipc/window");
const app_1 = require("./ipc/app");
// Check if in development mode
exports.isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// Global manager instances
let windowManager;
let trayManager;
let shortcutManager;
let notificationManager;
let backendManager;
/**
 * Get the window manager instance
 */
function getWindowManager() {
    return windowManager;
}
/**
 * Get the tray manager instance
 */
function getTrayManager() {
    return trayManager;
}
/**
 * Get the shortcut manager instance
 */
function getShortcutManager() {
    return shortcutManager;
}
/**
 * Get the notification manager instance
 */
function getNotificationManager() {
    return notificationManager;
}
/**
 * Get the backend manager instance
 */
function getBackendManager() {
    return backendManager;
}
/**
 * Initialize the application
 */
async function initializeApp() {
    // Wait for app to be ready
    await electron_1.app.whenReady();
    // Create window manager
    windowManager = new windowManager_1.WindowManager(exports.isDev);
    // Create main window
    const mainWindow = windowManager.createMainWindow();
    // Create tray manager and initialize
    trayManager = new trayManager_1.TrayManager();
    trayManager.initialize(mainWindow);
    // Create shortcut manager and register defaults
    shortcutManager = new shortcuts_1.ShortcutManager();
    shortcutManager.loadAndRegister({
        'open-order': () => {
            windowManager.openOrderWindow();
        },
        'open-kline': () => {
            // Get selected instrument from main window
            mainWindow.webContents.send('get-selected-instrument');
        },
        'quit': () => {
            electron_1.app.quit();
        },
    });
    // Create notification manager
    notificationManager = new notificationManager_1.NotificationManager();
    // Create backend manager and start backend
    backendManager = new backendManager_1.BackendManager();
    await backendManager.start();
    // Handle app activation (macOS)
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            windowManager.createMainWindow();
        }
    });
    // Handle all windows closed
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    // Register IPC handlers using modular approach
    (0, window_1.registerWindowControlHandlers)(mainWindow);
    (0, window_1.registerWindowManagementHandlers)(windowManager);
    (0, app_1.registerAppInfoHandlers)();
    (0, app_1.registerBackendManagementHandlers)(backendManager);
    // Cleanup on quit
    electron_1.app.on('will-quit', () => {
        shortcutManager.save();
        shortcutManager.unregisterAll();
        notificationManager.closeAll();
        backendManager.stop();
    });
}
// Only auto-initialize when not in test environment
if (process.env.NODE_ENV !== 'test') {
    initializeApp().catch(console.error);
}
//# sourceMappingURL=main.js.map