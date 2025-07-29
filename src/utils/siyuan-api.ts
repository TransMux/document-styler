/**
 * 思源API扩展实现
 * 为siyuan包中不存在的API提供实现
 */

// 扩展全局类型定义
declare global {
    interface Window {
        siyuan: {
            config: any;
            ws?: {
                ws?: WebSocket;
            };
        };
    }
}

/**
 * Custom类型定义（siyuan包中缺失）
 */
export interface Custom {
    element: HTMLElement;
    data: any;
    type: string;
    tab?: any;
    model?: any;
}

/**
 * 扩展的ISiyuan接口，包含WebSocket支持
 */
export interface ExtendedISiyuan {
    config: any;
    ws?: {
        ws?: WebSocket;
    };
}

/**
 * 获取WebSocket连接
 */
export function getWebSocket(): WebSocket | null {
    try {
        return (window.siyuan as any)?.ws?.ws || null;
    } catch (error) {
        console.warn('无法获取WebSocket连接:', error);
        return null;
    }
}

/**
 * 设置WebSocket消息处理器
 */
export function setupWebSocketHandler(handler: (event: MessageEvent) => void): void {
    const ws = getWebSocket();
    if (ws) {
        const originalOnMessage = ws.onmessage;
        ws.onmessage = (event) => {
            // 先调用原始处理器
            if (originalOnMessage) {
                originalOnMessage.call(ws, event);
            }
            // 调用自定义处理器
            handler(event);
        };
    }
}

/**
 * 检查是否有WebSocket连接
 */
export function hasWebSocket(): boolean {
    return getWebSocket() !== null;
}
