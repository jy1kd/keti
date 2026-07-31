/**
 * Notification Manager
 *
 * Manages native system notifications for the Electron application.
 * Supports order notifications, stop order notifications, and connection notifications.
 */

import { Notification } from 'electron';

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Notification options
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
export class NotificationManager {
  private notifications: Notification[] = [];

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Show a generic notification
   */
  show(options: NotificationOptions): void {
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
  showOrderNotification(orderRef: string, instrumentID: string, status: string): void {
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
  showStopOrderNotification(stopOrderID: string, instrumentID: string, status: string): void {
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
  showConnectionNotification(connected: boolean, message?: string): void {
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
  private getOrderStatusText(status: string): string {
    const statusMap: Record<string, string> = {
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
  private getStopOrderStatusText(status: string): void {
    const statusMap: Record<string, string> = {
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
  closeAll(): void {
    for (const notification of this.notifications) {
      notification.close();
    }
    this.notifications = [];
  }
}
