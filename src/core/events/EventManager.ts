/**
 * 事件管理器 - 统一的事件处理中心
 * 负责事件的注册、分发、处理和清理
 */

import { EventDispatcher } from './EventDispatcher';
import { WebSocketHandler } from './WebSocketHandler';
import { DocumentEventHandler } from './DocumentEventHandler';

export interface IEventManagerConfig {
    /** 是否启用WebSocket监听 */
    enableWebSocket?: boolean;
    /** 是否启用文档事件监听 */
    enableDocumentEvents?: boolean;
    /** 事件处理延迟（毫秒） */
    eventDelay?: number;
    /** 是否启用事件去重 */
    enableDeduplication?: boolean;
}

export class EventManager {
    private dispatcher: EventDispatcher;
    private webSocketHandler: WebSocketHandler;
    private documentEventHandler: DocumentEventHandler;
    private isInitialized = false;
    private config: Required<IEventManagerConfig>;

    constructor(config: IEventManagerConfig = {}) {
        this.config = {
            enableWebSocket: true,
            enableDocumentEvents: true,
            eventDelay: 100,
            enableDeduplication: true,
            ...config
        };

        this.dispatcher = new EventDispatcher({
            enableDeduplication: this.config.enableDeduplication,
            eventDelay: this.config.eventDelay
        });

        this.webSocketHandler = new WebSocketHandler(this.dispatcher);
        this.documentEventHandler = new DocumentEventHandler(this.dispatcher);
    }

    /**
     * 初始化事件管理器
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('EventManager: 已经初始化，跳过重复初始化');
            return;
        }

        try {
            // 初始化事件分发器
            await this.dispatcher.init();

            // 初始化WebSocket处理器
            if (this.config.enableWebSocket) {
                await this.webSocketHandler.init();
            }

            // 初始化文档事件处理器
            if (this.config.enableDocumentEvents) {
                await this.documentEventHandler.init();
            }

            this.isInitialized = true;
            console.log('EventManager: 初始化完成');

        } catch (error) {
            console.error('EventManager: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 注册事件监听器
     * @param eventType 事件类型
     * @param handler 处理函数
     * @param options 选项
     * @returns 取消注册函数
     */
    on(
        eventType: string,
        handler: (...args: any[]) => void | Promise<void>,
        options?: {
            once?: boolean;
            priority?: number;
            filter?: (...args: any[]) => boolean;
        }
    ): () => void {
        return this.dispatcher.on(eventType, handler, options);
    }

    /**
     * 注册一次性事件监听器
     * @param eventType 事件类型
     * @param handler 处理函数
     * @returns Promise
     */
    once(eventType: string, handler: (...args: any[]) => void | Promise<void>): Promise<void> {
        return new Promise((resolve) => {
            const unsubscribe = this.on(eventType, async (...args) => {
                try {
                    await handler(...args);
                } finally {
                    unsubscribe();
                    resolve();
                }
            }, { once: true });
        });
    }

    /**
     * 发送事件
     * @param eventType 事件类型
     * @param args 事件参数
     */
    async emit(eventType: string, ...args: any[]): Promise<void> {
        await this.dispatcher.emit(eventType, ...args);
    }

    /**
     * 移除事件监听器
     * @param eventType 事件类型
     * @param handler 处理函数
     */
    off(eventType: string, handler?: (...args: any[]) => void | Promise<void>): void {
        this.dispatcher.off(eventType, handler);
    }

    /**
     * 获取事件统计信息
     * @returns 统计信息
     */
    getStats(): {
        dispatcher: any;
        webSocket: any;
        documentEvents: any;
        isInitialized: boolean;
    } {
        return {
            dispatcher: this.dispatcher.getStats(),
            webSocket: this.webSocketHandler.getStats(),
            documentEvents: this.documentEventHandler.getStats(),
            isInitialized: this.isInitialized
        };
    }

    /**
     * 暂停事件处理
     */
    pause(): void {
        this.dispatcher.pause();
        this.webSocketHandler.pause();
        this.documentEventHandler.pause();
        console.log('EventManager: 暂停事件处理');
    }

    /**
     * 恢复事件处理
     */
    resume(): void {
        this.dispatcher.resume();
        this.webSocketHandler.resume();
        this.documentEventHandler.resume();
        console.log('EventManager: 恢复事件处理');
    }

    /**
     * 清空事件队列
     */
    clearQueue(): void {
        this.dispatcher.clearQueue();
        console.log('EventManager: 清空事件队列');
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<IEventManagerConfig>): void {
        this.config = { ...this.config, ...config };
        
        // 更新子组件配置
        this.dispatcher.updateConfig({
            enableDeduplication: this.config.enableDeduplication,
            eventDelay: this.config.eventDelay
        });

        console.log('EventManager: 配置已更新');
    }

    /**
     * 检查是否已初始化
     * @returns 是否已初始化
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * 获取支持的事件类型
     * @returns 事件类型数组
     */
    getSupportedEvents(): string[] {
        return [
            // 文档事件
            'document:switch',
            'document:loaded',
            'document:edited',
            'document:closed',
            
            // 图表事件
            'figure:added',
            'figure:removed',
            'figure:updated',
            'figure:reordered',
            
            // 样式事件
            'style:applied',
            'style:removed',
            'style:updated',
            
            // 状态事件
            'state:changed',
            'state:loading',
            'state:error',
            'state:cleared',
            
            // WebSocket事件
            'websocket:transaction',
            'websocket:connected',
            'websocket:disconnected',
            
            // 系统事件
            'system:ready',
            'system:error',
            'system:cleanup'
        ];
    }

    /**
     * 销毁事件管理器
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            // 销毁子组件
            await this.documentEventHandler.destroy();
            await this.webSocketHandler.destroy();
            await this.dispatcher.destroy();

            this.isInitialized = false;
            console.log('EventManager: 销毁完成');

        } catch (error) {
            console.error('EventManager: 销毁失败:', error);
            throw error;
        }
    }
}
