import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock window.electronAPI
const mockElectronAPI = {
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  openOrderWindow: vi.fn().mockResolvedValue(undefined),
  openKLineWindow: vi.fn().mockResolvedValue(undefined),
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  getPlatform: vi.fn().mockResolvedValue('win32'),
  getAppName: vi.fn().mockResolvedValue('SimNow Trading Terminal'),
  restartBackend: vi.fn().mockResolvedValue(undefined),
  getBackendStatus: vi.fn().mockResolvedValue({ running: false }),
  onOrderUpdate: vi.fn().mockReturnValue(() => {}),
  onNotification: vi.fn().mockReturnValue(() => {}),
  removeAllListeners: vi.fn(),
};

describe('Electron Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up window.electronAPI
    delete (window as any).electronAPI;
  });

  describe('isElectron', () => {
    it('should return false when window.electronAPI is undefined', async () => {
      const { isElectron } = await import('../electron');
      expect(isElectron()).toBe(false);
    });

    it('should return true when window.electronAPI is defined', async () => {
      (window as any).electronAPI = mockElectronAPI;
      const { isElectron } = await import('../electron');
      expect(isElectron()).toBe(true);
    });
  });

  describe('Window control functions', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI;
    });

    it('minimizeWindow should call electronAPI.minimizeWindow', async () => {
      const { minimizeWindow } = await import('../electron');
      await minimizeWindow();
      expect(mockElectronAPI.minimizeWindow).toHaveBeenCalled();
    });

    it('maximizeWindow should call electronAPI.maximizeWindow', async () => {
      const { maximizeWindow } = await import('../electron');
      await maximizeWindow();
      expect(mockElectronAPI.maximizeWindow).toHaveBeenCalled();
    });

    it('closeWindow should call electronAPI.closeWindow', async () => {
      const { closeWindow } = await import('../electron');
      await closeWindow();
      expect(mockElectronAPI.closeWindow).toHaveBeenCalled();
    });
  });

  describe('Window management functions', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI;
    });

    it('openOrderWindow should call electronAPI.openOrderWindow', async () => {
      const { openOrderWindow } = await import('../electron');
      await openOrderWindow('IF2608');
      expect(mockElectronAPI.openOrderWindow).toHaveBeenCalledWith('IF2608');
    });

    it('openKLineWindow should call electronAPI.openKLineWindow', async () => {
      const { openKLineWindow } = await import('../electron');
      await openKLineWindow('IF2608');
      expect(mockElectronAPI.openKLineWindow).toHaveBeenCalledWith('IF2608');
    });
  });

  describe('App info functions', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI;
    });

    it('getAppVersion should return version string', async () => {
      const { getAppVersion } = await import('../electron');
      const version = await getAppVersion();
      expect(version).toBe('1.0.0');
      expect(mockElectronAPI.getAppVersion).toHaveBeenCalled();
    });

    it('getPlatform should return platform string', async () => {
      const { getPlatform } = await import('../electron');
      const platform = await getPlatform();
      expect(platform).toBe('win32');
      expect(mockElectronAPI.getPlatform).toHaveBeenCalled();
    });

    it('getAppName should return app name', async () => {
      const { getAppName } = await import('../electron');
      const name = await getAppName();
      expect(name).toBe('SimNow Trading Terminal');
      expect(mockElectronAPI.getAppName).toHaveBeenCalled();
    });
  });

  describe('Backend management functions', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI;
    });

    it('restartBackend should call electronAPI.restartBackend', async () => {
      const { restartBackend } = await import('../electron');
      await restartBackend();
      expect(mockElectronAPI.restartBackend).toHaveBeenCalled();
    });

    it('getBackendStatus should return backend status', async () => {
      const { getBackendStatus } = await import('../electron');
      const status = await getBackendStatus();
      expect(status).toEqual({ running: false });
      expect(mockElectronAPI.getBackendStatus).toHaveBeenCalled();
    });
  });

  describe('Event listener functions', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI;
    });

    it('onOrderUpdate should register callback and return cleanup function', async () => {
      const { onOrderUpdate } = await import('../electron');
      const callback = vi.fn();
      const cleanup = onOrderUpdate(callback);
      expect(mockElectronAPI.onOrderUpdate).toHaveBeenCalledWith(callback);
      expect(typeof cleanup).toBe('function');
    });

    it('onNotification should register callback and return cleanup function', async () => {
      const { onNotification } = await import('../electron');
      const callback = vi.fn();
      const cleanup = onNotification(callback);
      expect(mockElectronAPI.onNotification).toHaveBeenCalledWith(callback);
      expect(typeof cleanup).toBe('function');
    });

    it('removeAllListeners should call electronAPI.removeAllListeners', async () => {
      const { removeAllListeners } = await import('../electron');
      removeAllListeners('order:update');
      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWith('order:update');
    });
  });

  describe('Non-Electron environment', () => {
    it('should throw error when calling functions without electronAPI', async () => {
      const { minimizeWindow } = await import('../electron');
      await expect(minimizeWindow()).rejects.toThrow('Electron API is not available');
    });
  });
});
