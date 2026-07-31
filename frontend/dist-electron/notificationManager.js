/**
 * Notification Manager
 *
 * Manages native system notifications for the Electron application.
 * Supports order notifications, stop order notifications, and connection notifications.
 */
import { Notification } from 'electron';
/**
 * NotificationManager class
 */
export class NotificationManager {
    constructor() {
        this.notifications = [];
    }
    /**
     * Check if notifications are supported
     */
    isSupported() {
        return Notification.isSupported();
    }
    /**
     * Show a generic notification
     */
    show(options) {
        if (!this.isSupported()) {
            console.warn('[NotificationManager] Notifications are not supported');
            return;
        }
        const notification = new Notification({
            title: options.title,
            body: options.body,
            silent: options.silent ?? false,
        });
        // Handle click
        if (options.onClick) {
            notification.on('click', options.onClick);
        }
        // Track notification
        this.notifications.push(notification);
        // Clean up when closed
        notification.on('close', () => {
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        });
        notification.show();
    }
    /**
     * Show order notification
     */
    showOrderNotification(orderRef, instrumentID, status) {
        const statusText = this.getOrderStatusText(status);
        this.show({
            title: '报单通知',
            body: `${instrumentID} 报单 ${orderRef} ${statusText}`,
            type: status === '0' ? 'success' : 'warning',
        });
    }
    /**
     * Show stop order notification
     */
    showStopOrderNotification(stopOrderID, instrumentID, status) {
        const statusText = this.getStopOrderStatusText(status);
        this.show({
            title: '止损单通知',
            body: `${instrumentID} 止损单 ${stopOrderID} ${statusText}`,
            type: status === 'triggered' ? 'success' : 'info',
        });
    }
    /**
     * Show connection notification
     */
    showConnectionNotification(connected, message) {
        this.show({
            title: connected ? '连接已恢复' : '连接已断开',
            body: message || (connected ? 'CTP 连接已恢复' : 'CTP 连接已断开，请检查网络'),
            type: connected ? 'success' : 'error',
            silent: connected, // Only play sound for disconnection
        });
    }
    /**
     * Get order status text
     */
    getOrderStatusText(status) {
        const statusMap = {
            '0': '全部成交',
            '1': '部分成交',
            '2': '未成交(排队)',
            '3': '未成交',
            '5': '已撤单',
        };
        return statusMap[status] || status;
    }
    /**
     * Get stop order status text
     */
    getStopOrderStatusText(status) {
        const statusMap = {
            'pending': '待触发',
            'triggered': '已触发',
            'trigger_failed': '触发失败',
            'canceled': '已取消',
        };
        return statusMap[status] || status;
    }
    /**
     * Close all notifications
     */
    closeAll() {
        for (const notification of this.notifications) {
            notification.close();
        }
        this.notifications = [];
    }
}
//# sourceMappingURL=notificationManager.js.map