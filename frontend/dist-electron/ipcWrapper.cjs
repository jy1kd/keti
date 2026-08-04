"use strict";
/**
 * IPC Wrapper
 *
 * Wraps IPC handlers to automatically log messages for IPC Monitor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addIPCListener = addIPCListener;
exports.getIPCMessages = getIPCMessages;
exports.clearIPCMessages = clearIPCMessages;
exports.wrapHandler = wrapHandler;
exports.handleIPC = handleIPC;
exports.sendToWindow = sendToWindow;
exports.broadcast = broadcast;
exports.sendIPCMonitorToWindow = sendIPCMonitorToWindow;
const electron_1 = require("electron");
// Global message store
const messages = [];
const listeners = new Set();
/**
 * Add a listener for IPC messages
 */
function addIPCListener(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
/**
 * Get all captured messages
 */
function getIPCMessages() {
    return [...messages];
}
/**
 * Clear all captured messages
 */
function clearIPCMessages() {
    messages.length = 0;
}
/**
 * Notify all listeners of a new message
 */
function notifyListeners(msg) {
    messages.push(msg);
    // Trim to max messages
    if (messages.length > 1000) {
        messages.splice(0, messages.length - 1000);
    }
    for (const listener of listeners) {
        try {
            listener(msg);
        }
        catch (e) {
            console.error('[IPC Wrapper] Listener error:', e);
        }
    }
}
/**
 * Get window ID from webContents
 */
function getWindowId(webContents) {
    const window = electron_1.BrowserWindow.fromWebContents(webContents);
    if (!window)
        return 'unknown';
    const windows = electron_1.BrowserWindow.getAllWindows();
    const index = windows.indexOf(window);
    return index >= 0 ? `window-${index}` : 'unknown';
}
/**
 * Wrap an IPC handler to log messages
 */
function wrapHandler(channel, handler) {
    const wrappedHandler = ((event, ...args) => {
        // Log incoming message
        notifyListeners({
            timestamp: Date.now(),
            direction: 'in',
            channel,
            data: args.length === 1 ? args[0] : args,
            windowId: getWindowId(event.sender),
        });
        // Call original handler
        return handler(event, ...args);
    });
    return wrappedHandler;
}
/**
 * Register an IPC handler with logging
 */
function handleIPC(channel, handler) {
    electron_1.ipcMain.handle(channel, wrapHandler(channel, handler));
}
/**
 * Send message to a window with logging
 */
function sendToWindow(window, channel, ...args) {
    // Log outgoing message
    notifyListeners({
        timestamp: Date.now(),
        direction: 'out',
        channel,
        data: args.length === 1 ? args[0] : args,
        windowId: 'main',
    });
    // Send to window
    window.webContents.send(channel, ...args);
}
/**
 * Broadcast message to all windows with logging
 */
function broadcast(channel, ...args) {
    // Log outgoing message
    notifyListeners({
        timestamp: Date.now(),
        direction: 'out',
        channel,
        data: args.length === 1 ? args[0] : args,
        windowId: 'main',
    });
    // Send to all windows
    const windows = electron_1.BrowserWindow.getAllWindows();
    for (const window of windows) {
        if (!window.isDestroyed()) {
            window.webContents.send(channel, ...args);
        }
    }
}
/**
 * Send IPC monitor data to a specific window
 */
function sendIPCMonitorToWindow(window) {
    // Send current messages
    window.webContents.send('ipc-monitor-messages', messages);
    // Set up real-time forwarding
    addIPCListener((msg) => {
        if (!window.isDestroyed()) {
            window.webContents.send('ipc-monitor-message', msg);
        }
    });
}
//# sourceMappingURL=ipcWrapper.js.map