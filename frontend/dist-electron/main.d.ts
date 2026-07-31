import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { ShortcutManager } from './shortcuts';
import { NotificationManager } from './notificationManager';
import { BackendManager } from './backendManager';
export declare const isDev: boolean;
/**
 * Get the window manager instance
 */
export declare function getWindowManager(): WindowManager;
/**
 * Get the tray manager instance
 */
export declare function getTrayManager(): TrayManager;
/**
 * Get the shortcut manager instance
 */
export declare function getShortcutManager(): ShortcutManager;
/**
 * Get the notification manager instance
 */
export declare function getNotificationManager(): NotificationManager;
/**
 * Get the backend manager instance
 */
export declare function getBackendManager(): BackendManager;
/**
 * Initialize the application
 */
export declare function initializeApp(): Promise<void>;
//# sourceMappingURL=main.d.ts.map