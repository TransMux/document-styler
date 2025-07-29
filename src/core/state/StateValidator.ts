/**
 * 状态验证器
 * 负责验证状态数据的有效性和一致性
 */

import { IFigureInfo } from '../../types';
import { IFigureState } from './FigureState';

export interface IStateValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class StateValidator {
    /**
     * 验证图表数据数组
     * @param figures 图表数据数组
     * @returns 验证结果
     */
    validateFigures(figures: IFigureInfo[]): IStateValidationResult {
        const result: IStateValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!Array.isArray(figures)) {
            result.isValid = false;
            result.errors.push('图表数据必须是数组');
            return result;
        }

        // 验证每个图表
        figures.forEach((figure, index) => {
            const figureValidation = this.validateSingleFigure(figure, index);
            result.errors.push(...figureValidation.errors);
            result.warnings.push(...figureValidation.warnings);
            
            if (!figureValidation.isValid) {
                result.isValid = false;
            }
        });

        // 验证整体一致性
        const consistencyValidation = this.validateFiguresConsistency(figures);
        result.errors.push(...consistencyValidation.errors);
        result.warnings.push(...consistencyValidation.warnings);
        
        if (!consistencyValidation.isValid) {
            result.isValid = false;
        }

        return result;
    }

    /**
     * 验证单个图表数据
     * @param figure 图表数据
     * @param index 索引
     * @returns 验证结果
     */
    private validateSingleFigure(figure: IFigureInfo, index: number): IStateValidationResult {
        const result: IStateValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const prefix = `图表[${index}]`;

        // 验证必需字段
        if (!figure.id) {
            result.isValid = false;
            result.errors.push(`${prefix}: 缺少ID`);
        }

        if (!figure.type) {
            result.isValid = false;
            result.errors.push(`${prefix}: 缺少类型`);
        }

        if (!figure.content) {
            result.isValid = false;
            result.errors.push(`${prefix}: 缺少内容`);
        }

        // 验证字段格式
        if (figure.id && !this.isValidId(figure.id)) {
            result.isValid = false;
            result.errors.push(`${prefix}: ID格式无效`);
        }

        if (figure.type && !['image', 'table'].includes(figure.type)) {
            result.isValid = false;
            result.errors.push(`${prefix}: 类型无效，必须是 'image' 或 'table'`);
        }

        if (figure.number !== undefined && (typeof figure.number !== 'number' || figure.number <= 0)) {
            result.isValid = false;
            result.errors.push(`${prefix}: 编号无效`);
        }

        // 验证可选字段
        if (!figure.caption || !figure.caption.trim()) {
            result.warnings.push(`${prefix}: 缺少标题`);
        }

        if (!figure.captionId) {
            result.warnings.push(`${prefix}: 缺少标题元素ID`);
        }

        if (figure.domOrder !== undefined && (typeof figure.domOrder !== 'number' || figure.domOrder < 0)) {
            result.warnings.push(`${prefix}: DOM顺序无效`);
        }

        return result;
    }

    /**
     * 验证图表数据的一致性
     * @param figures 图表数据数组
     * @returns 验证结果
     */
    private validateFiguresConsistency(figures: IFigureInfo[]): IStateValidationResult {
        const result: IStateValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 检查ID唯一性
        const ids = figures.map(f => f.id).filter(id => id);
        const duplicateIds = this.findDuplicates(ids);
        if (duplicateIds.length > 0) {
            result.isValid = false;
            result.errors.push(`发现重复的图表ID: ${duplicateIds.join(', ')}`);
        }

        // 检查编号连续性
        const images = figures.filter(f => f.type === 'image' && f.number !== undefined);
        const tables = figures.filter(f => f.type === 'table' && f.number !== undefined);

        const imageNumberValidation = this.validateNumberSequence(
            images.map(f => f.number!), 
            'image'
        );
        result.errors.push(...imageNumberValidation.errors);
        result.warnings.push(...imageNumberValidation.warnings);
        if (!imageNumberValidation.isValid) {
            result.isValid = false;
        }

        const tableNumberValidation = this.validateNumberSequence(
            tables.map(f => f.number!), 
            'table'
        );
        result.errors.push(...tableNumberValidation.errors);
        result.warnings.push(...tableNumberValidation.warnings);
        if (!tableNumberValidation.isValid) {
            result.isValid = false;
        }

        return result;
    }

    /**
     * 验证编号序列
     * @param numbers 编号数组
     * @param type 类型名称
     * @returns 验证结果
     */
    private validateNumberSequence(numbers: number[], type: string): IStateValidationResult {
        const result: IStateValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (numbers.length === 0) {
            return result;
        }

        const sortedNumbers = [...numbers].sort((a, b) => a - b);

        // 检查是否从1开始
        if (sortedNumbers[0] !== 1) {
            result.isValid = false;
            result.errors.push(`${type}编号应该从1开始，实际从${sortedNumbers[0]}开始`);
        }

        // 检查连续性
        for (let i = 0; i < sortedNumbers.length; i++) {
            const expected = i + 1;
            if (sortedNumbers[i] !== expected) {
                result.isValid = false;
                result.errors.push(`${type}编号不连续: 期望${expected}，实际${sortedNumbers[i]}`);
                break;
            }
        }

        // 检查重复
        const duplicates = this.findDuplicates(numbers);
        if (duplicates.length > 0) {
            result.isValid = false;
            result.errors.push(`${type}存在重复编号: ${duplicates.join(', ')}`);
        }

        return result;
    }

    /**
     * 验证状态对象
     * @param state 状态对象
     * @returns 验证结果
     */
    validateState(state: IFigureState): IStateValidationResult {
        const result: IStateValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 验证基本字段
        if (!state.docId) {
            result.isValid = false;
            result.errors.push('状态缺少文档ID');
        }

        if (!Array.isArray(state.figures)) {
            result.isValid = false;
            result.errors.push('状态的图表数据必须是数组');
        }

        if (typeof state.lastUpdated !== 'number' || state.lastUpdated <= 0) {
            result.isValid = false;
            result.errors.push('状态的最后更新时间无效');
        }

        if (typeof state.version !== 'number' || state.version <= 0) {
            result.isValid = false;
            result.errors.push('状态的版本号无效');
        }

        if (typeof state.loading !== 'boolean') {
            result.isValid = false;
            result.errors.push('状态的加载标志必须是布尔值');
        }

        // 验证图表数据
        if (Array.isArray(state.figures)) {
            const figuresValidation = this.validateFigures(state.figures);
            result.errors.push(...figuresValidation.errors);
            result.warnings.push(...figuresValidation.warnings);
            
            if (!figuresValidation.isValid) {
                result.isValid = false;
            }
        }

        return result;
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
     * 查找数组中的重复项
     * @param array 数组
     * @returns 重复项数组
     */
    private findDuplicates<T>(array: T[]): T[] {
        const seen = new Set<T>();
        const duplicates = new Set<T>();

        for (const item of array) {
            if (seen.has(item)) {
                duplicates.add(item);
            } else {
                seen.add(item);
            }
        }

        return Array.from(duplicates);
    }

    /**
     * 批量验证状态
     * @param states 状态映射
     * @returns 批量验证结果
     */
    validateStates(states: Map<string, IFigureState>): {
        totalStates: number;
        validStates: number;
        invalidStates: number;
        errors: Array<{ docId: string; errors: string[] }>;
        warnings: Array<{ docId: string; warnings: string[] }>;
    } {
        const result = {
            totalStates: states.size,
            validStates: 0,
            invalidStates: 0,
            errors: [] as Array<{ docId: string; errors: string[] }>,
            warnings: [] as Array<{ docId: string; warnings: string[] }>
        };

        for (const [docId, state] of states.entries()) {
            const validation = this.validateState(state);
            
            if (validation.isValid) {
                result.validStates++;
            } else {
                result.invalidStates++;
                result.errors.push({
                    docId,
                    errors: validation.errors
                });
            }

            if (validation.warnings.length > 0) {
                result.warnings.push({
                    docId,
                    warnings: validation.warnings
                });
            }
        }

        return result;
    }
}
