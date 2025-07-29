/**
 * 性能监控器
 * 负责监控和优化交叉引用系统的性能
 */

export interface IPerformanceMetrics {
    /** 操作名称 */
    operation: string;
    /** 开始时间 */
    startTime: number;
    /** 结束时间 */
    endTime: number;
    /** 持续时间（毫秒） */
    duration: number;
    /** 内存使用量（字节） */
    memoryUsage?: number;
    /** 额外数据 */
    metadata?: Record<string, any>;
}

export class PerformanceMonitor {
    private metrics: IPerformanceMetrics[] = [];
    private activeOperations = new Map<string, number>();
    private maxMetricsCount = 1000; // 最大保存的指标数量

    /**
     * 开始监控操作
     * @param operation 操作名称
     * @param metadata 额外数据
     * @returns 操作ID
     */
    startOperation(operation: string, metadata?: Record<string, any>): string {
        const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.activeOperations.set(operationId, performance.now());
        
        console.log(`PerformanceMonitor: 开始监控操作 ${operation} (ID: ${operationId})`);
        return operationId;
    }

    /**
     * 结束监控操作
     * @param operationId 操作ID
     * @param metadata 额外数据
     */
    endOperation(operationId: string, metadata?: Record<string, any>): IPerformanceMetrics | null {
        const startTime = this.activeOperations.get(operationId);
        if (!startTime) {
            console.warn(`PerformanceMonitor: 找不到操作 ${operationId}`);
            return null;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const operation = operationId.split('-')[0];

        const metric: IPerformanceMetrics = {
            operation,
            startTime,
            endTime,
            duration,
            memoryUsage: this.getMemoryUsage(),
            metadata
        };

        // 添加到指标列表
        this.metrics.push(metric);
        
        // 清理活跃操作
        this.activeOperations.delete(operationId);

        // 限制指标数量
        if (this.metrics.length > this.maxMetricsCount) {
            this.metrics.shift();
        }

        console.log(`PerformanceMonitor: 操作 ${operation} 完成，耗时 ${duration.toFixed(2)}ms`);
        return metric;
    }

    /**
     * 测量函数执行时间
     * @param operation 操作名称
     * @param fn 要测量的函数
     * @param metadata 额外数据
     * @returns 函数执行结果和性能指标
     */
    async measureAsync<T>(
        operation: string, 
        fn: () => Promise<T>, 
        metadata?: Record<string, any>
    ): Promise<{ result: T; metric: IPerformanceMetrics }> {
        const operationId = this.startOperation(operation, metadata);
        
        try {
            const result = await fn();
            const metric = this.endOperation(operationId, metadata)!;
            return { result, metric };
        } catch (error) {
            this.endOperation(operationId, { ...metadata, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * 测量同步函数执行时间
     * @param operation 操作名称
     * @param fn 要测量的函数
     * @param metadata 额外数据
     * @returns 函数执行结果和性能指标
     */
    measureSync<T>(
        operation: string, 
        fn: () => T, 
        metadata?: Record<string, any>
    ): { result: T; metric: IPerformanceMetrics } {
        const operationId = this.startOperation(operation, metadata);
        
        try {
            const result = fn();
            const metric = this.endOperation(operationId, metadata)!;
            return { result, metric };
        } catch (error) {
            this.endOperation(operationId, { ...metadata, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * 获取性能统计信息
     * @param operation 操作名称，不传则返回所有操作的统计
     * @returns 统计信息
     */
    getStats(operation?: string): {
        totalOperations: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
        totalDuration: number;
        averageMemoryUsage: number;
        operationCounts: Record<string, number>;
    } {
        const filteredMetrics = operation 
            ? this.metrics.filter(m => m.operation === operation)
            : this.metrics;

        if (filteredMetrics.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                totalDuration: 0,
                averageMemoryUsage: 0,
                operationCounts: {}
            };
        }

        const durations = filteredMetrics.map(m => m.duration);
        const memoryUsages = filteredMetrics.map(m => m.memoryUsage || 0).filter(m => m > 0);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);

        // 统计各操作的数量
        const operationCounts: Record<string, number> = {};
        for (const metric of filteredMetrics) {
            operationCounts[metric.operation] = (operationCounts[metric.operation] || 0) + 1;
        }

        return {
            totalOperations: filteredMetrics.length,
            averageDuration: totalDuration / filteredMetrics.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            totalDuration,
            averageMemoryUsage: memoryUsages.length > 0 ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length : 0,
            operationCounts
        };
    }

    /**
     * 获取慢操作列表
     * @param threshold 阈值（毫秒）
     * @returns 慢操作列表
     */
    getSlowOperations(threshold: number = 100): IPerformanceMetrics[] {
        return this.metrics.filter(m => m.duration > threshold);
    }

    /**
     * 获取最近的操作
     * @param count 数量
     * @returns 最近的操作列表
     */
    getRecentOperations(count: number = 10): IPerformanceMetrics[] {
        return this.metrics.slice(-count);
    }

    /**
     * 获取内存使用量
     * @returns 内存使用量（字节）
     */
    private getMemoryUsage(): number {
        if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
    }

    /**
     * 清除指标数据
     * @param operation 操作名称，不传则清除所有
     */
    clearMetrics(operation?: string): void {
        if (operation) {
            this.metrics = this.metrics.filter(m => m.operation !== operation);
            console.log(`PerformanceMonitor: 清除操作 ${operation} 的指标数据`);
        } else {
            this.metrics.length = 0;
            console.log('PerformanceMonitor: 清除所有指标数据');
        }
    }

    /**
     * 导出性能报告
     * @returns 性能报告
     */
    exportReport(): {
        summary: ReturnType<typeof this.getStats>;
        slowOperations: IPerformanceMetrics[];
        recentOperations: IPerformanceMetrics[];
        activeOperations: string[];
        timestamp: number;
    } {
        return {
            summary: this.getStats(),
            slowOperations: this.getSlowOperations(),
            recentOperations: this.getRecentOperations(),
            activeOperations: Array.from(this.activeOperations.keys()),
            timestamp: Date.now()
        };
    }

    /**
     * 设置配置
     * @param config 配置选项
     */
    setConfig(config: {
        maxMetricsCount?: number;
    }): void {
        if (config.maxMetricsCount !== undefined) {
            this.maxMetricsCount = config.maxMetricsCount;
        }
    }

    /**
     * 检查性能警告
     * @returns 警告列表
     */
    checkPerformanceWarnings(): string[] {
        const warnings: string[] = [];
        const stats = this.getStats();

        // 检查平均执行时间
        if (stats.averageDuration > 50) {
            warnings.push(`平均执行时间过长: ${stats.averageDuration.toFixed(2)}ms`);
        }

        // 检查最大执行时间
        if (stats.maxDuration > 200) {
            warnings.push(`存在执行时间过长的操作: ${stats.maxDuration.toFixed(2)}ms`);
        }

        // 检查活跃操作数量
        if (this.activeOperations.size > 10) {
            warnings.push(`活跃操作过多: ${this.activeOperations.size}`);
        }

        // 检查内存使用
        if (stats.averageMemoryUsage > 50 * 1024 * 1024) { // 50MB
            warnings.push(`平均内存使用过高: ${(stats.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }

        return warnings;
    }

    /**
     * 销毁性能监控器
     */
    destroy(): void {
        this.clearMetrics();
        this.activeOperations.clear();
        console.log('PerformanceMonitor: 销毁完成');
    }
}
