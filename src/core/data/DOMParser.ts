/**
 * 图表DOM解析器 - 专门负责从HTML内容中解析图表数据
 * 统一DOM解析逻辑，提供清晰的解析接口
 */

import { IRawFigureData } from '../../types';

export class FigureDOMParser {
    /**
     * 从HTML内容中解析图表数据
     * @param htmlContent HTML内容
     * @returns 原始图表数据数组
     */
    async parseFigures(htmlContent: string): Promise<IRawFigureData[]> {
        if (!htmlContent) {
            return [];
        }

        try {
            const parser = new (globalThis as any).DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // 查找所有超级块
            const superBlocks = doc.querySelectorAll('[data-type="NodeSuperBlock"]');
            const results: IRawFigureData[] = [];

            for (const superBlock of superBlocks) {
                const figuresInSuperBlock = this.analyzeSuperBlock(superBlock);
                results.push(...figuresInSuperBlock);
            }

            console.log(`DOMParser: 从 ${superBlocks.length} 个超级块中解析到 ${results.length} 个图表`);
            return results;

        } catch (error) {
            console.error('DOMParser: 解析HTML内容失败:', error);
            return [];
        }
    }

    /**
     * 分析超级块中的图表
     * @param superBlock 超级块DOM元素
     * @returns 图表数据数组
     */
    private analyzeSuperBlock(superBlock: Element): IRawFigureData[] {
        const results: IRawFigureData[] = [];

        try {
            // 只处理竖直布局（row）的超级块
            const layout = superBlock.getAttribute('data-sb-layout');
            if (layout !== 'row') {
                return results;
            }

            // 获取所有直接子元素（排除属性元素）
            const children = Array.from(superBlock.children).filter(child =>
                !child.classList.contains('protyle-attr')
            );

            // 必须恰好有两个子元素
            if (children.length !== 2) {
                return results;
            }

            // 分析两个子元素，找出图表和文本的组合
            const figureInfo = this.identifyFigureAndTextPair(children, superBlock);
            if (figureInfo) {
                results.push(figureInfo);
            }

        } catch (error) {
            console.error('DOMParser: 分析超级块失败:', error);
        }

        return results;
    }

    /**
     * 识别图表和文本的配对
     * @param children 超级块的子元素数组
     * @param superBlock 超级块元素
     * @returns 图表信息，如果不符合条件则返回null
     */
    private identifyFigureAndTextPair(children: Element[], superBlock: Element): IRawFigureData | null {
        let figureElement: Element | null = null;
        let textElement: Element | null = null;
        let figureType: 'image' | 'table' | null = null;

        // 分析两个子元素
        for (const child of children) {
            const nodeType = child.getAttribute('data-type');

            if (nodeType === 'NodeTable') {
                // 表格元素
                if (figureElement) return null; // 已经有图表了，不符合条件
                figureElement = child;
                figureType = 'table';
            } else if (nodeType === 'NodeParagraph') {
                // 段落元素，检查是否包含图片
                const imgElement = child.querySelector('[data-type="img"]');
                if (imgElement) {
                    // 包含图片的段落
                    if (figureElement) return null; // 已经有图表了，不符合条件
                    figureElement = child;
                    figureType = 'image';
                } else {
                    // 纯文本段落
                    if (textElement) return null; // 已经有文本了，不符合条件
                    textElement = child;
                }
            } else {
                // 其他类型的元素，不符合条件
                return null;
            }
        }

        // 必须同时有图表和文本元素
        if (!figureElement || !textElement || !figureType) {
            return null;
        }

        // 提取图表信息
        const figureId = figureElement.getAttribute('data-node-id');
        const textId = textElement.getAttribute('data-node-id');
        const superBlockId = superBlock.getAttribute('data-node-id');

        if (!figureId || !textId) {
            return null;
        }

        // 提取内容和标题
        const content = this.extractElementContent(figureElement, figureType);
        const caption = this.extractElementText(textElement);

        // 计算DOM顺序
        const domOrder = this.calculateDOMOrder(superBlock);

        return {
            id: figureId,
            nodeType: figureElement.getAttribute('data-type') || '',
            subtype: figureElement.getAttribute('data-subtype') || '',
            figureType: figureType,
            content: content,
            caption: caption,
            captionId: textId,
            domOrder: domOrder,
            superBlockId: superBlockId || undefined
        };
    }

    /**
     * 提取元素内容
     * @param element DOM元素
     * @param figureType 图表类型
     * @returns 内容字符串
     */
    private extractElementContent(element: Element, figureType: 'image' | 'table'): string {
        if (figureType === 'image') {
            // 对于图片，尝试提取markdown格式
            const editableDiv = element.querySelector('[contenteditable="true"]');
            if (editableDiv) {
                return editableDiv.innerHTML || '';
            }
            return element.innerHTML || '';
        } else if (figureType === 'table') {
            // 对于表格，提取表格内容
            return element.innerHTML || '';
        }
        return '';
    }

    /**
     * 提取元素的纯文本内容
     * @param element DOM元素
     * @returns 文本内容
     */
    private extractElementText(element: Element): string {
        const editableDiv = element.querySelector('[contenteditable="true"]');
        if (editableDiv) {
            return editableDiv.textContent?.trim() || '';
        }
        return element.textContent?.trim() || '';
    }

    /**
     * 计算DOM顺序
     * @param superBlock 超级块元素
     * @returns DOM顺序索引
     */
    private calculateDOMOrder(superBlock: Element): number {
        const parent = superBlock.parentElement;
        if (!parent) {
            return 0;
        }

        const siblings = Array.from(parent.children);
        return siblings.indexOf(superBlock);
    }

    /**
     * 验证图表数据的有效性
     * @param data 图表数据
     * @returns 是否有效
     */
    validateFigureData(data: IRawFigureData): boolean {
        return !!(
            data.id &&
            data.figureType &&
            (data.figureType === 'image' || data.figureType === 'table') &&
            data.content &&
            typeof data.domOrder === 'number'
        );
    }

    /**
     * 清理和标准化图表数据
     * @param data 原始图表数据
     * @returns 清理后的数据
     */
    sanitizeFigureData(data: IRawFigureData): IRawFigureData {
        return {
            ...data,
            content: data.content.trim(),
            caption: data.caption?.trim() || '',
            nodeType: data.nodeType.trim(),
            subtype: data.subtype?.trim() || ''
        };
    }
}
