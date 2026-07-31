import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules (only what's used in PR-E1)
vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn(),
    getName: vi.fn().mockReturnValue('SimNow Trading Terminal'),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    isPackaged: false,
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn().mockReturnValue(false),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

describe('Electron Main Process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export initializeApp function', async () => {
    const mainModule = await import('../main');
    expect(mainModule.initializeApp).toBeDefined();
    expect(typeof mainModule.initializeApp).toBe('function');
  });

  it('should export getWindowManager function', async () => {
    const mainModule = await import('../main');
    expect(mainModule.getWindowManager).toBeDefined();
    expect(typeof mainModule.getWindowManager).toBe('function');
  });

  it('should export isDev constant', async () => {
    const mainModule = await import('../main');
    expect(mainModule.isDev).toBeDefined();
    expect(typeof mainModule.isDev).toBe('boolean');
  });
});
