/**
 * 样式管理器
 * 负责管理插件的CSS样式
 */

import { IStyleManager, IHeadingNumberMap } from "../types";

export class StyleManager implements IStyleManager {
    private readonly MAIN_STYLE_ID = 'document-styler-plugin-styles';
    private readonly HEADING_STYLE_ID = 'document-styler-heading-numbering';
    private readonly IMG_LH_STYLE_ID = 'document-styler-img-lineheight';

    // 当前应用的编号映射
    private currentHeadingMap: IHeadingNumberMap = {};
    private currentFigureMap: Record<string, { number: string; type: 'image' | 'table' }> = {};

    async init(): Promise<void> {
        this.loadStyles();
    }

    destroy(): void {
        this.removeStyles();
    }

    loadStyles(): void {
        this.loadMainStyles();
    }

    removeStyles(): void {
        const mainStyle = document.getElementById(this.MAIN_STYLE_ID);
        if (mainStyle) mainStyle.remove();

        const headingStyle = document.getElementById(this.HEADING_STYLE_ID);
        if (headingStyle) headingStyle.remove();

        const imgLHStyle = document.getElementById(this.IMG_LH_STYLE_ID);
        if (imgLHStyle) imgLHStyle.remove();
    }

    updateStyles(): void {
        this.removeStyles();
        this.loadStyles();
    }

    /**
     * 加载主要样式
     */
    private loadMainStyles(): void {
        const css = `
            .document-styler-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: 14px;
            }

            .document-styler-content {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
            }

            .document-styler-section {
                margin-bottom: 24px;
                border-bottom: 1px solid var(--b3-theme-surface-lighter);
                padding-bottom: 16px;
            }

            .document-styler-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .document-styler-section-title {
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 12px 0;
                color: var(--b3-theme-on-surface);
                display: flex;
                align-items: center;
            }

            .document-styler-section-title::before {
                content: "";
                width: 3px;
                height: 16px;
                background-color: var(--b3-theme-primary);
                margin-right: 8px;
                border-radius: 2px;
            }

            .document-styler-option .b3-switch {
                align-items: center;
            }

            .document-styler-description {
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                margin-top: 8px;
                line-height: 1.4;
                padding-left: 16px;
                border-left: 2px solid var(--b3-theme-surface-light);
            }

            .document-styler-info {
                padding: 8px 12px;
                background-color: var(--b3-theme-surface);
                border-radius: var(--b3-border-radius);
                font-size: 13px;
                color: var(--b3-theme-on-surface-light);
                border: 1px solid var(--b3-theme-surface-lighter);
            }

            .document-styler-figures-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: var(--b3-border-radius);
            }

            .document-styler-figure-item {
                padding: 8px 12px;
                border-bottom: 1px solid var(--b3-theme-surface-lighter);
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .document-styler-figure-item:last-child {
                border-bottom: none;
            }

            .document-styler-figure-item:hover {
                background-color: var(--b3-theme-surface);
            }

            .document-styler-figure-item .figure-label,
            .document-styler-figure-item .table-label {
                font-weight: 600;
                color: var(--b3-theme-primary);
                margin-right: 8px;
                min-width: 80px;
                font-size: 12px;
            }

            .document-styler-figure-item .figure-content {
                flex: 1;
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .b3-list--empty {
                text-align: center;
                padding: 32px 16px;
                color: var(--b3-theme-on-surface-light);
                font-size: 13px;
            }

            .document-styler-subsection {
                margin-bottom: 16px;
            }

            .document-styler-subsection h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                font-weight: 600;
                color: var(--b3-theme-on-surface);
                padding: 4px 8px;
                background-color: var(--b3-theme-surface-light);
                border-radius: 4px;
            }

            /* 设置面板样式 */
            .document-styler-settings {
                padding: 16px;
            }

            .document-styler-settings .b3-label {
                margin-bottom: 16px;
            }

            .document-styler-settings .b3-label__text {
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
                margin-top: 4px;
            }

            .document-styler-option {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .document-styler-option input {
                flex: 1;
            }

            .document-styler-chinese-option {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                font-size: 12px;
                color: var(--b3-theme-on-surface-light);
            }

            /* 按钮样式 */
            .document-styler-button {
                padding: 6px 12px;
                border: 1px solid var(--b3-theme-surface-lighter);
                border-radius: var(--b3-border-radius);
                background-color: var(--b3-theme-surface);
                color: var(--b3-theme-on-surface);
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 12px;
            }

            .document-styler-button:hover {
                background-color: var(--b3-theme-surface-light);
                border-color: var(--b3-theme-primary);
            }

            .document-styler-button:active {
                transform: translateY(1px);
            }

            .document-styler-button--primary {
                background-color: var(--b3-theme-primary);
                color: var(--b3-theme-on-primary);
                border-color: var(--b3-theme-primary);
            }

            .document-styler-button--primary:hover {
                background-color: var(--b3-theme-primary-light);
            }

            .document-styler-button--danger {
                background-color: var(--b3-theme-error);
                color: var(--b3-theme-on-error);
                border-color: var(--b3-theme-error);
            }

            .document-styler-button--danger:hover {
                background-color: var(--b3-theme-error-light);
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .document-styler-content {
                    padding: 12px;
                }

                .document-styler-section {
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                }

                .document-styler-section-title {
                    font-size: 14px;
                }

                .document-styler-figure-item {
                    padding: 6px 8px;
                }

                .document-styler-figure-item .figure-label,
                .document-styler-figure-item .table-label {
                    min-width: 60px;
                    font-size: 11px;
                }

                .document-styler-figure-item .figure-content {
                    font-size: 11px;
                }
            }

            /* 动画效果 */
            .document-styler-fade-in {
                animation: documentStylerFadeIn 0.3s ease-in-out;
            }

            @keyframes documentStylerFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .document-styler-slide-in {
                animation: documentStylerSlideIn 0.3s ease-in-out;
            }

            @keyframes documentStylerSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* 加载状态 */
            .document-styler-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: var(--b3-theme-on-surface-light);
            }

            .document-styler-loading::before {
                content: "";
                width: 16px;
                height: 16px;
                border: 2px solid var(--b3-theme-surface-lighter);
                border-top: 2px solid var(--b3-theme-primary);
                border-radius: 50%;
                animation: documentStylerSpin 1s linear infinite;
                margin-right: 8px;
            }

            @keyframes documentStylerSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;

        let styleElement = document.getElementById(this.MAIN_STYLE_ID) as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = this.MAIN_STYLE_ID;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    /**
     * 加载标题编号样式
     * @param minLevel 最小标题级别
     */
    loadHeadingNumberingStyles(minLevel: number = 1): void {
        let css = `
            .protyle-wysiwyg {
                counter-reset: h1 h2 h3 h4 h5 h6;
            }
        `;

        // 为每个标题级别生成CSS规则
        for (let level = minLevel; level <= 6; level++) {
            const adjustedLevel = level - minLevel + 1;

            // 生成counter-reset规则
            const resetCounters = [];
            for (let resetLevel = level + 1; resetLevel <= 6; resetLevel++) {
                resetCounters.push(`h${resetLevel}`);
            }

            // 生成content内容
            const counterParts = [];
            for (let contentLevel = minLevel; contentLevel <= level; contentLevel++) {
                counterParts.push(`counter(h${contentLevel})`);
            }
            const counterContent = counterParts.join(' "." ');

            css += `
                .protyle-wysiwyg [data-subtype="h${level}"] > div:first-child:before {
                    counter-increment: h${level};
                    ${resetCounters.length > 0 ? `counter-reset: ${resetCounters.join(' ')};` : ''}
                    content: "${counterContent}. ";
                    color: var(--b3-theme-on-surface-light);
                    margin-right: 8px;
                    user-select: none;
                    display: inline;
                }
            `;
        }

        let styleElement = document.getElementById(this.HEADING_STYLE_ID) as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = this.HEADING_STYLE_ID;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    /**
     * 移除标题编号样式
     */
    removeHeadingNumberingStyles(): void {
        const styleElement = document.getElementById(this.HEADING_STYLE_ID);
        if (styleElement) {
            styleElement.remove();
        }
    }

    /**
     * 检查样式是否已加载
     * @param styleId 样式ID
     * @returns 是否已加载
     */
    isStyleLoaded(styleId: string): boolean {
        return document.getElementById(styleId) !== null;
    }

    /**
     * 确保“图片高度=行高”的CSS已注入
     * 使用 CSS 相对单位 1lh，使图片跟随行高变化，无需重复写入 inline style
     */
    ensureImageLineHeightRule(): void {
        if (document.getElementById(this.IMG_LH_STYLE_ID)) return;

        const css = `
            /* 针对标记了 data-styler-img-lh="1" 的图片或图片容器应用 1lh 高度 */
            .protyle-wysiwyg [data-styler-img-lh="1"] img,
            .protyle-wysiwyg img[data-styler-img-lh="1"] {
                height: 1lh;
                max-height: 1lh;
                width: auto;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = this.IMG_LH_STYLE_ID;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    /**
     * 获取主样式ID
     */
    getMainStyleId(): string {
        return this.MAIN_STYLE_ID;
    }

    /**
     * 获取标题样式ID
     */
    getHeadingStyleId(): string {
        return this.HEADING_STYLE_ID;
    }

    /**
     * 应用标题编号样式
     * @param headingMap 标题编号映射
     */
    applyHeadingNumbering(headingMap: IHeadingNumberMap): void {
        this.currentHeadingMap = headingMap;
        this.updateNumberingStyles();
    }

    /**
     * 清除标题编号样式
     */
    clearHeadingNumbering(): void {
        this.currentHeadingMap = {};
        // 直接移除样式，避免递归调用
        this.removeHeadingNumberingStyles();
    }

    /**
     * 应用图片表格编号样式
     * @param figureMap 图片表格编号映射
     */
    applyFigureNumbering(figureMap: Record<string, { number: string; type: 'image' | 'table' }>): void {
        this.currentFigureMap = figureMap;
        this.updateNumberingStyles();
    }

    /**
     * 清除图片表格编号样式
     */
    clearFigureNumbering(): void {
        this.currentFigureMap = {};
        // 如果标题映射也为空，直接移除样式；否则更新样式
        if (Object.keys(this.currentHeadingMap).length === 0) {
            this.removeHeadingNumberingStyles();
        } else {
            this.updateNumberingStyles();
        }
    }

    /**
     * 批量更新编号样式
     * @param options 更新选项
     */
    batchUpdateNumbering(options: {
        headingMap?: IHeadingNumberMap;
        figureMap?: Record<string, { number: string; type: 'image' | 'table' }>;
        clearHeadings?: boolean;
        clearFigures?: boolean;
    }): void {
        if (options.clearHeadings) {
            this.currentHeadingMap = {};
        } else if (options.headingMap) {
            this.currentHeadingMap = options.headingMap;
        }

        if (options.clearFigures) {
            this.currentFigureMap = {};
        } else if (options.figureMap) {
            this.currentFigureMap = options.figureMap;
        }

        this.updateNumberingStyles();
    }

    /**
     * 更新编号样式
     */
    private updateNumberingStyles(): void {
        const hasHeadings = Object.keys(this.currentHeadingMap).length > 0;
        const hasFigures = Object.keys(this.currentFigureMap).length > 0;

        if (!hasHeadings && !hasFigures) {
            // 直接移除样式，避免递归调用
            this.removeHeadingNumberingStyles();
            return;
        }

        const css = this.generateHeadingNumberingCSS(this.currentHeadingMap);
        this.applyHeadingNumberingCSS(css);
    }



    /**
     * 生成标题编号CSS
     * @param headingMap 标题编号映射
     * @returns CSS字符串
     */
    private generateHeadingNumberingCSS(headingMap: IHeadingNumberMap): string {
        let css = '';
        for (const [blockId, number] of Object.entries(headingMap)) {
            css += `.protyle-wysiwyg [data-node-id="${blockId}"] [contenteditable]::before {
                content: "${number}";
                margin-right: 4px;
                color: var(--b3-theme-on-surface-light);
            }\n`;
        }
        return css;
    }

    /**
     * 应用标题编号CSS
     * @param css CSS字符串
     */
    private applyHeadingNumberingCSS(css: string): void {
        let styleElement = document.getElementById(this.HEADING_STYLE_ID) as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = this.HEADING_STYLE_ID;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    /**
     * 检查编号样式是否已应用
     * @returns 是否已应用
     */
    isNumberingApplied(): boolean {
        const styleElement = document.getElementById(this.HEADING_STYLE_ID);
        return styleElement !== null && styleElement.textContent !== '';
    }

    /**
     * 获取当前编号样式统计
     * @returns 样式统计信息
     */
    getNumberingStats(): {
        headingCount: number;
        figureCount: number;
    } {
        return {
            headingCount: Object.keys(this.currentHeadingMap).length,
            figureCount: Object.keys(this.currentFigureMap).length
        };
    }
}
