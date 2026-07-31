/**
 * Backend Manager
 *
 * Manages the Python backend process for the Electron application.
 * Supports starting, stopping, restarting, and health checking.
 */
export interface BackendStatus {
    running: boolean;
    pid?: number;
    port?: number;
    uptime?: number;
    error?: string;
}
export interface BackendConfig {
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    port?: number;
}
/**
 * BackendManager class
 */
export declare class BackendManager {
    private process;
    private config;
    private startTime;
    private logs;
    private maxLogs;
    constructor(config?: Partial<BackendConfig>);
    /**
     * Check if backend is already running on the configured port
     */
    private isBackendAlreadyRunning;
    /**
     * Start the backend process
     */
    start(): Promise<boolean>;
    /**
     * Stop the backend process
     */
    stop(): void;
    /**
     * Restart the backend process
     */
    restart(): Promise<boolean>;
    /**
     * Check if the backend is running
     */
    isRunning(): boolean;
    /**
     * Get backend status
     */
    getStatus(): BackendStatus;
    /**
     * Get backend logs
     */
    getLogs(): string[];
    /**
     * Clear backend logs
     */
    clearLogs(): void;
    /**
     * Add a log entry
     */
    private addLog;
}
//# sourceMappingURL=backendManager.d.ts.map