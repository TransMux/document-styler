/**
 * 图表管理器 - 核心业务逻辑管理器
 * 负责协调各个业务组件，提供统一的业务接口
 */

import { IFigureInfo, IDataFetchConfig } from '../../types';
import { FigureDataProvider } from '../data';
import { FigureProcessor } from './FigureProcessor';
import { FigureNumbering } from './FigureNumbering';
import { FigureValidator } from './FigureValidator';

export class FigureManager {
    private dataProvider: FigureDataProvider;
    private processor: FigureProcessor;
    private numbering: FigureNumbering;
    private validator: FigureValidator;

    constructor() {
        this.dataProvider = new FigureDataProvider();
        this.processor = new FigureProcessor();
        this.numbering = new FigureNumbering();
        this.validator = new FigureValidator();
    }

    /**
     * 获取文档的图表列表
     * @param docId 文档ID
     * @param config 获取配置
     * @returns 处理后的图表数据
     */
    async getFiguresList(docId: string, config: IDataFetchConfig = {}): Promise<IFigureInfo[]> {
        if (!docId) {
            return [];
        }

        try {
            // 获取原始数据
            const rawFigures = await this.dataProvider.getFigures(docId, config);

            // 验证数据
            const validFigures = rawFigures.filter(figure => 
                this.validator.validateFigure(figure)
            );

            if (validFigures.length !== rawFigures.length) {
                console.warn(`FigureManager: 过滤掉 ${rawFigures.length - validFigures.length} 个无效图表`);
            }

            // 处理数据
            const processedFigures = await this.processor.processFigures(validFigures);

            // 重新编号
            const numberedFigures = this.numbering.assignNumbers(processedFigures);

            console.log(`FigureManager: 文档 ${docId} 共处理 ${numberedFigures.length} 个图表`);
            return numberedFigures;

        } catch (error) {
            console.error(`FigureManager: 获取文档 ${docId} 的图表列表失败:`, error);
            return [];
        }
    }

    /**
     * 获取指定类型的图表
     * @param docId 文档ID
     * @param type 图表类型
     * @param config 获取配置
     * @returns 指定类型的图表数据
     */
    async getFiguresByType(
        docId: string, 
        type: 'image' | 'table', 
        config: IDataFetchConfig = {}
    ): Promise<IFigureInfo[]> {
        const allFigures = await this.getFiguresList(docId, {
            ...config,
            includeTypes: [type]
        });

        return allFigures.filter(figure => figure.type === type);
    }

    /**
     * 获取图表统计信息
     * @param docId 文档ID
     * @returns 统计信息
     */
    async getFigureStats(docId: string): Promise<{
        total: number;
        images: number;
        tables: number;
        withCaptions: number;
        withoutCaptions: number;
    }> {
        const figures = await this.getFiguresList(docId);
        
        const stats = {
            total: figures.length,
            images: figures.filter(f => f.type === 'image').length,
            tables: figures.filter(f => f.type === 'table').length,
            withCaptions: figures.filter(f => f.caption && f.caption.trim()).length,
            withoutCaptions: figures.filter(f => !f.caption || !f.caption.trim()).length
        };

        return stats;
    }

    /**
     * 查找指定ID的图表
     * @param docId 文档ID
     * @param figureId 图表ID
     * @returns 图表信息，如果不存在则返回null
     */
    async findFigureById(docId: string, figureId: string): Promise<IFigureInfo | null> {
        const figures = await this.getFiguresList(docId);
        return figures.find(figure => figure.id === figureId) || null;
    }

    /**
     * 查找指定编号的图表
     * @param docId 文档ID
     * @param type 图表类型
     * @param number 编号
     * @returns 图表信息，如果不存在则返回null
     */
    async findFigureByNumber(
        docId: string, 
        type: 'image' | 'table', 
        number: number
    ): Promise<IFigureInfo | null> {
        const figures = await this.getFiguresByType(docId, type);
        return figures.find(figure => figure.number === number) || null;
    }

    /**
     * 重新处理文档的图表数据
     * @param docId 文档ID
     * @param forceRefresh 是否强制刷新
     * @returns 处理后的图表数据
     */
    async refreshFigures(docId: string, forceRefresh: boolean = true): Promise<IFigureInfo[]> {
        // 清除缓存
        if (forceRefresh) {
            await this.dataProvider.clearCache(docId);
        }

        return this.getFiguresList(docId, { forceRefresh });
    }

    /**
     * 验证图表数据的完整性
     * @param docId 文档ID
     * @returns 验证结果
     */
    async validateFigures(docId: string): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const figures = await this.getFiguresList(docId);
        const result = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[]
        };

        // 检查编号连续性
        const imageNumbers = figures
            .filter(f => f.type === 'image')
            .map(f => f.number!)
            .sort((a, b) => a - b);

        const tableNumbers = figures
            .filter(f => f.type === 'table')
            .map(f => f.number!)
            .sort((a, b) => a - b);

        // 验证图片编号
        for (let i = 0; i < imageNumbers.length; i++) {
            if (imageNumbers[i] !== i + 1) {
                result.errors.push(`图片编号不连续: 期望 ${i + 1}, 实际 ${imageNumbers[i]}`);
                result.isValid = false;
            }
        }

        // 验证表格编号
        for (let i = 0; i < tableNumbers.length; i++) {
            if (tableNumbers[i] !== i + 1) {
                result.errors.push(`表格编号不连续: 期望 ${i + 1}, 实际 ${tableNumbers[i]}`);
                result.isValid = false;
            }
        }

        // 检查缺少标题的图表
        const figuresWithoutCaptions = figures.filter(f => !f.caption || !f.caption.trim());
        if (figuresWithoutCaptions.length > 0) {
            result.warnings.push(`${figuresWithoutCaptions.length} 个图表缺少标题`);
        }

        return result;
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        return this.dataProvider.getCacheStats();
    }

    /**
     * 清除缓存
     * @param docId 文档ID，不传则清除所有缓存
     */
    async clearCache(docId?: string): Promise<void> {
        await this.dataProvider.clearCache(docId);
    }

    /**
     * 销毁管理器
     */
    destroy(): void {
        this.dataProvider.destroy();
    }
}
