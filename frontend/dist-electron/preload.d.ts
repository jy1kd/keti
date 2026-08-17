export interface ElectronAPI {
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    openOrderWindow: (instrumentID?: string) => Promise<void>;
    openKLineWindow: (instrumentID: string) => Promise<void>;
    openTabWindow: (tabType: string, tabId: string, tabTitle: string, props?: Record<string, unknown>) => Promise<void>;
    getAppVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getAppName: () => Promise<string>;
    restartBackend: () => Promise<void>;
    getBackendStatus: () => Promise<{
        running: boolean;
        pid?: number;
    }>;
    onNavigateTab: (callback: (tab: string) => void) => () => void;
    onOpenFloatingTab: (callback: (tab: 'order' | 'kline' | 'infinite' | 'settings' | 'ipc-monitor' | 'tquote' | 'query-orders' | 'query-positions' | 'query-account' | 'collections') => void) => () => void;
    onMarketView: (callback: (view: 'all' | 'options') => void) => () => void;
    onGetSelectedInstrument: (callback: () => string) => () => void;
    sendSelectedInstrument: (instrumentID: string) => void;
    onOrderUpdate: (callback: (data: any) => void) => () => void;
    onNotification: (callback: (data: any) => void) => () => void;
    removeAllListeners: (channel: string) => void;
}
//# sourceMappingURL=preload.d.ts.map