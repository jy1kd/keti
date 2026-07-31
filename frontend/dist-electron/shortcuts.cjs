"use strict";
/**
 * Shortcut Manager
 *
 * Manages global keyboard shortcuts for the Electron application.
 * Supports registration, unregistration, conflict detection, and persistence.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutManager = exports.DEFAULT_SHORTCUTS = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Default shortcuts
exports.DEFAULT_SHORTCUTS = [
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
// Persistence file name
const SHORTCUTS_FILE = 'shortcuts.json';
/**
 * ShortcutManager class
 */
class ShortcutManager {
    constructor(storagePath) {
        this.shortcuts = new Map();
        this.handlers = new Map();
        this.storagePath = storagePath || path_1.default.join(electron_1.app.getPath('userData'), SHORTCUTS_FILE);
    }
    /**
     * Register a global shortcut
     */
    register(config, handler) {
        try {
            // Check if already registered
            if (this.shortcuts.has(config.accelerator)) {
                console.warn(`[ShortcutManager] Shortcut already registered: ${config.accelerator}`);
                return false;
            }
            // Register the shortcut
            const success = electron_1.globalShortcut.register(config.accelerator, handler);
            if (success) {
                this.shortcuts.set(config.accelerator, config);
                this.handlers.set(config.accelerator, handler);
                console.log(`[ShortcutManager] Registered shortcut: ${config.accelerator} (${config.description})`);
            }
            return success;
        }
        catch (error) {
            console.error(`[ShortcutManager] Failed to register shortcut: ${config.accelerator}`, error);
            return false;
        }
    }
    /**
     * Unregister a specific shortcut
     */
    unregister(accelerator) {
        if (this.shortcuts.has(accelerator)) {
            electron_1.globalShortcut.unregister(accelerator);
            this.shortcuts.delete(accelerator);
            this.handlers.delete(accelerator);
            console.log(`[ShortcutManager] Unregistered shortcut: ${accelerator}`);
        }
    }
    /**
     * Unregister all shortcuts
     */
    unregisterAll() {
        electron_1.globalShortcut.unregisterAll();
        this.shortcuts.clear();
        this.handlers.clear();
        console.log('[ShortcutManager] Unregistered all shortcuts');
    }
    /**
     * Check if a shortcut is registered
     */
    isRegistered(accelerator) {
        return this.shortcuts.has(accelerator) || electron_1.globalShortcut.isRegistered(accelerator);
    }
    /**
     * Get all registered shortcuts
     */
    getShortcuts() {
        return Array.from(this.shortcuts.values());
    }
    /**
     * Register default shortcuts
     */
    registerDefaults(handlers) {
        for (const config of exports.DEFAULT_SHORTCUTS) {
            const handler = handlers[config.action];
            if (handler) {
                this.register(config, handler);
            }
        }
    }
    /**
     * Update a shortcut's accelerator
     * Returns true if successful, false if conflict or error
     */
    updateShortcut(action, newAccelerator, handler) {
        // Find existing shortcut by action
        const existing = Array.from(this.shortcuts.values()).find(s => s.action === action);
        if (!existing) {
            console.warn(`[ShortcutManager] Action not found: ${action}`);
            return false;
        }
        // Check if new accelerator conflicts with another shortcut
        if (this.shortcuts.has(newAccelerator)) {
            const conflict = this.shortcuts.get(newAccelerator);
            if (conflict?.action !== action) {
                console.warn(`[ShortcutManager] Accelerator conflict: ${newAccelerator} is used by ${conflict?.action}`);
                return false;
            }
        }
        // Unregister old accelerator
        this.unregister(existing.accelerator);
        // Register with new accelerator
        const newConfig = {
            accelerator: newAccelerator,
            action: existing.action,
            description: existing.description,
        };
        return this.register(newConfig, handler);
    }
    /**
     * Save current shortcuts to file
     */
    save() {
        try {
            const data = Array.from(this.shortcuts.values());
            const dir = path_1.default.dirname(this.storagePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`[ShortcutManager] Saved ${data.length} shortcuts to ${this.storagePath}`);
        }
        catch (error) {
            console.error('[ShortcutManager] Failed to save shortcuts:', error);
        }
    }
    /**
     * Load shortcuts from file, falling back to defaults
     * Returns loaded configs (or defaults if file not found)
     */
    load() {
        try {
            if (fs_1.default.existsSync(this.storagePath)) {
                const raw = fs_1.default.readFileSync(this.storagePath, 'utf-8');
                const data = JSON.parse(raw);
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`[ShortcutManager] Loaded ${data.length} shortcuts from ${this.storagePath}`);
                    return data;
                }
            }
        }
        catch (error) {
            console.warn('[ShortcutManager] Failed to load shortcuts, using defaults:', error);
        }
        console.log('[ShortcutManager] Using default shortcuts');
        return [...exports.DEFAULT_SHORTCUTS];
    }
    /**
     * Load shortcuts from file and register them
     */
    loadAndRegister(handlers) {
        const configs = this.load();
        for (const config of configs) {
            const handler = handlers[config.action];
            if (handler) {
                this.register(config, handler);
            }
        }
    }
    /**
     * Reset to default shortcuts
     */
    resetToDefaults(handlers) {
        this.unregisterAll();
        this.registerDefaults(handlers);
        this.save();
        console.log('[ShortcutManager] Reset to default shortcuts');
    }
}
exports.ShortcutManager = ShortcutManager;
//# sourceMappingURL=shortcuts.js.map