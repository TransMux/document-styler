/**
 * 图表状态管理器 - 统一的状态管理中心
 * 负责图表数据的状态存储、更新通知和一致性维护
 */

import { IFigureInfo } from '../../types';
import { StateCache } from './StateCache';
import { StateValidator } from './StateValidator';
import { StateNotifier } from './StateNotifier';

export interface IFigureState {
    /** 文档ID */
    docId: string;
    /** 图表数据 */
    figures: IFigureInfo[];
    /** 最后更新时间 */
    lastUpdated: number;
    /** 状态版本 */
    version: number;
    /** 是否正在加载 */
    loading: boolean;
    /** 错误信息 */
    error?: string;
}

export interface IStateUpdateOptions {
    /** 是否触发通知 */
    notify?: boolean;
    /** 是否验证数据 */
    validate?: boolean;
    /** 是否强制更新 */
    force?: boolean;
    /** 更新来源 */
    source?: string;
}

export class FigureState {
    private states = new Map<string, IFigureState>();
    private cache: StateCache;
    private validator: StateValidator;
    private notifier: StateNotifier;
    private globalVersion = 0;

    constructor() {
        this.cache = new StateCache();
        this.validator = new StateValidator();
        this.notifier = new StateNotifier();
    }

    /**
     * 获取文档的图表状态
     * @param docId 文档ID
     * @returns 图表状态
     */
    getState(docId: string): IFigureState | null {
        if (!docId) {
            return null;
        }

        return this.states.get(docId) || null;
    }

    /**
     * 设置文档的图表状态
     * @param docId 文档ID
     * @param figures 图表数据
     * @param options 更新选项
     */
    async setState(
        docId: string, 
        figures: IFigureInfo[], 
        options: IStateUpdateOptions = {}
    ): Promise<void> {
        if (!docId) {
            throw new Error('文档ID不能为空');
        }

        const {
            notify = true,
            validate = true,
            force = false,
            source = 'unknown'
        } = options;

        try {
            // 验证数据
            if (validate) {
                const validation = this.validator.validateFigures(figures);
                if (!validation.isValid) {
                    throw new Error(`图表数据验证失败: ${validation.errors.join(', ')}`);
                }
            }

            // 检查是否需要更新
            const currentState = this.states.get(docId);
            if (!force && currentState && this.isSameData(currentState.figures, figures)) {
                console.log(`FigureState: 文档 ${docId} 的数据未变化，跳过更新`);
                return;
            }

            // 创建新状态
            const newState: IFigureState = {
                docId,
                figures: [...figures], // 创建副本
                lastUpdated: Date.now(),
                version: this.generateVersion(),
                loading: false,
                error: undefined
            };

            // 更新状态
            this.states.set(docId, newState);

            // 缓存状态
            await this.cache.set(docId, newState);

            // 发送通知
            if (notify) {
                await this.notifier.notifyStateChanged(docId, newState, source);
            }

            console.log(`FigureState: 更新文档 ${docId} 的状态，包含 ${figures.length} 个图表`);

        } catch (error) {
            console.error(`FigureState: 设置文档 ${docId} 的状态失败:`, error);
            
            // 设置错误状态
            await this.setErrorState(docId, error as Error, options);
            throw error;
        }
    }

    /**
     * 设置加载状态
     * @param docId 文档ID
     * @param loading 是否正在加载
     */
    async setLoadingState(docId: string, loading: boolean): Promise<void> {
        if (!docId) {
            return;
        }

        const currentState = this.states.get(docId);
        const newState: IFigureState = {
            docId,
            figures: currentState?.figures || [],
            lastUpdated: Date.now(),
            version: currentState?.version || this.generateVersion(),
            loading,
            error: loading ? undefined : currentState?.error
        };

        this.states.set(docId, newState);
        await this.notifier.notifyStateChanged(docId, newState, 'loading');
    }

    /**
     * 设置错误状态
     * @param docId 文档ID
     * @param error 错误信息
     * @param options 更新选项
     */
    async setErrorState(
        docId: string, 
        error: Error, 
        options: IStateUpdateOptions = {}
    ): Promise<void> {
        if (!docId) {
            return;
        }

        const currentState = this.states.get(docId);
        const newState: IFigureState = {
            docId,
            figures: currentState?.figures || [],
            lastUpdated: Date.now(),
            version: currentState?.version || this.generateVersion(),
            loading: false,
            error: error.message
        };

        this.states.set(docId, newState);

        if (options.notify !== false) {
            await this.notifier.notifyStateChanged(docId, newState, 'error');
        }
    }

    /**
     * 清除文档状态
     * @param docId 文档ID
     */
    async clearState(docId: string): Promise<void> {
        if (!docId) {
            return;
        }

        this.states.delete(docId);
        await this.cache.clear(docId);
        await this.notifier.notifyStateCleared(docId);

        console.log(`FigureState: 清除文档 ${docId} 的状态`);
    }

    /**
     * 获取所有状态
     * @returns 状态映射
     */
    getAllStates(): Map<string, IFigureState> {
        return new Map(this.states);
    }

    /**
     * 获取状态统计信息
     * @returns 统计信息
     */
    getStats(): {
        totalDocuments: number;
        totalFigures: number;
        loadingDocuments: number;
        errorDocuments: number;
        memoryUsage: number;
    } {
        let totalFigures = 0;
        let loadingDocuments = 0;
        let errorDocuments = 0;

        for (const state of this.states.values()) {
            totalFigures += state.figures.length;
            if (state.loading) loadingDocuments++;
            if (state.error) errorDocuments++;
        }

        return {
            totalDocuments: this.states.size,
            totalFigures,
            loadingDocuments,
            errorDocuments,
            memoryUsage: this.calculateMemoryUsage()
        };
    }

    /**
     * 订阅状态变化
     * @param callback 回调函数
     * @returns 取消订阅函数
     */
    subscribe(callback: (docId: string, state: IFigureState, source: string) => void): () => void {
        return this.notifier.subscribe(callback);
    }

    /**
     * 验证状态一致性
     * @returns 验证结果
     */
    validateConsistency(): {
        isConsistent: boolean;
        issues: string[];
    } {
        const result = {
            isConsistent: true,
            issues: [] as string[]
        };

        for (const [docId, state] of this.states.entries()) {
            // 验证状态结构
            if (!state.docId || state.docId !== docId) {
                result.isConsistent = false;
                result.issues.push(`文档 ${docId} 的状态ID不匹配`);
            }

            if (!Array.isArray(state.figures)) {
                result.isConsistent = false;
                result.issues.push(`文档 ${docId} 的图表数据不是数组`);
            }

            if (typeof state.version !== 'number' || state.version <= 0) {
                result.isConsistent = false;
                result.issues.push(`文档 ${docId} 的版本号无效`);
            }

            // 验证图表数据
            const figureValidation = this.validator.validateFigures(state.figures);
            if (!figureValidation.isValid) {
                result.isConsistent = false;
                result.issues.push(`文档 ${docId} 的图表数据无效: ${figureValidation.errors.join(', ')}`);
            }
        }

        return result;
    }

    /**
     * 比较两个图表数据数组是否相同
     * @param figures1 图表数据1
     * @param figures2 图表数据2
     * @returns 是否相同
     */
    private isSameData(figures1: IFigureInfo[], figures2: IFigureInfo[]): boolean {
        if (figures1.length !== figures2.length) {
            return false;
        }

        for (let i = 0; i < figures1.length; i++) {
            const f1 = figures1[i];
            const f2 = figures2[i];

            if (f1.id !== f2.id || 
                f1.type !== f2.type || 
                f1.content !== f2.content || 
                f1.caption !== f2.caption ||
                f1.number !== f2.number) {
                return false;
            }
        }

        return true;
    }

    /**
     * 生成版本号
     * @returns 版本号
     */
    private generateVersion(): number {
        return ++this.globalVersion;
    }

    /**
     * 计算内存使用量（估算）
     * @returns 内存使用量（字节）
     */
    private calculateMemoryUsage(): number {
        let size = 0;

        for (const [docId, state] of this.states.entries()) {
            size += docId.length * 2; // 字符串大小（UTF-16）
            size += JSON.stringify(state).length * 2;
        }

        size += this.cache.getMemoryUsage();
        return size;
    }

    /**
     * 清理过期状态
     * @param maxAge 最大年龄（毫秒）
     */
    cleanupExpiredStates(maxAge: number = 30 * 60 * 1000): void {
        const now = Date.now();
        const expiredDocs: string[] = [];

        for (const [docId, state] of this.states.entries()) {
            if (now - state.lastUpdated > maxAge) {
                expiredDocs.push(docId);
            }
        }

        for (const docId of expiredDocs) {
            this.clearState(docId);
        }

        if (expiredDocs.length > 0) {
            console.log(`FigureState: 清理了 ${expiredDocs.length} 个过期状态`);
        }
    }

    /**
     * 销毁状态管理器
     */
    async destroy(): Promise<void> {
        try {
            // 清除所有状态
            const docIds = Array.from(this.states.keys());
            for (const docId of docIds) {
                await this.clearState(docId);
            }

            // 销毁子组件
            this.cache.destroy();
            this.notifier.destroy();

            console.log('FigureState: 销毁完成');

        } catch (error) {
            console.error('FigureState: 销毁失败:', error);
        }
    }
}
