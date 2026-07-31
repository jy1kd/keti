/**
 * App IPC Handlers
 *
 * Handles all app-related IPC communications:
 * - App info (version, platform, name)
 * - Backend management (restart, status)
 */
import { BackendManager } from '../backendManager';
/**
 * Register app info IPC handlers
 */
export declare function registerAppInfoHandlers(): void;
/**
 * Register backend management IPC handlers
 */
export declare function registerBackendManagementHandlers(backendManager: BackendManager): void;
/**
 * Unregister all app IPC handlers
 */
export declare function unregisterAppHandlers(): void;
//# sourceMappingURL=app.d.ts.map