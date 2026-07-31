/**
 * Shortcut Manager
 *
 * Manages global keyboard shortcuts for the Electron application.
 * Supports registration, unregistration, and conflict detection.
 */

import { globalShortcut } from 'electron';

// Shortcut configuration
export interface ShortcutConfig {
  accelerator: string;
  action: string;
  description: string;
}

// Default shortcuts
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  {
    accelerator: 'CommandOrControl+B',
    action: 'open-order',
    description: '快速报单',
  },
  {
    accelerator: 'CommandOrControl+K',
    action: 'open-kline',
    description: '打开K线图',
  },
  {
    accelerator: 'CommandOrControl+Q',
    action: 'quit',
    description: '退出应用',
  },
];

/**
 * ShortcutManager class
 */
export class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private handlers: Map<string, () => void> = new Map();

  /**
   * Register a global shortcut
   */
  register(config: ShortcutConfig, handler: () => void): boolean {
    try {
      // Check if already registered
      if (this.shortcuts.has(config.accelerator)) {
        console.warn(`[ShortcutManager] Shortcut already registered: ${config.accelerator}`);
        return false;
      }

      // Register the shortcut
      const success = globalShortcut.register(config.accelerator, handler);
      if (success) {
        this.shortcuts.set(config.accelerator, config);
        this.handlers.set(config.accelerator, handler);
        console.log(`[ShortcutManager] Registered shortcut: ${config.accelerator} (${config.description})`);
      }
      return success;
    } catch (error) {
      console.error(`[ShortcutManager] Failed to register shortcut: ${config.accelerator}`, error);
      return false;
    }
  }

  /**
   * Unregister a specific shortcut
   */
  unregister(accelerator: string): void {
    if (this.shortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.shortcuts.delete(accelerator);
      this.handlers.delete(accelerator);
      console.log(`[ShortcutManager] Unregistered shortcut: ${accelerator}`);
    }
  }

  /**
   * Unregister all shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
    this.handlers.clear();
    console.log('[ShortcutManager] Unregistered all shortcuts');
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(accelerator: string): boolean {
    return this.shortcuts.has(accelerator) || globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Register default shortcuts
   */
  registerDefaults(handlers: Record<string, () => void>): void {
    for (const config of DEFAULT_SHORTCUTS) {
      const handler = handlers[config.action];
      if (handler) {
        this.register(config, handler);
      }
    }
  }
}
