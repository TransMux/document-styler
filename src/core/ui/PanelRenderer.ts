/**
 * 面板渲染器 - 负责侧边栏面板的渲染和更新
 * 统一面板内容的生成和显示逻辑
 */

import { IFigureInfo } from '../../types';
import { IUIState } from './UIManager';

export interface IPanelRendererConfig {
    /** 容器选择器 */
    container?: string;
    /** 是否启用动画 */
    enableAnimation?: boolean;
    /** 面板标题 */
    title?: string;
    /** 自定义CSS类名 */
    className?: string;
}

export class PanelRenderer {
    private config: Required<IPanelRendererConfig>;
    private panelElement: HTMLElement | null = null;
    private isInitialized = false;
    private renderCount = 0;

    constructor(config: IPanelRendererConfig = {}) {
        this.config = {
            container: '.layout__dockl',
            enableAnimation: true,
            title: 'DocumentStyler',
            className: 'document-styler-panel',
            ...config
        };
    }

    /**
     * 初始化面板渲染器
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('PanelRenderer: 已经初始化，跳过重复初始化');
            return;
        }

        try {
            await this.createPanel();
            this.isInitialized = true;
            console.log('PanelRenderer: 初始化完成');

        } catch (error) {
            console.error('PanelRenderer: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 渲染面板内容
     * @param state UI状态
     */
    async render(state: IUIState): Promise<void> {
        if (!this.isInitialized || !this.panelElement) {
            console.warn('PanelRenderer: 未初始化，无法渲染');
            return;
        }

        try {
            this.renderCount++;
            
            // 生成面板HTML
            const html = this.generatePanelHTML(state);
            
            // 更新面板内容
            this.panelElement.innerHTML = html;
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            console.log(`PanelRenderer: 渲染完成 (第${this.renderCount}次)`);

        } catch (error) {
            console.error('PanelRenderer: 渲染失败:', error);
            this.renderError(error as Error);
        }
    }

    /**
     * 生成面板HTML
     * @param state UI状态
     * @returns HTML字符串
     */
    private generatePanelHTML(state: IUIState): string {
        const { currentDocId, figures, loading, error } = state;

        return `
            <div class="${this.config.className}">
                ${this.generateHeaderHTML()}
                ${this.generateStatusHTML(currentDocId, loading, error)}
                ${this.generateContentHTML(figures, loading, error)}
            </div>
        `;
    }

    /**
     * 生成头部HTML
     * @returns HTML字符串
     */
    private generateHeaderHTML(): string {
        return `
            <div class="document-styler-header">
                <h3 class="document-styler-title">
                    <svg class="document-styler-icon"><use xlink:href="#iconList"></use></svg>
                    ${this.config.title}
                </h3>
                <button class="b3-button b3-button--small document-styler-refresh" title="刷新">
                    <svg><use xlink:href="#iconRefresh"></use></svg>
                </button>
            </div>
        `;
    }

    /**
     * 生成状态HTML
     * @param docId 文档ID
     * @param loading 是否加载中
     * @param error 错误信息
     * @returns HTML字符串
     */
    private generateStatusHTML(docId?: string, loading?: boolean, error?: string): string {
        if (error) {
            return `
                <div class="document-styler-status document-styler-error">
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                    <span>错误: ${this.escapeHtml(error)}</span>
                </div>
            `;
        }

        if (loading) {
            return `
                <div class="document-styler-status document-styler-loading">
                    <svg class="fn__rotate"><use xlink:href="#iconRefresh"></use></svg>
                    <span>加载中...</span>
                </div>
            `;
        }

        if (!docId) {
            return `
                <div class="document-styler-status document-styler-empty">
                    <svg><use xlink:href="#iconFile"></use></svg>
                    <span>未选择文档</span>
                </div>
            `;
        }

        return '';
    }

    /**
     * 生成内容HTML
     * @param figures 图表数据
     * @param loading 是否加载中
     * @param error 错误信息
     * @returns HTML字符串
     */
    private generateContentHTML(figures: IFigureInfo[], loading?: boolean, error?: string): string {
        if (loading || error) {
            return '';
        }

        if (figures.length === 0) {
            return `
                <div class="document-styler-empty">
                    <svg><use xlink:href="#iconImage"></use></svg>
                    <div>当前文档中没有图片或表格</div>
                </div>
            `;
        }

        return `
            <div class="document-styler-content">
                ${this.generateSettingsHTML()}
                ${this.generateFiguresListHTML(figures)}
            </div>
        `;
    }

    /**
     * 生成设置HTML
     * @returns HTML字符串
     */
    private generateSettingsHTML(): string {
        return `
            <div class="document-styler-settings">
                <div class="document-styler-section">
                    <h4 class="document-styler-section-title">当前文档设置</h4>
                    
                    <label class="fn__flex b3-label">
                        <div class="fn__flex-1">
                            交叉引用
                            <div class="b3-label__text">为图片和表格添加编号标签</div>
                        </div>
                        <span class="fn__space"></span>
                        <input class="b3-switch fn__flex-center" id="cross-ref-toggle" type="checkbox" checked="">
                    </label>
                </div>
            </div>
        `;
    }

    /**
     * 生成图表列表HTML
     * @param figures 图表数据
     * @returns HTML字符串
     */
    private generateFiguresListHTML(figures: IFigureInfo[]): string {
        const imageCount = figures.filter(f => f.type === 'image').length;
        const tableCount = figures.filter(f => f.type === 'table').length;

        return `
            <div class="document-styler-figures">
                <div class="document-styler-section">
                    <h4 class="document-styler-section-title">
                        图表列表 (${imageCount} 图片, ${tableCount} 表格)
                    </h4>
                    
                    <div class="document-styler-figures-list">
                        ${figures.map(figure => this.generateFigureItemHTML(figure)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成单个图表项HTML
     * @param figure 图表数据
     * @returns HTML字符串
     */
    private generateFigureItemHTML(figure: IFigureInfo): string {
        const typeIcon = figure.type === 'image' ? 'iconImage' : 'iconTable';
        const typeText = figure.type === 'image' ? '图' : '表';
        const caption = figure.caption || '无标题';

        return `
            <div class="document-styler-figure-item" data-figure-id="${figure.id}" data-figure-type="${figure.type}">
                <div class="document-styler-figure-icon">
                    <svg><use xlink:href="#${typeIcon}"></use></svg>
                </div>
                <div class="document-styler-figure-info">
                    <div class="document-styler-figure-title">
                        ${typeText} ${figure.number || '?'}: ${this.escapeHtml(caption)}
                    </div>
                    <div class="document-styler-figure-meta">
                        ID: ${figure.id.substring(0, 8)}...
                    </div>
                </div>
                <div class="document-styler-figure-actions">
                    <button class="b3-button b3-button--small" title="跳转到图表">
                        <svg><use xlink:href="#iconGoto"></use></svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件监听器
     */
    private bindEventListeners(): void {
        if (!this.panelElement) {
            return;
        }

        // 刷新按钮
        const refreshBtn = this.panelElement.querySelector('.document-styler-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.handleRefreshClick();
            });
        }

        // 设置切换
        const toggles = this.panelElement.querySelectorAll('input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.handleSettingToggle(target.id, target.checked);
            });
        });

        // 图表项点击
        const figureItems = this.panelElement.querySelectorAll('.document-styler-figure-item');
        figureItems.forEach(item => {
            item.addEventListener('click', () => {
                const figureId = item.getAttribute('data-figure-id');
                const figureType = item.getAttribute('data-figure-type');
                if (figureId && figureType) {
                    this.handleFigureClick(figureId, figureType);
                }
            });
        });
    }

    /**
     * 处理刷新点击（占位符，实际由UIManager处理）
     */
    private handleRefreshClick(): void {
        // 这个方法会被UIManager的回调覆盖
        console.log('PanelRenderer: 刷新点击');
    }

    /**
     * 处理设置切换（占位符，实际由UIManager处理）
     */
    private handleSettingToggle(settingId: string, enabled: boolean): void {
        // 这个方法会被UIManager的回调覆盖
        console.log(`PanelRenderer: 设置切换 ${settingId} = ${enabled}`);
    }

    /**
     * 处理图表点击（占位符，实际由UIManager处理）
     */
    private handleFigureClick(figureId: string, figureType: string): void {
        // 这个方法会被UIManager的回调覆盖
        console.log(`PanelRenderer: 图表点击 ${figureType} ${figureId}`);
    }

    /**
     * 渲染错误状态
     * @param error 错误对象
     */
    private renderError(error: Error): void {
        if (!this.panelElement) {
            return;
        }

        this.panelElement.innerHTML = `
            <div class="${this.config.className}">
                ${this.generateHeaderHTML()}
                <div class="document-styler-error">
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                    <div>渲染失败: ${this.escapeHtml(error.message)}</div>
                </div>
            </div>
        `;
    }

    /**
     * 创建面板元素
     */
    private async createPanel(): Promise<void> {
        // 查找容器
        const container = document.querySelector(this.config.container);
        if (!container) {
            throw new Error(`找不到面板容器: ${this.config.container}`);
        }

        // 创建面板元素
        this.panelElement = document.createElement('div');
        this.panelElement.className = 'fn__flex-1 fn__flex-column';
        this.panelElement.setAttribute('data-type', 'document-styler-panel');

        // 添加到容器
        container.appendChild(this.panelElement);

        console.log('PanelRenderer: 面板元素已创建');
    }

    /**
     * 转义HTML字符
     * @param text 文本
     * @returns 转义后的文本
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isInitialized: boolean;
        renderCount: number;
        hasPanelElement: boolean;
    } {
        return {
            isInitialized: this.isInitialized,
            renderCount: this.renderCount,
            hasPanelElement: this.panelElement !== null
        };
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<IPanelRendererConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('PanelRenderer: 配置已更新');
    }

    /**
     * 销毁面板渲染器
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            // 移除面板元素
            if (this.panelElement && this.panelElement.parentNode) {
                this.panelElement.parentNode.removeChild(this.panelElement);
            }

            this.panelElement = null;
            this.isInitialized = false;
            this.renderCount = 0;

            console.log('PanelRenderer: 销毁完成');

        } catch (error) {
            console.error('PanelRenderer: 销毁失败:', error);
            throw error;
        }
    }
}
