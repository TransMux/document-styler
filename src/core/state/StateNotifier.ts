/**
 * 状态通知器
 * 负责状态变更的通知和事件分发
 */

import { IFigureState } from './FigureState';

export type StateChangeCallback = (docId: string, state: IFigureState, source: string) => void;
export type StateChangeListener = {
    id: string;
    callback: StateChangeCallback;
    filter?: (docId: string, state: IFigureState, source: string) => boolean;
};

export class StateNotifier {
    private listeners = new Map<string, StateChangeListener>();
    private listenerCounter = 0;
    private eventQueue: Array<{
        type: 'changed' | 'cleared';
        docId: string;
        state?: IFigureState;
        source?: string;
        timestamp: number;
    }> = [];
    private isProcessing = false;

    /**
     * 订阅状态变化
     * @param callback 回调函数
     * @param filter 过滤函数
     * @returns 取消订阅函数
     */
    subscribe(
        callback: StateChangeCallback,
        filter?: (docId: string, state: IFigureState, source: string) => boolean
    ): () => void {
        const id = this.generateListenerId();
        const listener: StateChangeListener = {
            id,
            callback,
            filter
        };

        this.listeners.set(id, listener);
        console.log(`StateNotifier: 添加监听器 ${id}`);

        // 返回取消订阅函数
        return () => {
            this.unsubscribe(id);
        };
    }

    /**
     * 取消订阅
     * @param listenerId 监听器ID
     */
    unsubscribe(listenerId: string): void {
        if (this.listeners.delete(listenerId)) {
            console.log(`StateNotifier: 移除监听器 ${listenerId}`);
        }
    }

    /**
     * 通知状态变化
     * @param docId 文档ID
     * @param state 新状态
     * @param source 变化来源
     */
    async notifyStateChanged(docId: string, state: IFigureState, source: string = 'unknown'): Promise<void> {
        if (!docId || !state) {
            return;
        }

        // 添加到事件队列
        this.eventQueue.push({
            type: 'changed',
            docId,
            state: { ...state }, // 创建副本
            source,
            timestamp: Date.now()
        });

        // 处理事件队列
        await this.processEventQueue();
    }

    /**
     * 通知状态清除
     * @param docId 文档ID
     */
    async notifyStateCleared(docId: string): Promise<void> {
        if (!docId) {
            return;
        }

        // 添加到事件队列
        this.eventQueue.push({
            type: 'cleared',
            docId,
            timestamp: Date.now()
        });

        // 处理事件队列
        await this.processEventQueue();
    }

    /**
     * 处理事件队列
     */
    private async processEventQueue(): Promise<void> {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift()!;
                await this.processEvent(event);
            }
        } catch (error) {
            console.error('StateNotifier: 处理事件队列失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理单个事件
     * @param event 事件
     */
    private async processEvent(event: {
        type: 'changed' | 'cleared';
        docId: string;
        state?: IFigureState;
        source?: string;
        timestamp: number;
    }): Promise<void> {
        try {
            if (event.type === 'changed' && event.state) {
                await this.notifyListeners(event.docId, event.state, event.source || 'unknown');
            } else if (event.type === 'cleared') {
                await this.notifyCleared(event.docId);
            }
        } catch (error) {
            console.error(`StateNotifier: 处理事件失败:`, error);
        }
    }

    /**
     * 通知所有监听器状态变化
     * @param docId 文档ID
     * @param state 状态
     * @param source 来源
     */
    private async notifyListeners(docId: string, state: IFigureState, source: string): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const listener of this.listeners.values()) {
            // 应用过滤器
            if (listener.filter && !listener.filter(docId, state, source)) {
                continue;
            }

            // 异步调用回调
            promises.push(this.safeCallListener(listener, docId, state, source));
        }

        // 等待所有回调完成
        await Promise.allSettled(promises);
    }

    /**
     * 通知状态清除
     * @param docId 文档ID
     */
    private async notifyCleared(docId: string): Promise<void> {
        // 创建一个空状态表示清除
        const emptyState: IFigureState = {
            docId,
            figures: [],
            lastUpdated: Date.now(),
            version: 0,
            loading: false
        };

        await this.notifyListeners(docId, emptyState, 'cleared');
    }

    /**
     * 安全调用监听器
     * @param listener 监听器
     * @param docId 文档ID
     * @param state 状态
     * @param source 来源
     */
    private async safeCallListener(
        listener: StateChangeListener,
        docId: string,
        state: IFigureState,
        source: string
    ): Promise<void> {
        try {
            await listener.callback(docId, state, source);
        } catch (error) {
            console.error(`StateNotifier: 监听器 ${listener.id} 回调失败:`, error);
        }
    }

    /**
     * 生成监听器ID
     * @returns 监听器ID
     */
    private generateListenerId(): string {
        return `listener-${++this.listenerCounter}-${Date.now()}`;
    }

    /**
     * 获取监听器统计信息
     * @returns 统计信息
     */
    getStats(): {
        totalListeners: number;
        queuedEvents: number;
        isProcessing: boolean;
    } {
        return {
            totalListeners: this.listeners.size,
            queuedEvents: this.eventQueue.length,
            isProcessing: this.isProcessing
        };
    }

    /**
     * 清空事件队列
     */
    clearEventQueue(): void {
        this.eventQueue.length = 0;
        console.log('StateNotifier: 清空事件队列');
    }

    /**
     * 获取所有监听器ID
     * @returns 监听器ID数组
     */
    getListenerIds(): string[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * 创建文档过滤器
     * @param docIds 文档ID数组
     * @returns 过滤器函数
     */
    static createDocumentFilter(docIds: string[]): (docId: string) => boolean {
        const docIdSet = new Set(docIds);
        return (docId: string) => docIdSet.has(docId);
    }

    /**
     * 创建来源过滤器
     * @param sources 来源数组
     * @returns 过滤器函数
     */
    static createSourceFilter(sources: string[]): (docId: string, state: IFigureState, source: string) => boolean {
        const sourceSet = new Set(sources);
        return (docId: string, state: IFigureState, source: string) => sourceSet.has(source);
    }

    /**
     * 创建状态类型过滤器
     * @param includeLoading 是否包含加载状态
     * @param includeError 是否包含错误状态
     * @returns 过滤器函数
     */
    static createStateTypeFilter(
        includeLoading: boolean = true,
        includeError: boolean = true
    ): (docId: string, state: IFigureState, source: string) => boolean {
        return (docId: string, state: IFigureState, source: string) => {
            if (state.loading && !includeLoading) {
                return false;
            }
            if (state.error && !includeError) {
                return false;
            }
            return true;
        };
    }

    /**
     * 销毁通知器
     */
    destroy(): void {
        // 清除所有监听器
        this.listeners.clear();
        
        // 清空事件队列
        this.clearEventQueue();
        
        // 重置计数器
        this.listenerCounter = 0;
        this.isProcessing = false;

        console.log('StateNotifier: 销毁完成');
    }
}
