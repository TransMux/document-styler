/**
 * 内存管理器
 * 负责监控和优化内存使用，防止内存泄漏
 */

export interface IMemoryStats {
    /** 总内存使用量（字节） */
    totalMemory: number;
    /** 各组件内存使用量 */
    componentMemory: Record<string, number>;
    /** 缓存内存使用量 */
    cacheMemory: number;
    /** 事件监听器数量 */
    eventListeners: number;
    /** DOM元素数量 */
    domElements: number;
    /** 最后更新时间 */
    lastUpdated: number;
}

export class MemoryManager {
    private componentRegistry = new Map<string, () => number>();
    private cleanupTasks = new Map<string, () => void>();
    private monitoringInterval: NodeJS.Timeout | null = null;
    private memoryHistory: IMemoryStats[] = [];
    private maxHistoryLength = 100;
    private warningThreshold = 100 * 1024 * 1024; // 100MB

    constructor() {
        this.startMonitoring();
    }

    /**
     * 注册组件内存监控
     * @param componentName 组件名称
     * @param getMemoryUsage 获取内存使用量的函数
     */
    registerComponent(componentName: string, getMemoryUsage: () => number): void {
        this.componentRegistry.set(componentName, getMemoryUsage);
        console.log(`MemoryManager: 注册组件 ${componentName}`);
    }

    /**
     * 注销组件内存监控
     * @param componentName 组件名称
     */
    unregisterComponent(componentName: string): void {
        this.componentRegistry.delete(componentName);
        console.log(`MemoryManager: 注销组件 ${componentName}`);
    }

    /**
     * 注册清理任务
     * @param taskName 任务名称
     * @param cleanupFn 清理函数
     */
    registerCleanupTask(taskName: string, cleanupFn: () => void): void {
        this.cleanupTasks.set(taskName, cleanupFn);
        console.log(`MemoryManager: 注册清理任务 ${taskName}`);
    }

    /**
     * 注销清理任务
     * @param taskName 任务名称
     */
    unregisterCleanupTask(taskName: string): void {
        this.cleanupTasks.delete(taskName);
        console.log(`MemoryManager: 注销清理任务 ${taskName}`);
    }

    /**
     * 获取当前内存统计
     * @returns 内存统计信息
     */
    getCurrentMemoryStats(): IMemoryStats {
        const componentMemory: Record<string, number> = {};
        let totalComponentMemory = 0;

        // 收集各组件内存使用量
        for (const [name, getMemoryUsage] of this.componentRegistry.entries()) {
            try {
                const usage = getMemoryUsage();
                componentMemory[name] = usage;
                totalComponentMemory += usage;
            } catch (error) {
                console.error(`MemoryManager: 获取组件 ${name} 内存使用量失败:`, error);
                componentMemory[name] = 0;
            }
        }

        // 获取系统内存信息
        const systemMemory = this.getSystemMemoryUsage();
        
        // 计算缓存内存（估算）
        const cacheMemory = this.estimateCacheMemory();

        // 统计事件监听器
        const eventListeners = this.countEventListeners();

        // 统计DOM元素
        const domElements = this.countDOMElements();

        const stats: IMemoryStats = {
            totalMemory: systemMemory + totalComponentMemory,
            componentMemory,
            cacheMemory,
            eventListeners,
            domElements,
            lastUpdated: Date.now()
        };

        return stats;
    }

    /**
     * 执行内存清理
     * @param force 是否强制清理
     */
    async performCleanup(force: boolean = false): Promise<void> {
        console.log('MemoryManager: 开始内存清理...');

        const beforeStats = this.getCurrentMemoryStats();

        // 执行注册的清理任务
        for (const [taskName, cleanupFn] of this.cleanupTasks.entries()) {
            try {
                cleanupFn();
                console.log(`MemoryManager: 执行清理任务 ${taskName}`);
            } catch (error) {
                console.error(`MemoryManager: 清理任务 ${taskName} 执行失败:`, error);
            }
        }

        // 清理过期的内存历史记录
        this.cleanupMemoryHistory();

        // 强制垃圾回收（如果可用）
        if (force && 'gc' in window && typeof (window as any).gc === 'function') {
            try {
                (window as any).gc();
                console.log('MemoryManager: 执行强制垃圾回收');
            } catch (error) {
                console.warn('MemoryManager: 强制垃圾回收失败:', error);
            }
        }

        const afterStats = this.getCurrentMemoryStats();
        const memoryFreed = beforeStats.totalMemory - afterStats.totalMemory;

        console.log(`MemoryManager: 内存清理完成，释放了 ${this.formatBytes(memoryFreed)}`);
    }

    /**
     * 检查内存警告
     * @returns 警告列表
     */
    checkMemoryWarnings(): string[] {
        const warnings: string[] = [];
        const stats = this.getCurrentMemoryStats();

        // 检查总内存使用量
        if (stats.totalMemory > this.warningThreshold) {
            warnings.push(`总内存使用量过高: ${this.formatBytes(stats.totalMemory)}`);
        }

        // 检查各组件内存使用量
        for (const [component, usage] of Object.entries(stats.componentMemory)) {
            if (usage > this.warningThreshold / 10) { // 10MB per component
                warnings.push(`组件 ${component} 内存使用量过高: ${this.formatBytes(usage)}`);
            }
        }

        // 检查缓存内存
        if (stats.cacheMemory > this.warningThreshold / 5) { // 20MB for cache
            warnings.push(`缓存内存使用量过高: ${this.formatBytes(stats.cacheMemory)}`);
        }

        // 检查事件监听器数量
        if (stats.eventListeners > 1000) {
            warnings.push(`事件监听器过多: ${stats.eventListeners}`);
        }

        // 检查DOM元素数量
        if (stats.domElements > 10000) {
            warnings.push(`DOM元素过多: ${stats.domElements}`);
        }

        return warnings;
    }

    /**
     * 获取内存使用趋势
     * @param minutes 分钟数
     * @returns 趋势数据
     */
    getMemoryTrend(minutes: number = 10): {
        trend: 'increasing' | 'decreasing' | 'stable';
        changeRate: number; // bytes per minute
        samples: IMemoryStats[];
    } {
        const cutoffTime = Date.now() - minutes * 60 * 1000;
        const recentStats = this.memoryHistory.filter(s => s.lastUpdated > cutoffTime);

        if (recentStats.length < 2) {
            return {
                trend: 'stable',
                changeRate: 0,
                samples: recentStats
            };
        }

        const firstSample = recentStats[0];
        const lastSample = recentStats[recentStats.length - 1];
        const timeDiff = (lastSample.lastUpdated - firstSample.lastUpdated) / 1000 / 60; // minutes
        const memoryDiff = lastSample.totalMemory - firstSample.totalMemory;
        const changeRate = timeDiff > 0 ? memoryDiff / timeDiff : 0;

        let trend: 'increasing' | 'decreasing' | 'stable';
        if (Math.abs(changeRate) < 1024 * 1024) { // Less than 1MB/min
            trend = 'stable';
        } else if (changeRate > 0) {
            trend = 'increasing';
        } else {
            trend = 'decreasing';
        }

        return {
            trend,
            changeRate,
            samples: recentStats
        };
    }

    /**
     * 开始内存监控
     */
    private startMonitoring(): void {
        if (this.monitoringInterval) {
            return;
        }

        this.monitoringInterval = setInterval(() => {
            const stats = this.getCurrentMemoryStats();
            this.memoryHistory.push(stats);

            // 限制历史记录长度
            if (this.memoryHistory.length > this.maxHistoryLength) {
                this.memoryHistory.shift();
            }

            // 检查警告
            const warnings = this.checkMemoryWarnings();
            if (warnings.length > 0) {
                console.warn('MemoryManager: 内存警告:', warnings);
                
                // 自动执行清理
                this.performCleanup();
            }

        }, 30000); // 每30秒检查一次

        console.log('MemoryManager: 开始内存监控');
    }

    /**
     * 停止内存监控
     */
    private stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('MemoryManager: 停止内存监控');
        }
    }

    /**
     * 获取系统内存使用量
     * @returns 内存使用量（字节）
     */
    private getSystemMemoryUsage(): number {
        if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize || 0;
        }
        return 0;
    }

    /**
     * 估算缓存内存使用量
     * @returns 缓存内存使用量（字节）
     */
    private estimateCacheMemory(): number {
        // 这是一个估算值，实际实现可能需要更精确的计算
        let cacheSize = 0;

        // 估算localStorage使用量
        try {
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    cacheSize += key.length + (localStorage[key]?.length || 0);
                }
            }
        } catch (error) {
            // 忽略localStorage访问错误
        }

        // 估算sessionStorage使用量
        try {
            for (const key in sessionStorage) {
                if (sessionStorage.hasOwnProperty(key)) {
                    cacheSize += key.length + (sessionStorage[key]?.length || 0);
                }
            }
        } catch (error) {
            // 忽略sessionStorage访问错误
        }

        return cacheSize * 2; // UTF-16编码，每个字符2字节
    }

    /**
     * 统计事件监听器数量
     * @returns 事件监听器数量
     */
    private countEventListeners(): number {
        // 这是一个估算值，实际实现可能需要更精确的统计
        const elements = document.querySelectorAll('*');
        let count = 0;

        for (const element of elements) {
            // 检查常见的事件属性
            const eventAttributes = ['onclick', 'onload', 'onchange', 'onsubmit'];
            for (const attr of eventAttributes) {
                if (element.hasAttribute(attr)) {
                    count++;
                }
            }
        }

        return count;
    }

    /**
     * 统计DOM元素数量
     * @returns DOM元素数量
     */
    private countDOMElements(): number {
        return document.querySelectorAll('*').length;
    }

    /**
     * 清理内存历史记录
     */
    private cleanupMemoryHistory(): void {
        const cutoffTime = Date.now() - 60 * 60 * 1000; // 保留1小时的历史
        this.memoryHistory = this.memoryHistory.filter(s => s.lastUpdated > cutoffTime);
    }

    /**
     * 格式化字节数
     * @param bytes 字节数
     * @returns 格式化后的字符串
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 设置配置
     * @param config 配置选项
     */
    setConfig(config: {
        warningThreshold?: number;
        maxHistoryLength?: number;
    }): void {
        if (config.warningThreshold !== undefined) {
            this.warningThreshold = config.warningThreshold;
        }
        if (config.maxHistoryLength !== undefined) {
            this.maxHistoryLength = config.maxHistoryLength;
        }
    }

    /**
     * 导出内存报告
     * @returns 内存报告
     */
    exportReport(): {
        currentStats: IMemoryStats;
        warnings: string[];
        trend: ReturnType<typeof this.getMemoryTrend>;
        history: IMemoryStats[];
    } {
        return {
            currentStats: this.getCurrentMemoryStats(),
            warnings: this.checkMemoryWarnings(),
            trend: this.getMemoryTrend(),
            history: [...this.memoryHistory]
        };
    }

    /**
     * 销毁内存管理器
     */
    destroy(): void {
        this.stopMonitoring();
        this.componentRegistry.clear();
        this.cleanupTasks.clear();
        this.memoryHistory.length = 0;
        console.log('MemoryManager: 销毁完成');
    }
}
