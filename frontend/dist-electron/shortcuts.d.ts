/**
 * Shortcut Manager
 *
 * Manages global keyboard shortcuts for the Electron application.
 * Supports registration, unregistration, conflict detection, and persistence.
 */
export interface ShortcutConfig {
    accelerator: string;
    action: string;
    description: string;
}
export declare const DEFAULT_SHORTCUTS: ShortcutConfig[];
/**
 * ShortcutManager class
 */
export declare class ShortcutManager {
    private shortcuts;
    private handlers;
    private storagePath;
    constructor(storagePath?: string);
    /**
     * Register a global shortcut
     */
    register(config: ShortcutConfig, handler: () => void): boolean;
    /**
     * Unregister a specific shortcut
     */
    unregister(accelerator: string): void;
    /**
     * Unregister all shortcuts
     */
    unregisterAll(): void;
    /**
     * Check if a shortcut is registered
     */
    isRegistered(accelerator: string): boolean;
    /**
     * Get all registered shortcuts
     */
    getShortcuts(): ShortcutConfig[];
    /**
     * Register default shortcuts
     */
    registerDefaults(handlers: Record<string, () => void>): void;
    /**
     * Update a shortcut's accelerator
     * Returns true if successful, false if conflict or error
     */
    updateShortcut(action: string, newAccelerator: string, handler: () => void): boolean;
    /**
     * Save current shortcuts to file
     */
    save(): void;
    /**
     * Load shortcuts from file, falling back to defaults
     * Returns loaded configs (or defaults if file not found)
     */
    load(): ShortcutConfig[];
    /**
     * Load shortcuts from file and register them
     */
    loadAndRegister(handlers: Record<string, () => void>): void;
    /**
     * Reset to default shortcuts
     */
    resetToDefaults(handlers: Record<string, () => void>): void;
}
//# sourceMappingURL=shortcuts.d.ts.map