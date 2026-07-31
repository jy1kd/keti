"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = void 0;
exports.getWindowManager = getWindowManager;
exports.getTrayManager = getTrayManager;
exports.getShortcutManager = getShortcutManager;
exports.getNotificationManager = getNotificationManager;
exports.getBackendManager = getBackendManager;
exports.getAutoUpdaterManager = getAutoUpdaterManager;
exports.initializeApp = initializeApp;
const electron_1 = require("electron");
const windowManager_1 = require('./windowManager.cjs');
const trayManager_1 = require('./trayManager.cjs');
const shortcuts_1 = require('./shortcuts.cjs');
const notificationManager_1 = require('./notificationManager.cjs');
const backendManager_1 = require('./backendManager.cjs');
const autoUpdater_1 = require('./autoUpdater.cjs');
const index_1 = require('./ipc/index.cjs');
const window_1 = require('./ipc/window.cjs');
const app_1 = require('./ipc/app.cjs');
// Check if in development mode
exports.isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// Global manager instances
let windowManager;
let trayManager;
let shortcutManager;
let notificationManager;
let backendManager;
let autoUpdaterManager;
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
 * Get the auto updater manager instance
 */
function getAutoUpdaterManager() {
    return autoUpdaterManager;
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
    // Store selected instrument from renderer
    let selectedInstrument = '';
    // IPC handler to receive selected instrument from renderer
    electron_1.ipcMain.handle(index_1.IPC_CHANNELS.SELECTED_INSTRUMENT_RESPONSE, (_event, instrumentID) => {
        selectedInstrument = instrumentID;
    });
    // Create shortcut manager and register defaults
    shortcutManager = new shortcuts_1.ShortcutManager();
    shortcutManager.loadAndRegister({
        'open-order': () => {
            windowManager.openOrderWindow();
        },
        'open-kline': () => {
            // Request selected instrument from renderer
            mainWindow.webContents.send(index_1.IPC_CHANNELS.GET_SELECTED_INSTRUMENT);
            // Open K-line window with stored instrument (will be updated on response)
            if (selectedInstrument) {
                windowManager.openKLineWindow(selectedInstrument);
            }
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
    // Create auto updater manager
    autoUpdaterManager = new autoUpdater_1.AutoUpdaterManager();
    autoUpdaterManager.setMainWindow(mainWindow);
    // Check for updates after a short delay (don't block startup)
    setTimeout(() => {
        autoUpdaterManager.checkForUpdates();
    }, 5000);
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