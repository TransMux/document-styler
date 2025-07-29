/**
 * 样式应用器 - 负责CSS样式的实际应用和管理
 * 处理样式的注入、更新、移除等操作
 */

export interface IStyleApplicationConfig {
    /** 样式作用域 */
    scope?: string;
    /** CSS类名 */
    className?: string;
    /** 是否立即应用 */
    immediate?: boolean;
    /** 优先级 */
    priority?: number;
}

export class StyleApplicator {
    private appliedStyles = new Map<string, HTMLStyleElement>();
    private styleCounter = 0;

    /**
     * 应用CSS样式
     * @param id 样式ID
     * @param cssContent CSS内容
     * @param config 应用配置
     * @returns 样式元素ID
     */
    async applyStyles(
        id: string, 
        cssContent: string, 
        config: IStyleApplicationConfig = {}
    ): Promise<string> {
        if (!id || !cssContent) {
            throw new Error('样式ID和CSS内容不能为空');
        }

        try {
            // 生成唯一的样式ID
            const styleId = this.generateStyleId(id);

            // 移除已存在的样式
            await this.removeStyles(styleId);

            // 创建样式元素
            const styleElement = this.createStyleElement(styleId, cssContent, config);

            // 应用样式
            this.injectStyleElement(styleElement, config);

            // 记录样式
            this.appliedStyles.set(styleId, styleElement);

            console.log(`StyleApplicator: 应用样式 ${styleId}，内容长度: ${cssContent.length}`);
            return styleId;

        } catch (error) {
            console.error(`StyleApplicator: 应用样式 ${id} 失败:`, error);
            throw error;
        }
    }

    /**
     * 移除CSS样式
     * @param styleId 样式ID
     */
    async removeStyles(styleId: string): Promise<void> {
        if (!styleId) {
            return;
        }

        try {
            const styleElement = this.appliedStyles.get(styleId);
            if (styleElement && styleElement.parentNode) {
                styleElement.parentNode.removeChild(styleElement);
                this.appliedStyles.delete(styleId);
                console.log(`StyleApplicator: 移除样式 ${styleId}`);
            }

        } catch (error) {
            console.error(`StyleApplicator: 移除样式 ${styleId} 失败:`, error);
            throw error;
        }
    }

    /**
     * 更新CSS样式
     * @param styleId 样式ID
     * @param cssContent 新的CSS内容
     */
    async updateStyles(styleId: string, cssContent: string): Promise<void> {
        if (!styleId || !cssContent) {
            throw new Error('样式ID和CSS内容不能为空');
        }

        try {
            const styleElement = this.appliedStyles.get(styleId);
            if (styleElement) {
                styleElement.textContent = cssContent;
                console.log(`StyleApplicator: 更新样式 ${styleId}`);
            } else {
                console.warn(`StyleApplicator: 样式 ${styleId} 不存在，无法更新`);
            }

        } catch (error) {
            console.error(`StyleApplicator: 更新样式 ${styleId} 失败:`, error);
            throw error;
        }
    }

    /**
     * 检查样式是否已应用
     * @param styleId 样式ID
     * @returns 是否已应用
     */
    hasStyles(styleId: string): boolean {
        return this.appliedStyles.has(styleId);
    }

    /**
     * 获取已应用的样式数量
     * @returns 样式数量
     */
    getAppliedStylesCount(): number {
        return this.appliedStyles.size;
    }

    /**
     * 获取所有已应用的样式ID
     * @returns 样式ID数组
     */
    getAppliedStyleIds(): string[] {
        return Array.from(this.appliedStyles.keys());
    }

    /**
     * 生成样式ID
     * @param baseId 基础ID
     * @returns 唯一样式ID
     */
    private generateStyleId(baseId: string): string {
        this.styleCounter++;
        return `document-styler-${baseId}-${this.styleCounter}-${Date.now()}`;
    }

    /**
     * 创建样式元素
     * @param styleId 样式ID
     * @param cssContent CSS内容
     * @param config 配置
     * @returns 样式元素
     */
    private createStyleElement(
        styleId: string, 
        cssContent: string, 
        config: IStyleApplicationConfig
    ): HTMLStyleElement {
        const styleElement = document.createElement('style');
        
        // 设置基本属性
        styleElement.id = styleId;
        styleElement.type = 'text/css';
        styleElement.textContent = cssContent;

        // 设置数据属性
        styleElement.setAttribute('data-source', 'document-styler');
        styleElement.setAttribute('data-scope', config.scope || 'global');
        
        if (config.className) {
            styleElement.setAttribute('data-class', config.className);
        }

        if (config.priority !== undefined) {
            styleElement.setAttribute('data-priority', config.priority.toString());
        }

        return styleElement;
    }

    /**
     * 注入样式元素到DOM
     * @param styleElement 样式元素
     * @param config 配置
     */
    private injectStyleElement(
        styleElement: HTMLStyleElement, 
        config: IStyleApplicationConfig
    ): void {
        const target = this.getInjectionTarget(config);
        
        // 根据优先级插入
        if (config.priority !== undefined) {
            this.insertByPriority(target, styleElement, config.priority);
        } else {
            target.appendChild(styleElement);
        }
    }

    /**
     * 获取注入目标
     * @param config 配置
     * @returns 目标元素
     */
    private getInjectionTarget(config: IStyleApplicationConfig): HTMLElement {
        // 优先注入到head
        if (document.head) {
            return document.head;
        }

        // 降级到document.documentElement
        if (document.documentElement) {
            return document.documentElement;
        }

        throw new Error('无法找到样式注入目标');
    }

    /**
     * 按优先级插入样式元素
     * @param target 目标元素
     * @param styleElement 样式元素
     * @param priority 优先级
     */
    private insertByPriority(
        target: HTMLElement, 
        styleElement: HTMLStyleElement, 
        priority: number
    ): void {
        const existingStyles = Array.from(target.querySelectorAll('style[data-source="document-styler"]'));
        
        // 找到合适的插入位置
        let insertBefore: Element | null = null;
        
        for (const existing of existingStyles) {
            const existingPriority = parseInt(existing.getAttribute('data-priority') || '0');
            if (existingPriority > priority) {
                insertBefore = existing;
                break;
            }
        }

        if (insertBefore) {
            target.insertBefore(styleElement, insertBefore);
        } else {
            target.appendChild(styleElement);
        }
    }

    /**
     * 清理无效的样式引用
     */
    cleanup(): void {
        const invalidIds: string[] = [];

        for (const [styleId, styleElement] of this.appliedStyles.entries()) {
            // 检查元素是否还在DOM中
            if (!document.contains(styleElement)) {
                invalidIds.push(styleId);
            }
        }

        // 移除无效引用
        for (const id of invalidIds) {
            this.appliedStyles.delete(id);
        }

        if (invalidIds.length > 0) {
            console.log(`StyleApplicator: 清理了 ${invalidIds.length} 个无效样式引用`);
        }
    }

    /**
     * 获取内存使用量（估算）
     * @returns 内存使用量（字节）
     */
    getMemoryUsage(): number {
        let size = 0;

        for (const [styleId, styleElement] of this.appliedStyles.entries()) {
            size += styleId.length * 2; // 字符串大小（UTF-16）
            size += (styleElement.textContent || '').length * 2;
            size += 100; // 元素对象的估算大小
        }

        return size;
    }

    /**
     * 获取样式统计信息
     * @returns 统计信息
     */
    getStats(): {
        totalStyles: number;
        memoryUsage: number;
        averageStyleSize: number;
    } {
        const totalStyles = this.appliedStyles.size;
        const memoryUsage = this.getMemoryUsage();
        const averageStyleSize = totalStyles > 0 ? memoryUsage / totalStyles : 0;

        return {
            totalStyles,
            memoryUsage,
            averageStyleSize
        };
    }

    /**
     * 导出所有样式
     * @returns 样式映射
     */
    exportStyles(): Map<string, string> {
        const exported = new Map<string, string>();

        for (const [styleId, styleElement] of this.appliedStyles.entries()) {
            exported.set(styleId, styleElement.textContent || '');
        }

        return exported;
    }

    /**
     * 销毁样式应用器
     */
    destroy(): void {
        try {
            // 移除所有样式
            for (const styleId of this.appliedStyles.keys()) {
                this.removeStyles(styleId);
            }

            this.appliedStyles.clear();
            this.styleCounter = 0;

            console.log('StyleApplicator: 销毁完成');

        } catch (error) {
            console.error('StyleApplicator: 销毁失败:', error);
        }
    }
}
