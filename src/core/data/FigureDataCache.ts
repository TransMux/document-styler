/**
 * 图表数据缓存管理器
 * 负责图表数据的缓存存储、过期管理和性能优化
 */

import { IFigureInfo } from '../../types';

interface ICacheEntry {
    data: IFigureInfo[];
    timestamp: number;
    expiry: number;
}

interface ICacheStats {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
}

export class FigureDataCache {
    private cache = new Map<string, ICacheEntry>();
    private defaultExpiry = 60 * 1000; // 60秒（最大缓存时间）
    private maxEntries = 100; // 最大缓存条目数
    private hits = 0;
    private misses = 0;

    /**
     * 获取缓存数据
     * @param docId 文档ID
     * @returns 缓存的图表数据，如果不存在或已过期则返回null
     */
    async get(docId: string): Promise<IFigureInfo[] | null> {
        const entry = this.cache.get(docId);
        
        if (!entry) {
            this.misses++;
            return null;
        }

        // 检查是否过期
        if (Date.now() > entry.expiry) {
            this.cache.delete(docId);
            this.misses++;
            return null;
        }

        this.hits++;
        return [...entry.data]; // 返回副本，防止外部修改
    }

    /**
     * 设置缓存数据
     * @param docId 文档ID
     * @param data 图表数据
     * @param expiry 过期时间（毫秒），不传则使用默认值
     */
    async set(docId: string, data: IFigureInfo[], expiry?: number): Promise<void> {
        // 检查缓存大小限制
        if (this.cache.size >= this.maxEntries) {
            this.evictOldest();
        }

        const expiryTime = expiry || this.defaultExpiry;
        const entry: ICacheEntry = {
            data: [...data], // 存储副本，防止外部修改
            timestamp: Date.now(),
            expiry: Date.now() + expiryTime
        };

        this.cache.set(docId, entry);
        console.log(`FigureDataCache: 缓存文档 ${docId} 的 ${data.length} 个图表数据`);
    }

    /**
     * 清除缓存
     * @param docId 文档ID，不传则清除所有缓存
     */
    async clear(docId?: string): Promise<void> {
        if (docId) {
            this.cache.delete(docId);
            console.log(`FigureDataCache: 清除文档 ${docId} 的缓存`);
        } else {
            this.cache.clear();
            this.hits = 0;
            this.misses = 0;
            console.log('FigureDataCache: 清除所有缓存');
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

        // 检查是否过期
        if (Date.now() > entry.expiry) {
            this.cache.delete(docId);
            return false;
        }

        return true;
    }

    /**
     * 获取缓存统计信息
     */
    getStats(): ICacheStats {
        const totalRequests = this.hits + this.misses;
        return {
            totalEntries: this.cache.size,
            totalSize: this.calculateTotalSize(),
            hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
            missRate: totalRequests > 0 ? this.misses / totalRequests : 0
        };
    }

    /**
     * 清理过期缓存
     */
    cleanupExpired(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
        }

        if (expiredKeys.length > 0) {
            console.log(`FigureDataCache: 清理了 ${expiredKeys.length} 个过期缓存条目`);
        }
    }

    /**
     * 驱逐最旧的缓存条目
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            console.log(`FigureDataCache: 驱逐最旧的缓存条目 ${oldestKey}`);
        }
    }

    /**
     * 计算缓存总大小（估算）
     */
    private calculateTotalSize(): number {
        let size = 0;
        for (const entry of this.cache.values()) {
            size += JSON.stringify(entry.data).length;
        }
        return size;
    }

    /**
     * 设置缓存配置
     */
    setConfig(config: {
        defaultExpiry?: number;
        maxEntries?: number;
    }): void {
        if (config.defaultExpiry !== undefined) {
            this.defaultExpiry = config.defaultExpiry;
        }
        if (config.maxEntries !== undefined) {
            this.maxEntries = config.maxEntries;
        }
    }

    /**
     * 销毁缓存
     */
    destroy(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
}
