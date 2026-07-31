/**
 * Window IPC Handlers
 *
 * Handles all window-related IPC communications:
 * - Window control (minimize, maximize, close)
 * - Window management (open order window, open kline window)
 */
import { BrowserWindow } from 'electron';
import { WindowManager } from '../windowManager';
/**
 * Register window control IPC handlers
 */
export declare function registerWindowControlHandlers(mainWindow: BrowserWindow): void;
/**
 * Register window management IPC handlers
 */
export declare function registerWindowManagementHandlers(windowManager: WindowManager): void;
/**
 * Unregister all window IPC handlers
 */
export declare function unregisterWindowHandlers(): void;
//# sourceMappingURL=window.d.ts.map