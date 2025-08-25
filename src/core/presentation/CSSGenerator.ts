/**
 * CSS生成器 - 专门负责生成CSS样式
 * 根据图表数据和配置生成对应的CSS样式
 */

import { IFigureInfo } from '../../types';
import { IStyleConfig } from './StyleManager';

export class CSSGenerator {
    /**
     * 生成图表样式
     * @param figures 图表数据
     * @param config 样式配置
     * @returns CSS样式字符串
     */
    generateFigureStyles(figures: IFigureInfo[], config: IStyleConfig): string {
        if (!figures || figures.length === 0) {
            return '';
        }

        const styles: string[] = [];

        // 生成基础样式
        styles.push(this.generateBaseStyles(config));

        // 生成图表标题样式
        styles.push(this.generateCaptionStyles(figures, config));

        // 生成交叉引用链接样式
        // styles.push(this.generateCrossRefLinkStyles(config));

        // 生成斜杠命令交叉引用样式
        styles.push(this.generateSlashCrossRefStyles(figures, config));

        return styles.filter(style => style.trim()).join('\n\n');
    }

    /**
     * 生成基础样式
     * @param config 样式配置
     * @returns 基础CSS样式
     */
    private generateBaseStyles(config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';
        const className = config.customClassName || 'document-styler-cross-ref';
        const animation = config.enableAnimation ? 'transition: all 0.3s ease;' : '';

        return `
/* DocumentStyler 交叉引用基础样式 */
${scope} .${className} {
    ${animation}
}

${scope} .${className}-caption {
    font-weight: 500;
    color: var(--b3-theme-primary);
    ${animation}
}

${scope} .${className}-number {
    font-weight: 600;
    color: var(--b3-theme-primary);
}
        `.trim();
    }

    /**
     * 生成图表标题样式
     * @param figures 图表数据
     * @param config 样式配置
     * @returns 标题CSS样式
     */
    private generateCaptionStyles(figures: IFigureInfo[], config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';
        const imagePrefix = config.imagePrefix || '图';
        const tablePrefix = config.tablePrefix || '表';
        const styles: string[] = [];

        for (const figure of figures) {
            if (!figure.captionId || !figure.caption || !figure.number) {
                continue;
            }

            const prefix = figure.type === 'image' ? imagePrefix : tablePrefix;
            const captionStyle = this.generateSingleCaptionStyle(
                figure.captionId,
                prefix,
                figure.number,
                scope
            );

            if (captionStyle) {
                styles.push(captionStyle);
            }
        }

        if (styles.length === 0) {
            return '';
        }

        return `
/* 图表标题编号样式 */
${styles.join('\n\n')}
        `.trim();
    }

    /**
     * 生成单个图表标题样式
     * @param captionId 标题元素ID
     * @param prefix 编号前缀
     * @param number 编号
     * @param scope 作用域
     * @returns CSS样式
     */
    private generateSingleCaptionStyle(
        captionId: string,
        prefix: string,
        number: number,
        scope: string
    ): string {
        return `
${scope} [data-node-id="${captionId}"] [contenteditable]::before {
    content: "${prefix} ${number}: ";
    color: var(--b3-theme-primary);
    font-weight: 500;
    margin-right: 0.25em;
}
        `.trim();
    }

    /**
     * 生成交叉引用链接样式
     * @param config 样式配置
     * @returns 链接CSS样式
     */
    private generateCrossRefLinkStyles(config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';
        const className = config.customClassName || 'document-styler-cross-ref';
        const animation = config.enableAnimation ? 'transition: all 0.2s ease;' : '';

        return `
/* 交叉引用链接样式 */
${scope} [data-type="cross-ref"] {
    color: var(--b3-theme-primary);
    text-decoration: none;
    cursor: pointer;
    padding: 0.1em 0.2em;
    border-radius: 0.2em;
    ${animation}
}

${scope} [data-type="cross-ref"]:hover {
    background-color: var(--b3-theme-primary-lighter);
    text-decoration: underline;
}

${scope} [data-type="cross-ref"]:active {
    background-color: var(--b3-theme-primary-light);
}

/* 高亮目标图表样式 */
${scope} .${className}-highlight {
    background-color: rgba(255, 255, 0, 0.3) !important;
    ${animation}
}

${scope} .${className}-highlight-fade {
    background-color: transparent !important;
    ${animation}
}
        `.trim();
    }

    /**
     * 生成响应式样式
     * @param config 样式配置
     * @returns 响应式CSS样式
     */
    generateResponsiveStyles(config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';

        return `
/* 响应式样式 */
@media (max-width: 768px) {
    ${scope} [data-node-id] [contenteditable]::before {
        font-size: 0.9em;
    }
}

@media (max-width: 480px) {
    ${scope} [data-node-id] [contenteditable]::before {
        font-size: 0.8em;
        margin-right: 0.2em;
    }
}
        `.trim();
    }

    /**
     * 生成打印样式
     * @param config 样式配置
     * @returns 打印CSS样式
     */
    generatePrintStyles(config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';

        return `
/* 打印样式 */
@media print {
    ${scope} [data-type="cross-ref"] {
        color: #000 !important;
        text-decoration: none !important;
        background-color: transparent !important;
    }
    
    ${scope} [data-node-id] [contenteditable]::before {
        color: #000 !important;
    }
}
        `.trim();
    }

    /**
     * 生成主题适配样式
     * @param config 样式配置
     * @param theme 主题名称
     * @returns 主题CSS样式
     */
    generateThemeStyles(config: IStyleConfig, theme: string = 'default'): string {
        const scope = config.scope || '.protyle-wysiwyg';
        
        switch (theme) {
            case 'dark':
                return this.generateDarkThemeStyles(scope);
            case 'light':
                return this.generateLightThemeStyles(scope);
            default:
                return '';
        }
    }

    /**
     * 生成深色主题样式
     * @param scope 作用域
     * @returns 深色主题CSS样式
     */
    private generateDarkThemeStyles(scope: string): string {
        return `
/* 深色主题样式 */
[data-theme-mode="dark"] ${scope} [data-type="cross-ref"] {
    color: var(--b3-theme-primary-lighter);
}

[data-theme-mode="dark"] ${scope} [data-type="cross-ref"]:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

[data-theme-mode="dark"] ${scope} [data-node-id] [contenteditable]::before {
    color: var(--b3-theme-primary-lighter);
}
        `.trim();
    }

    /**
     * 生成浅色主题样式
     * @param scope 作用域
     * @returns 浅色主题CSS样式
     */
    private generateLightThemeStyles(scope: string): string {
        return `
/* 浅色主题样式 */
[data-theme-mode="light"] ${scope} [data-type="cross-ref"] {
    color: var(--b3-theme-primary);
}

[data-theme-mode="light"] ${scope} [data-type="cross-ref"]:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

[data-theme-mode="light"] ${scope} [data-node-id] [contenteditable]::before {
    color: var(--b3-theme-primary);
}
        `.trim();
    }

    /**
     * 压缩CSS样式
     * @param css CSS样式字符串
     * @returns 压缩后的CSS
     */
    compressCSS(css: string): string {
        return css
            .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
            .replace(/\s+/g, ' ') // 合并空白字符
            .replace(/;\s*}/g, '}') // 移除最后一个分号
            .replace(/\s*{\s*/g, '{') // 清理大括号周围空格
            .replace(/\s*}\s*/g, '}') // 清理大括号周围空格
            .replace(/\s*;\s*/g, ';') // 清理分号周围空格
            .replace(/\s*:\s*/g, ':') // 清理冒号周围空格
            .trim();
    }

    /**
     * 验证CSS语法
     * @param css CSS样式字符串
     * @returns 验证结果
     */
    validateCSS(css: string): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const result = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[]
        };

        // 基本语法检查
        const openBraces = (css.match(/{/g) || []).length;
        const closeBraces = (css.match(/}/g) || []).length;

        if (openBraces !== closeBraces) {
            result.isValid = false;
            result.errors.push('大括号不匹配');
        }

        // 检查选择器格式
        const selectorPattern = /[^{}]+\s*{[^{}]*}/g;
        const selectors = css.match(selectorPattern) || [];

        for (const selector of selectors) {
            const selectorPart = selector.split('{')[0].trim();
            if (!selectorPart) {
                result.warnings.push('发现空选择器');
            }
        }

        return result;
    }

    /**
     * 生成斜杠命令交叉引用样式
     * @param figures 图表数据
     * @param config 样式配置
     * @returns 斜杠命令交叉引用CSS样式
     */
    private generateSlashCrossRefStyles(figures: IFigureInfo[], config: IStyleConfig): string {
        const scope = config.scope || '.protyle-wysiwyg';
        const imagePrefix = config.imagePrefix || '图';
        const tablePrefix = config.tablePrefix || '表';
        const animation = config.enableAnimation ? 'transition: all 0.2s ease;' : '';

        let styles = "";

        // 为每个图表生成特定的::before样式
        if (figures && figures.length > 0) {
            styles += '\n\n/* 图表编号显示样式 */';

            figures.forEach(figure => {
                const prefix = figure.type === 'image' ? imagePrefix : tablePrefix;
                const displayText = `${prefix}${figure.number}`;

                styles += `\n${scope} [data-type="block-ref"][data-subtype="s"][data-id="${figure.id}"]::before {
    content: "${displayText}";
}`;
            });
        }

        return styles;
    }
}
