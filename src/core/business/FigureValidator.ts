/**
 * 图表数据验证器
 * 负责验证图表数据的有效性和完整性
 */

import { IFigureInfo, IRawFigureData } from '../../types';

export interface IValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class FigureValidator {
    /**
     * 验证图表数据
     * @param figure 图表数据
     * @returns 验证结果
     */
    validateFigure(figure: IFigureInfo): boolean {
        const result = this.validateFigureDetailed(figure);
        return result.isValid;
    }

    /**
     * 详细验证图表数据
     * @param figure 图表数据
     * @returns 详细验证结果
     */
    validateFigureDetailed(figure: IFigureInfo): IValidationResult {
        const result: IValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 验证必需字段
        if (!this.validateRequiredFields(figure, result)) {
            result.isValid = false;
        }

        // 验证字段格式
        if (!this.validateFieldFormats(figure, result)) {
            result.isValid = false;
        }

        // 验证业务逻辑
        this.validateBusinessLogic(figure, result);

        return result;
    }

    /**
     * 验证原始图表数据
     * @param rawData 原始图表数据
     * @returns 验证结果
     */
    validateRawFigureData(rawData: IRawFigureData): IValidationResult {
        const result: IValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 验证必需字段
        if (!rawData.id) {
            result.errors.push('缺少图表ID');
            result.isValid = false;
        }

        if (!rawData.figureType) {
            result.errors.push('缺少图表类型');
            result.isValid = false;
        }

        if (!rawData.content) {
            result.errors.push('缺少图表内容');
            result.isValid = false;
        }

        // 验证图表类型
        if (rawData.figureType && !['image', 'table'].includes(rawData.figureType)) {
            result.errors.push(`无效的图表类型: ${rawData.figureType}`);
            result.isValid = false;
        }

        // 验证DOM顺序
        if (typeof rawData.domOrder !== 'number' || rawData.domOrder < 0) {
            result.warnings.push('DOM顺序无效或缺失');
        }

        return result;
    }

    /**
     * 验证必需字段
     * @param figure 图表数据
     * @param result 验证结果
     * @returns 是否通过验证
     */
    private validateRequiredFields(figure: IFigureInfo, result: IValidationResult): boolean {
        let isValid = true;

        if (!figure.id) {
            result.errors.push('缺少图表ID');
            isValid = false;
        }

        if (!figure.type) {
            result.errors.push('缺少图表类型');
            isValid = false;
        }

        if (!figure.content) {
            result.errors.push('缺少图表内容');
            isValid = false;
        }

        return isValid;
    }

    /**
     * 验证字段格式
     * @param figure 图表数据
     * @param result 验证结果
     * @returns 是否通过验证
     */
    private validateFieldFormats(figure: IFigureInfo, result: IValidationResult): boolean {
        let isValid = true;

        // 验证ID格式
        if (figure.id && !this.isValidId(figure.id)) {
            result.errors.push(`无效的图表ID格式: ${figure.id}`);
            isValid = false;
        }

        // 验证类型
        if (figure.type && !['image', 'table'].includes(figure.type)) {
            result.errors.push(`无效的图表类型: ${figure.type}`);
            isValid = false;
        }

        // 验证编号
        if (figure.number !== undefined && (typeof figure.number !== 'number' || figure.number <= 0)) {
            result.errors.push(`无效的图表编号: ${figure.number}`);
            isValid = false;
        }

        // 验证DOM顺序
        if (figure.domOrder !== undefined && (typeof figure.domOrder !== 'number' || figure.domOrder < 0)) {
            result.warnings.push(`无效的DOM顺序: ${figure.domOrder}`);
        }

        return isValid;
    }

    /**
     * 验证业务逻辑
     * @param figure 图表数据
     * @param result 验证结果
     */
    private validateBusinessLogic(figure: IFigureInfo, result: IValidationResult): void {
        // 检查标题
        if (!figure.caption || !figure.caption.trim()) {
            result.warnings.push('图表缺少标题');
        }

        // 检查标题ID
        if (!figure.captionId) {
            result.warnings.push('图表缺少标题元素ID');
        }

        // 检查内容长度
        if (figure.content && figure.content.length > 10000) {
            result.warnings.push('图表内容过长，可能影响性能');
        }

        // 检查标题长度
        if (figure.caption && figure.caption.length > 200) {
            result.warnings.push('图表标题过长，建议简化');
        }

        // 特定类型验证
        if (figure.type === 'image') {
            this.validateImageSpecific(figure, result);
        } else if (figure.type === 'table') {
            this.validateTableSpecific(figure, result);
        }
    }

    /**
     * 验证图片特定逻辑
     * @param figure 图表数据
     * @param result 验证结果
     */
    private validateImageSpecific(figure: IFigureInfo, result: IValidationResult): void {
        // 检查是否包含图片标签
        if (!figure.content.includes('<img') && !figure.content.includes('![')) {
            result.warnings.push('图片内容中未找到图片标签');
        }

        // 检查alt属性
        if (figure.content.includes('<img') && !figure.content.includes('alt=')) {
            result.warnings.push('图片缺少alt属性');
        }
    }

    /**
     * 验证表格特定逻辑
     * @param figure 图表数据
     * @param result 验证结果
     */
    private validateTableSpecific(figure: IFigureInfo, result: IValidationResult): void {
        // 检查是否包含表格标签
        if (!figure.content.includes('<table') && !figure.content.includes('|')) {
            result.warnings.push('表格内容中未找到表格标签');
        }

        // 检查表格结构
        if (figure.content.includes('<table')) {
            const rowCount = (figure.content.match(/<tr/g) || []).length;
            if (rowCount < 2) {
                result.warnings.push('表格行数过少，可能不是有效的表格');
            }
        }
    }

    /**
     * 验证ID格式
     * @param id ID字符串
     * @returns 是否有效
     */
    private isValidId(id: string): boolean {
        // 思源笔记的块ID格式验证
        return /^[0-9]{14}-[a-z0-9]{7}$/.test(id);
    }

    /**
     * 批量验证图表数据
     * @param figures 图表数据数组
     * @returns 批量验证结果
     */
    validateFigures(figures: IFigureInfo[]): {
        totalCount: number;
        validCount: number;
        invalidCount: number;
        warningCount: number;
        errors: Array<{ index: number; figure: IFigureInfo; errors: string[] }>;
        warnings: Array<{ index: number; figure: IFigureInfo; warnings: string[] }>;
    } {
        const result = {
            totalCount: figures.length,
            validCount: 0,
            invalidCount: 0,
            warningCount: 0,
            errors: [] as Array<{ index: number; figure: IFigureInfo; errors: string[] }>,
            warnings: [] as Array<{ index: number; figure: IFigureInfo; warnings: string[] }>
        };

        figures.forEach((figure, index) => {
            const validation = this.validateFigureDetailed(figure);
            
            if (validation.isValid) {
                result.validCount++;
            } else {
                result.invalidCount++;
                result.errors.push({
                    index,
                    figure,
                    errors: validation.errors
                });
            }

            if (validation.warnings.length > 0) {
                result.warningCount++;
                result.warnings.push({
                    index,
                    figure,
                    warnings: validation.warnings
                });
            }
        });

        return result;
    }

    /**
     * 检查图表数据的一致性
     * @param figures 图表数据数组
     * @returns 一致性检查结果
     */
    checkConsistency(figures: IFigureInfo[]): {
        isConsistent: boolean;
        issues: string[];
    } {
        const result = {
            isConsistent: true,
            issues: [] as string[]
        };

        // 检查ID唯一性
        const ids = figures.map(f => f.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            result.isConsistent = false;
            result.issues.push(`发现重复的图表ID: ${[...new Set(duplicateIds)].join(', ')}`);
        }

        // 检查编号连续性
        const images = figures.filter(f => f.type === 'image' && f.number !== undefined);
        const tables = figures.filter(f => f.type === 'table' && f.number !== undefined);

        if (images.length > 0) {
            const imageNumbers = images.map(f => f.number!).sort((a, b) => a - b);
            for (let i = 0; i < imageNumbers.length; i++) {
                if (imageNumbers[i] !== i + 1) {
                    result.isConsistent = false;
                    result.issues.push(`图片编号不连续: 期望 ${i + 1}, 实际 ${imageNumbers[i]}`);
                    break;
                }
            }
        }

        if (tables.length > 0) {
            const tableNumbers = tables.map(f => f.number!).sort((a, b) => a - b);
            for (let i = 0; i < tableNumbers.length; i++) {
                if (tableNumbers[i] !== i + 1) {
                    result.isConsistent = false;
                    result.issues.push(`表格编号不连续: 期望 ${i + 1}, 实际 ${tableNumbers[i]}`);
                    break;
                }
            }
        }

        return result;
    }
}
