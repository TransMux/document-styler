/**
 * 图表编号管理器
 * 负责图表的编号分配和编号算法
 */

import { IFigureInfo } from '../../types';

export interface INumberingConfig {
    /** 图片编号前缀 */
    imagePrefix?: string;
    /** 表格编号前缀 */
    tablePrefix?: string;
    /** 是否重置编号 */
    resetNumbers?: boolean;
    /** 起始编号 */
    startNumber?: number;
}

export class FigureNumbering {
    private defaultConfig: INumberingConfig = {
        imagePrefix: '图',
        tablePrefix: '表',
        resetNumbers: true,
        startNumber: 1
    };

    /**
     * 为图表分配编号
     * @param figures 图表数据数组
     * @param config 编号配置
     * @returns 分配编号后的图表数据
     */
    assignNumbers(figures: IFigureInfo[], config: INumberingConfig = {}): IFigureInfo[] {
        if (!figures || figures.length === 0) {
            return [];
        }

        const finalConfig = { ...this.defaultConfig, ...config };
        
        try {
            // 分离图片和表格
            const images = figures.filter(f => f.type === 'image');
            const tables = figures.filter(f => f.type === 'table');

            // 分别编号
            const numberedImages = this.assignNumbersToType(images, 'image', finalConfig);
            const numberedTables = this.assignNumbersToType(tables, 'table', finalConfig);

            // 合并并按原始顺序排序
            const allNumbered = [...numberedImages, ...numberedTables];
            allNumbered.sort((a, b) => {
                if (a.domOrder !== undefined && b.domOrder !== undefined) {
                    return a.domOrder - b.domOrder;
                }
                return a.id.localeCompare(b.id);
            });

            console.log(`FigureNumbering: 为 ${images.length} 个图片和 ${tables.length} 个表格分配了编号`);
            return allNumbered;

        } catch (error) {
            console.error('FigureNumbering: 分配编号失败:', error);
            return figures; // 返回原始数据作为降级处理
        }
    }

    /**
     * 为指定类型的图表分配编号
     * @param figures 同类型图表数组
     * @param type 图表类型
     * @param config 编号配置
     * @returns 分配编号后的图表数据
     */
    private assignNumbersToType(
        figures: IFigureInfo[], 
        type: 'image' | 'table', 
        config: INumberingConfig
    ): IFigureInfo[] {
        if (figures.length === 0) {
            return [];
        }

        // 按DOM顺序排序
        const sortedFigures = figures.sort((a, b) => {
            if (a.domOrder !== undefined && b.domOrder !== undefined) {
                return a.domOrder - b.domOrder;
            }
            return a.id.localeCompare(b.id);
        });

        // 分配编号
        return sortedFigures.map((figure, index) => ({
            ...figure,
            number: (config.startNumber || 1) + index
        }));
    }

    /**
     * 重新编号图表
     * @param figures 图表数据数组
     * @param config 编号配置
     * @returns 重新编号后的图表数据
     */
    renumberFigures(figures: IFigureInfo[], config: INumberingConfig = {}): IFigureInfo[] {
        return this.assignNumbers(figures, { ...config, resetNumbers: true });
    }

    /**
     * 验证编号的连续性
     * @param figures 图表数据数组
     * @returns 验证结果
     */
    validateNumbering(figures: IFigureInfo[]): {
        isValid: boolean;
        errors: string[];
        suggestions: string[];
    } {
        const result = {
            isValid: true,
            errors: [] as string[],
            suggestions: [] as string[]
        };

        // 分离图片和表格
        const images = figures.filter(f => f.type === 'image');
        const tables = figures.filter(f => f.type === 'table');

        // 验证图片编号
        const imageValidation = this.validateTypeNumbering(images, 'image');
        result.errors.push(...imageValidation.errors);
        result.suggestions.push(...imageValidation.suggestions);
        if (!imageValidation.isValid) {
            result.isValid = false;
        }

        // 验证表格编号
        const tableValidation = this.validateTypeNumbering(tables, 'table');
        result.errors.push(...tableValidation.errors);
        result.suggestions.push(...tableValidation.suggestions);
        if (!tableValidation.isValid) {
            result.isValid = false;
        }

        return result;
    }

    /**
     * 验证指定类型图表的编号
     * @param figures 同类型图表数组
     * @param type 图表类型
     * @returns 验证结果
     */
    private validateTypeNumbering(figures: IFigureInfo[], type: 'image' | 'table'): {
        isValid: boolean;
        errors: string[];
        suggestions: string[];
    } {
        const result = {
            isValid: true,
            errors: [] as string[],
            suggestions: [] as string[]
        };

        if (figures.length === 0) {
            return result;
        }

        // 检查是否所有图表都有编号
        const figuresWithoutNumber = figures.filter(f => f.number === undefined || f.number === null);
        if (figuresWithoutNumber.length > 0) {
            result.isValid = false;
            result.errors.push(`${figuresWithoutNumber.length} 个${type === 'image' ? '图片' : '表格'}缺少编号`);
            result.suggestions.push(`为所有${type === 'image' ? '图片' : '表格'}重新分配编号`);
        }

        // 检查编号连续性
        const numbers = figures
            .filter(f => f.number !== undefined && f.number !== null)
            .map(f => f.number!)
            .sort((a, b) => a - b);

        for (let i = 0; i < numbers.length; i++) {
            const expectedNumber = i + 1;
            if (numbers[i] !== expectedNumber) {
                result.isValid = false;
                result.errors.push(
                    `${type === 'image' ? '图片' : '表格'}编号不连续: 期望 ${expectedNumber}, 实际 ${numbers[i]}`
                );
                result.suggestions.push(`重新排序并分配连续编号`);
                break;
            }
        }

        // 检查重复编号
        const duplicates = this.findDuplicateNumbers(numbers);
        if (duplicates.length > 0) {
            result.isValid = false;
            result.errors.push(
                `${type === 'image' ? '图片' : '表格'}存在重复编号: ${duplicates.join(', ')}`
            );
            result.suggestions.push(`移除重复编号并重新分配`);
        }

        return result;
    }

    /**
     * 查找重复的编号
     * @param numbers 编号数组
     * @returns 重复的编号
     */
    private findDuplicateNumbers(numbers: number[]): number[] {
        const seen = new Set<number>();
        const duplicates = new Set<number>();

        for (const num of numbers) {
            if (seen.has(num)) {
                duplicates.add(num);
            } else {
                seen.add(num);
            }
        }

        return Array.from(duplicates);
    }

    /**
     * 获取编号统计信息
     * @param figures 图表数据数组
     * @returns 统计信息
     */
    getNumberingStats(figures: IFigureInfo[]): {
        totalFigures: number;
        numberedFigures: number;
        unnumberedFigures: number;
        imageStats: {
            total: number;
            numbered: number;
            maxNumber: number;
        };
        tableStats: {
            total: number;
            numbered: number;
            maxNumber: number;
        };
    } {
        const images = figures.filter(f => f.type === 'image');
        const tables = figures.filter(f => f.type === 'table');
        
        const numberedImages = images.filter(f => f.number !== undefined && f.number !== null);
        const numberedTables = tables.filter(f => f.number !== undefined && f.number !== null);

        return {
            totalFigures: figures.length,
            numberedFigures: numberedImages.length + numberedTables.length,
            unnumberedFigures: figures.length - (numberedImages.length + numberedTables.length),
            imageStats: {
                total: images.length,
                numbered: numberedImages.length,
                maxNumber: numberedImages.length > 0 ? Math.max(...numberedImages.map(f => f.number!)) : 0
            },
            tableStats: {
                total: tables.length,
                numbered: numberedTables.length,
                maxNumber: numberedTables.length > 0 ? Math.max(...numberedTables.map(f => f.number!)) : 0
            }
        };
    }

    /**
     * 生成编号显示文本
     * @param figure 图表数据
     * @param config 编号配置
     * @returns 编号显示文本
     */
    generateNumberText(figure: IFigureInfo, config: INumberingConfig = {}): string {
        const finalConfig = { ...this.defaultConfig, ...config };
        
        if (figure.number === undefined || figure.number === null) {
            return '';
        }

        const prefix = figure.type === 'image' 
            ? (finalConfig.imagePrefix || '图')
            : (finalConfig.tablePrefix || '表');

        return `${prefix} ${figure.number}`;
    }
}
