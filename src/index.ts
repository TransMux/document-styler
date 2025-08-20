import { Plugin, App, showMessage } from "siyuan";
import { insertBlock, updateBlock } from "./api";
import { batchUpdateBlockContent } from "./utils/apiUtils";
import { Custom, setupWebSocketHandler, hasWebSocket } from "./utils/siyuan-api";

// 导入核心组件
import { SettingsManager } from "./core/SettingsManager";
import { DocumentManager } from "./core/DocumentManager";
import { HeadingNumbering } from "./core/HeadingNumbering";
import { CrossReference } from "./core/CrossReference";
import { FontStyleManager } from "./core/FontStyleManager";
import { BetaFeatureManager } from "./core/BetaFeatureManager";
import { ImageStackManager } from "./core/ImageStackManager";
import { DockPanel } from "./ui/DockPanel";
import { StyleManager } from "./ui/StyleManager";
import { IPluginOptions, IDocumentStylerSettings, IDocumentInfo } from "./types";

/**
 * Built-in plugin: Document Styler
 * 提供文档样式设置的侧边栏面板，包括：
 * - 标题自动编号与高级格式化选项
 * - 图片/表格交叉引用与标题标签
 * - 实时更新与可自定义编号格式
 */
export default class DocumentStylerPlugin extends Plugin {
    private appRef: App;

    // 核心组件 - 简化架构，只保留必要的模块
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private headingNumbering: HeadingNumbering;
    private crossReference: CrossReference;
    private fontStyleManager: FontStyleManager;
    private betaFeatureManager: BetaFeatureManager;
    private styleManager: StyleManager;
    private dockPanel: DockPanel;
    private imageStackManager: ImageStackManager;

    // 事件监听器管理
    private eventListeners: Map<string, Function> = new Map();
    private currentDocId: string | null = null;

    // 活跃的protyle跟踪 - 用于管理样式清理
    private activeProtyles: Set<string> = new Set();

    // 防重复处理
    private lastSwitchTime = 0;
    private switchDebounceDelay = 300; // 300ms防抖

    constructor(options: IPluginOptions) {
        super(options);
        this.appRef = options.app;

        // 将插件实例暴露到全局，供HTML onclick使用
        (window as any).documentStylerPlugin = this;

        // 注册斜杠命令
        this.registerSlashCommands();

        // 注册命令面板命令
        this.registerCommands();

        // 初始化核心组件 - 简化依赖关系
        this.initializeComponents();
    }

    /**
     * 注册斜杠命令
     */
    private registerSlashCommands(): void {
        // 注册交叉引用斜杠命令
        this.protyleSlash.push({
            filter: ["cross-reference", "cross reference", "交叉引用", "jiaochayinyong", "jcyy", "图表引用", "tubiaoyinyong", "tbyy"],
            html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconRef"></use></svg><span class="b3-list-item__text">交叉引用</span></div>`,
            id: "crossReference",
            callback: (protyle: any) => {
                // 检查是否为内测用户
                if (!this.betaFeatureManager.isBetaVerified()) {
                    // 非内测用户，弹出提示信息
                    return;
                }

                // 从protyle中获取当前节点元素
                const nodeElement = protyle.wysiwyg?.element?.querySelector('.protyle-wysiwyg--select') as HTMLElement;
                this.handleCrossReferenceSlash(protyle, nodeElement);
            }
        });
    }

    /**
     * 注册命令面板命令（使用 addCommand）
     */
    private registerCommands(): void {
        // 行内换行转多块
        this.addCommand({
            langKey: "splitInlineBreaksToBlocks",
            langText: "行内换行转多块 (break inline to blocks)",
            hotkey: "",
            callback: async () => {
                debugger
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.handleSplitInlineBreaks(protyle);
                }
            },
        });

        // 将选中范围的文本内的图片设置为行高
        this.addCommand({
            langKey: "setSelectedImagesToLineHeight",
            langText: "将选中范围的图片设置为行高 （set inline image to line height）",
            hotkey: "",
            callback: async () => {
                debugger
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.handleSetImagesToLineHeight(protyle);
                }
            },
        });
    }

    /**
     * 初始化核心组件
     */
    private initializeComponents(): void {
        // 按依赖顺序创建组件
        this.settingsManager = new SettingsManager(this);
        this.documentManager = new DocumentManager(this.appRef);
        this.fontStyleManager = new FontStyleManager(this.settingsManager);
        this.styleManager = new StyleManager();
        this.imageStackManager = new ImageStackManager(this.settingsManager, this.documentManager, this.styleManager);

        // 功能组件
        this.headingNumbering = new HeadingNumbering(
            this.settingsManager,
            this.documentManager,
            this.styleManager
        );
        this.crossReference = new CrossReference(this.documentManager);
        this.crossReference.setSettingsManager(this.settingsManager);
        this.betaFeatureManager = new BetaFeatureManager(this.settingsManager);
        this.crossReference.setBetaFeatureManager(this.betaFeatureManager);

        // UI组件
        this.dockPanel = new DockPanel(
            this.settingsManager,
            this.documentManager,
            this.crossReference,
            this.betaFeatureManager,
            this
        );

        // 设置交叉引用的面板更新回调
        this.crossReference.setPanelUpdateCallback(async () => {
            await this.dockPanel.updatePanel();
        });

        // 注入“图片高度=行高”的CSS规则
        this.styleManager.ensureImageLineHeightRule();
    }

    /**
     * 插件加载时调用
     */
    async onload(): Promise<void> {
        try {
            // 初始化所有组件
            await this.initializeAllComponents();

            // 绑定事件监听器
            this.bindEvents();

            // 注册侧边栏面板
            this.registerDockPanel();

            console.log('DocumentStyler plugin loaded successfully');
        } catch (error) {
            console.error('DocumentStyler plugin failed to load:', error);
        }
    }

    /**
     * 插件卸载时调用
     */
    async onunload(): Promise<void> {
        try {
            // 解绑事件监听器
            this.unbindEvents();

            // 销毁所有组件
            this.destroyAllComponents();

            // 清理全局引用
            delete (window as any).documentStylerPlugin;

            console.log('DocumentStyler plugin unloaded successfully');
        } catch (error) {
            console.error('DocumentStyler plugin failed to unload:', error);
        }
    }

    /**
     * 初始化所有组件
     */
    private async initializeAllComponents(): Promise<void> {
        // 按依赖顺序初始化组件
        await this.settingsManager.init();
        await this.documentManager.init();
        await this.fontStyleManager.init();
        await this.styleManager.init();
        await this.betaFeatureManager.init();
        await this.headingNumbering.init();
        await this.crossReference.init();
        await this.imageStackManager.init();
        await this.dockPanel.init();
    }

    /**
     * 销毁所有组件
     */
    private destroyAllComponents(): void {
        // 按相反顺序销毁组件
        this.dockPanel?.destroy();
        this.crossReference?.destroy();
        this.headingNumbering?.destroy();
        this.betaFeatureManager?.destroy();
        this.styleManager?.destroy();
        this.fontStyleManager?.destroy();
        this.documentManager?.destroy();
        this.settingsManager?.destroy();
    }

    /**
     * 绑定事件监听器 - 合并EventHandler的功能
     */
    private bindEvents(): void {
        // 文档切换事件
        const onDocumentSwitch = this.onDocumentSwitch.bind(this);
        this.eventBus.on("switch-protyle", onDocumentSwitch);
        this.eventListeners.set("switch-protyle", onDocumentSwitch);

        // 文档加载事件
        const onDocumentLoaded = this.onDocumentLoaded.bind(this);
        this.eventBus.on("loaded-protyle-static", onDocumentLoaded);
        this.eventListeners.set("loaded-protyle-static", onDocumentLoaded);

        // 文档销毁事件
        const onDocumentDestroy = this.onDocumentDestroy.bind(this);
        this.eventBus.on("destroy-protyle", onDocumentDestroy);
        this.eventListeners.set("destroy-protyle", onDocumentDestroy);

        // WebSocket 事件监听 - 简化版本
        this.setupWebSocketListener();
    }

    /**
     * 解绑事件监听器
     */
    private unbindEvents(): void {
        // 移除所有事件监听器
        for (const [eventName, listener] of this.eventListeners) {
            this.eventBus.off(eventName as any, listener as any);
        }
        this.eventListeners.clear();
    }

    /**
     * 设置WebSocket监听器 - 简化版本，只监听必要事件
     */
    private setupWebSocketListener(): void {
        if (hasWebSocket()) {
            setupWebSocketHandler((event: MessageEvent) => {
                this.handleWebSocketMessage(event);
            });
        }
    }

    /**
     * 添加文档ID到protyle元素
     * @param protyle 编辑器实例
     * @param docId 文档ID
     */
    private addDocIdToProtyle(protyle: any, docId: string): void {
        try {
            if (protyle && protyle.element) {
                // 添加data-doc-id属性到protyle元素
                protyle.element.setAttribute('data-doc-id', docId);

                // 也添加到wysiwyg元素上，以便CSS选择器能够正确匹配
                if (protyle.wysiwyg && protyle.wysiwyg.element) {
                    protyle.wysiwyg.element.setAttribute('data-doc-id', docId);
                }

                console.log(`DocumentStyler: 已为文档 ${docId} 添加data-doc-id属性`);
            }
        } catch (error) {
            console.error('DocumentStyler: 添加data-doc-id属性失败:', error);
        }
    }

    /**
     * 文档切换事件处理
     */
    private async onDocumentSwitch(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const newDocId = protyle.block.rootID;
            const now = Date.now();

            // 检查是否是同一个文档
            if (this.currentDocId === newDocId) return;

            // 立即更新文档ID，确保后续操作使用正确的ID
            this.currentDocId = newDocId;
            this.documentManager.updateCurrentDocument(protyle);

            // 添加data-doc-id属性到protyle元素上
            this.addDocIdToProtyle(protyle, newDocId);

            // 跟踪活跃的protyle
            this.activeProtyles.add(newDocId);

            // 防抖处理，避免短时间内重复的完整处理流程
            if (now - this.lastSwitchTime < this.switchDebounceDelay) {
                console.log(`DocumentStyler: 快速切换到文档 ${newDocId}，仅更新ID，跳过完整处理`);
                // 仍然需要更新面板以显示正确的文档信息
                await this.dockPanel.updatePanel();
                return;
            }

            this.lastSwitchTime = now;
            console.log(`DocumentStyler: 完整处理文档切换到 ${newDocId}`);

            // 更新面板
            await this.dockPanel.updatePanel();

            // 应用当前文档的设置
            await this.applyCurrentDocumentSettings();
            // 应用图片堆叠
            await this.imageStackManager.applyForCurrentDocument();

            // 延迟检查是否需要更新交叉引用（防止WebSocket消息处理的竞争条件）
            setTimeout(async () => {
                try {
                    const docSettings = await this.settingsManager.getDocumentSettings(newDocId);
                    if (docSettings.crossReferenceEnabled) {
                        const protyle = this.documentManager.getCurrentProtyle();
                        if (protyle) {
                            console.log('DocumentStyler: 文档切换后延迟检查交叉引用更新');
                            await this.crossReference.applyCrossReference(protyle);
                        }
                    }
                } catch (error) {
                    console.error('DocumentStyler: 延迟更新交叉引用失败:', error);
                }
            }, 500); // 500ms延迟，确保DOM更新完成
        } catch (error) {
            console.error('DocumentStyler: 文档切换处理失败:', error);
        }
    }

    /**
     * 文档加载事件处理
     */
    private async onDocumentLoaded(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const docId = protyle.block.rootID;
            this.currentDocId = docId;
            this.documentManager.updateCurrentDocument(protyle);

            // 添加data-doc-id属性到protyle元素上
            this.addDocIdToProtyle(protyle, docId);

            // 跟踪活跃的protyle
            this.activeProtyles.add(docId);

            // 应用当前文档的设置
            await this.applyCurrentDocumentSettings();
            // 应用图片堆叠
            await this.imageStackManager.applyForCurrentDocument();
        } catch (error) {
            console.error('DocumentStyler: 文档加载处理失败:', error);
        }
    }

    /**
     * 文档销毁事件处理
     */
    private async onDocumentDestroy(event: CustomEvent): Promise<void> {
        try {
            const protyle = event.detail?.protyle;
            if (!protyle?.block?.rootID) return;

            const docId = protyle.block.rootID;
            console.log(`DocumentStyler: 处理文档销毁事件 - ${docId}`);

            // 从活跃protyle集合中移除
            this.activeProtyles.delete(docId);

            // 检查是否还有其他protyle在使用样式
            const hasActiveProtyles = this.activeProtyles.size > 0;

            if (!hasActiveProtyles) {
                // 如果没有活跃的protyle了，清理所有样式
                console.log('DocumentStyler: 没有活跃的protyle，清理所有样式');
                await this.headingNumbering.clearNumbering(null);
                await this.crossReference.clearCrossReference(protyle);
                this.fontStyleManager.clearAllStyles();
            } else {
                console.log(`DocumentStyler: 还有 ${this.activeProtyles.size} 个活跃的protyle，保留样式`);
            }
        } catch (error) {
            console.error('DocumentStyler: 文档销毁处理失败:', error);
        }
    }

    /**
     * WebSocket消息处理 - 智能版本，使用组件的专门处理器
     */
    private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
        try {
            const data = JSON.parse(event.data);

            // 只处理transactions事件，用于实时更新
            if (data.cmd === 'transactions') {
                if (this.currentDocId) {
                    console.log(`DocumentStyler: 收到WebSocket transactions消息，当前文档ID: ${this.currentDocId}`);
                    // 使用组件的专门处理器进行更精细的分析
                    await this.headingNumbering.handleTransactionMessage(data);
                    await this.crossReference.handleTransactionMessage(data);
                    // 变更后尝试重新应用图片堆叠（结构变化可能影响分组）
                    await this.imageStackManager.applyForCurrentDocument();
                } else {
                    console.log('DocumentStyler: 收到WebSocket transactions消息，但当前文档ID为空，跳过处理');
                }
            } else if (data.cmd === 'savedoc') {
                // 处理内核推送的 savedoc 消息：用于拖拽排序、块类型转换等保存导致的结构变化
                const rootId = data?.data?.rootID;
                if (this.currentDocId && rootId === this.currentDocId) {
                    console.log(`DocumentStyler: 收到WebSocket savedoc消息，当前文档ID: ${this.currentDocId}`);
                    if (typeof this.headingNumbering?.handleSaveDocMessage === 'function') {
                        await this.headingNumbering.handleSaveDocMessage(data);
                    }
                    await this.imageStackManager.applyForCurrentDocument();
                }
            }
        } catch (error) {
            // 忽略解析错误，不是所有WebSocket消息都是JSON
        }
    }



    /**
     * 应用当前文档的设置
     */
    private async applyCurrentDocumentSettings(): Promise<void> {
        if (!this.currentDocId) return;

        try {
            const docSettings = await this.settingsManager.getDocumentSettings(this.currentDocId);

            // 应用标题编号 - 不清理，只应用当前文档的样式
            if (docSettings.headingNumberingEnabled) {
                await this.headingNumbering.updateNumberingForDoc(this.currentDocId);
            }
            // 注意：不在这里清理标题编号，因为其他protyle可能还在使用

            // 应用交叉引用 - 不清理，只应用当前文档的样式
            if (docSettings.crossReferenceEnabled) {
                const protyle = this.documentManager.getCurrentProtyle();
                if (protyle) {
                    await this.crossReference.applyCrossReference(protyle);
                }
            }
            // 注意：不在这里清理交叉引用，因为其他protyle可能还在使用

            // 应用字体设置
            await this.fontStyleManager.applyFontStyles(this.currentDocId, docSettings.fontSettings);

            // 图片堆叠设置
            await this.imageStackManager.applyForCurrentDocument();
        } catch (error) {
            console.error('DocumentStyler: 应用文档设置失败:', error);
        }
    }

    /**
     * 注册侧边栏面板
     */
    private registerDockPanel(): void {
        this.addDock({
            config: {
                position: "RightTop",
                size: { width: 320, height: 450 },
                icon: "iconEdit",
                title: "文档样式设置",
                show: false,
                index: 100
            },
            data: {},
            type: "document-styler-dock",
            init: (custom: Custom) => this.initDockPanel(custom),
            update: () => this.updateDockPanel(),
            destroy: () => this.destroyDockPanel()
        });
    }

    /**
     * 初始化侧边栏面板
     */
    private async initDockPanel(custom: Custom): Promise<void> {
        await this.dockPanel.initPanel(custom);
    }

    /**
     * 更新侧边栏面板
     */
    private async updateDockPanel(): Promise<void> {
        await this.dockPanel.updatePanel();
    }

    /**
     * 销毁侧边栏面板
     */
    private destroyDockPanel(): void {
        // 面板销毁逻辑由 dockPanel 模块处理
    }

    // ==================== 公共方法 ====================

    /**
     * 滚动到指定图片/表格（供HTML onclick调用）
     * @param figureId 图片/表格ID
     */
    public scrollToFigure(figureId: string): void {
        this.crossReference.scrollToFigure(figureId);
    }

    /**
     * 切换当前文档的标题编号状态
     */
    public async toggleHeadingNumbering(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            const currentEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(docId);

            if (currentEnabled) {
                // 关闭编号
                await this.headingNumbering.clearNumbering(null);
                await this.settingsManager.setDocumentHeadingNumberingEnabled(docId, false);
            } else {
                // 开启编号
                await this.headingNumbering.updateNumberingForDoc(docId);
                await this.settingsManager.setDocumentHeadingNumberingEnabled(docId, true);
            }

            // 更新面板
            this.dockPanel.updatePanel();
        } catch (error) {
            console.error('切换标题编号失败:', error);
        }
    }

    /**
     * 切换当前文档的交叉引用状态
     */
    public async toggleCrossReference(): Promise<void> {
        const settings = this.settingsManager.getSettings();
        const protyle = this.documentManager.getCurrentProtyle();

        if (!protyle) return;

        try {
            if (settings.crossReference) {
                await this.crossReference.clearCrossReference(protyle);
                await this.settingsManager.updateSettings({ crossReference: false });
            } else {
                await this.crossReference.applyCrossReference(protyle);
                await this.settingsManager.updateSettings({ crossReference: true });
            }

            // 更新面板
            this.dockPanel.updatePanel();
        } catch (error) {
            console.error('切换交叉引用失败:', error);
        }
    }

    /**
     * 获取当前设置
     */
    public getSettings(): IDocumentStylerSettings {
        return this.settingsManager.getSettings();
    }

    /**
     * 获取当前文档的编号启用状态
     */
    public async getCurrentDocumentNumberingStatus(): Promise<{
        headingNumbering: boolean;
        crossReference: boolean;
    }> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            return {
                headingNumbering: false,
                crossReference: false
            };
        }

        try {
            const headingNumbering = await this.settingsManager.isDocumentHeadingNumberingEnabled(docId);
            const crossReference = await this.settingsManager.isDocumentCrossReferenceEnabled(docId);

            return {
                headingNumbering,
                crossReference
            };
        } catch (error) {
            console.error('获取文档编号状态失败:', error);
            return {
                headingNumbering: false,
                crossReference: false
            };
        }
    }

    /**
     * 更新设置
     */
    public async updateSettings(settings: Partial<IDocumentStylerSettings>): Promise<void> {
        await this.settingsManager.updateSettings(settings);
        this.dockPanel.updatePanel();
    }

    /**
     * 获取当前文档信息
     */
    public async getCurrentDocumentInfo(): Promise<IDocumentInfo | null> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return null;
        return await this.documentManager.getDocumentInfo(docId);
    }

    /**
     * 应用标题编号（供DockPanel调用）
     */
    public async applyHeadingNumbering(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            console.log('DocumentStyler: 开始应用标题编号');

            // 获取文档设置
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log('DocumentStyler: 文档设置获取成功', docSettings);

            // 使用文档的设置更新编号
            await this.headingNumbering.updateNumberingForDoc(docId);
            console.log('DocumentStyler: 标题编号应用完成');
        } catch (error) {
            console.error('应用标题编号失败:', error);
        }
    }

    /**
     * 清除标题编号（供DockPanel调用）
     */
    public async clearHeadingNumbering(): Promise<void> {
        try {
            await this.headingNumbering.clearNumbering(null);
        } catch (error) {
            console.error('清除标题编号失败:', error);
        }
    }

    /**
     * 应用交叉引用（供DockPanel调用）
     */
    public async applyCrossReference(): Promise<void> {
        // 检查是否为内测用户
        if (!this.betaFeatureManager.isBetaVerified()) {
            return;
        }

        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        try {
            await this.crossReference.applyCrossReference(protyle);
        } catch (error) {
            console.error('应用交叉引用失败:', error);
        }
    }

    /**
     * 清除交叉引用（供DockPanel调用）
     */
    public async clearCrossReference(): Promise<void> {
        const protyle = this.documentManager.getCurrentProtyle();
        if (!protyle) return;

        try {
            await this.crossReference.clearCrossReference(protyle);
        } catch (error) {
            console.error('清除交叉引用失败:', error);
        }
    }

    /**
     * 手动触发交叉引用更新（供调试使用）
     */
    public async forceUpdateCrossReference(): Promise<void> {
        // 检查是否为内测用户
        if (!this.betaFeatureManager.isBetaVerified()) {
            return;
        }

        try {
            await this.crossReference.forceUpdate();
        } catch (error) {
            console.error('手动更新交叉引用失败:', error);
        }
    }

    /**
     * 应用字体设置（供DockPanel调用）
     */
    public async applyFontSettings(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            console.log(`DocumentStyler: 开始应用字体设置，文档ID: ${docId}`);
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log('DocumentStyler: 获取到文档设置', docSettings);

            // 检查是否启用了字体自定义
            if (!docSettings.customFontEnabled) {
                console.log('DocumentStyler: 字体自定义未启用，清除字体样式');
                await this.fontStyleManager.clearDocumentStyles(docId);
                return;
            }

            await this.fontStyleManager.applyFontStyles(docId, docSettings.fontSettings);
            console.log('DocumentStyler: 字体设置应用完成');
        } catch (error) {
            console.error('应用字体设置失败:', error);
        }
    }

    /**
     * 清除字体设置（供DockPanel调用）
     */
    public async clearFontSettings(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            await this.fontStyleManager.clearDocumentStyles(docId);
            console.log('DocumentStyler: 字体设置清除完成');
        } catch (error) {
            console.error('清除字体设置失败:', error);
        }
    }

    /**
     * 获取字体样式管理器（供DockPanel调用）
     */
    public getFontStyleManager(): FontStyleManager {
        return this.fontStyleManager;
    }

    /**
     * 处理交叉引用斜杠命令
     * @param protyle 编辑器实例
     * @param nodeElement 节点元素
     */
    private async handleCrossReferenceSlash(protyle: any, nodeElement: HTMLElement | null): Promise<void> {
        try {
            // 获取当前文档ID
            const docId = protyle?.block?.rootID;
            if (!docId) {
                console.warn('无法获取当前文档ID');
                return;
            }

            // 获取图表数据
            const figures = await this.crossReference.getFiguresList(docId);

            // 显示图表选择菜单
            this.showCrossReferenceMenu(protyle, nodeElement, figures);
        } catch (error) {
            console.error('处理交叉引用斜杠命令失败:', error);
        }
    }

    /**
     * 显示交叉引用选择菜单
     * @param protyle 编辑器实例
     * @param nodeElement 节点元素
     * @param figures 图表数据
     */
    private showCrossReferenceMenu(protyle: any, nodeElement: HTMLElement, figures: any[]): void {
        // 获取光标位置
        const range = protyle.toolbar.range;
        if (!range) return;

        const rangePosition = this.getSelectionPosition(nodeElement, range);
        const menuPosition = {
            x: rangePosition.left,
            y: rangePosition.top + 26
        };

        // 创建并显示菜单
        this.createCrossReferenceMenu(figures, menuPosition, (figure) => {
            // 插入交叉引用
            this.insertCrossReference(protyle, figure);
        });
    }

    /**
     * 获取选择位置
     * @param _nodeElement 节点元素（未使用，保留以备将来扩展）
     * @param range 选择范围
     * @returns 位置信息
     */
    private getSelectionPosition(_nodeElement: HTMLElement, range: Range): { left: number; top: number } {
        const rect = range.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top
        };
    }

    /**
     * 创建交叉引用菜单
     * @param figures 图表数据
     * @param position 菜单位置
     * @param onSelect 选择回调
     */
    private createCrossReferenceMenu(
        figures: any[],
        position: { x: number; y: number },
        onSelect: (figure: any) => void
    ): void {
        // 移除已存在的菜单
        const existingMenu = document.querySelector('.cross-reference-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建菜单容器
        const menuElement = document.createElement('div');
        menuElement.className = 'b3-menu b3-list b3-list--background cross-reference-menu';
        menuElement.style.position = 'fixed';
        menuElement.style.left = `${position.x}px`;
        menuElement.style.top = `${position.y}px`;
        menuElement.style.zIndex = '9999';
        menuElement.style.maxHeight = '300px';
        menuElement.style.overflowY = 'auto';
        menuElement.style.minWidth = '200px';

        if (figures.length === 0) {
            // 没有图表时显示提示
            menuElement.innerHTML = `
                <div class="b3-list-item b3-list-item--readonly">
                    <span class="b3-list-item__text">当前文档中没有图片或表格</span>
                </div>
            `;
        } else {
            // 生成图表列表
            const menuHTML = figures.map(figure => {
                const typeText = figure.type === 'image' ? '图' : '表';
                const iconName = figure.type === 'image' ? 'iconImage' : 'iconTable';
                const displayText = `${typeText} ${figure.number}`;
                const captionText = figure.caption ? `: ${figure.caption}` : '';

                return `
                    <div class="b3-list-item" data-figure-id="${figure.id}" data-figure-type="${figure.type}" data-figure-number="${figure.number}">
                        <div style="display: flex; align-items: center;">
                            <svg class="b3-list-item__graphic">
                                <use xlink:href="#${iconName}"></use>
                            </svg>
                            <span class="b3-list-item__text">${displayText}${captionText}</span>
                        </div>
                    </div>
                `;
            }).join('');

            menuElement.innerHTML = menuHTML;

            // 添加点击事件监听
            menuElement.addEventListener('click', (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                const listItem = target.closest('.b3-list-item') as HTMLElement;

                if (listItem && listItem.dataset.figureId) {
                    const figure = {
                        id: listItem.dataset.figureId,
                        type: listItem.dataset.figureType,
                        number: parseInt(listItem.dataset.figureNumber || '0')
                    };

                    onSelect(figure);
                    menuElement.remove();
                }
            });
        }

        // 添加到页面
        document.body.appendChild(menuElement);

        // 添加全局点击事件监听，点击菜单外部时关闭菜单
        setTimeout(() => {
            document.addEventListener('click', (event: MouseEvent) => {
                const target = event.target as HTMLElement;
                if (!menuElement.contains(target)) {
                    menuElement.remove();
                }
            }, { once: true });
        }, 0);

        // 调整菜单位置，确保不超出屏幕边界
        this.adjustMenuPosition(menuElement);
    }

    /**
     * 调整菜单位置
     * @param menuElement 菜单元素
     */
    private adjustMenuPosition(menuElement: HTMLElement): void {
        const rect = menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 调整水平位置
        if (rect.right > viewportWidth) {
            const newLeft = viewportWidth - rect.width - 10;
            menuElement.style.left = `${Math.max(10, newLeft)}px`;
        }

        // 调整垂直位置
        if (rect.bottom > viewportHeight) {
            const newTop = viewportHeight - rect.height - 10;
            menuElement.style.top = `${Math.max(10, newTop)}px`;
        }
    }

    /**
     * 插入交叉引用
     * @param protyle 编辑器实例
     * @param figure 图表信息
     */
    private insertCrossReference(protyle: any, figure: any): void {
        try {
            // 使用正确的交叉引用格式
            const crossRefHTML = `<span data-type="block-ref" data-subtype="s" data-id="${figure.id}">*</span>`;

            // 获取当前选择范围
            const range = protyle.toolbar.range;
            if (range) {
                // 删除选择内容
                range.deleteContents();

                // 创建HTML元素并插入
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = crossRefHTML;
                const crossRefElement = tempDiv.firstChild as HTMLElement;

                range.insertNode(crossRefElement);
                range.setStartAfter(crossRefElement);
                range.collapse(true);

                // 更新选择
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                // 触发文档更新
                this.triggerDocumentUpdate(protyle);

                // 重新应用交叉引用样式以包含新插入的引用
                this.updateCrossReferenceStyles(protyle);
            }

            console.log(`插入交叉引用: ${figure.type} ${figure.number}`);
        } catch (error) {
            console.error('插入交叉引用失败:', error);
        }
    }

    /**
     * 触发文档更新
     * @param protyle 编辑器实例
     */
    private triggerDocumentUpdate(protyle: any): void {
        try {
            // 触发文档更新
            if (protyle && protyle.wysiwyg && typeof protyle.wysiwyg.renderCustom === 'function') {
                protyle.wysiwyg.renderCustom();
            }
        } catch (error) {
            console.error('触发文档更新失败:', error);
        }
    }

    /**
     * 更新交叉引用样式
     * @param protyle 编辑器实例
     */
    private async updateCrossReferenceStyles(protyle: any): Promise<void> {
        try {
            const docId = protyle?.block?.rootID;
            if (!docId) return;

            // 重新应用交叉引用样式
            await this.crossReference.applyCrossReference(protyle);

            console.log('交叉引用样式已更新');
        } catch (error) {
            console.error('更新交叉引用样式失败:', error);
        }
    }

    /**
     * 检验是否加入内测 - 公共接口
     * @returns 是否已通过内测验证
     */
    public isBetaVerified(): boolean {
        return this.betaFeatureManager?.isBetaVerified() || false;
    }

    /**
     * 获取内测功能管理器 - 供外部使用
     * @returns BetaFeatureManager实例
     */
    public getBetaFeatureManager(): BetaFeatureManager | null {
        return this.betaFeatureManager || null;
    }

    /**
     * 应用图片堆叠（供DockPanel调用）
     */
    public async applyImageStack(): Promise<void> {
        try {
            await this.imageStackManager.applyForCurrentDocument();
        } catch (e) {
            console.error('应用图片堆叠失败:', e);
        }
    }

    // ==================== 新增命令的实现 ====================

    /**
     * 行内换行转多块：
     * - 无选中：处理光标所在块
     * - 仅选中文本：处理该文本所在块
     * - 选中多块：依次处理所有选中块
     */
	private async handleSplitInlineBreaks(protyle: any): Promise<void> {
        const blocks = this.getSelectedBlocks(protyle);
        let total = 0;
        if (blocks.length === 0) {
            showMessage('未找到需要处理的块', 2000, 'info');
            return;
        }

        for (const blockEl of blocks) {
            const blockId = blockEl.getAttribute('data-node-id');
            if (!blockId) continue;

            const editable = blockEl.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (!editable) continue;

            // 基于 DOM Range 的换行拆分：严格保持合法结构
            const htmlLines = this.splitEditableByBreaks(editable);

            if (htmlLines.length <= 1) {
                continue; // 无需拆分
            }

			// 更新第一个块为第一行：复制原块所有属性，仅覆盖 updated
			const firstInner = this.buildParagraphInnerHTML(htmlLines[0]);
			const firstAttr = this.buildBlockAttrString(blockEl, { updated: this.generateUpdatedTimestamp() });
			const firstBlockDom = this.wrapBlockWithAttributes(firstAttr, firstInner);
			await updateBlock('dom', firstBlockDom, blockId);

			// 链式在该块之后插入后续行，保持原有顺序
			let previousId: string = blockId;
			for (let i = htmlLines.length - 1; i > 0; i--) {
				const inner = this.buildParagraphInnerHTML(htmlLines[i]);
				// 为新块复制原块属性，并生成新的 data-node-id 与 updated
				const newId = this.generateBlockId();
				const newAttr = this.buildBlockAttrString(blockEl, { 'data-node-id': newId, updated: this.generateUpdatedTimestamp() });
				const blockDom = this.wrapBlockWithAttributes(newAttr, inner);
				const ops = await insertBlock('dom', blockDom, undefined, previousId, undefined);
				if (Array.isArray(ops) && ops.length > 0) {
					const created = ops.find((op: any) => op.id);
					if (created && created.id) {
						previousId = created.id;
					}
				}
			}

            total += htmlLines.length;
        }

        showMessage(`已将行内换行转换为 ${total} 个块`, 2000, 'info');
    }

    /**
     * 将选中范围内的图片设置为行高
     * - 无选中：处理光标所在块
     * - 仅选中文本：处理该文本所在块
     * - 选中多块：依次处理所有选中块
     */
    private async handleSetImagesToLineHeight(protyle: any): Promise<void> {
        const blocks = this.getSelectedBlocks(protyle);
        if (blocks.length === 0) {
            showMessage('未找到需要处理的块', 2000, 'info');
            return;
        }

        // 汇总变更，使用事务批量提交（/api/block/updateBlocks）
        const updates: Record<string, string> = {};
        let changed = 0;

        for (const blockEl of blocks) {
            const blockId = blockEl.getAttribute('data-node-id');
            if (!blockId) continue;

            const editable = blockEl.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (!editable) continue;

            const beforeHTML = editable.innerHTML;

            // 使用 DOM 方式查找并设置图片容器层级的宽度为 1lh
            const temp = document.createElement('div');
            temp.innerHTML = beforeHTML;

            const imgs = Array.from(temp.querySelectorAll('span[contenteditable="false"][data-type="img"] img')) as HTMLImageElement[];
            let localChanged = 0;
            for (const img of imgs) {
                const wrapper = img.parentElement as HTMLElement | null;
                if (!wrapper || wrapper.tagName !== 'SPAN') continue;
                if (wrapper.style.width !== '1lh') {
                    wrapper.style.width = '1lh';
                    localChanged++;
                }
            }

			if (localChanged > 0) {
				const afterHTML = temp.innerHTML;
				if (afterHTML !== beforeHTML) {
					const inner = this.buildParagraphInnerHTML(afterHTML, false);
					// 保留原块所有属性，覆盖 updated
					const attr = this.buildBlockAttrString(blockEl, { updated: this.generateUpdatedTimestamp() });
					const blockDom = this.wrapBlockWithAttributes(attr, inner);
					updates[blockId] = blockDom;
					changed += localChanged;
				}
			}
        }

        if (Object.keys(updates).length > 0) {
            await batchUpdateBlockContent(updates, 'dom', true);
        }

        showMessage(changed > 0 ? `已为 ${changed} 个图片设置 width: 1lh` : '未找到需要设置的图片', 2000, 'info');
    }

    /**
     * 获取当前选中的块列表；
     * 若多选返回所有被框选的块；若仅光标或仅选中文本，返回所在块。
     */
    private getSelectedBlocks(protyle: any): HTMLElement[] {
        const container = protyle?.wysiwyg?.element as HTMLElement | undefined;
        if (!container) return [];

        // 多块选择的标记
        const selectedBlocks = Array.from(container.querySelectorAll('.protyle-wysiwyg--select')) as HTMLElement[];
        if (selectedBlocks.length > 0) return selectedBlocks;

        // 退化为光标所在块
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const anchor = selection.anchorNode as Node | null;
            const block = anchor ? (anchor instanceof HTMLElement ? anchor : anchor.parentElement)?.closest('[data-node-id]') as HTMLElement | null : null;
            if (block) return [block];
        }
        return [];
    }

    /**
     * 构造段落块的内部 DOM（contenteditable + protyle-attr）
     */
	private buildParagraphInnerHTML(editableInnerHTML: string, ensureAttr: boolean = true): string {
		const attrPart = `<div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div>`;
		const editablePart = `<div contenteditable="true" spellcheck="false">${editableInnerHTML}</div>`;
		return ensureAttr ? `${editablePart}${attrPart}` : `${editablePart}${attrPart}`;
	}

    /**
	 * 生成块属性字符串：从现有块复制所有属性，可传入 overrides 覆盖，excludes 排除
     */
	private buildBlockAttrString(blockEl: HTMLElement, overrides: Record<string, string> = {}, excludes: string[] = []): string {
		const names = blockEl.getAttributeNames();
		const excludeSet = new Set(excludes.map(s => s.toLowerCase()));
		const parts: string[] = [];
		for (const name of names) {
			if (excludeSet.has(name.toLowerCase())) continue;
			const value = blockEl.getAttribute(name);
			if (value === null) continue;
			// 若在 overrides 中会在后续统一附加覆盖
			if (Object.prototype.hasOwnProperty.call(overrides, name)) continue;
			parts.push(`${name}="${value}"`);
		}
		// 附加覆盖项
		for (const [k, v] of Object.entries(overrides)) {
			parts.push(`${k}="${v}"`);
		}
		return parts.join(' ');
	}

	/**
	 * 包裹为完整块 DOM，使用给定属性字符串
	 */
	private wrapBlockWithAttributes(attrString: string, innerHTML: string): string {
		return `<div ${attrString}>${innerHTML}</div>`;
	}



	private generateUpdatedTimestamp(): string {
		const d = new Date();
		const pad = (n: number) => n.toString().padStart(2, '0');
		return (
			`${d.getFullYear()}` +
			pad(d.getMonth() + 1) +
			pad(d.getDate()) +
			pad(d.getHours()) +
			pad(d.getMinutes()) +
			pad(d.getSeconds())
		);
	}

	/**
	 * 生成块 ID：YYYYMMDDHHmmss-xxxxxxx（小写字母数字）
	 */
	private generateBlockId(): string {
		const ts = this.generateUpdatedTimestamp();
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let suffix = '';
		for (let i = 0; i < 7; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
		return `${ts}-${suffix}`;
	}

    /**
     * 将可编辑区域按换行节点拆分为多个 HTML 片段（合法 DOM）
     * 识别的换行标记：<span data-type="br"></span> 与 <br>
     */
	private splitEditableByBreaks(editable: HTMLElement): string[] {
		// 在克隆的容器上操作：把文本节点中的 "\n" 转换为显式的换行标记，以统一处理
		const working = editable.cloneNode(true) as HTMLElement;

		// 收集所有文本节点（快照），避免遍历过程中结构修改导致迭代异常
		const textNodes: Text[] = [];
		const walker = document.createTreeWalker(working, NodeFilter.SHOW_TEXT);
		let current: Node | null = walker.nextNode();
		while (current) {
			textNodes.push(current as Text);
			current = walker.nextNode();
		}

		// 将文本中的换行符转换为 <span data-type="br"></span>
		for (const textNode of textNodes) {
			const value = textNode.nodeValue || '';
			if (!value || value.indexOf('\n') === -1) continue;

			const parts = value.split('\n');
			const frag = document.createDocumentFragment();
			for (let i = 0; i < parts.length; i++) {
				if (parts[i]) {
					frag.appendChild(document.createTextNode(parts[i]));
				}
				if (i < parts.length - 1) {
					const brSpan = document.createElement('span');
					brSpan.setAttribute('data-type', 'br');
					frag.appendChild(brSpan);
				}
			}
			textNode.parentNode?.replaceChild(frag, textNode);
		}

		// 现在工作容器中的所有换行都已显式化，继续使用统一的断点切分逻辑
		const breaks = Array.from(working.querySelectorAll('span[data-type="br"], br')) as Node[];
		const fragments: string[] = [];
		const tmp = document.createElement('div');

		const pushRangeHTML = (startNode: Node | null, endNode: Node | null) => {
			const range = document.createRange();
			if (startNode) {
				range.setStartAfter(startNode);
			} else {
				range.setStart(working, 0);
			}
			if (endNode) {
				range.setEndBefore(endNode);
			} else {
				range.setEnd(working, working.childNodes.length);
			}
			const frag = range.cloneContents();
			tmp.innerHTML = '';
			tmp.appendChild(frag);
			const html = (tmp.innerHTML || '').trim();
			if (html) fragments.push(html);
		};

		if (breaks.length === 0) {
			const html = (working.innerHTML || '').trim();
			return html ? [html] : [];
		}

		// 开头 -> 第一个换行前
		pushRangeHTML(null, breaks[0]);
		// 中间段
		for (let i = 0; i < breaks.length - 1; i++) {
			pushRangeHTML(breaks[i], breaks[i + 1]);
		}
		// 最后一个换行 -> 末尾
		pushRangeHTML(breaks[breaks.length - 1], null);

		return fragments;
	}

}
