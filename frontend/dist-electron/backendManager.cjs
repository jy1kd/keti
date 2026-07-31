"use strict";
/**
 * Backend Manager
 *
 * Manages the Python backend process for the Electron application.
 * Supports starting, stopping, restarting, and health checking.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendManager = void 0;
const child_process_1 = require("child_process");
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
// Default backend configuration
const DEFAULT_CONFIG = {
    command: 'python',
    args: ['start.py'],
    cwd: path_1.default.join(__dirname, '../../server'),
    port: 8000,
};
/**
 * BackendManager class
 */
class BackendManager {
    constructor(config) {
        this.process = null;
        this.startTime = 0;
        this.logs = [];
        this.maxLogs = 1000;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Check if backend is already running on the configured port
     */
    async isBackendAlreadyRunning() {
        return new Promise((resolve) => {
            const req = http_1.default.get(`http://localhost:${this.config.port}/api/connection/status`, (res) => {
                resolve(res.statusCode === 200);
                res.resume(); // Consume response
            });
            req.on('error', () => resolve(false));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
    /**
     * Start the backend process
     */
    async start() {
        if (this.isRunning()) {
            console.warn('[BackendManager] Backend is already running');
            return true;
        }
        // Check if backend is already running on the port
        if (await this.isBackendAlreadyRunning()) {
            console.log(`[BackendManager] Backend already running on port ${this.config.port}`);
            return true;
        }
        try {
            console.log(`[BackendManager] Starting backend: ${this.config.command} ${this.config.args.join(' ')}`);
            // Check if command exists
            if (!this.config.command) {
                throw new Error('Backend command not specified');
            }
            // Spawn the process
            this.process = (0, child_process_1.spawn)(this.config.command, this.config.args, {
                cwd: this.config.cwd,
                env: { ...process.env, ...this.config.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            this.startTime = Date.now();
            // Handle stdout
            this.process.stdout?.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    this.addLog(`[stdout] ${message}`);
                    console.log(`[Backend] ${message}`);
                }
            });
            // Handle stderr
            this.process.stderr?.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    this.addLog(`[stderr] ${message}`);
                    console.error(`[Backend] ${message}`);
                }
            });
            // Handle process exit
            this.process.on('exit', (code, signal) => {
                console.log(`[BackendManager] Backend exited with code ${code}, signal ${signal}`);
                this.process = null;
                this.startTime = 0;
            });
            // Handle process error
            this.process.on('error', (error) => {
                console.error(`[BackendManager] Backend process error:`, error);
                this.addLog(`[error] ${error.message}`);
                this.process = null;
                this.startTime = 0;
            });
            console.log(`[BackendManager] Backend started with PID ${this.process.pid}`);
            return true;
        }
        catch (error) {
            console.error('[BackendManager] Failed to start backend:', error);
            this.addLog(`[error] Failed to start: ${error}`);
            return false;
        }
    }
    /**
     * Stop the backend process
     */
    stop() {
        if (!this.isRunning()) {
            console.warn('[BackendManager] Backend is not running');
            return;
        }
        console.log(`[BackendManager] Stopping backend (PID ${this.process?.pid})`);
        if (this.process) {
            this.process.kill('SIGTERM');
            // Force kill after timeout
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    console.warn('[BackendManager] Force killing backend');
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        }
    }
    /**
     * Restart the backend process
     */
    async restart() {
        console.log('[BackendManager] Restarting backend');
        this.stop();
        // Wait for process to exit
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.isRunning()) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
        return this.start();
    }
    /**
     * Check if the backend is running
     */
    isRunning() {
        return this.process !== null && !this.process.killed;
    }
    /**
     * Get backend status
     */
    getStatus() {
        if (!this.isRunning()) {
            return { running: false };
        }
        return {
            running: true,
            pid: this.process?.pid,
            port: this.config.port,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
        };
    }
    /**
     * Get backend logs
     */
    getLogs() {
        return [...this.logs];
    }
    /**
     * Clear backend logs
     */
    clearLogs() {
        this.logs = [];
    }
    /**
     * Add a log entry
     */
    addLog(message) {
        const timestamp = new Date().toISOString();
        this.logs.push(`[${timestamp}] ${message}`);
        // Trim logs if too many
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }
}
exports.BackendManager = BackendManager;
//# sourceMappingURL=backendManager.js.map