/**
 * 交叉引用管理器 - 简化版本
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { getDocumentFigures } from "../utils/apiUtils";

export class CrossReference implements ICrossReference {
    private documentManager: DocumentManager;
    private panelUpdateCallback: (() => Promise<void>) | null = null;
    private settingsManager: any = null;
    private betaFeatureManager: any = null;
    private figuresCache: Map<string, IFigureInfo[]> = new Map();

    constructor(documentManager: DocumentManager) {
        this.documentManager = documentManager;
    }

    /**
     * 初始化交叉引用管理器
     */
    async init(): Promise<void> {
        // 简化初始化
    }

    /**
     * 设置设置管理器引用
     */
    setSettingsManager(settingsManager: any): void {
        this.settingsManager = settingsManager;
    }

    /**
     * 设置内测功能管理器引用
     */
    setBetaFeatureManager(betaFeatureManager: any): void {
        this.betaFeatureManager = betaFeatureManager;
    }

    /**
     * 设置面板更新回调函数
     */
    setPanelUpdateCallback(callback: () => Promise<void>): void {
        this.panelUpdateCallback = callback;
    }

    /**
     * 销毁交叉引用管理器
     */
    async destroy(): Promise<void> {
        this.removeCrossReferenceStyles();
        this.figuresCache.clear();
    }

    /**
     * 应用交叉引用到指定protyle
     */
    async applyCrossReference(protyle: any, config?: { fromWebSocket?: boolean }): Promise<void> {
        if (!protyle) return;

        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            return;
        }

        try {
            const docId = protyle?.block?.rootID;
            if (!docId) return;

            // 获取图表数据
            const figures = await this.getFiguresList(docId);
            
            // 应用样式
            await this.applyCrossReferenceStyles(docId, figures);

        } catch (error) {
            console.error('应用交叉引用失败:', error);
            throw error;
        }
    }

    /**
     * 清除交叉引用
     */
    async clearCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            this.removeCrossReferenceStyles();
        } catch (error) {
            console.error('清除交叉引用失败:', error);
            throw error;
        }
    }

    /**
     * 获取图表列表
     */
    async getFiguresList(docId: string): Promise<IFigureInfo[]> {
        if (!docId) return [];

        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            return [];
        }

        try {
            // 检查缓存
            if (this.figuresCache.has(docId)) {
                return this.figuresCache.get(docId) || [];
            }

            // 获取图表数据
            const figures = await getDocumentFigures(docId);
            
            // 缓存结果
            this.figuresCache.set(docId, figures);
            
            return figures;
        } catch (error) {
            console.error('获取图片表格列表失败:', error);
            return [];
        }
    }

    /**
     * 滚动到指定图表
     */
    scrollToFigure(figureId: string): void {
        try {
            const element = document.querySelector(`[data-node-id="${figureId}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (error) {
            console.error('滚动到图表失败:', error);
        }
    }

    /**
     * 处理 WebSocket 事务消息
     */
    async handleTransactionMessage(data: any): Promise<void> {
        try {
            const docId = this.documentManager.getCurrentDocId();
            if (!docId) return;

            // 清除缓存，重新获取数据
            this.figuresCache.delete(docId);
            
            // 重新应用交叉引用
            const protyle = this.documentManager.getCurrentProtyle();
            if (protyle) {
                await this.applyCrossReference(protyle, { fromWebSocket: true });
            }
        } catch (error) {
            console.error('处理WebSocket消息失败:', error);
        }
    }

    /**
     * 强制更新交叉引用
     */
    async forceUpdate(): Promise<void> {
        try {
            const docId = this.documentManager.getCurrentDocId();
            if (docId) {
                // 清除缓存
                this.figuresCache.delete(docId);
                
                // 重新应用
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.applyCrossReference(protyle);
                }
            }
        } catch (error) {
            console.error('强制更新交叉引用失败:', error);
        }
    }

    /**
     * 应用交叉引用样式
     */
    private async applyCrossReferenceStyles(docId: string, figures: IFigureInfo[]): Promise<void> {
        if (!this.settingsManager) {
            console.warn('设置管理器未设置，无法应用样式');
            return;
        }

        try {
            // 获取前缀设置
            const figurePrefix = await this.settingsManager.getDocumentFigurePrefix(docId);
            const tablePrefix = await this.settingsManager.getDocumentTablePrefix(docId);

            // 生成CSS样式
            const styles = this.generateFigureCaptionStyles(figures, figurePrefix, tablePrefix);
            
            // 应用样式
            this.addCrossReferenceStyles(styles);

        } catch (error) {
            console.error('应用交叉引用样式失败:', error);
        }
    }

    /**
     * 生成图表标题样式
     */
    private generateFigureCaptionStyles(figures: IFigureInfo[], figurePrefix: string = '图', tablePrefix: string = '表'): string {
        let styles = '';

        for (const figure of figures) {
            // 检查是否有标题ID
            const captionId = (figure as any).captionId;
            if (captionId && figure.caption) {
                const prefix = figure.type === 'image' ? figurePrefix : tablePrefix;
                styles += `
                    .protyle-wysiwyg [data-node-id="${captionId}"] [contenteditable="true"]::before {
                        content: "${prefix} ${figure.number}: ";
                        color: var(--b3-theme-primary);
                        font-weight: 500;
                    }
                `;
            }
        }

        return styles;
    }

    /**
     * 添加交叉引用样式
     */
    private addCrossReferenceStyles(styles: string): void {
        // 移除旧样式
        this.removeCrossReferenceStyles();
        
        if (!styles.trim()) return;

        // 添加新样式
        const styleElement = document.createElement('style');
        styleElement.id = 'cross-reference-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * 移除交叉引用样式
     */
    private removeCrossReferenceStyles(): void {
        const existingStyle = document.getElementById('cross-reference-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
    }
}