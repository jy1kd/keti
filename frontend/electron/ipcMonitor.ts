/**
 * IPC Monitor
 *
 * Monitors all IPC communications between main and renderer processes.
 * Sends captured messages to renderer for display in IPCMonitorPage.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from './ipc/index'

interface IPCMessage {
  timestamp: number
  direction: 'in' | 'out'
  channel: string
  data?: unknown
  windowId?: string
}

/**
 * IPCMonitor class
 *
 * Captures IPC messages and sends them to renderer windows.
 */
export class IPCMonitor {
  private enabled: boolean = false
  private messages: IPCMessage[] = []
  private maxMessages: number = 1000
  private listeners: Set<(msg: IPCMessage) => void> = new Set()
  private originalHandlers: Map<string, (...args: any[]) => any> = new Map()

  /**
   * Enable IPC monitoring
   */
  enable(): void {
    if (this.enabled) return
    this.enabled = true
    this.setupInterceptors()
  }

  /**
   * Disable IPC monitoring
   */
  disable(): void {
    this.enabled = false
    this.restoreHandlers()
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get all captured messages
   */
  getMessages(): IPCMessage[] {
    return [...this.messages]
  }

  /**
   * Clear all captured messages
   */
  clearMessages(): void {
    this.messages = []
  }

  /**
   * Add a listener for new messages
   */
  addListener(listener: (msg: IPCMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of a new message
   */
  private notifyListeners(msg: IPCMessage): void {
    this.messages.push(msg)

    // Trim to max messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages)
    }

    for (const listener of this.listeners) {
      try {
        listener(msg)
      } catch (e) {
        console.error('[IPC Monitor] Listener error:', e)
      }
    }
  }

  /**
   * Setup IPC interceptors
   */
  private setupInterceptors(): void {
    // Intercept all ipcMain.handle calls
    const originalHandle = ipcMain.handle.bind(ipcMain)
    ipcMain.handle = (channel: string, handler: (event: any, ...args: any[]) => any) => {
      // Wrap the handler to capture incoming messages
      const wrappedHandler = (event: any, ...args: any[]) => {
        if (this.enabled) {
          this.notifyListeners({
            timestamp: Date.now(),
            direction: 'in',
            channel,
            data: args.length === 1 ? args[0] : args,
            windowId: this.getWindowId(event.sender),
          })
        }
        return handler(event, ...args)
      }

      // Store original handler for restoration
      this.originalHandlers.set(channel, handler)

      return originalHandle(channel, wrappedHandler)
    }

    // Intercept webContents.send to capture outgoing messages
    const originalSend = BrowserWindow.prototype.webContents.send
    const monitor = this // Capture reference to IPCMonitor instance
    BrowserWindow.prototype.webContents.send = function (this: any, channel: string, ...args: any[]) {
      if (monitor.enabled) {
        monitor.notifyListeners({
          timestamp: Date.now(),
          direction: 'out',
          channel,
          data: args.length === 1 ? args[0] : args,
          windowId: 'main',
        })
      }
      return originalSend.call(this, channel, ...args)
    }
  }

  /**
   * Restore original IPC handlers
   */
  private restoreHandlers(): void {
    // Note: Restoring handlers is complex due to Electron's API
    // For now, we just disable the monitoring flag
    // In production, consider using a Proxy pattern instead
  }

  /**
   * Get window ID from webContents
   */
  private getWindowId(webContents: any): string {
    const window = BrowserWindow.fromWebContents(webContents)
    if (!window) return 'unknown'

    // Try to find window ID from our tracked windows
    const windows = BrowserWindow.getAllWindows()
    const index = windows.indexOf(window)
    return index >= 0 ? `window-${index}` : 'unknown'
  }

  /**
   * Send monitoring data to a specific window
   */
  sendToWindow(window: BrowserWindow): void {
    if (!this.enabled) return

    // Send current messages
    window.webContents.send('ipc-monitor-messages', this.messages)

    // Set up real-time forwarding
    this.addListener((msg) => {
      if (!window.isDestroyed()) {
        window.webContents.send('ipc-monitor-message', msg)
      }
    })
  }
}

// Singleton instance
let monitorInstance: IPCMonitor | null = null

/**
 * Get the IPC Monitor singleton instance
 */
export function getIPCMonitor(): IPCMonitor {
  if (!monitorInstance) {
    monitorInstance = new IPCMonitor()
  }
  return monitorInstance
}
