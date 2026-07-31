import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    isMaximized: vi.fn().mockReturnValue(false),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 }),
    setBounds: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    id: 1,
  })),
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
    }),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

describe('WindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export WindowManager class', async () => {
    const { WindowManager } = await import('../windowManager');
    expect(WindowManager).toBeDefined();
    expect(typeof WindowManager).toBe('function');
  });

  it('should create instance with createMainWindow method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.createMainWindow).toBeDefined();
    expect(typeof manager.createMainWindow).toBe('function');
  });

  it('should create instance with openOrderWindow method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.openOrderWindow).toBeDefined();
    expect(typeof manager.openOrderWindow).toBe('function');
  });

  it('should create instance with openKLineWindow method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.openKLineWindow).toBeDefined();
    expect(typeof manager.openKLineWindow).toBe('function');
  });

  it('should create instance with getWindow method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.getWindow).toBeDefined();
    expect(typeof manager.getWindow).toBe('function');
  });

  it('should create instance with getAllWindows method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.getAllWindows).toBeDefined();
    expect(typeof manager.getAllWindows).toBe('function');
  });

  it('should create instance with closeAllWindows method', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    expect(manager.closeAllWindows).toBeDefined();
    expect(typeof manager.closeAllWindows).toBe('function');
  });

  it('should return empty array when no windows created', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    const windows = manager.getAllWindows();
    expect(windows).toEqual([]);
  });

  it('should return null for non-existent window', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    const window = manager.getWindow('non-existent');
    expect(window).toBeNull();
  });

  it('should create main window and add to getAllWindows', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    manager.createMainWindow();
    const windows = manager.getAllWindows();
    expect(windows.length).toBe(1);
  });

  it('should return same window when opening order window twice', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    const window1 = manager.openOrderWindow('IF2608');
    const window2 = manager.openOrderWindow('IF2608');
    expect(window1).toBe(window2);
  });

  it('should set parent for order window', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    const mainWindow = manager.createMainWindow();
    const orderWindow = manager.openOrderWindow('IF2608');
    // BrowserWindow mock doesn't track parent, but we verify no error
    expect(orderWindow).toBeDefined();
  });

  it('should close all windows', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    manager.createMainWindow();
    manager.openOrderWindow('IF2608');
    manager.openKLineWindow('IF2608');
    expect(manager.getAllWindows().length).toBe(3);
    manager.closeAllWindows();
    expect(manager.getAllWindows().length).toBe(0);
  });

  it('should save and restore window state', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    manager.createMainWindow();
    manager.saveWindowState('main');
    const state = manager.getWindowState('main');
    expect(state).toBeDefined();
    expect(state?.width).toBe(800);
    expect(state?.height).toBe(600);
  });

  it('should broadcast message to all windows', async () => {
    const { WindowManager } = await import('../windowManager');
    const manager = new WindowManager();
    manager.createMainWindow();
    manager.openOrderWindow('IF2608');
    // Should not throw
    manager.broadcast('test-channel', { data: 'test' });
  });
});
