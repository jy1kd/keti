export interface ElectronAPI {
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    openOrderWindow: (instrumentID?: string) => Promise<void>;
    openKLineWindow: (instrumentID: string) => Promise<void>;
    getAppVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getAppName: () => Promise<string>;
    restartBackend: () => Promise<void>;
    getBackendStatus: () => Promise<{
        running: boolean;
        pid?: number;
    }>;
    onOrderUpdate: (callback: (data: any) => void) => () => void;
    onNotification: (callback: (data: any) => void) => () => void;
    removeAllListeners: (channel: string) => void;
}
//# sourceMappingURL=preload.d.ts.map