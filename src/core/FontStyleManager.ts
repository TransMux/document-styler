/**
 * 字体样式管理器
 * 负责管理文档的字体样式设置
 */

import { IFontSettings, IModule } from "../types";
import { SettingsManager } from "./SettingsManager";

export class FontStyleManager implements IModule {
    private readonly FONT_STYLE_ID_PREFIX = 'document-styler-font-';
    private appliedStyles: Map<string, HTMLStyleElement> = new Map();
    private settingsManager: SettingsManager;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
    }

    async init(): Promise<void> {
        // 初始化时清理可能存在的旧样式
        this.clearAllStyles();
    }

    destroy(): void {
        this.clearAllStyles();
        this.appliedStyles.clear();
    }

    /**
     * 应用文档字体样式
     * @param docId 文档ID
     * @param fontSettings 字体设置
     */
    async applyFontStyles(docId: string, fontSettings: IFontSettings): Promise<void> {
        if (!docId) {
            console.warn('FontStyleManager: 文档ID为空，无法应用字体样式');
            return;
        }

        try {
            // 检查是否启用了文章字体自定义
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            if (!docSettings.customFontEnabled) {
                console.log(`FontStyleManager: 文档 ${docId} 未启用文章字体自定义，清除字体样式`);
                await this.clearDocumentStyles(docId);
                return;
            }

            // 清除该文档的旧样式
            await this.clearDocumentStyles(docId);

            // 生成CSS样式
            const cssContent = this.generateFontCSS(docId, fontSettings);

            // 如果CSS内容为空或者字体设置都是默认值，则不应用样式
            if (!cssContent || this.isDefaultFontSettings(fontSettings)) {
                console.log(`FontStyleManager: 文档 ${docId} 使用默认字体设置，不应用自定义样式`);
                return;
            }

            // 应用样式
            const styleId = this.generateStyleId(docId);
            const styleElement = this.createStyleElement(styleId, cssContent);
            this.injectStyleElement(styleElement);

            // 记录样式
            this.appliedStyles.set(docId, styleElement);

            console.log(`FontStyleManager: 已为文档 ${docId} 应用字体样式`);
        } catch (error) {
            console.error(`FontStyleManager: 应用文档 ${docId} 字体样式失败:`, error);
        }
    }

    /**
     * 清除文档字体样式
     * @param docId 文档ID
     */
    async clearDocumentStyles(docId: string): Promise<void> {
        if (!docId) return;

        try {
            const styleElement = this.appliedStyles.get(docId);
            if (styleElement && styleElement.parentNode) {
                styleElement.parentNode.removeChild(styleElement);
            }
            this.appliedStyles.delete(docId);

            console.log(`FontStyleManager: 已清除文档 ${docId} 的字体样式`);
        } catch (error) {
            console.error(`FontStyleManager: 清除文档 ${docId} 字体样式失败:`, error);
        }
    }

    /**
     * 清除所有字体样式
     */
    clearAllStyles(): void {
        try {
            // 清除记录的样式元素
            for (const [docId, styleElement] of this.appliedStyles) {
                if (styleElement && styleElement.parentNode) {
                    styleElement.parentNode.removeChild(styleElement);
                }
            }
            this.appliedStyles.clear();

            // 清除可能遗留的样式元素
            const existingStyles = document.querySelectorAll(`style[id^="${this.FONT_STYLE_ID_PREFIX}"]`);
            existingStyles.forEach(style => {
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            });

            console.log('FontStyleManager: 已清除所有字体样式');
        } catch (error) {
            console.error('FontStyleManager: 清除所有字体样式失败:', error);
        }
    }

    /**
     * 检查是否为默认字体设置
     * @param fontSettings 字体设置
     * @returns 是否为默认设置
     */
    private isDefaultFontSettings(fontSettings: IFontSettings): boolean {
        return (
            (!fontSettings.fontFamily || fontSettings.fontFamily === '') &&
            (!fontSettings.fontSize || fontSettings.fontSize === '16px') &&
            (!fontSettings.lineHeight || fontSettings.lineHeight === '1.6')
        );
    }

    /**
     * 生成字体CSS样式
     * @param docId 文档ID
     * @param fontSettings 字体设置
     * @returns CSS样式字符串
     */
    private generateFontCSS(docId: string, fontSettings: IFontSettings): string {
        const styles: string[] = [];

        // 构建CSS属性
        const cssProperties: string[] = [];

        if (fontSettings.fontFamily && fontSettings.fontFamily !== '') {
            cssProperties.push(`font-family: ${fontSettings.fontFamily}`);
        }

        if (fontSettings.fontSize && fontSettings.fontSize !== '16px') {
            cssProperties.push(`font-size: ${fontSettings.fontSize}`);
        }

        if (fontSettings.lineHeight && fontSettings.lineHeight !== '1.6') {
            cssProperties.push(`line-height: ${fontSettings.lineHeight}`);
        }

        // 如果没有需要设置的属性，返回空字符串
        if (cssProperties.length === 0) {
            return '';
        }

        // 生成针对特定文档的CSS规则
        const cssRule = `
/* 文档 ${docId} 的字体样式 */
.protyle[data-doc-id="${docId}"] .protyle-wysiwyg,
.protyle[data-doc-id="${docId}"] .protyle-wysiwyg [contenteditable],
.protyle-wysiwyg[data-doc-id="${docId}"],
.protyle-wysiwyg[data-doc-id="${docId}"] [contenteditable],
.protyle-wysiwyg[data-doc-id="${docId}"] .protyle-wysiwyg__embed,
.protyle-wysiwyg[data-doc-id="${docId}"] [data-type="NodeParagraph"],
.protyle-wysiwyg[data-doc-id="${docId}"] [data-type="NodeHeading"],
.protyle-wysiwyg[data-doc-id="${docId}"] [data-type="NodeList"],
.protyle-wysiwyg[data-doc-id="${docId}"] [data-type="NodeListItem"],
.protyle-wysiwyg[data-doc-id="${docId}"] [data-type="NodeBlockquote"] {
    ${cssProperties.join(';\n    ')};
}`;

        styles.push(cssRule);

        return styles.join('\n\n');
    }

    /**
     * 生成样式ID
     * @param docId 文档ID
     * @returns 样式ID
     */
    private generateStyleId(docId: string): string {
        return `${this.FONT_STYLE_ID_PREFIX}${docId}`;
    }

    /**
     * 创建样式元素
     * @param styleId 样式ID
     * @param cssContent CSS内容
     * @returns 样式元素
     */
    private createStyleElement(styleId: string, cssContent: string): HTMLStyleElement {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.type = 'text/css';
        styleElement.textContent = cssContent;
        return styleElement;
    }

    /**
     * 注入样式元素
     * @param styleElement 样式元素
     */
    private injectStyleElement(styleElement: HTMLStyleElement): void {
        document.head.appendChild(styleElement);
    }

    /**
     * 获取当前应用的字体样式统计
     * @returns 样式统计信息
     */
    getStyleStats(): {
        appliedDocuments: number;
        documentIds: string[];
    } {
        return {
            appliedDocuments: this.appliedStyles.size,
            documentIds: Array.from(this.appliedStyles.keys())
        };
    }

    /**
     * 检查文档是否已应用字体样式
     * @param docId 文档ID
     * @returns 是否已应用样式
     */
    hasDocumentStyles(docId: string): boolean {
        return this.appliedStyles.has(docId);
    }
}
