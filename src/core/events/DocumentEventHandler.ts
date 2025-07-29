/**
 * 文档事件处理器
 * 负责文档相关事件的监听和处理
 */

import { EventDispatcher } from './EventDispatcher';

export interface IDocumentEventData {
    protyle: any;
    docId?: string;
    [key: string]: any;
}

export class DocumentEventHandler {
    private dispatcher: EventDispatcher;
    private eventListeners = new Map<string, (event: CustomEvent) => void>();
    private isActive = false;
    private isPaused = false;
    private eventCount = 0;

    constructor(dispatcher: EventDispatcher) {
        this.dispatcher = dispatcher;
    }

    /**
     * 初始化文档事件处理器
     */
    async init(): Promise<void> {
        if (this.isActive) {
            console.warn('DocumentEventHandler: 已经初始化，跳过重复初始化');
            return;
        }

        try {
            this.setupDocumentEventListeners();
            this.isActive = true;
            console.log('DocumentEventHandler: 初始化完成');

        } catch (error) {
            console.error('DocumentEventHandler: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 设置文档事件监听器
     */
    private setupDocumentEventListeners(): void {
        // 文档切换事件
        this.registerEventListener('switch-protyle', this.handleDocumentSwitch.bind(this));

        // 文档加载事件
        this.registerEventListener('loaded-protyle-static', this.handleDocumentLoaded.bind(this));

        // 文档关闭事件
        this.registerEventListener('destroy-protyle', this.handleDocumentClosed.bind(this));

        // 编辑器焦点事件
        this.registerEventListener('focus-protyle', this.handleDocumentFocus.bind(this));

        // 编辑器失焦事件
        this.registerEventListener('blur-protyle', this.handleDocumentBlur.bind(this));

        console.log('DocumentEventHandler: 文档事件监听器已设置');
    }

    /**
     * 注册事件监听器
     * @param eventName 事件名称
     * @param handler 处理函数
     */
    private registerEventListener(eventName: string, handler: (event: CustomEvent) => void): void {
        // 包装处理函数以添加错误处理和统计
        const wrappedHandler = (event: CustomEvent) => {
            if (this.isPaused || !this.isActive) {
                return;
            }

            try {
                this.eventCount++;
                handler(event);
            } catch (error) {
                console.error(`DocumentEventHandler: 处理事件 ${eventName} 失败:`, error);
            }
        };

        // 注册事件监听器
        window.addEventListener(eventName, wrappedHandler);
        this.eventListeners.set(eventName, wrappedHandler);

        console.log(`DocumentEventHandler: 注册事件监听器 ${eventName}`);
    }

    /**
     * 处理文档切换事件
     * @param event 事件对象
     */
    private async handleDocumentSwitch(event: CustomEvent): Promise<void> {
        const data = this.extractEventData(event);
        if (!data) {
            return;
        }

        await this.dispatcher.emit('document:switch', data);
        console.log(`DocumentEventHandler: 文档切换 - ${data.docId}`);
    }

    /**
     * 处理文档加载事件
     * @param event 事件对象
     */
    private async handleDocumentLoaded(event: CustomEvent): Promise<void> {
        const data = this.extractEventData(event);
        if (!data) {
            return;
        }

        await this.dispatcher.emit('document:loaded', data);
        console.log(`DocumentEventHandler: 文档加载 - ${data.docId}`);
    }

    /**
     * 处理文档关闭事件
     * @param event 事件对象
     */
    private async handleDocumentClosed(event: CustomEvent): Promise<void> {
        const data = this.extractEventData(event);
        if (!data) {
            return;
        }

        await this.dispatcher.emit('document:closed', data);
        console.log(`DocumentEventHandler: 文档关闭 - ${data.docId}`);
    }

    /**
     * 处理文档获得焦点事件
     * @param event 事件对象
     */
    private async handleDocumentFocus(event: CustomEvent): Promise<void> {
        const data = this.extractEventData(event);
        if (!data) {
            return;
        }

        await this.dispatcher.emit('document:focus', data);
    }

    /**
     * 处理文档失去焦点事件
     * @param event 事件对象
     */
    private async handleDocumentBlur(event: CustomEvent): Promise<void> {
        const data = this.extractEventData(event);
        if (!data) {
            return;
        }

        await this.dispatcher.emit('document:blur', data);
    }

    /**
     * 提取事件数据
     * @param event 事件对象
     * @returns 提取的数据
     */
    private extractEventData(event: CustomEvent): IDocumentEventData | null {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle) {
                return null;
            }

            const docId = this.extractDocId(protyle);
            return {
                protyle,
                docId,
                detail: event.detail
            };

        } catch (error) {
            console.error('DocumentEventHandler: 提取事件数据失败:', error);
            return null;
        }
    }

    /**
     * 从protyle中提取文档ID
     * @param protyle protyle对象
     * @returns 文档ID
     */
    private extractDocId(protyle: any): string | undefined {
        return protyle?.block?.rootID || 
               protyle?.background?.ial?.id || 
               protyle?.options?.blockId;
    }

    /**
     * 暂停事件处理
     */
    pause(): void {
        this.isPaused = true;
        console.log('DocumentEventHandler: 暂停事件处理');
    }

    /**
     * 恢复事件处理
     */
    resume(): void {
        this.isPaused = false;
        console.log('DocumentEventHandler: 恢复事件处理');
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isActive: boolean;
        isPaused: boolean;
        eventCount: number;
        registeredEvents: string[];
    } {
        return {
            isActive: this.isActive,
            isPaused: this.isPaused,
            eventCount: this.eventCount,
            registeredEvents: Array.from(this.eventListeners.keys())
        };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.eventCount = 0;
        console.log('DocumentEventHandler: 统计信息已重置');
    }

    /**
     * 手动触发文档事件（用于测试）
     * @param eventType 事件类型
     * @param data 事件数据
     */
    async triggerDocumentEvent(eventType: string, data: IDocumentEventData): Promise<void> {
        if (!this.isActive || this.isPaused) {
            console.warn('DocumentEventHandler: 处理器未激活或已暂停，无法触发事件');
            return;
        }

        await this.dispatcher.emit(`document:${eventType}`, data);
        console.log(`DocumentEventHandler: 手动触发事件 document:${eventType}`);
    }

    /**
     * 检查事件监听器是否已注册
     * @param eventName 事件名称
     * @returns 是否已注册
     */
    hasEventListener(eventName: string): boolean {
        return this.eventListeners.has(eventName);
    }

    /**
     * 获取当前活跃的protyle
     * @returns 活跃的protyle对象
     */
    getActiveProtyle(): any {
        try {
            // 尝试从全局对象获取当前活跃的protyle
            const app = window.siyuan?.app;
            if (!app) {
                return null;
            }

            // 查找活跃的编辑器
            const editors = app.layout?.layout?.models?.editor;
            if (Array.isArray(editors)) {
                for (const editor of editors) {
                    if (editor?.protyle && this.isProtyleActive(editor.protyle)) {
                        return editor.protyle;
                    }
                }
            }

            return null;

        } catch (error) {
            console.error('DocumentEventHandler: 获取活跃protyle失败:', error);
            return null;
        }
    }

    /**
     * 检查protyle是否活跃
     * @param protyle protyle对象
     * @returns 是否活跃
     */
    private isProtyleActive(protyle: any): boolean {
        try {
            return protyle?.wysiwyg?.element?.isConnected && 
                   !protyle?.disabled &&
                   protyle?.wysiwyg?.element?.offsetParent !== null;
        } catch {
            return false;
        }
    }

    /**
     * 销毁文档事件处理器
     */
    async destroy(): Promise<void> {
        if (!this.isActive) {
            return;
        }

        try {
            // 移除所有事件监听器
            for (const [eventName, handler] of this.eventListeners.entries()) {
                window.removeEventListener(eventName, handler);
                console.log(`DocumentEventHandler: 移除事件监听器 ${eventName}`);
            }

            this.eventListeners.clear();
            this.isActive = false;
            this.isPaused = false;
            this.resetStats();

            console.log('DocumentEventHandler: 销毁完成');

        } catch (error) {
            console.error('DocumentEventHandler: 销毁失败:', error);
            throw error;
        }
    }
}
