/**
 * 样式管理器 - 统一的CSS样式管理
 * 负责CSS样式的生成、应用、更新和清理
 */

import { IFigureInfo } from '../../types';
import { CSSGenerator } from './CSSGenerator';
import { StyleApplicator } from './StyleApplicator';

export interface IStyleConfig {
    /** 图片编号前缀 */
    imagePrefix?: string;
    /** 表格编号前缀 */
    tablePrefix?: string;
    /** 样式作用域 */
    scope?: string;
    /** 是否启用动画 */
    enableAnimation?: boolean;
    /** 自定义CSS类名 */
    customClassName?: string;
}

export class StyleManager {
    private cssGenerator: CSSGenerator;
    private styleApplicator: StyleApplicator;
    private appliedStyles = new Map<string, string>(); // docId -> styleId
    private defaultConfig: IStyleConfig = {
        imagePrefix: '图',
        tablePrefix: '表',
        scope: '.protyle-wysiwyg',
        enableAnimation: true,
        customClassName: 'document-styler-cross-ref'
    };

    constructor() {
        this.cssGenerator = new CSSGenerator();
        this.styleApplicator = new StyleApplicator();
    }

    /**
     * 应用交叉引用样式
     * @param docId 文档ID
     * @param figures 图表数据
     * @param config 样式配置
     */
    async applyCrossReferenceStyles(
        docId: string, 
        figures: IFigureInfo[], 
        config: IStyleConfig = {}
    ): Promise<void> {
        if (!docId) {
            throw new Error('文档ID不能为空');
        }

        try {
            const finalConfig = { ...this.defaultConfig, ...config };

            // 如果没有图表，只清除旧样式
            if (!figures || figures.length === 0) {
                await this.clearDocumentStyles(docId);
                console.log(`StyleManager: 文档 ${docId} 没有图表，已清除旧样式`);
                return;
            }

            // 生成CSS样式
            const cssContent = this.cssGenerator.generateFigureStyles(figures, finalConfig);

            // 如果生成的CSS为空，也只清除旧样式
            if (!cssContent || cssContent.trim() === '') {
                await this.clearDocumentStyles(docId);
                console.log(`StyleManager: 文档 ${docId} 生成的CSS为空，已清除旧样式`);
                return;
            }

            // 应用样式
            const styleId = await this.styleApplicator.applyStyles(docId, cssContent, {
                scope: finalConfig.scope,
                className: finalConfig.customClassName
            });

            // 清除旧样式
            await this.clearDocumentStyles(docId);

            // 记录新样式
            this.appliedStyles.set(docId, styleId);

            console.log(`StyleManager: 为文档 ${docId} 应用了交叉引用样式，包含 ${figures.length} 个图表`);

        } catch (error) {
            console.error(`StyleManager: 应用文档 ${docId} 的样式失败:`, error);
            throw error;
        }
    }

    /**
     * 更新图表前缀样式
     * @param docId 文档ID
     * @param figures 图表数据
     * @param config 样式配置
     */
    async updatePrefixStyles(
        docId: string, 
        figures: IFigureInfo[], 
        config: IStyleConfig = {}
    ): Promise<void> {
        // 直接重新应用样式，因为前缀变化需要重新生成CSS
        await this.applyCrossReferenceStyles(docId, figures, config);
    }

    /**
     * 清除文档的交叉引用样式
     * @param docId 文档ID
     */
    async clearCrossReferenceStyles(docId: string): Promise<void> {
        if (!docId) {
            return;
        }

        try {
            await this.clearDocumentStyles(docId);
            console.log(`StyleManager: 清除了文档 ${docId} 的交叉引用样式`);

        } catch (error) {
            console.error(`StyleManager: 清除文档 ${docId} 的样式失败:`, error);
            throw error;
        }
    }

    /**
     * 清除指定文档的样式
     * @param docId 文档ID
     */
    private async clearDocumentStyles(docId: string): Promise<void> {
        const existingStyleId = this.appliedStyles.get(docId);
        if (existingStyleId) {
            await this.styleApplicator.removeStyles(existingStyleId);
            this.appliedStyles.delete(docId);
        }
    }

    /**
     * 清除所有样式
     */
    async clearAllStyles(): Promise<void> {
        try {
            const styleIds = Array.from(this.appliedStyles.values());
            
            for (const styleId of styleIds) {
                await this.styleApplicator.removeStyles(styleId);
            }

            this.appliedStyles.clear();
            console.log('StyleManager: 清除了所有交叉引用样式');

        } catch (error) {
            console.error('StyleManager: 清除所有样式失败:', error);
            throw error;
        }
    }

    /**
     * 检查文档是否已应用样式
     * @param docId 文档ID
     * @returns 是否已应用样式
     */
    hasAppliedStyles(docId: string): boolean {
        return this.appliedStyles.has(docId);
    }

    /**
     * 获取已应用样式的文档列表
     * @returns 文档ID数组
     */
    getStyledDocuments(): string[] {
        return Array.from(this.appliedStyles.keys());
    }

    /**
     * 验证样式配置
     * @param config 样式配置
     * @returns 验证结果
     */
    validateConfig(config: IStyleConfig): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const result = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[]
        };

        // 验证前缀
        if (config.imagePrefix !== undefined && !config.imagePrefix.trim()) {
            result.warnings.push('图片前缀为空');
        }

        if (config.tablePrefix !== undefined && !config.tablePrefix.trim()) {
            result.warnings.push('表格前缀为空');
        }

        // 验证作用域
        if (config.scope !== undefined && !config.scope.trim()) {
            result.errors.push('样式作用域不能为空');
            result.isValid = false;
        }

        // 验证CSS类名
        if (config.customClassName !== undefined) {
            if (!config.customClassName.trim()) {
                result.warnings.push('自定义CSS类名为空');
            } else if (!/^[a-zA-Z][\w-]*$/.test(config.customClassName)) {
                result.errors.push('自定义CSS类名格式无效');
                result.isValid = false;
            }
        }

        return result;
    }

    /**
     * 生成样式预览
     * @param figures 图表数据
     * @param config 样式配置
     * @returns CSS样式字符串
     */
    generateStylePreview(figures: IFigureInfo[], config: IStyleConfig = {}): string {
        const finalConfig = { ...this.defaultConfig, ...config };
        return this.cssGenerator.generateFigureStyles(figures, finalConfig);
    }

    /**
     * 获取样式统计信息
     * @returns 统计信息
     */
    getStyleStats(): {
        totalDocuments: number;
        totalStyles: number;
        memoryUsage: number;
    } {
        return {
            totalDocuments: this.appliedStyles.size,
            totalStyles: this.styleApplicator.getAppliedStylesCount(),
            memoryUsage: this.calculateMemoryUsage()
        };
    }

    /**
     * 计算内存使用量（估算）
     * @returns 内存使用量（字节）
     */
    private calculateMemoryUsage(): number {
        let size = 0;
        
        // 计算appliedStyles的大小
        for (const [docId, styleId] of this.appliedStyles.entries()) {
            size += docId.length * 2; // 字符串大小（UTF-16）
            size += styleId.length * 2;
        }

        // 加上StyleApplicator的内存使用
        size += this.styleApplicator.getMemoryUsage();

        return size;
    }

    /**
     * 优化内存使用
     */
    optimizeMemory(): void {
        // 清理无效的样式引用
        this.styleApplicator.cleanup();
        
        // 可以添加更多优化逻辑
        console.log('StyleManager: 内存优化完成');
    }

    /**
     * 销毁样式管理器
     */
    async destroy(): Promise<void> {
        try {
            await this.clearAllStyles();
            this.styleApplicator.destroy();
            console.log('StyleManager: 销毁完成');

        } catch (error) {
            console.error('StyleManager: 销毁失败:', error);
        }
    }
}
