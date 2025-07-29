/**
 * API客户端 - 统一的API调用封装
 * 负责所有与后端API的交互，提供统一的错误处理和重试机制
 */

import { fetchPost } from 'siyuan';

export class APIClient {
    private requestCache = new Map<string, { data: any; timestamp: number }>();
    private cacheExpiry = 30 * 1000; // 30秒缓存

    /**
     * 获取文档的完整内容
     * @param docId 文档ID
     * @param useCache 是否使用缓存
     * @returns 文档HTML内容
     */
    async getDocumentContent(docId: string, useCache: boolean = true): Promise<string> {
        if (!docId) {
            throw new Error('文档ID不能为空');
        }

        const cacheKey = `doc_content_${docId}`;

        // 检查缓存
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`APIClient: 从缓存获取文档 ${docId} 的内容`);
                return cached;
            }
        }

        try {
            const content = await this.fetchDocumentContent(docId);
            
            // 缓存结果
            if (useCache) {
                this.setCache(cacheKey, content);
            }

            console.log(`APIClient: 获取文档 ${docId} 的内容成功，长度: ${content.length}`);
            return content;

        } catch (error) {
            console.error(`APIClient: 获取文档 ${docId} 的内容失败:`, error);
            throw error;
        }
    }

    /**
     * 获取文档标题
     * @param docId 文档ID
     * @param useCache 是否使用缓存
     * @returns 文档标题
     */
    async getDocumentTitle(docId: string, useCache: boolean = true): Promise<string> {
        if (!docId) {
            throw new Error('文档ID不能为空');
        }

        const cacheKey = `doc_title_${docId}`;

        // 检查缓存
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const title = await this.fetchDocumentTitle(docId);
            
            // 缓存结果
            if (useCache) {
                this.setCache(cacheKey, title);
            }

            return title;

        } catch (error) {
            console.error(`APIClient: 获取文档 ${docId} 的标题失败:`, error);
            throw error;
        }
    }

    /**
     * 获取块属性
     * @param blockId 块ID
     * @param useCache 是否使用缓存
     * @returns 块属性对象
     */
    async getBlockAttributes(blockId: string, useCache: boolean = true): Promise<Record<string, string>> {
        if (!blockId) {
            throw new Error('块ID不能为空');
        }

        const cacheKey = `block_attrs_${blockId}`;

        // 检查缓存
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const attrs = await this.fetchBlockAttributes(blockId);
            
            // 缓存结果
            if (useCache) {
                this.setCache(cacheKey, attrs);
            }

            return attrs;

        } catch (error) {
            console.error(`APIClient: 获取块 ${blockId} 的属性失败:`, error);
            throw error;
        }
    }

    /**
     * 设置块属性
     * @param blockId 块ID
     * @param attrs 属性对象
     */
    async setBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void> {
        if (!blockId) {
            throw new Error('块ID不能为空');
        }

        try {
            await this.updateBlockAttributes(blockId, attrs);
            
            // 清除相关缓存
            this.clearCache(`block_attrs_${blockId}`);

        } catch (error) {
            console.error(`APIClient: 设置块 ${blockId} 的属性失败:`, error);
            throw error;
        }
    }

    /**
     * 执行SQL查询
     * @param sql SQL语句
     * @returns 查询结果
     */
    async executeSQL(sql: string): Promise<any[]> {
        if (!sql) {
            throw new Error('SQL语句不能为空');
        }

        try {
            const result = await this.querySQL(sql);
            return result;

        } catch (error) {
            console.error('APIClient: SQL查询失败:', error);
            throw error;
        }
    }

    /**
     * 实际的文档内容获取
     */
    private async fetchDocumentContent(docId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/filetree/getDoc", {
                id: docId,
                mode: 3, // 上下都加载
                size: 2147483647, // 最大值，加载所有内容
                isBacklink: false
            }, (response) => {
                if (response.code === 0) {
                    resolve(response.data.content || "");
                } else {
                    reject(new Error(response.msg || "获取文档内容失败"));
                }
            });
        });
    }

    /**
     * 实际的文档标题获取
     */
    private async fetchDocumentTitle(docId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/block/getBlockBreadcrumb", {
                id: docId
            }, (response) => {
                if (response.code === 0 && response.data && response.data.length > 0) {
                    resolve(response.data[0].name || "");
                } else {
                    reject(new Error(response.msg || "获取文档标题失败"));
                }
            });
        });
    }

    /**
     * 实际的块属性获取
     */
    private async fetchBlockAttributes(blockId: string): Promise<Record<string, string>> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/attr/getBlockAttrs", {
                id: blockId
            }, (response) => {
                if (response.code === 0) {
                    resolve(response.data || {});
                } else {
                    reject(new Error(response.msg || "获取块属性失败"));
                }
            });
        });
    }

    /**
     * 实际的块属性更新
     */
    private async updateBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/attr/setBlockAttrs", {
                id: blockId,
                attrs: attrs
            }, (response) => {
                if (response.code === 0) {
                    resolve();
                } else {
                    reject(new Error(response.msg || "设置块属性失败"));
                }
            });
        });
    }

    /**
     * 实际的SQL查询
     */
    private async querySQL(sql: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/query/sql", {
                stmt: sql
            }, (response) => {
                if (response.code === 0) {
                    resolve(response.data || []);
                } else {
                    reject(new Error(response.msg || "SQL查询失败"));
                }
            });
        });
    }

    /**
     * 从缓存获取数据
     */
    private getFromCache(key: string): any {
        const cached = this.requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * 设置缓存
     */
    private setCache(key: string, data: any): void {
        this.requestCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * 清除缓存
     */
    private clearCache(key: string): void {
        this.requestCache.delete(key);
    }

    /**
     * 清除所有缓存
     */
    clearAllCache(): void {
        this.requestCache.clear();
    }

    /**
     * 销毁客户端
     */
    destroy(): void {
        this.requestCache.clear();
    }
}
