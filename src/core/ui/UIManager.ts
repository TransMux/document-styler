/**
 * UI管理器 - 统一的用户界面管理
 * 负责UI组件的创建、更新、销毁和状态同步
 */

import { PanelRenderer } from './PanelRenderer';
import { InteractionHandler } from './InteractionHandler';
import { IFigureInfo } from '../../types';

export interface IUIManagerConfig {
    /** 面板容器选择器 */
    panelContainer?: string;
    /** 是否启用自动更新 */
    autoUpdate?: boolean;
    /** 更新延迟（毫秒） */
    updateDelay?: number;
    /** 是否启用动画 */
    enableAnimation?: boolean;
}

export interface IUIState {
    /** 当前文档ID */
    currentDocId?: string;
    /** 图表数据 */
    figures: IFigureInfo[];
    /** 是否正在加载 */
    loading: boolean;
    /** 错误信息 */
    error?: string;
    /** 最后更新时间 */
    lastUpdated: number;
}

export class UIManager {
    private panelRenderer: PanelRenderer;
    private interactionHandler: InteractionHandler;
    private config: Required<IUIManagerConfig>;
    private state: IUIState;
    private updateTimer: NodeJS.Timeout | null = null;
    private isInitialized = false;

    constructor(config: IUIManagerConfig = {}) {
        this.config = {
            panelContainer: '.layout__dockl',
            autoUpdate: true,
            updateDelay: 200,
            enableAnimation: true,
            ...config
        };

        this.state = {
            figures: [],
            loading: false,
            lastUpdated: Date.now()
        };

        this.panelRenderer = new PanelRenderer({
            container: this.config.panelContainer,
            enableAnimation: this.config.enableAnimation
        });

        this.interactionHandler = new InteractionHandler();
    }

    /**
     * 初始化UI管理器
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('UIManager: 已经初始化，跳过重复初始化');
            return;
        }

        try {
            // 初始化子组件
            await this.panelRenderer.init();
            await this.interactionHandler.init();

            // 设置交互处理器的回调
            this.setupInteractionCallbacks();

            this.isInitialized = true;
            console.log('UIManager: 初始化完成');

        } catch (error) {
            console.error('UIManager: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 更新UI状态
     * @param newState 新状态
     */
    async updateState(newState: Partial<IUIState>): Promise<void> {
        if (!this.isInitialized) {
            console.warn('UIManager: 未初始化，无法更新状态');
            return;
        }

        try {
            // 合并状态
            const oldState = { ...this.state };
            this.state = {
                ...this.state,
                ...newState,
                lastUpdated: Date.now()
            };

            // 检查是否需要更新UI
            if (this.shouldUpdateUI(oldState, this.state)) {
                await this.scheduleUIUpdate();
            }

        } catch (error) {
            console.error('UIManager: 更新状态失败:', error);
            this.state.error = error instanceof Error ? error.message : '未知错误';
            await this.scheduleUIUpdate();
        }
    }

    /**
     * 设置图表数据
     * @param docId 文档ID
     * @param figures 图表数据
     */
    async setFigures(docId: string, figures: IFigureInfo[]): Promise<void> {
        await this.updateState({
            currentDocId: docId,
            figures: [...figures], // 创建副本
            loading: false,
            error: undefined
        });
    }

    /**
     * 设置加载状态
     * @param loading 是否正在加载
     */
    async setLoading(loading: boolean): Promise<void> {
        await this.updateState({
            loading,
            error: loading ? undefined : this.state.error
        });
    }

    /**
     * 设置错误状态
     * @param error 错误信息
     */
    async setError(error: string | Error): Promise<void> {
        await this.updateState({
            loading: false,
            error: error instanceof Error ? error.message : error
        });
    }

    /**
     * 清除当前状态
     */
    async clearState(): Promise<void> {
        await this.updateState({
            currentDocId: undefined,
            figures: [],
            loading: false,
            error: undefined
        });
    }

    /**
     * 刷新UI
     */
    async refreshUI(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            await this.renderUI();
            console.log('UIManager: UI刷新完成');

        } catch (error) {
            console.error('UIManager: 刷新UI失败:', error);
            await this.setError(error as Error);
        }
    }

    /**
     * 获取当前状态
     * @returns 当前状态
     */
    getState(): IUIState {
        return { ...this.state };
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isInitialized: boolean;
        state: IUIState;
        panelStats: any;
        interactionStats: any;
    } {
        return {
            isInitialized: this.isInitialized,
            state: this.getState(),
            panelStats: this.panelRenderer.getStats(),
            interactionStats: this.interactionHandler.getStats()
        };
    }

    /**
     * 设置交互回调
     */
    private setupInteractionCallbacks(): void {
        // 图表点击回调
        this.interactionHandler.onFigureClick((figureId: string, figureType: string) => {
            this.handleFigureClick(figureId, figureType);
        });

        // 设置切换回调
        this.interactionHandler.onSettingToggle((setting: string, enabled: boolean) => {
            this.handleSettingToggle(setting, enabled);
        });

        // 刷新按钮回调
        this.interactionHandler.onRefreshClick(() => {
            this.handleRefreshClick();
        });
    }

    /**
     * 处理图表点击
     * @param figureId 图表ID
     * @param figureType 图表类型
     */
    private async handleFigureClick(figureId: string, figureType: string): Promise<void> {
        try {
            // 查找目标图表元素
            const targetElement = document.querySelector(`[data-node-id="${figureId}"]`);
            if (targetElement) {
                // 滚动到目标元素
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // 高亮显示
                this.highlightElement(targetElement as HTMLElement);
            }

            console.log(`UIManager: 点击图表 ${figureType} ${figureId}`);

        } catch (error) {
            console.error('UIManager: 处理图表点击失败:', error);
        }
    }

    /**
     * 处理设置切换
     * @param setting 设置名称
     * @param enabled 是否启用
     */
    private async handleSettingToggle(setting: string, enabled: boolean): Promise<void> {
        console.log(`UIManager: 设置切换 ${setting} = ${enabled}`);
        // 这里可以触发相应的事件或回调
    }

    /**
     * 处理刷新点击
     */
    private async handleRefreshClick(): Promise<void> {
        console.log('UIManager: 刷新按钮被点击');
        await this.refreshUI();
    }

    /**
     * 高亮显示元素
     * @param element 目标元素
     */
    private highlightElement(element: HTMLElement): void {
        if (!this.config.enableAnimation) {
            return;
        }

        const originalStyle = element.style.cssText;
        
        // 添加高亮样式
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';

        // 延迟移除高亮
        setTimeout(() => {
            element.style.backgroundColor = '';
            setTimeout(() => {
                element.style.cssText = originalStyle;
            }, 300);
        }, 1500);
    }

    /**
     * 检查是否需要更新UI
     * @param oldState 旧状态
     * @param newState 新状态
     * @returns 是否需要更新
     */
    private shouldUpdateUI(oldState: IUIState, newState: IUIState): boolean {
        return (
            oldState.currentDocId !== newState.currentDocId ||
            oldState.figures.length !== newState.figures.length ||
            oldState.loading !== newState.loading ||
            oldState.error !== newState.error ||
            this.figuresChanged(oldState.figures, newState.figures)
        );
    }

    /**
     * 检查图表数据是否变化
     * @param oldFigures 旧图表数据
     * @param newFigures 新图表数据
     * @returns 是否变化
     */
    private figuresChanged(oldFigures: IFigureInfo[], newFigures: IFigureInfo[]): boolean {
        if (oldFigures.length !== newFigures.length) {
            return true;
        }

        for (let i = 0; i < oldFigures.length; i++) {
            const old = oldFigures[i];
            const new_ = newFigures[i];
            
            if (old.id !== new_.id || 
                old.type !== new_.type || 
                old.number !== new_.number ||
                old.caption !== new_.caption) {
                return true;
            }
        }

        return false;
    }

    /**
     * 调度UI更新
     */
    private async scheduleUIUpdate(): Promise<void> {
        if (!this.config.autoUpdate) {
            return;
        }

        // 清除之前的定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        // 设置新的定时器
        this.updateTimer = setTimeout(async () => {
            await this.renderUI();
            this.updateTimer = null;
        }, this.config.updateDelay);
    }

    /**
     * 渲染UI
     */
    private async renderUI(): Promise<void> {
        await this.panelRenderer.render(this.state);
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<IUIManagerConfig>): void {
        this.config = { ...this.config, ...config };
        
        // 更新子组件配置
        this.panelRenderer.updateConfig({
            enableAnimation: this.config.enableAnimation
        });

        console.log('UIManager: 配置已更新');
    }

    /**
     * 销毁UI管理器
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            // 清除定时器
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
                this.updateTimer = null;
            }

            // 销毁子组件
            await this.interactionHandler.destroy();
            await this.panelRenderer.destroy();

            // 重置状态
            this.state = {
                figures: [],
                loading: false,
                lastUpdated: Date.now()
            };

            this.isInitialized = false;
            console.log('UIManager: 销毁完成');

        } catch (error) {
            console.error('UIManager: 销毁失败:', error);
            throw error;
        }
    }
}
