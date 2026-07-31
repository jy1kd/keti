import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    }),
  };
});

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/path'),
  },
}));

// Mock path module
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    join: vi.fn().mockReturnValue('/mock/path'),
  };
});

describe('BackendManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export BackendManager class', async () => {
    const { BackendManager } = await import('../backendManager');
    expect(BackendManager).toBeDefined();
    expect(typeof BackendManager).toBe('function');
  });

  it('should create instance with start method', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.start).toBeDefined();
    expect(typeof manager.start).toBe('function');
  });

  it('should create instance with stop method', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.stop).toBeDefined();
    expect(typeof manager.stop).toBe('function');
  });

  it('should create instance with restart method', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.restart).toBeDefined();
    expect(typeof manager.restart).toBe('function');
  });

  it('should create instance with getStatus method', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.getStatus).toBeDefined();
    expect(typeof manager.getStatus).toBe('function');
  });

  it('should create instance with isRunning method', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.isRunning).toBeDefined();
    expect(typeof manager.isRunning).toBe('function');
  });

  it('should return not running status before start', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    const status = manager.getStatus();
    expect(status.running).toBe(false);
    expect(status.pid).toBeUndefined();
  });

  it('should return false for isRunning before start', async () => {
    const { BackendManager } = await import('../backendManager');
    const manager = new BackendManager();
    expect(manager.isRunning()).toBe(false);
  });
});
