/**
 * 图表数据处理器
 * 负责图表数据的清理、转换、排序等处理逻辑
 */

import { IFigureInfo } from '../../types';

export class FigureProcessor {
    /**
     * 处理图表数据
     * @param figures 原始图表数据
     * @returns 处理后的图表数据
     */
    async processFigures(figures: IFigureInfo[]): Promise<IFigureInfo[]> {
        if (!figures || figures.length === 0) {
            return [];
        }

        try {
            // 1. 清理数据
            const cleanedFigures = figures.map(figure => this.cleanFigureData(figure));

            // 2. 排序
            const sortedFigures = this.sortFigures(cleanedFigures);

            // 3. 标准化内容
            const standardizedFigures = sortedFigures.map(figure => this.standardizeFigureContent(figure));

            console.log(`FigureProcessor: 处理了 ${figures.length} 个图表`);
            return standardizedFigures;

        } catch (error) {
            console.error('FigureProcessor: 处理图表数据失败:', error);
            return figures; // 返回原始数据作为降级处理
        }
    }

    /**
     * 清理图表数据
     * @param figure 图表数据
     * @returns 清理后的数据
     */
    private cleanFigureData(figure: IFigureInfo): IFigureInfo {
        return {
            ...figure,
            content: this.cleanContent(figure.content),
            caption: this.cleanCaption(figure.caption),
        };
    }

    /**
     * 排序图表数据
     * @param figures 图表数据数组
     * @returns 排序后的数据
     */
    private sortFigures(figures: IFigureInfo[]): IFigureInfo[] {
        return figures.sort((a, b) => {
            // 首先按DOM顺序排序
            if (a.domOrder !== undefined && b.domOrder !== undefined) {
                return a.domOrder - b.domOrder;
            }

            // 如果没有DOM顺序，按ID排序
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * 标准化图表内容
     * @param figure 图表数据
     * @returns 标准化后的数据
     */
    private standardizeFigureContent(figure: IFigureInfo): IFigureInfo {
        const standardized = { ...figure };

        if (figure.type === 'image') {
            standardized.content = this.standardizeImageContent(figure.content);
        } else if (figure.type === 'table') {
            standardized.content = this.standardizeTableContent(figure.content);
        }

        return standardized;
    }

    /**
     * 清理内容字符串
     * @param content 原始内容
     * @returns 清理后的内容
     */
    private cleanContent(content: string): string {
        if (!content) return '';

        return content
            .trim()
            .replace(/\s+/g, ' ') // 合并多个空白字符
            .replace(/[\r\n]+/g, ' ') // 替换换行符为空格
            .trim();
    }

    /**
     * 清理标题字符串
     * @param caption 原始标题
     * @returns 清理后的标题
     */
    private cleanCaption(caption?: string): string {
        if (!caption) return '';

        return caption
            .trim()
            .replace(/\s+/g, ' ') // 合并多个空白字符
            .replace(/^[：:]\s*/, '') // 移除开头的冒号
            .replace(/\s*[：:]\s*$/, '') // 移除结尾的冒号
            .trim();
    }

    /**
     * 标准化图片内容
     * @param content 图片内容
     * @returns 标准化后的内容
     */
    private standardizeImageContent(content: string): string {
        if (!content) return '';

        // 提取图片的alt文本或markdown格式
        const altMatch = content.match(/alt="([^"]*)"/);
        if (altMatch) {
            return altMatch[1];
        }

        // 提取markdown格式的图片描述
        const markdownMatch = content.match(/!\[([^\]]*)\]/);
        if (markdownMatch) {
            return markdownMatch[1];
        }

        return this.cleanContent(content);
    }

    /**
     * 标准化表格内容
     * @param content 表格内容
     * @returns 标准化后的内容
     */
    private standardizeTableContent(content: string): string {
        if (!content) return '';

        // 提取表格的摘要信息
        const summaryMatch = content.match(/<table[^>]*summary="([^"]*)"[^>]*>/);
        if (summaryMatch) {
            return summaryMatch[1];
        }

        // 提取表格的第一行作为描述
        const firstRowMatch = content.match(/<tr[^>]*>(.*?)<\/tr>/);
        if (firstRowMatch) {
            const cellsText = firstRowMatch[1]
                .replace(/<[^>]*>/g, '') // 移除HTML标签
                .replace(/\s+/g, ' ')
                .trim();
            
            if (cellsText.length > 0 && cellsText.length < 100) {
                return cellsText;
            }
        }

        return '表格';
    }

    /**
     * 提取图片的alt文本
     * @param content 图片内容
     * @returns alt文本
     */
    extractImageAlt(content: string): string {
        if (!content) return '';

        // 尝试多种方式提取alt文本
        const patterns = [
            /alt="([^"]*)"/,
            /!\[([^\]]*)\]/,
            /title="([^"]*)"/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return this.cleanContent(match[1]);
            }
        }

        return '';
    }

    /**
     * 提取图片标题
     * @param content 图片内容
     * @returns 图片标题
     */
    extractImageCaption(content: string): string {
        const alt = this.extractImageAlt(content);
        return alt || '图片';
    }

    /**
     * 提取表格摘要
     * @param content 表格内容
     * @returns 表格摘要
     */
    extractTableSummary(content: string): string {
        return this.standardizeTableContent(content);
    }

    /**
     * 提取表格标题
     * @param content 表格内容
     * @returns 表格标题
     */
    extractTableCaption(content: string): string {
        const summary = this.extractTableSummary(content);
        return summary || '表格';
    }

    /**
     * 验证处理结果
     * @param original 原始数据
     * @param processed 处理后数据
     * @returns 验证结果
     */
    validateProcessingResult(original: IFigureInfo[], processed: IFigureInfo[]): {
        isValid: boolean;
        errors: string[];
    } {
        const result = {
            isValid: true,
            errors: [] as string[]
        };

        // 检查数量是否一致
        if (original.length !== processed.length) {
            result.isValid = false;
            result.errors.push(`数据数量不一致: 原始 ${original.length}, 处理后 ${processed.length}`);
        }

        // 检查ID是否都存在
        const originalIds = new Set(original.map(f => f.id));
        const processedIds = new Set(processed.map(f => f.id));

        for (const id of originalIds) {
            if (!processedIds.has(id)) {
                result.isValid = false;
                result.errors.push(`缺少图表ID: ${id}`);
            }
        }

        return result;
    }

    /**
     * 获取处理统计信息
     * @param figures 图表数据
     * @returns 统计信息
     */
    getProcessingStats(figures: IFigureInfo[]): {
        total: number;
        withContent: number;
        withCaption: number;
        withDomOrder: number;
    } {
        return {
            total: figures.length,
            withContent: figures.filter(f => f.content && f.content.trim()).length,
            withCaption: figures.filter(f => f.caption && f.caption.trim()).length,
            withDomOrder: figures.filter(f => f.domOrder !== undefined).length
        };
    }
}
