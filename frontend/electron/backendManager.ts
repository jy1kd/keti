/**
 * Backend Manager
 *
 * Manages the Python backend process for the Electron application.
 * Supports starting, stopping, restarting, and health checking.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Backend status
export interface BackendStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime?: number;
  error?: string;
}

// Backend configuration
export interface BackendConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  port?: number;
}

// Default backend configuration
const DEFAULT_CONFIG: BackendConfig = {
  command: 'python',
  args: ['start.py'],
  cwd: path.join(__dirname, '../../server'),
  port: 8000,
};

/**
 * BackendManager class
 */
export class BackendManager {
  private process: ChildProcess | null = null;
  private config: BackendConfig;
  private startTime: number = 0;
  private logs: string[] = [];
  private maxLogs: number = 1000;

  constructor(config?: Partial<BackendConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the backend process
   */
  async start(): Promise<boolean> {
    if (this.isRunning()) {
      console.warn('[BackendManager] Backend is already running');
      return true;
    }

    try {
      console.log(`[BackendManager] Starting backend: ${this.config.command} ${this.config.args.join(' ')}`);

      // Check if command exists
      if (!this.config.command) {
        throw new Error('Backend command not specified');
      }

      // Spawn the process
      this.process = spawn(this.config.command, this.config.args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.startTime = Date.now();

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.addLog(`[stdout] ${message}`);
          console.log(`[Backend] ${message}`);
        }
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          this.addLog(`[stderr] ${message}`);
          console.error(`[Backend] ${message}`);
        }
      });

      // Handle process exit
      this.process.on('exit', (code: number | null, signal: string | null) => {
        console.log(`[BackendManager] Backend exited with code ${code}, signal ${signal}`);
        this.process = null;
        this.startTime = 0;
      });

      // Handle process error
      this.process.on('error', (error: Error) => {
        console.error(`[BackendManager] Backend process error:`, error);
        this.addLog(`[error] ${error.message}`);
        this.process = null;
        this.startTime = 0;
      });

      console.log(`[BackendManager] Backend started with PID ${this.process.pid}`);
      return true;
    } catch (error) {
      console.error('[BackendManager] Failed to start backend:', error);
      this.addLog(`[error] Failed to start: ${error}`);
      return false;
    }
  }

  /**
   * Stop the backend process
   */
  stop(): void {
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
  async restart(): Promise<boolean> {
    console.log('[BackendManager] Restarting backend');
    this.stop();

    // Wait for process to exit
    await new Promise<void>((resolve) => {
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
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get backend status
   */
  getStatus(): BackendStatus {
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
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear backend logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Add a log entry
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    this.logs.push(`[${timestamp}] ${message}`);

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
}
