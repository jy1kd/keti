import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
}));

describe('Electron Preload Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose electronAPI to window with all required functions', async () => {
    const { contextBridge } = await import('electron');
    await import('../preload');

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        // Window control
        minimizeWindow: expect.any(Function),
        maximizeWindow: expect.any(Function),
        closeWindow: expect.any(Function),
        // Window management
        openOrderWindow: expect.any(Function),
        openKLineWindow: expect.any(Function),
        // App info
        getAppVersion: expect.any(Function),
        getPlatform: expect.any(Function),
        getAppName: expect.any(Function),
        // Backend management
        restartBackend: expect.any(Function),
        getBackendStatus: expect.any(Function),
        // Event listeners
        onOrderUpdate: expect.any(Function),
        onNotification: expect.any(Function),
        removeAllListeners: expect.any(Function),
      })
    );
  });
});
