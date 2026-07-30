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
    isDestroyed: vi.fn().mockReturnValue(false),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 }),
    setBounds: vi.fn(),
    webContents: {
      send: vi.fn(),
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
});
