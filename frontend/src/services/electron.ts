/**
 * Electron Service
 *
 * Provides a clean API for the renderer process to interact with Electron.
 * This service wraps the electronAPI exposed by the preload script.
 */

import type {
  ElectronAPI,
  BackendStatus,
  OrderUpdateEvent,
  NotificationEvent,
} from '../../electron/ipc/index';

// Check if running in Electron (dynamic check for testability)
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Get the Electron API (only available in Electron environment)
 */
function getElectronAPI(): ElectronAPI {
  if (!isElectron()) {
    throw new Error('Electron API is not available. This function can only be used in Electron environment.');
  }
  return window.electronAPI!;
}

// Window control
export async function minimizeWindow(): Promise<void> {
  return getElectronAPI().minimizeWindow();
}

export async function maximizeWindow(): Promise<void> {
  return getElectronAPI().maximizeWindow();
}

export async function closeWindow(): Promise<void> {
  return getElectronAPI().closeWindow();
}

// Window management
export async function openOrderWindow(instrumentID?: string): Promise<void> {
  return getElectronAPI().openOrderWindow(instrumentID);
}

export async function openKLineWindow(instrumentID: string): Promise<void> {
  return getElectronAPI().openKLineWindow(instrumentID);
}

// App info
export async function getAppVersion(): Promise<string> {
  return getElectronAPI().getAppVersion();
}

export async function getPlatform(): Promise<string> {
  return getElectronAPI().getPlatform();
}

export async function getAppName(): Promise<string> {
  return getElectronAPI().getAppName();
}

// Backend management
export async function restartBackend(): Promise<void> {
  return getElectronAPI().restartBackend();
}

export async function getBackendStatus(): Promise<BackendStatus> {
  return getElectronAPI().getBackendStatus();
}

// Event listeners
export function onOrderUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
  return getElectronAPI().onOrderUpdate(callback);
}

export function onNotification(callback: (data: NotificationEvent) => void): () => void {
  return getElectronAPI().onNotification(callback);
}

export function removeAllListeners(channel: string): void {
  return getElectronAPI().removeAllListeners(channel);
}

// Type-safe window.electronAPI declaration
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
