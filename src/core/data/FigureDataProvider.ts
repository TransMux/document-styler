/**
 * 图表数据提供者 - 统一的数据获取入口
 * 负责协调各种数据源，提供统一的数据获取接口
 */

import { IFigureInfo, IRawFigureData, IDataFetchConfig } from '../../types';
import { FigureDataCache } from './FigureDataCache';
import { FigureDOMParser } from './DOMParser';
import { APIClient } from './APIClient';

export class FigureDataProvider {
    private cache: FigureDataCache;
    private domParser: FigureDOMParser;
    private apiClient: APIClient;

    constructor() {
        this.cache = new FigureDataCache();
        this.domParser = new FigureDOMParser();
        this.apiClient = new APIClient();
    }

    /**
     * 获取文档中的图表数据
     * @param docId 文档ID
     * @param config 获取配置
     * @returns 图表数据数组
     */
    async getFigures(docId: string, config: IDataFetchConfig = {}): Promise<IFigureInfo[]> {
        if (!docId) {
            return [];
        }

        const {
            useCache = true,
            forceRefresh = false,
            includeTypes = ['image', 'table'],
            fromWebSocket = false
        } = config;

        try {
            // WebSocket触发的更新强制跳过缓存
            const shouldSkipCache = forceRefresh || fromWebSocket;

            // 检查缓存
            if (useCache && !shouldSkipCache) {
                const cached = await this.cache.get(docId);
                if (cached) {
                    console.log(`FigureDataProvider: 从缓存获取文档 ${docId} 的图表数据`);
                    return this.filterByTypes(cached, includeTypes);
                }
            }

            if (fromWebSocket) {
                console.log(`FigureDataProvider: WebSocket触发更新，强制跳过缓存获取文档 ${docId} 的图表数据`);
            }

            // 获取原始数据
            const rawData = await this.fetchRawData(docId, !shouldSkipCache);
            
            // 处理数据
            const processedData = await this.processRawData(rawData);

            // 缓存数据
            if (useCache) {
                await this.cache.set(docId, processedData, config.cacheExpiry);
            }

            console.log(`FigureDataProvider: 获取到文档 ${docId} 的 ${processedData.length} 个图表`);
            return this.filterByTypes(processedData, includeTypes);

        } catch (error) {
            console.error(`FigureDataProvider: 获取文档 ${docId} 的图表数据失败:`, error);
            return [];
        }
    }

    /**
     * 获取原始数据
     * @param docId 文档ID
     * @returns 原始图表数据
     */
    private async fetchRawData(docId: string, useCache: boolean = true): Promise<IRawFigureData[]> {
        // 获取文档完整内容
        const htmlContent = await this.apiClient.getDocumentContent(docId, useCache);
        
        // 解析DOM获取图表数据
        const rawData = await this.domParser.parseFigures(htmlContent);
        
        return rawData;
    }

    /**
     * 处理原始数据
     * @param rawData 原始数据
     * @returns 处理后的图表数据
     */
    private async processRawData(rawData: IRawFigureData[]): Promise<IFigureInfo[]> {
        const result: IFigureInfo[] = [];
        let imageCount = 0;
        let tableCount = 0;

        // 按DOM顺序排序
        const sortedData = rawData.sort((a, b) => a.domOrder - b.domOrder);

        for (const raw of sortedData) {
            if (raw.figureType === 'image') {
                imageCount++;
                result.push({
                    id: raw.id,
                    type: 'image',
                    content: raw.content,
                    caption: raw.caption,
                    captionId: raw.captionId,
                    number: imageCount,
                    domOrder: raw.domOrder,
                    rawData: raw
                });
            } else if (raw.figureType === 'table') {
                tableCount++;
                result.push({
                    id: raw.id,
                    type: 'table',
                    content: raw.content,
                    caption: raw.caption,
                    captionId: raw.captionId,
                    number: tableCount,
                    domOrder: raw.domOrder,
                    rawData: raw
                });
            }
        }

        return result;
    }

    /**
     * 按类型过滤数据
     * @param data 图表数据
     * @param types 包含的类型
     * @returns 过滤后的数据
     */
    private filterByTypes(data: IFigureInfo[], types: ('image' | 'table')[]): IFigureInfo[] {
        return data.filter(item => types.includes(item.type));
    }

    /**
     * 清除缓存
     * @param docId 文档ID，不传则清除所有缓存
     */
    async clearCache(docId?: string): Promise<void> {
        await this.cache.clear(docId);
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * 销毁资源
     */
    destroy(): void {
        this.cache.destroy();
    }
}
