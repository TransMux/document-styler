/**
 * 事件分发器 - 核心事件分发机制
 * 负责事件的注册、分发、去重和队列管理
 */

export interface IEventHandler {
    id: string;
    handler: (...args: any[]) => void | Promise<void>;
    once?: boolean;
    priority?: number;
    filter?: (...args: any[]) => boolean;
}

export interface IEventDispatcherConfig {
    /** 是否启用事件去重 */
    enableDeduplication?: boolean;
    /** 事件处理延迟（毫秒） */
    eventDelay?: number;
    /** 最大队列长度 */
    maxQueueLength?: number;
}

export class EventDispatcher {
    private handlers = new Map<string, IEventHandler[]>();
    private eventQueue: Array<{
        type: string;
        args: any[];
        timestamp: number;
        id: string;
    }> = [];
    private isProcessing = false;
    private isPaused = false;
    private handlerCounter = 0;
    private config: Required<IEventDispatcherConfig>;
    private processTimer: NodeJS.Timeout | null = null;

    constructor(config: IEventDispatcherConfig = {}) {
        this.config = {
            enableDeduplication: true,
            eventDelay: 100,
            maxQueueLength: 1000,
            ...config
        };
    }

    /**
     * 初始化事件分发器
     */
    async init(): Promise<void> {
        console.log('EventDispatcher: 初始化完成');
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
        const handlerId = this.generateHandlerId();
        const eventHandler: IEventHandler = {
            id: handlerId,
            handler,
            once: options?.once || false,
            priority: options?.priority || 0,
            filter: options?.filter
        };

        // 获取或创建事件处理器数组
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }

        const handlers = this.handlers.get(eventType)!;
        handlers.push(eventHandler);

        // 按优先级排序
        handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        console.log(`EventDispatcher: 注册事件监听器 ${eventType}:${handlerId}`);

        // 返回取消注册函数
        return () => {
            this.removeHandler(eventType, handlerId);
        };
    }

    /**
     * 移除事件监听器
     * @param eventType 事件类型
     * @param handler 处理函数或处理器ID
     */
    off(eventType: string, handler?: (...args: any[]) => void | Promise<void> | string): void {
        const handlers = this.handlers.get(eventType);
        if (!handlers) {
            return;
        }

        if (!handler) {
            // 移除所有处理器
            this.handlers.delete(eventType);
            console.log(`EventDispatcher: 移除所有 ${eventType} 事件监听器`);
        } else if (typeof handler === 'string') {
            // 按ID移除
            this.removeHandler(eventType, handler);
        } else {
            // 按函数引用移除
            const index = handlers.findIndex(h => h.handler === handler);
            if (index !== -1) {
                const removed = handlers.splice(index, 1)[0];
                console.log(`EventDispatcher: 移除事件监听器 ${eventType}:${removed.id}`);
            }
        }
    }

    /**
     * 发送事件
     * @param eventType 事件类型
     * @param args 事件参数
     */
    async emit(eventType: string, ...args: any[]): Promise<void> {
        if (this.isPaused) {
            return;
        }

        const eventId = this.generateEventId(eventType, args);

        // 检查队列长度限制
        if (this.eventQueue.length >= this.config.maxQueueLength) {
            console.warn(`EventDispatcher: 事件队列已满，丢弃事件 ${eventType}`);
            return;
        }

        // 添加到队列
        this.eventQueue.push({
            type: eventType,
            args: [...args], // 创建副本
            timestamp: Date.now(),
            id: eventId
        });

        // 启动处理
        this.scheduleProcessing();
    }

    /**
     * 暂停事件处理
     */
    pause(): void {
        this.isPaused = true;
        if (this.processTimer) {
            clearTimeout(this.processTimer);
            this.processTimer = null;
        }
    }

    /**
     * 恢复事件处理
     */
    resume(): void {
        this.isPaused = false;
        this.scheduleProcessing();
    }

    /**
     * 清空事件队列
     */
    clearQueue(): void {
        this.eventQueue.length = 0;
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        totalHandlers: number;
        queuedEvents: number;
        isProcessing: boolean;
        isPaused: boolean;
        handlersByType: Record<string, number>;
    } {
        const handlersByType: Record<string, number> = {};
        for (const [type, handlers] of this.handlers.entries()) {
            handlersByType[type] = handlers.length;
        }

        return {
            totalHandlers: Array.from(this.handlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
            queuedEvents: this.eventQueue.length,
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            handlersByType
        };
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<IEventDispatcherConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 调度事件处理
     */
    private scheduleProcessing(): void {
        if (this.isPaused || this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        if (this.processTimer) {
            clearTimeout(this.processTimer);
        }

        this.processTimer = setTimeout(() => {
            this.processEventQueue();
        }, this.config.eventDelay);
    }

    /**
     * 处理事件队列
     */
    private async processEventQueue(): Promise<void> {
        if (this.isPaused || this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        this.processTimer = null;

        try {
            // 去重处理
            const events = this.config.enableDeduplication 
                ? this.deduplicateEvents(this.eventQueue)
                : [...this.eventQueue];

            // 清空队列
            this.eventQueue.length = 0;

            // 处理事件
            for (const event of events) {
                await this.processEvent(event.type, event.args);
            }

        } catch (error) {
            console.error('EventDispatcher: 处理事件队列失败:', error);
        } finally {
            this.isProcessing = false;
            
            // 如果队列中还有事件，继续处理
            if (this.eventQueue.length > 0) {
                this.scheduleProcessing();
            }
        }
    }

    /**
     * 处理单个事件
     * @param eventType 事件类型
     * @param args 事件参数
     */
    private async processEvent(eventType: string, args: any[]): Promise<void> {
        const handlers = this.handlers.get(eventType);
        if (!handlers || handlers.length === 0) {
            return;
        }

        const promises: Promise<void>[] = [];
        const handlersToRemove: string[] = [];

        for (const handler of handlers) {
            // 应用过滤器
            if (handler.filter && !handler.filter(...args)) {
                continue;
            }

            // 异步调用处理器
            promises.push(this.safeCallHandler(handler, args));

            // 标记一次性处理器
            if (handler.once) {
                handlersToRemove.push(handler.id);
            }
        }

        // 等待所有处理器完成
        await Promise.allSettled(promises);

        // 移除一次性处理器
        for (const handlerId of handlersToRemove) {
            this.removeHandler(eventType, handlerId);
        }
    }

    /**
     * 安全调用处理器
     * @param handler 处理器
     * @param args 参数
     */
    private async safeCallHandler(handler: IEventHandler, args: any[]): Promise<void> {
        try {
            await handler.handler(...args);
        } catch (error) {
            console.error(`EventDispatcher: 处理器 ${handler.id} 执行失败:`, error);
        }
    }

    /**
     * 去重事件
     * @param events 事件数组
     * @returns 去重后的事件数组
     */
    private deduplicateEvents(events: Array<{
        type: string;
        args: any[];
        timestamp: number;
        id: string;
    }>): Array<{
        type: string;
        args: any[];
        timestamp: number;
        id: string;
    }> {
        const seen = new Set<string>();
        const deduplicated: typeof events = [];

        // 从最新的事件开始处理
        for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i];
            if (!seen.has(event.id)) {
                seen.add(event.id);
                deduplicated.unshift(event); // 保持原始顺序
            }
        }

        return deduplicated;
    }

    /**
     * 生成事件ID
     * @param eventType 事件类型
     * @param args 事件参数
     * @returns 事件ID
     */
    private generateEventId(eventType: string, args: any[]): string {
        // 简单的去重策略：基于事件类型和主要参数
        const key = JSON.stringify({ type: eventType, args: args.slice(0, 2) });
        return `${eventType}-${this.hashCode(key)}`;
    }

    /**
     * 计算字符串哈希码
     * @param str 字符串
     * @returns 哈希码
     */
    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    /**
     * 生成处理器ID
     * @returns 处理器ID
     */
    private generateHandlerId(): string {
        return `handler-${++this.handlerCounter}-${Date.now()}`;
    }

    /**
     * 移除处理器
     * @param eventType 事件类型
     * @param handlerId 处理器ID
     */
    private removeHandler(eventType: string, handlerId: string): void {
        const handlers = this.handlers.get(eventType);
        if (!handlers) {
            return;
        }

        const index = handlers.findIndex(h => h.id === handlerId);
        if (index !== -1) {
            handlers.splice(index, 1);
            console.log(`EventDispatcher: 移除事件监听器 ${eventType}:${handlerId}`);

            // 如果没有处理器了，删除整个条目
            if (handlers.length === 0) {
                this.handlers.delete(eventType);
            }
        }
    }

    /**
     * 销毁事件分发器
     */
    async destroy(): Promise<void> {
        this.pause();
        this.clearQueue();
        this.handlers.clear();
        this.handlerCounter = 0;
        console.log('EventDispatcher: 销毁完成');
    }
}
