import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    displayBalloon: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn().mockReturnValue({}),
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({}),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn().mockReturnValue(true),
  })),
}));

describe('TrayManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export TrayManager class', async () => {
    const { TrayManager } = await import('../trayManager');
    expect(TrayManager).toBeDefined();
    expect(typeof TrayManager).toBe('function');
  });

  it('should create instance with initialize method', async () => {
    const { TrayManager } = await import('../trayManager');
    const manager = new TrayManager();
    expect(manager.initialize).toBeDefined();
    expect(typeof manager.initialize).toBe('function');
  });

  it('should create instance with destroy method', async () => {
    const { TrayManager } = await import('../trayManager');
    const manager = new TrayManager();
    expect(manager.destroy).toBeDefined();
    expect(typeof manager.destroy).toBe('function');
  });

  it('should create instance with showNotification method', async () => {
    const { TrayManager } = await import('../trayManager');
    const manager = new TrayManager();
    expect(manager.showNotification).toBeDefined();
    expect(typeof manager.showNotification).toBe('function');
  });

  it('should create instance with getTray method', async () => {
    const { TrayManager } = await import('../trayManager');
    const manager = new TrayManager();
    expect(manager.getTray).toBeDefined();
    expect(typeof manager.getTray).toBe('function');
  });

  it('should return null for getTray before initialization', async () => {
    const { TrayManager } = await import('../trayManager');
    const manager = new TrayManager();
    const tray = manager.getTray();
    expect(tray).toBeNull();
  });
});
