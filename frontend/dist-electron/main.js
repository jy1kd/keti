import { app, BrowserWindow } from 'electron';
import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { ShortcutManager } from './shortcuts';
import { NotificationManager } from './notificationManager';
import { BackendManager } from './backendManager';
import { registerWindowControlHandlers, registerWindowManagementHandlers } from './ipc/window';
import { registerAppInfoHandlers, registerBackendManagementHandlers } from './ipc/app';
// Check if in development mode
export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
// Global manager instances
let windowManager;
let trayManager;
let shortcutManager;
let notificationManager;
let backendManager;
/**
 * Get the window manager instance
 */
export function getWindowManager() {
    return windowManager;
}
/**
 * Get the tray manager instance
 */
export function getTrayManager() {
    return trayManager;
}
/**
 * Get the shortcut manager instance
 */
export function getShortcutManager() {
    return shortcutManager;
}
/**
 * Get the notification manager instance
 */
export function getNotificationManager() {
    return notificationManager;
}
/**
 * Get the backend manager instance
 */
export function getBackendManager() {
    return backendManager;
}
/**
 * Initialize the application
 */
export async function initializeApp() {
    // Wait for app to be ready
    await app.whenReady();
    // Create window manager
    windowManager = new WindowManager(isDev);
    // Create main window
    const mainWindow = windowManager.createMainWindow();
    // Create tray manager and initialize
    trayManager = new TrayManager();
    trayManager.initialize(mainWindow);
    // Create shortcut manager and register defaults
    shortcutManager = new ShortcutManager();
    shortcutManager.loadAndRegister({
        'open-order': () => {
            windowManager.openOrderWindow();
        },
        'open-kline': () => {
            // Get selected instrument from main window
            mainWindow.webContents.send('get-selected-instrument');
        },
        'quit': () => {
            app.quit();
        },
    });
    // Create notification manager
    notificationManager = new NotificationManager();
    // Create backend manager and start backend
    backendManager = new BackendManager();
    await backendManager.start();
    // Handle app activation (macOS)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            windowManager.createMainWindow();
        }
    });
    // Handle all windows closed
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
    // Register IPC handlers using modular approach
    registerWindowControlHandlers(mainWindow);
    registerWindowManagementHandlers(windowManager);
    registerAppInfoHandlers();
    registerBackendManagementHandlers(backendManager);
    // Cleanup on quit
    app.on('will-quit', () => {
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