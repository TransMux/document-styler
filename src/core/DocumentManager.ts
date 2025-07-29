/**
 * 文档管理器
 * 负责管理当前文档状态和编辑器实例
 */

import { App } from "../../../../index";
import { IDocumentManager, IDocumentInfo, IDocumentStylerDocumentSettings } from "../types";
import { getDocumentTitle } from "../utils/apiUtils";

export class DocumentManager implements IDocumentManager {
    private app: App;
    private currentDocId: string | null = null;
    private currentProtyle: any = null;
    private documentCache: Map<string, IDocumentInfo> = new Map();

    constructor(app: App) {
        this.app = app;
    }

    async init(): Promise<void> {
        // 初始化时获取当前文档信息
        this.updateCurrentDocument();
    }

    destroy(): void {
        this.currentDocId = null;
        this.currentProtyle = null;
        this.documentCache.clear();
    }

    getCurrentDocId(): string | null {
        return this.currentDocId;
    }

    getCurrentProtyle(): any {
        return this.currentProtyle;
    }

    /**
     * 更新当前文档信息
     * @param protyle 编辑器实例
     */
    updateCurrentDocument(protyle?: any): void {
        if (protyle) {
            this.currentProtyle = protyle;
            this.currentDocId = this.extractDocId(protyle);
        } else {
            // 尝试从当前活跃的编辑器获取
            const activeProtyle = this.getActiveProtyle();
            if (activeProtyle) {
                this.currentProtyle = activeProtyle;
                this.currentDocId = this.extractDocId(activeProtyle);
            }
        }
    }

    /**
     * 从编辑器实例中提取文档ID
     * @param protyle 编辑器实例
     * @returns 文档ID
     */
    private extractDocId(protyle: any): string | null {
        if (!protyle) return null;
        
        // 尝试多种方式获取文档ID
        return protyle?.block?.rootID || 
               protyle?.background?.ial?.id || 
               protyle?.options?.blockId ||
               null;
    }

    /**
     * 获取当前活跃的编辑器实例
     * @returns 编辑器实例
     */
    private getActiveProtyle(): any {
        try {
            const app = this.app as any;
            const editors = app.layout?.layout?.models?.editor;
            
            if (editors && Array.isArray(editors)) {
                // 查找当前活跃的编辑器
                for (const editor of editors) {
                    if (editor?.protyle && this.isProtyleActive(editor.protyle)) {
                        return editor.protyle;
                    }
                }
                
                // 如果没有找到活跃的，返回第一个可用的
                for (const editor of editors) {
                    if (editor?.protyle) {
                        return editor.protyle;
                    }
                }
            }
        } catch (error) {
            console.error('获取活跃编辑器失败:', error);
        }
        
        return null;
    }

    /**
     * 检查编辑器是否活跃
     * @param protyle 编辑器实例
     * @returns 是否活跃
     */
    private isProtyleActive(protyle: any): boolean {
        try {
            // 检查编辑器是否可见且可编辑
            return protyle?.wysiwyg?.element?.isConnected && 
                   !protyle?.disabled &&
                   protyle?.wysiwyg?.element?.offsetParent !== null;
        } catch {
            return false;
        }
    }

    async getDocumentInfo(docId: string): Promise<IDocumentInfo | null> {
        if (!docId) return null;

        // 先从缓存中查找
        if (this.documentCache.has(docId)) {
            return this.documentCache.get(docId)!;
        }

        try {
            // 获取文档标题
            const title = await getDocumentTitle(docId);
            
            const docInfo: IDocumentInfo = {
                id: docId,
                title: title,
                numberingEnabled: false,
                crossReferenceEnabled: false
            };

            // 缓存文档信息
            this.documentCache.set(docId, docInfo);
            return docInfo;
        } catch (error) {
            console.error('获取文档信息失败:', error);
            return null;
        }
    }

    async updateDocumentInfo(docId: string, info: Partial<IDocumentInfo>): Promise<void> {
        if (!docId) return;

        let docInfo = this.documentCache.get(docId);
        if (!docInfo) {
            docInfo = await this.getDocumentInfo(docId);
            if (!docInfo) return;
        }

        // 更新文档信息
        Object.assign(docInfo, info);
        this.documentCache.set(docId, docInfo);
    }

    /**
     * 清除文档缓存
     * @param docId 文档ID，如果不提供则清除所有缓存
     */
    clearDocumentCache(docId?: string): void {
        if (docId) {
            this.documentCache.delete(docId);
        } else {
            this.documentCache.clear();
        }
    }

    /**
     * 检查文档是否存在
     * @param docId 文档ID
     * @returns 是否存在
     */
    async documentExists(docId: string): Promise<boolean> {
        if (!docId) return false;
        
        try {
            const info = await this.getDocumentInfo(docId);
            return info !== null;
        } catch {
            return false;
        }
    }

    /**
     * 获取文档的编辑器实例
     * @param docId 文档ID
     * @returns 编辑器实例
     */
    getProtyleByDocId(docId: string): any {
        if (!docId) return null;
        
        try {
            const app = this.app as any;
            const editors = app.layout?.layout?.models?.editor;
            
            if (editors && Array.isArray(editors)) {
                for (const editor of editors) {
                    if (editor?.protyle) {
                        const editorDocId = this.extractDocId(editor.protyle);
                        if (editorDocId === docId) {
                            return editor.protyle;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取文档编辑器失败:', error);
        }
        
        return null;
    }

    /**
     * 检查当前是否有活跃的文档
     * @returns 是否有活跃文档
     */
    hasActiveDocument(): boolean {
        return this.currentDocId !== null && this.currentProtyle !== null;
    }

    /**
     * 获取所有打开的文档ID
     * @returns 文档ID数组
     */
    getOpenDocumentIds(): string[] {
        const docIds: string[] = [];
        
        try {
            const app = this.app as any;
            const editors = app.layout?.layout?.models?.editor;
            
            if (editors && Array.isArray(editors)) {
                for (const editor of editors) {
                    if (editor?.protyle) {
                        const docId = this.extractDocId(editor.protyle);
                        if (docId && !docIds.includes(docId)) {
                            docIds.push(docId);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取打开文档列表失败:', error);
        }
        
        return docIds;
    }

    /**
     * 刷新当前文档信息
     */
    async refreshCurrentDocument(): Promise<void> {
        if (this.currentDocId) {
            this.clearDocumentCache(this.currentDocId);
            await this.getDocumentInfo(this.currentDocId);
        }
    }

    /**
     * 监听文档切换事件
     * @param callback 回调函数
     */
    onDocumentSwitch(callback: (docId: string | null, protyle: any) => void): void {
        // 这里可以添加事件监听逻辑
        // 由于需要与主插件类集成，这个方法可能需要在主类中实现
    }

    /**
     * 监听文档加载事件
     * @param callback 回调函数
     */
    onDocumentLoaded(callback: (docId: string | null, protyle: any) => void): void {
        // 这里可以添加事件监听逻辑
        // 由于需要与主插件类集成，这个方法可能需要在主类中实现
    }

    /**
     * 检查 WebSocket 消息是否影响当前文档
     * @param msg WebSocket 消息
     * @returns 是否影响当前文档
     */
    isCurrentDocumentAffected(msg: any): boolean {
        if (!this.currentDocId || !this.currentProtyle || !msg.data || !Array.isArray(msg.data)) {
            console.log(`DocumentManager: 消息影响检查失败 - 当前文档ID: ${this.currentDocId}, protyle存在: ${!!this.currentProtyle}, 消息数据有效: ${!!(msg.data && Array.isArray(msg.data))}`);
            return false;
        }

        // 检查 transaction 中的操作是否影响当前 protyle 中的块
        const isAffected = msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作的块ID是否存在于当前protyle中
                if (operation.id) {
                    const blockExists = this.isBlockInCurrentProtyle(operation.id);
                    if (blockExists) {
                        console.log(`DocumentManager: 检测到影响当前文档的操作 - 块ID: ${operation.id}, 操作: ${operation.action}`);
                    }
                    return blockExists;
                }
                return false;
            });
        });

        console.log(`DocumentManager: 消息是否影响当前文档: ${isAffected}`);
        return isAffected;
    }

    /**
     * 检查 WebSocket 消息是否影响指定文档
     * @param msg WebSocket 消息
     * @param docId 文档ID
     * @returns 是否影响指定文档
     */
    isDocumentAffected(msg: any, docId: string): boolean {
        if (!docId || !msg.data || !Array.isArray(msg.data)) {
            return false;
        }

        // 只检查当前文档，因为只有当前文档的 protyle 是可用的
        if (docId !== this.currentDocId || !this.currentProtyle) {
            return false;
        }

        // 直接调用当前文档检测方法
        return this.isCurrentDocumentAffected(msg);
    }



    /**
     * 检查指定的块ID是否存在于当前 protyle 中
     * @param blockId 块ID
     * @returns 是否存在
     */
    private isBlockInCurrentProtyle(blockId: string): boolean {
        if (!blockId || !this.currentProtyle?.wysiwyg?.element) {
            return false;
        }

        try {
            // 在当前 protyle 的 DOM 中查找对应的块元素
            const blockElement = this.currentProtyle.wysiwyg.element.querySelector(`[data-node-id="${blockId}"]`);
            return blockElement !== null;
        } catch (error) {
            console.warn('检查块是否存在失败:', error);
            return false;
        }
    }

    /**
     * 从 WebSocket 消息中提取受影响的文档ID列表
     * @param msg WebSocket 消息
     * @returns 受影响的文档ID列表
     */
    getAffectedDocumentIds(msg: any): string[] {
        if (!msg.data || !Array.isArray(msg.data)) {
            return [];
        }

        const docIds = new Set<string>();

        msg.data.forEach((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return;
            }

            transaction.doOperations.forEach((operation: any) => {
                if (operation.data && typeof operation.data === 'string') {
                    // 提取 data-root-id 属性值
                    const rootIdMatch = operation.data.match(/data-root-id="([^"]+)"/);
                    if (rootIdMatch && rootIdMatch[1]) {
                        docIds.add(rootIdMatch[1]);
                    }
                }
            });
        });

        return Array.from(docIds);
    }
}
