/**
 * 状态缓存管理器
 * 负责状态数据的持久化缓存和快速访问
 */

import { IFigureState } from './FigureState';

interface ICacheEntry {
    state: IFigureState;
    timestamp: number;
    accessCount: number;
    lastAccess: number;
}

export class StateCache {
    private cache = new Map<string, ICacheEntry>();
    private maxEntries = 50; // 最大缓存条目数
    private defaultExpiry = 10 * 60 * 1000; // 10分钟
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // 启动定期清理
        this.startCleanupTimer();
    }

    /**
     * 获取缓存的状态
     * @param docId 文档ID
     * @returns 缓存的状态，如果不存在或已过期则返回null
     */
    async get(docId: string): Promise<IFigureState | null> {
        const entry = this.cache.get(docId);
        
        if (!entry) {
            return null;
        }

        // 检查是否过期
        if (this.isExpired(entry)) {
            this.cache.delete(docId);
            return null;
        }

        // 更新访问信息
        entry.accessCount++;
        entry.lastAccess = Date.now();

        return { ...entry.state }; // 返回副本
    }

    /**
     * 设置状态缓存
     * @param docId 文档ID
     * @param state 状态数据
     */
    async set(docId: string, state: IFigureState): Promise<void> {
        // 检查缓存大小限制
        if (this.cache.size >= this.maxEntries) {
            this.evictLeastUsed();
        }

        const entry: ICacheEntry = {
            state: { ...state }, // 存储副本
            timestamp: Date.now(),
            accessCount: 1,
            lastAccess: Date.now()
        };

        this.cache.set(docId, entry);
        console.log(`StateCache: 缓存文档 ${docId} 的状态`);
    }

    /**
     * 清除缓存
     * @param docId 文档ID，不传则清除所有缓存
     */
    async clear(docId?: string): Promise<void> {
        if (docId) {
            this.cache.delete(docId);
            console.log(`StateCache: 清除文档 ${docId} 的缓存`);
        } else {
            this.cache.clear();
            console.log('StateCache: 清除所有缓存');
        }
    }

    /**
     * 检查缓存是否存在且有效
     * @param docId 文档ID
     * @returns 是否存在有效缓存
     */
    has(docId: string): boolean {
        const entry = this.cache.get(docId);
        if (!entry) {
            return false;
        }

        if (this.isExpired(entry)) {
            this.cache.delete(docId);
            return false;
        }

        return true;
    }

    /**
     * 获取缓存统计信息
     * @returns 统计信息
     */
    getStats(): {
        totalEntries: number;
        memoryUsage: number;
        hitRate: number;
        averageAccessCount: number;
    } {
        let totalAccess = 0;
        let totalHits = 0;

        for (const entry of this.cache.values()) {
            totalAccess += entry.accessCount;
            if (entry.accessCount > 1) {
                totalHits += entry.accessCount - 1;
            }
        }

        return {
            totalEntries: this.cache.size,
            memoryUsage: this.getMemoryUsage(),
            hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
            averageAccessCount: this.cache.size > 0 ? totalAccess / this.cache.size : 0
        };
    }

    /**
     * 检查条目是否过期
     * @param entry 缓存条目
     * @returns 是否过期
     */
    private isExpired(entry: ICacheEntry): boolean {
        return Date.now() - entry.timestamp > this.defaultExpiry;
    }

    /**
     * 驱逐最少使用的条目
     */
    private evictLeastUsed(): void {
        let leastUsedKey: string | null = null;
        let leastUsedScore = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            // 计算使用分数（访问次数 / 时间因子）
            const timeFactor = (Date.now() - entry.lastAccess) / 1000; // 秒
            const score = entry.accessCount / (1 + timeFactor);

            if (score < leastUsedScore) {
                leastUsedScore = score;
                leastUsedKey = key;
            }
        }

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            console.log(`StateCache: 驱逐最少使用的缓存条目 ${leastUsedKey}`);
        }
    }

    /**
     * 清理过期条目
     */
    private cleanupExpired(): void {
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
        }

        if (expiredKeys.length > 0) {
            console.log(`StateCache: 清理了 ${expiredKeys.length} 个过期缓存条目`);
        }
    }

    /**
     * 启动清理定时器
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired();
        }, 5 * 60 * 1000); // 每5分钟清理一次
    }

    /**
     * 停止清理定时器
     */
    private stopCleanupTimer(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * 获取内存使用量（估算）
     * @returns 内存使用量（字节）
     */
    getMemoryUsage(): number {
        let size = 0;

        for (const [key, entry] of this.cache.entries()) {
            size += key.length * 2; // 字符串大小（UTF-16）
            size += JSON.stringify(entry.state).length * 2;
            size += 64; // 条目元数据的估算大小
        }

        return size;
    }

    /**
     * 设置缓存配置
     * @param config 配置选项
     */
    setConfig(config: {
        maxEntries?: number;
        defaultExpiry?: number;
    }): void {
        if (config.maxEntries !== undefined) {
            this.maxEntries = config.maxEntries;
        }
        if (config.defaultExpiry !== undefined) {
            this.defaultExpiry = config.defaultExpiry;
        }
    }

    /**
     * 预热缓存
     * @param states 状态数据映射
     */
    async warmup(states: Map<string, IFigureState>): Promise<void> {
        for (const [docId, state] of states.entries()) {
            await this.set(docId, state);
        }
        console.log(`StateCache: 预热了 ${states.size} 个状态`);
    }

    /**
     * 导出缓存数据
     * @returns 缓存数据映射
     */
    export(): Map<string, IFigureState> {
        const exported = new Map<string, IFigureState>();

        for (const [docId, entry] of this.cache.entries()) {
            if (!this.isExpired(entry)) {
                exported.set(docId, { ...entry.state });
            }
        }

        return exported;
    }

    /**
     * 销毁缓存
     */
    destroy(): void {
        this.stopCleanupTimer();
        this.cache.clear();
        console.log('StateCache: 销毁完成');
    }
}
