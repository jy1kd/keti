/**
 * Notification Manager
 *
 * Manages native system notifications for the Electron application.
 * Supports order notifications, stop order notifications, and connection notifications.
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export interface NotificationOptions {
    title: string;
    body: string;
    type?: NotificationType;
    silent?: boolean;
    onClick?: () => void;
}
/**
 * NotificationManager class
 */
export declare class NotificationManager {
    private notifications;
    /**
     * Check if notifications are supported
     */
    isSupported(): boolean;
    /**
     * Show a generic notification
     */
    show(options: NotificationOptions): void;
    /**
     * Show order notification
     */
    showOrderNotification(orderRef: string, instrumentID: string, status: string): void;
    /**
     * Show stop order notification
     */
    showStopOrderNotification(stopOrderID: string, instrumentID: string, status: string): void;
    /**
     * Show connection notification
     */
    showConnectionNotification(connected: boolean, message?: string): void;
    /**
     * Get order status text
     */
    private getOrderStatusText;
    /**
     * Get stop order status text
     */
    private getStopOrderStatusText;
    /**
     * Close all notifications
     */
    closeAll(): void;
}
//# sourceMappingURL=notificationManager.d.ts.map