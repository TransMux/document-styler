/**
 * 交叉引用控制器 - 核心控制器
 * 整合所有重构的组件，提供统一的交叉引用功能接口
 */

import { FigureManager } from './business';
import { StyleManager } from './presentation';
import { FigureState } from './state';
import { EventManager } from './events';
import { UIManager } from './ui';
import { PerformanceMonitor, MemoryManager } from './utils';
import { IFigureInfo, IDataFetchConfig } from '../types';

export interface ICrossReferenceConfig {
    /** 图片编号前缀 */
    imagePrefix?: string;
    /** 表格编号前缀 */
    tablePrefix?: string;
    /** 是否启用自动更新 */
    autoUpdate?: boolean;
    /** 是否启用UI面板 */
    enableUI?: boolean;
    /** 是否启用WebSocket监听 */
    enableWebSocket?: boolean;
    /** 事件处理延迟（毫秒） */
    eventDelay?: number;
}

export class CrossReferenceController {
    private figureManager: FigureManager;
    private styleManager: StyleManager;
    private figureState: FigureState;
    private eventManager: EventManager;
    private uiManager: UIManager;
    private performanceMonitor: PerformanceMonitor;
    private memoryManager: MemoryManager;

    private config: Required<ICrossReferenceConfig>;
    private isInitialized = false;
    private currentDocId?: string;

    // 防重复处理
    private processingDocs = new Set<string>();
    private lastProcessTime = new Map<string, number>();

    constructor(config: ICrossReferenceConfig = {}) {
        this.config = {
            imagePrefix: '图',
            tablePrefix: '表',
            autoUpdate: true,
            enableUI: true,
            enableWebSocket: true,
            eventDelay: 100,
            ...config
        };

        // 初始化各个组件
        this.figureManager = new FigureManager();
        this.styleManager = new StyleManager();
        this.figureState = new FigureState();
        this.eventManager = new EventManager({
            enableWebSocket: this.config.enableWebSocket,
            eventDelay: this.config.eventDelay
        });
        this.uiManager = new UIManager({
            autoUpdate: this.config.autoUpdate
        });

        // 初始化性能监控和内存管理
        this.performanceMonitor = new PerformanceMonitor();
        this.memoryManager = new MemoryManager();

        // 注册组件内存监控
        this.setupMemoryMonitoring();
    }

    /**
     * 初始化控制器
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('CrossReferenceController: 已经初始化，跳过重复初始化');
            return;
        }

        try {
            console.log('CrossReferenceController: 开始初始化...');

            // 初始化各个组件
            await this.eventManager.init();
            
            if (this.config.enableUI) {
                await this.uiManager.init();
            }

            // 设置事件监听
            this.setupEventListeners();

            // 设置状态监听
            this.setupStateListeners();

            this.isInitialized = true;
            console.log('CrossReferenceController: 初始化完成');

            // 发送初始化完成事件
            await this.eventManager.emit('system:ready');

        } catch (error) {
            console.error('CrossReferenceController: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 处理文档切换
     * @param docId 文档ID
     * @param config 数据获取配置
     */
    async handleDocumentSwitch(docId: string, config?: { fromWebSocket?: boolean }): Promise<void> {
        if (!this.isInitialized || !docId) {
            return;
        }

        // 防重复处理检查
        const now = Date.now();
        const lastTime = this.lastProcessTime.get(docId);
        if (lastTime && (now - lastTime) < 500) { // 500ms内的重复请求直接忽略
            console.log(`CrossReferenceController: 忽略重复的文档切换请求 ${docId}`);
            return;
        }

        if (this.processingDocs.has(docId)) {
            console.log(`CrossReferenceController: 文档 ${docId} 正在处理中，跳过`);
            return;
        }

        this.processingDocs.add(docId);
        this.lastProcessTime.set(docId, now);

        const operationId = this.performanceMonitor.startOperation('document-switch', { docId });

        try {
            console.log(`CrossReferenceController: 处理文档切换 ${docId}`);

            // 更新当前文档ID
            this.currentDocId = docId;

            // 设置加载状态
            await this.figureState.setLoadingState(docId, true);

            if (this.config.enableUI) {
                await this.uiManager.setLoading(true);
            }

            // 获取图表数据（带性能监控）
            const fetchConfig = {
                fromWebSocket: config?.fromWebSocket || false,
                forceRefresh: config?.fromWebSocket || false // WebSocket触发时强制刷新
            };

            const { result: figures } = await this.performanceMonitor.measureAsync(
                'get-figures-list',
                () => this.figureManager.getFiguresList(docId, fetchConfig),
                { docId, fromWebSocket: config?.fromWebSocket }
            );

            // 更新状态
            await this.figureState.setState(docId, figures, {
                source: 'document-switch'
            });

            // 应用样式（带性能监控）
            await this.performanceMonitor.measureAsync(
                'apply-styles',
                () => this.styleManager.applyCrossReferenceStyles(docId, figures, {
                    imagePrefix: this.config.imagePrefix,
                    tablePrefix: this.config.tablePrefix
                }),
                { docId, figureCount: figures.length }
            );

            // 更新UI
            if (this.config.enableUI) {
                await this.uiManager.setFigures(docId, figures);
            }

            console.log(`CrossReferenceController: 文档 ${docId} 处理完成，包含 ${figures.length} 个图表`);

        } catch (error) {
            console.error(`CrossReferenceController: 处理文档 ${docId} 失败:`, error);

            // 设置错误状态
            await this.figureState.setErrorState(docId, error as Error);

            if (this.config.enableUI) {
                await this.uiManager.setError(error as Error);
            }
        } finally {
            this.processingDocs.delete(docId);
            this.performanceMonitor.endOperation(operationId);
        }
    }

    /**
     * 刷新当前文档
     */
    async refreshCurrentDocument(): Promise<void> {
        if (!this.currentDocId) {
            console.warn('CrossReferenceController: 没有当前文档，无法刷新');
            return;
        }

        await this.handleDocumentSwitch(this.currentDocId);
    }

    /**
     * 仅更新前缀样式，不重新处理整个文档
     * @param docId 文档ID
     */
    async updatePrefixStylesOnly(docId: string): Promise<void> {
        if (!docId) {
            console.warn('CrossReferenceController: 文档ID不能为空');
            return;
        }

        try {
            // 获取当前文档的图表数据（从缓存中获取，避免重新解析）
            const state = this.figureState.getState(docId);
            if (!state || !state.figures || state.figures.length === 0) {
                console.log(`CrossReferenceController: 文档 ${docId} 没有图表数据，跳过前缀样式更新`);
                return;
            }

            const figures = state.figures;

            // 仅更新样式，使用当前配置的前缀
            await this.styleManager.applyCrossReferenceStyles(docId, figures, {
                imagePrefix: this.config.imagePrefix,
                tablePrefix: this.config.tablePrefix
            });

            console.log(`CrossReferenceController: 文档 ${docId} 前缀样式已更新`);
        } catch (error) {
            console.error(`CrossReferenceController: 更新文档 ${docId} 前缀样式失败:`, error);
        }
    }

    /**
     * 启用交叉引用功能
     * @param docId 文档ID，不传则使用当前文档
     * @param config 数据获取配置
     */
    async enableCrossReference(docId?: string, config?: { fromWebSocket?: boolean }): Promise<void> {
        const targetDocId = docId || this.currentDocId;
        if (!targetDocId) {
            console.warn('CrossReferenceController: 没有指定文档ID');
            return;
        }

        await this.handleDocumentSwitch(targetDocId, config);
    }

    /**
     * 禁用交叉引用功能
     * @param docId 文档ID，不传则使用当前文档
     */
    async disableCrossReference(docId?: string): Promise<void> {
        const targetDocId = docId || this.currentDocId;
        if (!targetDocId) {
            console.warn('CrossReferenceController: 没有指定文档ID');
            return;
        }

        try {
            // 清除样式
            await this.styleManager.clearCrossReferenceStyles(targetDocId);

            // 清除状态
            await this.figureState.clearState(targetDocId);

            // 更新UI
            if (this.config.enableUI) {
                await this.uiManager.clearState();
            }

            console.log(`CrossReferenceController: 已禁用文档 ${targetDocId} 的交叉引用`);

        } catch (error) {
            console.error(`CrossReferenceController: 禁用文档 ${targetDocId} 的交叉引用失败:`, error);
        }
    }

    /**
     * 获取文档的图表列表
     * @param docId 文档ID
     * @param config 获取配置
     * @returns 图表列表
     */
    async getFiguresList(docId: string, config?: IDataFetchConfig): Promise<IFigureInfo[]> {
        return this.figureManager.getFiguresList(docId, config);
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isInitialized: boolean;
        currentDocId?: string;
        figureManager: any;
        styleManager: any;
        figureState: any;
        eventManager: any;
        uiManager: any;
        performance: any;
        memory: any;
    } {
        return {
            isInitialized: this.isInitialized,
            currentDocId: this.currentDocId,
            figureManager: this.figureManager.getCacheStats(),
            styleManager: this.styleManager.getStyleStats(),
            figureState: this.figureState.getStats(),
            eventManager: this.eventManager.getStats(),
            uiManager: this.config.enableUI ? this.uiManager.getStats() : null,
            performance: this.performanceMonitor.getStats(),
            memory: this.memoryManager.getCurrentMemoryStats()
        };
    }

    /**
     * 获取性能报告
     * @returns 性能报告
     */
    getPerformanceReport() {
        return this.performanceMonitor.exportReport();
    }

    /**
     * 获取内存报告
     * @returns 内存报告
     */
    getMemoryReport() {
        return this.memoryManager.exportReport();
    }

    /**
     * 执行性能优化
     */
    async optimizePerformance(): Promise<void> {
        console.log('CrossReferenceController: 开始性能优化...');

        // 清理过期缓存
        await this.figureManager.clearCache();

        // 执行内存清理
        await this.memoryManager.performCleanup();

        // 清理性能指标（保留最近的）
        this.performanceMonitor.clearMetrics();

        console.log('CrossReferenceController: 性能优化完成');
    }

    /**
     * 检查系统健康状态
     * @returns 健康状态报告
     */
    checkSystemHealth(): {
        isHealthy: boolean;
        warnings: string[];
        recommendations: string[];
    } {
        const warnings: string[] = [];
        const recommendations: string[] = [];

        // 检查性能警告
        const performanceWarnings = this.performanceMonitor.checkPerformanceWarnings();
        warnings.push(...performanceWarnings);

        // 检查内存警告
        const memoryWarnings = this.memoryManager.checkMemoryWarnings();
        warnings.push(...memoryWarnings);

        // 生成建议
        if (performanceWarnings.length > 0) {
            recommendations.push('考虑执行性能优化');
        }

        if (memoryWarnings.length > 0) {
            recommendations.push('考虑执行内存清理');
        }

        const stats = this.getStats();
        if (stats.figureState.totalDocuments > 10) {
            recommendations.push('考虑清理不活跃文档的状态');
        }

        return {
            isHealthy: warnings.length === 0,
            warnings,
            recommendations
        };
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 文档切换事件
        this.eventManager.on('document:switch', async (data: any) => {
            const docId = data?.docId || data?.protyle?.block?.rootID;
            if (docId && this.config.autoUpdate) {
                await this.handleDocumentSwitch(docId);
            }
        });

        // 文档加载事件
        this.eventManager.on('document:loaded', async (data: any) => {
            const docId = data?.docId || data?.protyle?.block?.rootID;
            if (docId && this.config.autoUpdate) {
                await this.handleDocumentSwitch(docId);
            }
        });

        // 图表操作事件
        this.eventManager.on('figure:operation', async (_data: any) => {
            if (this.currentDocId && this.config.autoUpdate) {
                // 延迟刷新，避免频繁更新
                setTimeout(async () => {
                    await this.refreshCurrentDocument();
                }, this.config.eventDelay * 2);
            }
        });

        // WebSocket transaction事件
        this.eventManager.on('websocket:transaction', async (transactions: any[]) => {
            if (this.currentDocId && this.config.autoUpdate) {
                // 检查是否涉及当前文档
                const affectsCurrentDoc = this.checkTransactionAffectsDocument(transactions, this.currentDocId);
                if (affectsCurrentDoc) {
                    // 延迟刷新
                    setTimeout(async () => {
                        await this.refreshCurrentDocument();
                    }, this.config.eventDelay * 3);
                }
            }
        });

        console.log('CrossReferenceController: 事件监听器已设置');
    }

    /**
     * 设置状态监听器
     */
    private setupStateListeners(): void {
        this.figureState.subscribe(async (docId: string, state: any, source: string) => {
            console.log(`CrossReferenceController: 状态变化 ${docId} (来源: ${source})`);
            
            // 如果是当前文档且启用UI，更新UI状态
            if (docId === this.currentDocId && this.config.enableUI) {
                if (state.loading) {
                    await this.uiManager.setLoading(true);
                } else if (state.error) {
                    await this.uiManager.setError(state.error);
                } else {
                    await this.uiManager.setFigures(docId, state.figures);
                }
            }
        });

        console.log('CrossReferenceController: 状态监听器已设置');
    }

    /**
     * 检查transaction是否影响指定文档
     * @param transactions transaction数组
     * @param docId 文档ID
     * @returns 是否影响
     */
    private checkTransactionAffectsDocument(transactions: any[], docId: string): boolean {
        if (!Array.isArray(transactions) || !docId) {
            return false;
        }

        for (const transaction of transactions) {
            if (!transaction || !transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                continue;
            }

            for (const operation of transaction.doOperations) {
                if (!operation) {
                    continue;
                }

                // 检查操作ID
                if (operation.id === docId) {
                    return true;
                }

                // 检查操作数据（确保是字符串类型）
                if (operation.data && typeof operation.data === 'string' && operation.data.includes(docId)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    updateConfig(config: Partial<ICrossReferenceConfig>): void {
        this.config = { ...this.config, ...config };
        
        // 更新子组件配置
        this.eventManager.updateConfig({
            eventDelay: this.config.eventDelay
        });

        if (this.config.enableUI) {
            this.uiManager.updateConfig({
                autoUpdate: this.config.autoUpdate
            });
        }

        console.log('CrossReferenceController: 配置已更新');
    }

    /**
     * 设置内存监控
     */
    private setupMemoryMonitoring(): void {
        // 注册各组件的内存监控
        this.memoryManager.registerComponent('figureManager', () => {
            const stats = this.figureManager.getCacheStats();
            return stats.totalSize || 0;
        });

        this.memoryManager.registerComponent('styleManager', () => {
            const stats = this.styleManager.getStyleStats();
            return stats.memoryUsage || 0;
        });

        this.memoryManager.registerComponent('figureState', () => {
            const stats = this.figureState.getStats();
            return stats.memoryUsage || 0;
        });

        this.memoryManager.registerComponent('eventManager', () => {
            const stats = this.eventManager.getStats();
            return JSON.stringify(stats).length * 2; // 估算
        });

        if (this.config.enableUI) {
            this.memoryManager.registerComponent('uiManager', () => {
                const stats = this.uiManager.getStats();
                return JSON.stringify(stats).length * 2; // 估算
            });
        }

        // 注册清理任务
        this.memoryManager.registerCleanupTask('clearExpiredCache', () => {
            this.figureManager.clearCache();
        });

        this.memoryManager.registerCleanupTask('optimizeStyles', () => {
            this.styleManager.optimizeMemory();
        });

        console.log('CrossReferenceController: 内存监控已设置');
    }

    /**
     * 销毁控制器
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            console.log('CrossReferenceController: 开始销毁...');

            // 清除当前文档的样式
            if (this.currentDocId) {
                await this.styleManager.clearCrossReferenceStyles(this.currentDocId);
            }

            // 销毁各个组件
            if (this.config.enableUI) {
                await this.uiManager.destroy();
            }

            await this.eventManager.destroy();
            await this.figureState.destroy();
            await this.styleManager.destroy();
            this.figureManager.destroy();

            // 销毁性能监控和内存管理
            this.performanceMonitor.destroy();
            this.memoryManager.destroy();

            this.isInitialized = false;
            this.currentDocId = undefined;

            console.log('CrossReferenceController: 销毁完成');

        } catch (error) {
            console.error('CrossReferenceController: 销毁失败:', error);
            throw error;
        }
    }
}
