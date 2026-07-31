import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  })),
}));

describe('NotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export NotificationManager class', async () => {
    const { NotificationManager } = await import('../notificationManager');
    expect(NotificationManager).toBeDefined();
    expect(typeof NotificationManager).toBe('function');
  });

  it('should create instance with show method', async () => {
    const { NotificationManager } = await import('../notificationManager');
    const manager = new NotificationManager();
    expect(manager.show).toBeDefined();
    expect(typeof manager.show).toBe('function');
  });

  it('should create instance with showOrderNotification method', async () => {
    const { NotificationManager } = await import('../notificationManager');
    const manager = new NotificationManager();
    expect(manager.showOrderNotification).toBeDefined();
    expect(typeof manager.showOrderNotification).toBe('function');
  });

  it('should create instance with showStopOrderNotification method', async () => {
    const { NotificationManager } = await import('../notificationManager');
    const manager = new NotificationManager();
    expect(manager.showStopOrderNotification).toBeDefined();
    expect(typeof manager.showStopOrderNotification).toBe('function');
  });

  it('should create instance with showConnectionNotification method', async () => {
    const { NotificationManager } = await import('../notificationManager');
    const manager = new NotificationManager();
    expect(manager.showConnectionNotification).toBeDefined();
    expect(typeof manager.showConnectionNotification).toBe('function');
  });

  it('should create instance with isSupported method', async () => {
    const { NotificationManager } = await import('../notificationManager');
    const manager = new NotificationManager();
    expect(manager.isSupported).toBeDefined();
    expect(typeof manager.isSupported).toBe('function');
  });
});
