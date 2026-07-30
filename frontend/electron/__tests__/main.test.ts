import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn(),
    getName: vi.fn().mockReturnValue('SimNow Trading Terminal'),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    webContents: {
      send: vi.fn(),
    },
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  })),
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({}),
  },
}));

describe('Electron Main Process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export createMainWindow function', async () => {
    // This test will fail initially (RED phase)
    const mainModule = await import('../main');
    expect(mainModule.createMainWindow).toBeDefined();
    expect(typeof mainModule.createMainWindow).toBe('function');
  });

  it('should export initializeApp function', async () => {
    const mainModule = await import('../main');
    expect(mainModule.initializeApp).toBeDefined();
    expect(typeof mainModule.initializeApp).toBe('function');
  });

  it('should have correct app configuration', async () => {
    const mainModule = await import('../main');
    expect(mainModule.APP_CONFIG).toBeDefined();
    expect(mainModule.APP_CONFIG.title).toBe('SimNow 交易终端');
    expect(mainModule.APP_CONFIG.width).toBe(1600);
    expect(mainModule.APP_CONFIG.height).toBe(1000);
  });
});
