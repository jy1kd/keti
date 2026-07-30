import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS, IPCResponse } from '../index';

describe('IPC Channel Definitions', () => {
  it('should define window control channels', () => {
    expect(IPC_CHANNELS.WINDOW_MINIMIZE).toBe('window:minimize');
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE).toBe('window:maximize');
    expect(IPC_CHANNELS.WINDOW_CLOSE).toBe('window:close');
  });

  it('should define window management channels', () => {
    expect(IPC_CHANNELS.WINDOW_OPEN_ORDER).toBe('window:open-order');
    expect(IPC_CHANNELS.WINDOW_OPEN_KLINE).toBe('window:open-kline');
  });

  it('should define app info channels', () => {
    expect(IPC_CHANNELS.APP_VERSION).toBe('app:version');
    expect(IPC_CHANNELS.APP_PLATFORM).toBe('app:platform');
    expect(IPC_CHANNELS.APP_NAME).toBe('app:name');
  });

  it('should define backend management channels', () => {
    expect(IPC_CHANNELS.BACKEND_RESTART).toBe('backend:restart');
    expect(IPC_CHANNELS.BACKEND_STATUS).toBe('backend:status');
  });

  it('should define event channels', () => {
    expect(IPC_CHANNELS.EVENT_ORDER_UPDATE).toBe('order:update');
    expect(IPC_CHANNELS.EVENT_NOTIFICATION).toBe('notification');
  });
});

describe('IPCResponse type', () => {
  it('should accept success response', () => {
    const response: IPCResponse<string> = {
      success: true,
      data: 'test',
    };
    expect(response.success).toBe(true);
    expect(response.data).toBe('test');
  });

  it('should accept error response', () => {
    const response: IPCResponse<null> = {
      success: false,
      error: 'Something went wrong',
    };
    expect(response.success).toBe(false);
    expect(response.error).toBe('Something went wrong');
  });
});
