/**
 * WebSocket事件处理器
 * 负责WebSocket消息的监听、解析和分发
 */

import { EventDispatcher } from './EventDispatcher';

export interface IWebSocketMessage {
    cmd: string;
    data?: any;
    [key: string]: any;
}

export interface ITransactionData {
    doOperations?: Array<{
        action: string;
        data: string;
        id: string;
        [key: string]: any;
    }>;
    [key: string]: any;
}

export class WebSocketHandler {
    private dispatcher: EventDispatcher;
    private originalOnMessage: ((event: MessageEvent) => void) | null = null;
    private isActive = false;
    private isPaused = false;
    private messageCount = 0;
    private errorCount = 0;

    constructor(dispatcher: EventDispatcher) {
        this.dispatcher = dispatcher;
    }

    /**
     * 初始化WebSocket处理器
     */
    async init(): Promise<void> {
        try {
            this.setupWebSocketListener();
            this.isActive = true;
            console.log('WebSocketHandler: 初始化完成');
        } catch (error) {
            console.error('WebSocketHandler: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 设置WebSocket监听器
     */
    private setupWebSocketListener(): void {
        if (!window.siyuan?.ws?.ws) {
            console.warn('WebSocketHandler: WebSocket不可用');
            return;
        }

        // 保存原始处理器
        this.originalOnMessage = window.siyuan.ws.ws.onmessage;

        // 设置新的处理器
        window.siyuan.ws.ws.onmessage = (event: MessageEvent) => {
            // 先调用原始处理器
            if (this.originalOnMessage) {
                this.originalOnMessage.call(window.siyuan.ws.ws, event);
            }

            // 处理我们的逻辑
            this.handleWebSocketMessage(event);
        };

        console.log('WebSocketHandler: WebSocket监听器已设置');
    }

    /**
     * 处理WebSocket消息
     * @param event WebSocket事件
     */
    private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
        if (this.isPaused || !this.isActive) {
            return;
        }

        try {
            this.messageCount++;
            
            const message = this.parseMessage(event.data);
            if (!message) {
                return;
            }

            await this.processMessage(message);

        } catch (error) {
            this.errorCount++;
            console.error('WebSocketHandler: 处理WebSocket消息失败:', error);
        }
    }

    /**
     * 解析WebSocket消息
     * @param data 消息数据
     * @returns 解析后的消息对象
     */
    private parseMessage(data: string): IWebSocketMessage | null {
        try {
            const message = JSON.parse(data);
            return message;
        } catch (error) {
            // 不是所有WebSocket消息都是JSON，忽略解析错误
            return null;
        }
    }

    /**
     * 处理解析后的消息
     * @param message 消息对象
     */
    private async processMessage(message: IWebSocketMessage): Promise<void> {
        // 发送通用WebSocket事件
        await this.dispatcher.emit('websocket:message', message);

        // 根据消息类型分发特定事件
        switch (message.cmd) {
            case 'transactions':
                await this.handleTransactionMessage(message);
                break;
            
            case 'readonly':
                await this.dispatcher.emit('websocket:readonly', message.data);
                break;
            
            case 'progress':
                await this.dispatcher.emit('websocket:progress', message.data);
                break;
            
            default:
                // 其他类型的消息
                await this.dispatcher.emit(`websocket:${message.cmd}`, message.data);
                break;
        }
    }

    /**
     * 处理transaction消息
     * @param message 消息对象
     */
    private async handleTransactionMessage(message: IWebSocketMessage): Promise<void> {
        if (!message.data || !Array.isArray(message.data)) {
            return;
        }

        // 发送原始transaction事件
        await this.dispatcher.emit('websocket:transaction', message.data);

        // 分析transaction内容
        for (const transaction of message.data) {
            await this.analyzeTransaction(transaction);
        }
    }

    /**
     * 分析单个transaction
     * @param transaction transaction数据
     */
    private async analyzeTransaction(transaction: ITransactionData): Promise<void> {
        if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
            return;
        }

        for (const operation of transaction.doOperations) {
            await this.analyzeOperation(operation);
        }
    }

    /**
     * 分析单个操作
     * @param operation 操作数据
     */
    private async analyzeOperation(operation: any): Promise<void> {
        const { action, data, id } = operation;

        // 检查是否涉及图表相关的操作
        if (this.isFigureRelatedOperation(operation)) {
            await this.dispatcher.emit('figure:operation', {
                action,
                blockId: id,
                data,
                operation
            });

            // 根据操作类型发送具体事件
            switch (action) {
                case 'insert':
                    await this.dispatcher.emit('figure:added', { blockId: id, data });
                    break;
                case 'update':
                    await this.dispatcher.emit('figure:updated', { blockId: id, data });
                    break;
                case 'delete':
                    await this.dispatcher.emit('figure:removed', { blockId: id, data });
                    break;
                case 'move':
                    await this.dispatcher.emit('figure:reordered', { blockId: id, data });
                    break;
            }
        }

        // 检查是否涉及文档操作
        if (this.isDocumentRelatedOperation(operation)) {
            await this.dispatcher.emit('document:operation', {
                action,
                blockId: id,
                data,
                operation
            });
        }
    }

    /**
     * 检查操作是否与图表相关
     * @param operation 操作数据
     * @returns 是否相关
     */
    private isFigureRelatedOperation(operation: any): boolean {
        if (!operation.data || typeof operation.data !== 'string') {
            return false;
        }

        const data = operation.data;
        return (
            data.includes('data-type="NodeTable"') ||
            data.includes('<img') ||
            data.includes('data-type="NodeSuperBlock"') ||
            data.includes('data-sb-layout') ||
            data.includes('data-type="img"')
        );
    }

    /**
     * 检查操作是否与文档相关
     * @param operation 操作数据
     * @returns 是否相关
     */
    private isDocumentRelatedOperation(operation: any): boolean {
        if (!operation.data || typeof operation.data !== 'string') {
            return false;
        }

        const data = operation.data;
        return (
            data.includes('data-type="NodeDocument"') ||
            data.includes('data-node-id') ||
            operation.action === 'create' ||
            operation.action === 'remove'
        );
    }

    /**
     * 暂停处理
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * 恢复处理
     */
    resume(): void {
        this.isPaused = false;
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isActive: boolean;
        isPaused: boolean;
        messageCount: number;
        errorCount: number;
        errorRate: number;
    } {
        return {
            isActive: this.isActive,
            isPaused: this.isPaused,
            messageCount: this.messageCount,
            errorCount: this.errorCount,
            errorRate: this.messageCount > 0 ? this.errorCount / this.messageCount : 0
        };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.messageCount = 0;
        this.errorCount = 0;
    }

    /**
     * 检查WebSocket连接状态
     * @returns 连接状态
     */
    getConnectionStatus(): {
        isConnected: boolean;
        readyState: number;
        url?: string;
    } {
        const ws = window.siyuan?.ws?.ws;
        return {
            isConnected: ws?.readyState === WebSocket.OPEN,
            readyState: ws?.readyState || -1,
            url: ws?.url
        };
    }

    /**
     * 销毁WebSocket处理器
     */
    async destroy(): Promise<void> {
        try {
            this.isActive = false;
            this.isPaused = true;

            // 恢复原始处理器
            if (window.siyuan?.ws?.ws && this.originalOnMessage) {
                window.siyuan.ws.ws.onmessage = this.originalOnMessage;
                this.originalOnMessage = null;
            }

            this.resetStats();
            console.log('WebSocketHandler: 销毁完成');

        } catch (error) {
            console.error('WebSocketHandler: 销毁失败:', error);
            throw error;
        }
    }
}
