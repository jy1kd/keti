import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock electron modules
vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(false),
  },
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-user-data'),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
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

  it('should have save method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.save).toBeDefined();
    expect(typeof manager.save).toBe('function');
  });

  it('should have load method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.load).toBeDefined();
    expect(typeof manager.load).toBe('function');
  });

  it('should have loadAndRegister method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.loadAndRegister).toBeDefined();
    expect(typeof manager.loadAndRegister).toBe('function');
  });

  it('should have updateShortcut method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.updateShortcut).toBeDefined();
    expect(typeof manager.updateShortcut).toBe('function');
  });

  it('should have resetToDefaults method', async () => {
    const { ShortcutManager } = await import('../shortcuts');
    const manager = new ShortcutManager();
    expect(manager.resetToDefaults).toBeDefined();
    expect(typeof manager.resetToDefaults).toBe('function');
  });

  it('should return defaults from load when file does not exist', async () => {
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { ShortcutManager, DEFAULT_SHORTCUTS } = await import('../shortcuts');
    const manager = new ShortcutManager('/tmp/test-shortcuts.json');
    const loaded = manager.load();
    expect(loaded).toEqual(DEFAULT_SHORTCUTS);
  });
});
