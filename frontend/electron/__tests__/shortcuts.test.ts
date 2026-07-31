import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron modules
vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(false),
  },
}));

describe('ShortcutManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export ShortcutManager class', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    expect(ShortcutManager).toBeDefined();
    expect(typeof ShortcutManager).toBe('function');
  });

  it('should create instance with register method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.register).toBeDefined();
    expect(typeof manager.register).toBe('function');
  });

  it('should create instance with unregister method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.unregister).toBeDefined();
    expect(typeof manager.unregister).toBe('function');
  });

  it('should create instance with unregisterAll method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.unregisterAll).toBeDefined();
    expect(typeof manager.unregisterAll).toBe('function');
  });

  it('should create instance with isRegistered method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.isRegistered).toBeDefined();
    expect(typeof manager.isRegistered).toBe('function');
  });

  it('should create instance with getShortcuts method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.getShortcuts).toBeDefined();
    expect(typeof manager.getShortcuts).toBe('function');
  });

  it('should return empty array for getShortcuts before registration', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    const shortcuts = manager.getShortcuts();
    expect(shortcuts).toEqual([]);
  });

  it('should return false for isRegistered before registration', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    const registered = manager.isRegistered('CommandOrControl+B');
    expect(registered).toBe(false);
  });
});
