/**
 * 交叉引用管理器 - 重构版本
 * 使用新的架构，提供向后兼容的接口
 */

import { ICrossReference, IFigureInfo } from "../types";
import { DocumentManager } from "./DocumentManager";
import { CrossReferenceController } from "./CrossReferenceController";
import { showMessage } from "siyuan";

export class CrossReference implements ICrossReference {
    private documentManager: DocumentManager;
    private controller: CrossReferenceController;
    private panelUpdateCallback: (() => Promise<void>) | null = null;
    private settingsManager: any = null;
    private betaFeatureManager: any = null;

    constructor(documentManager: DocumentManager) {
        this.documentManager = documentManager;

        // 使用新的控制器
        this.controller = new CrossReferenceController({
            autoUpdate: true,
            enableUI: false, // 暂时禁用UI，保持向后兼容
            enableWebSocket: true
        });
    }

    /**
     * 初始化交叉引用管理器
     */
    async init(): Promise<void> {
        await this.controller.init();
    }

    /**
     * 设置设置管理器引用
     * @param settingsManager 设置管理器实例
     */
    setSettingsManager(settingsManager: any): void {
        this.settingsManager = settingsManager;
    }

    /**
     * 设置内测功能管理器引用
     * @param betaFeatureManager 内测功能管理器实例
     */
    setBetaFeatureManager(betaFeatureManager: any): void {
        this.betaFeatureManager = betaFeatureManager;
    }

    /**
     * 仅更新图表编号前缀的CSS样式，不重新获取图表数据
     * @param docId 文档ID
     */
    async updateFigurePrefixStyles(docId: string): Promise<void> {
        if (!this.settingsManager) {
            console.warn('CrossReference: 设置管理器未设置，无法更新前缀样式');
            return;
        }

        try {
            // 获取最新的前缀设置
            const figurePrefix = await this.settingsManager.getDocumentFigurePrefix(docId);
            const tablePrefix = await this.settingsManager.getDocumentTablePrefix(docId);

            // 使用新控制器更新配置
            this.controller.updateConfig({
                imagePrefix: figurePrefix,
                tablePrefix: tablePrefix
            });

            // 仅更新前缀样式，避免重新处理整个文档
            await this.controller.updatePrefixStylesOnly(docId);

            console.log(`CrossReference: 图表前缀样式已更新 - 图片前缀: ${figurePrefix}, 表格前缀: ${tablePrefix}`);
        } catch (error) {
            console.error('更新图表前缀样式失败:', error);
        }
    }

    /**
     * 设置面板更新回调函数
     * @param callback 面板更新回调函数
     */
    setPanelUpdateCallback(callback: () => Promise<void>): void {
        this.panelUpdateCallback = callback;
    }

    /**
     * 销毁交叉引用管理器
     */
    async destroy(): Promise<void> {
        await this.controller.destroy();

        // 保持向后兼容的清理逻辑
        this.removeCrossReferenceStyles();
        this.unregisterCrossReferenceHint();

        // 清理observer
        if ((this as any).protyleObserver) {
            (this as any).protyleObserver.disconnect();
            delete (this as any).protyleObserver;
        }
    }

    /**
     * 应用交叉引用到指定protyle
     * @param protyle protyle对象
     * @param config 数据获取配置
     */
    async applyCrossReference(protyle: any, config?: { fromWebSocket?: boolean }): Promise<void> {
        if (!protyle) return;

        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            showMessage("交叉引用功能仅对内测用户开放，请联系开发者获取内测码", 3000, "info");
            return;
        }

        try {
            const docId = protyle?.block?.rootID;
            if (docId) {
                // 将配置传递给controller
                await this.controller.enableCrossReference(docId, config);
            }

            // 保持向后兼容的样式加载
            await this.loadCrossReferenceStyles(protyle);
        } catch (error) {
            console.error('应用交叉引用失败:', error);
            throw error;
        }
    }

    /**
     * 清除交叉引用
     * @param protyle protyle对象
     */
    async clearCrossReference(protyle: any): Promise<void> {
        if (!protyle) return;

        try {
            const docId = protyle?.block?.rootID;
            if (docId) {
                await this.controller.disableCrossReference(docId);
            }

            // 保持向后兼容的样式移除
            this.removeCrossReferenceStyles();
        } catch (error) {
            console.error('清除交叉引用失败:', error);
            throw error;
        }
    }

    /**
     * 获取图表列表
     * @param docId 文档ID
     * @returns 图表列表
     */
    async getFiguresList(docId: string): Promise<IFigureInfo[]> {
        if (!docId) return [];

        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            showMessage("交叉引用功能仅对内测用户开放，请联系开发者获取内测码", 3000, "info");
            return [];
        }

        try {
            return await this.controller.getFiguresList(docId);
        } catch (error) {
            console.error('获取图片表格列表失败:', error);
            return [];
        }
    }

    /**
     * 生成图表标题样式（基于DOM解析的数据）
     * 为每个图表的标题元素生成CSS样式，添加编号前缀
     * @param figuresData 图表数据（包含标题信息和编号）
     * @param figurePrefix 图表编号前缀
     * @param tablePrefix 表格编号前缀
     * @returns CSS样式字符串
     */
    private generateFigureCaptionStyles(figuresData: IFigureInfo[], figurePrefix: string = '图', tablePrefix: string = '表'): string {
        let styles = '';

        for (const figure of figuresData) {
            // 检查是否有标题ID（从DOM解析时保存的）
            const captionId = (figure as any).captionId;
            if (captionId && figure.caption) {
                const prefix = figure.type === 'image' ? figurePrefix : tablePrefix;
                styles += `
                    .protyle-wysiwyg [data-node-id="${captionId}"] [contenteditable="true"]::before {
                        content: "${prefix} ${figure.number}: ";
                        color: var(--b3-theme-primary);
                        font-weight: 500;
                    }
                `;
            }
        }

        return styles;
    }

    /**
     * 加载交叉引用样式（现在由新的StyleManager统一管理）
     */
    private async loadCrossReferenceStyles(_protyle?: any): Promise<void> {
        // 移除旧的样式系统，现在统一使用新的StyleManager
        const oldStyleElement = document.getElementById('document-styler-cross-reference');
        if (oldStyleElement) {
            oldStyleElement.remove();
            console.log('CrossReference: 移除了旧的样式元素 document-styler-cross-reference');
        }

        // 现在样式由新的StyleManager统一管理，通过controller处理
        // 这个方法保持向后兼容，但实际样式处理已经迁移到新系统
        console.log('CrossReference: 样式处理已迁移到新的StyleManager系统');
    }

    /**
     * 处理图片表格数据
     * 处理从DOM解析出来的符合条件的图表数据
     * @param figures 从DOM解析的图表数据（已经包含正确顺序和标题信息）
     * @returns 处理后的数据
     */
    private async processFiguresData(figures: any[]): Promise<IFigureInfo[]> {
        const result: IFigureInfo[] = [];
        let imageCount = 0;
        let tableCount = 0;

        // 从DOM解析的数据，按照domOrder排序
        console.log('CrossReference: 使用DOM解析的数据，按domOrder排序');
        figures.sort((a, b) => {
            if (a.domOrder !== undefined && b.domOrder !== undefined) {
                return a.domOrder - b.domOrder;
            }
            // 如果没有domOrder，回退到ID排序
            return a.id.localeCompare(b.id);
        });

        console.log('CrossReference: 排序后的图片表格:', figures.map(f => ({
            id: f.id,
            type: f.figureType,
            domOrder: f.domOrder,
            caption: f.caption
        })));

        for (const figure of figures) {
            if (figure.figureType === 'image') {
                imageCount++;
                result.push({
                    id: figure.id,
                    type: 'image',
                    captionId: figure.captionId,
                    // 优先使用从DOM解析出来的标题，如果没有则从内容中提取
                    content: figure.caption || this.extractImageAlt(figure.content || figure.markdown || ''),
                    caption: figure.caption || this.extractImageCaption(figure.content || figure.markdown || ''),
                    number: imageCount
                });
            } else if (figure.figureType === 'table') {
                tableCount++;
                result.push({
                    id: figure.id,
                    type: 'table',
                    captionId: figure.captionId,
                    // 优先使用从DOM解析出来的标题，如果没有则从内容中提取
                    content: figure.caption || this.extractTableSummary(figure.content || ''),
                    caption: figure.caption || this.extractTableCaption(figure.content || ''),
                    number: tableCount
                });
            }
        }

        return result;
    }

    /**
     * 提取图片的alt文本
     * @param content markdown内容
     * @returns alt文本
     */
    private extractImageAlt(content: string): string {
        // 匹配 ![alt](url) 格式
        const match = content.match(/!\[([^\]]*)\]/);
        return match ? match[1] || '图片' : '图片';
    }

    /**
     * 提取图片标题（从HTML或markdown中）
     * @param content 内容
     * @returns 标题文本
     */
    private extractImageCaption(content: string): string {
        // 尝试从HTML title属性中提取
        const titleMatch = content.match(/title="([^"]*)"/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
        }

        // 尝试从markdown alt文本中提取
        const altMatch = content.match(/!\[([^\]]*)\]/);
        if (altMatch && altMatch[1]) {
            return altMatch[1];
        }

        return '';
    }

    /**
     * 提取表格摘要
     * @param content 表格内容
     * @returns 摘要文本
     */
    private extractTableSummary(content: string): string {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            // 取第一行作为表格描述，移除markdown表格语法
            const firstLine = lines[0].replace(/\|/g, ' ').replace(/[-:]/g, '').trim();
            return firstLine || '表格';
        }
        return '表格';
    }

    /**
     * 提取表格标题（从HTML属性或内容中）
     * @param content 内容
     * @returns 标题文本
     */
    private extractTableCaption(content: string): string {
        // 尝试从HTML data-table-title属性中提取
        const titleMatch = content.match(/data-table-title="([^"]*)"/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
        }

        // 尝试从表格第一行提取（如果看起来像标题）
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
            const firstLine = lines[0].replace(/\|/g, '').trim();
            // 如果第一行不包含分隔符，可能是标题
            if (firstLine && !firstLine.includes('---') && !firstLine.includes(':::')) {
                return firstLine;
            }
        }

        return '';
    }

    /**
     * 移除交叉引用样式
     */
    private removeCrossReferenceStyles(): void {
        // 移除旧的样式元素
        const oldStyleElement = document.getElementById('document-styler-cross-reference');
        if (oldStyleElement) {
            oldStyleElement.remove();
            console.log('CrossReference: 移除了旧的样式元素 document-styler-cross-reference');
        }

        // 新的样式由StyleManager管理，通过controller清除
        // 这里不需要额外处理
    }



    /**
     * 处理 WebSocket transaction 消息
     * @param msg WebSocket 消息
     */
    async handleTransactionMessage(msg: any): Promise<void> {
        try {
            // 检查当前文档是否受影响
            if (!this.documentManager.isCurrentDocumentAffected(msg)) {
                console.log('CrossReference: WebSocket消息不影响当前文档，跳过处理');
                return;
            }

            console.log('CrossReference: 收到影响当前文档的WebSocket消息，检查是否需要更新图表');

            // 分析是否需要更新图片表格索引或超级块结构
            if (this.needsFigureUpdate(msg)) {
                console.log('CrossReference: 检测到需要更新图表，开始处理');
                const currentProtyle = this.documentManager.getCurrentProtyle();
                if (currentProtyle) {
                    // 延迟一小段时间以确保DOM更新完成
                    setTimeout(async () => {
                        try {
                            // WebSocket触发的更新需要强制跳过缓存
                            await this.applyCrossReference(currentProtyle, { fromWebSocket: true });

                            // 通知侧边栏面板更新图表列表
                            if (this.panelUpdateCallback) {
                                await this.panelUpdateCallback();
                                console.log('CrossReference: 侧边栏面板已更新');
                            }
                        } catch (error) {
                            console.error('CrossReference: 延迟更新失败:', error);
                        }
                    }, 100);
                }
            } else {
                console.log('CrossReference: WebSocket消息不需要更新图表');
            }
        } catch (error) {
            console.error('CrossReference: 处理 transaction 消息失败:', error);
        }
    }

    /**
     * 检查消息是否需要更新图片表格索引
     * @param msg WebSocket 消息
     * @returns 是否需要更新
     */
    private needsFigureUpdate(msg: any): boolean {
        if (!msg.data || !Array.isArray(msg.data)) {
            console.log('CrossReference: 消息数据格式不正确');
            return false;
        }

        // 检查是否包含图片、表格或超级块相关的操作
        const needsUpdate = msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作数据中是否包含相关节点类型
                if (operation.data && typeof operation.data === 'string') {
                    const isFigureRelated = operation.data.includes('data-type="NodeTable"') ||
                                          operation.data.includes('<img') ||
                                          operation.data.includes('data-type="NodeSuperBlock"') ||
                                          operation.data.includes('data-sb-layout');

                    if (isFigureRelated) {
                        console.log(`CrossReference: 检测到图表相关操作 - 动作: ${operation.action}, 数据包含: ${
                            operation.data.includes('data-type="NodeTable"') ? 'NodeTable ' : ''
                        }${operation.data.includes('<img') ? 'img ' : ''}${
                            operation.data.includes('data-type="NodeSuperBlock"') ? 'NodeSuperBlock ' : ''
                        }${operation.data.includes('data-sb-layout') ? 'sb-layout' : ''}`);
                        return true;
                    }
                }

                return false;
            });
        });

        console.log(`CrossReference: needsFigureUpdate 结果: ${needsUpdate}`);
        return needsUpdate;
    }

    /**
     * 注册@符号交叉引用功能
     */
    private registerCrossReferenceHint(): void {
        // 检查是否已经有protyle实例可用
        const protyles = document.querySelectorAll('.protyle');
        protyles.forEach((protyleElement) => {
            const protyle = (protyleElement as any).protyle;
            if (protyle && protyle.options && protyle.options.hint) {
                // 添加@符号的hint扩展
                if (!protyle.options.hint.extend) {
                    protyle.options.hint.extend = [];
                }

                // 检查是否已经注册过
                const existingIndex = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                if (existingIndex === -1) {
                    protyle.options.hint.extend.push({
                        key: '@',
                        hint: this.generateCrossReferenceHints.bind(this)
                    });
                    console.log('CrossReference: 已注册@符号交叉引用功能');
                }
            }
        });

        // 监听新的protyle创建
        this.setupProtyleListener();
    }

    /**
     * 注销@符号交叉引用功能
     */
    private unregisterCrossReferenceHint(): void {
        const protyles = document.querySelectorAll('.protyle');
        protyles.forEach((protyleElement) => {
            const protyle = (protyleElement as any).protyle;
            if (protyle && protyle.options && protyle.options.hint && protyle.options.hint.extend) {
                // 移除@符号的hint扩展
                const index = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                if (index !== -1) {
                    protyle.options.hint.extend.splice(index, 1);
                    console.log('CrossReference: 已注销@符号交叉引用功能');
                }
            }
        });
    }

    /**
     * 设置protyle监听器，为新创建的protyle添加hint扩展
     */
    private setupProtyleListener(): void {
        // 监听DOM变化，当有新的protyle创建时自动注册hint
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        if (element.classList && element.classList.contains('protyle')) {
                            // 延迟一下确保protyle完全初始化
                            setTimeout(() => {
                                const protyle = (element as any).protyle;
                                if (protyle && protyle.options && protyle.options.hint) {
                                    if (!protyle.options.hint.extend) {
                                        protyle.options.hint.extend = [];
                                    }

                                    const existingIndex = protyle.options.hint.extend.findIndex((item: any) => item.key === '@');
                                    if (existingIndex === -1) {
                                        protyle.options.hint.extend.push({
                                            key: '@',
                                            hint: this.generateCrossReferenceHints.bind(this)
                                        });
                                        console.log('CrossReference: 为新protyle注册@符号交叉引用功能');
                                    }
                                }
                            }, 100);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 保存observer引用以便后续清理
        (this as any).protyleObserver = observer;
    }

    /**
     * 生成交叉引用提示
     * @param key 输入的关键字
     * @param protyle 编辑器实例
     * @param source 来源
     * @returns 提示数据数组
     */
    private async generateCrossReferenceHints(key: string, protyle: any): Promise<any[]> {
        if (!protyle || !protyle.block || !protyle.block.rootID) {
            return [];
        }

        try {
            const docId = protyle.block.rootID;
            const figures = await this.getFiguresList(docId);

            const hints: any[] = [];

            // 过滤匹配的图片和表格
            figures.forEach((figure) => {
                const searchText = `${figure.type === 'image' ? '图' : '表'} ${figure.number}`;
                const content = figure.content || figure.caption || '';

                if (!key || searchText.includes(key) || content.includes(key)) {
                    hints.push({
                        value: `<span data-type="cross-ref" data-figure-id="${figure.id}" data-figure-type="${figure.type}" data-figure-number="${figure.number}">${searchText}</span>`,
                        html: `<div class="b3-list-item__first">
                            <svg class="b3-list-item__graphic">
                                <use xlink:href="#icon${figure.type === 'image' ? 'Image' : 'Table'}"></use>
                            </svg>
                            <span class="b3-list-item__text">${searchText}${content ? ': ' + content : ''}</span>
                        </div>`,
                        id: figure.id,
                        focus: false
                    });
                }
            });

            return hints;
        } catch (error) {
            console.error('CrossReference: 生成交叉引用提示失败:', error);
            return [];
        }
    }

    /**
     * 注册交叉引用点击处理器
     */
    private registerCrossReferenceClickHandler(): void {
        // 使用事件委托处理交叉引用点击
        document.addEventListener('click', this.handleCrossReferenceClick.bind(this));
    }

    /**
     * 处理交叉引用点击事件
     * @param event 点击事件
     */
    private handleCrossReferenceClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const crossRefElement = target.closest('[data-type="cross-ref"]') as HTMLElement;

        if (crossRefElement) {
            event.preventDefault();
            event.stopPropagation();

            const figureId = crossRefElement.getAttribute('data-figure-id');
            const figureType = crossRefElement.getAttribute('data-figure-type');
            const figureNumber = crossRefElement.getAttribute('data-figure-number');

            if (figureId) {
                this.scrollToFigure(figureId, figureType, figureNumber);
            }
        }
    }

    /**
     * 手动触发交叉引用更新（用于调试和特殊情况）
     */
    async forceUpdate(): Promise<void> {
        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            showMessage("交叉引用功能仅对内测用户开放，请联系开发者获取内测码", 3000, "info");
            return;
        }

        const currentProtyle = this.documentManager.getCurrentProtyle();
        if (currentProtyle) {
            console.log('CrossReference: 手动触发交叉引用更新');
            await this.applyCrossReference(currentProtyle);

            // 通知侧边栏面板更新图表列表
            if (this.panelUpdateCallback) {
                await this.panelUpdateCallback();
                console.log('CrossReference: 侧边栏面板已更新');
            }
        } else {
            console.warn('CrossReference: 无法手动更新，当前protyle不存在');
        }
    }

    /**
     * 滚动到指定的图片或表格
     * @param figureId 图片或表格的ID
     * @param figureType 类型（image或table）
     * @param figureNumber 编号
     */
    scrollToFigure(figureId: string, figureType?: string, figureNumber?: string): void {
        // 检查是否为内测用户
        if (this.betaFeatureManager && !this.betaFeatureManager.isBetaVerified()) {
            showMessage("交叉引用功能仅对内测用户开放，请联系开发者获取内测码", 3000, "info");
            return;
        }

        const targetElement = document.querySelector(`[data-node-id="${figureId}"]`) as HTMLElement;

        if (targetElement) {
            // 滚动到目标元素
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // 高亮显示目标元素
            targetElement.style.transition = 'background-color 0.3s ease';
            targetElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';

            setTimeout(() => {
                targetElement.style.backgroundColor = '';
                setTimeout(() => {
                    targetElement.style.transition = '';
                }, 300);
            }, 1500);

            console.log(`CrossReference: 跳转到${figureType === 'image' ? '图片' : '表格'} ${figureNumber}`);
        } else {
            console.warn(`CrossReference: 未找到ID为 ${figureId} 的${figureType === 'image' ? '图片' : '表格'}`);
        }
    }
}
