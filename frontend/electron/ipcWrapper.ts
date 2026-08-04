/**
 * IPC Wrapper
 *
 * Wraps IPC handlers to automatically log messages for IPC Monitor.
 */

import { ipcMain, BrowserWindow } from 'electron'

interface IPCMessage {
  timestamp: number
  direction: 'in' | 'out'
  channel: string
  data?: unknown
  windowId?: string
}

// Global message store
const messages: IPCMessage[] = []
const listeners: Set<(msg: IPCMessage) => void> = new Set()

/**
 * Add a listener for IPC messages
 */
export function addIPCListener(listener: (msg: IPCMessage) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Get all captured messages
 */
export function getIPCMessages(): IPCMessage[] {
  return [...messages]
}

/**
 * Clear all captured messages
 */
export function clearIPCMessages(): void {
  messages.length = 0
}

/**
 * Notify all listeners of a new message
 */
function notifyListeners(msg: IPCMessage): void {
  messages.push(msg)

  // Trim to max messages
  if (messages.length > 1000) {
    messages.splice(0, messages.length - 1000)
  }

  for (const listener of listeners) {
    try {
      listener(msg)
    } catch (e) {
      console.error('[IPC Wrapper] Listener error:', e)
    }
  }
}

/**
 * Get window ID from webContents
 */
function getWindowId(webContents: any): string {
  const window = BrowserWindow.fromWebContents(webContents)
  if (!window) return 'unknown'

  const windows = BrowserWindow.getAllWindows()
  const index = windows.indexOf(window)
  return index >= 0 ? `window-${index}` : 'unknown'
}

/**
 * Wrap an IPC handler to log messages
 */
export function wrapHandler<T extends (...args: any[]) => any>(
  channel: string,
  handler: T
): T {
  const wrappedHandler = ((event: any, ...args: any[]) => {
    console.log('[IPC Wrapper] Handling message:', channel)

    // Log incoming message
    notifyListeners({
      timestamp: Date.now(),
      direction: 'in',
      channel,
      data: args.length === 1 ? args[0] : args,
      windowId: getWindowId(event.sender),
    })

    // Call original handler
    return handler(event, ...args)
  }) as any

  return wrappedHandler
}

/**
 * Register an IPC handler with logging
 */
export function handleIPC(channel: string, handler: (event: any, ...args: any[]) => any): void {
  console.log('[IPC Wrapper] Registering handler for:', channel)
  ipcMain.handle(channel, wrapHandler(channel, handler))
}

/**
 * Send message to a window with logging
 */
export function sendToWindow(window: BrowserWindow, channel: string, ...args: any[]): void {
  // Log outgoing message
  notifyListeners({
    timestamp: Date.now(),
    direction: 'out',
    channel,
    data: args.length === 1 ? args[0] : args,
    windowId: 'main',
  })

  // Send to window
  window.webContents.send(channel, ...args)
}

/**
 * Broadcast message to all windows with logging
 */
export function broadcast(channel: string, ...args: any[]): void {
  // Log outgoing message
  notifyListeners({
    timestamp: Date.now(),
    direction: 'out',
    channel,
    data: args.length === 1 ? args[0] : args,
    windowId: 'main',
  })

  // Send to all windows
  const windows = BrowserWindow.getAllWindows()
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, ...args)
    }
  }
}

/**
 * Send IPC monitor data to a specific window
 */
export function sendIPCMonitorToWindow(window: BrowserWindow): void {
  console.log('[IPC Monitor] Sending messages to window:', messages.length)

  // Send current messages
  window.webContents.send('ipc-monitor-messages', messages)

  // Set up real-time forwarding
  addIPCListener((msg) => {
    if (!window.isDestroyed()) {
      console.log('[IPC Monitor] Forwarding message to window:', msg.channel)
      window.webContents.send('ipc-monitor-message', msg)
    }
  })
}
