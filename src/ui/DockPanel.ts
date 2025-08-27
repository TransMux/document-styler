/**
 * 侧边栏面板管理器
 * 负责管理插件的侧边栏面板UI
 */

import { Custom } from "../utils/siyuan-api";
import { showMessage } from "siyuan";
import { IDockPanel, IFigureInfo, HeadingNumberStyle, IFontSettings } from "../types";
import { SettingsManager } from "../core/SettingsManager";
import { DocumentManager } from "../core/DocumentManager";
import { CrossReference } from "../core/CrossReference";
import { BetaFeatureManager } from "../core/BetaFeatureManager";
import { NumberStyleConverter } from "../utils/numberStyleConverter";

export class DockPanel implements IDockPanel {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private crossReference: CrossReference;
    private betaFeatureManager: BetaFeatureManager;
    private customElement: Custom | null = null;
    private panelElement: Element | null = null;
    private pluginInstance: any; // 主插件实例
    private eventsInitialized: boolean = false; // 标记事件是否已初始化
    private updateTimeout: NodeJS.Timeout | null = null; // 防抖定时器

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        crossReference: CrossReference,
        betaFeatureManager: BetaFeatureManager,
        pluginInstance?: any
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.crossReference = crossReference;
        this.betaFeatureManager = betaFeatureManager;
        this.pluginInstance = pluginInstance;
    }

    async init(): Promise<void> {
        // 初始化将在主插件类中调用 initDockPanel 时完成
    }

    destroy(): void {
        // 清理事件监听器
        this.clearPanelEvents();

        // 清理防抖定时器
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        this.customElement = null;
        this.panelElement = null;
        this.eventsInitialized = false;
    }

    /**
     * 初始化面板
     * @param custom 自定义面板实例
     */
    async initPanel(custom: Custom): Promise<void> {
        if (!custom || !custom.element) {
            console.error('DocumentStyler: Custom element not available');
            return;
        }

        try {
            this.customElement = custom;
            this.panelElement = custom.element;

            // 重置事件初始化状态
            this.eventsInitialized = false;

            custom.element.innerHTML = await this.generatePanelHTML();
            await this.updatePanel();
            this.bindPanelEvents();
        } catch (error) {
            console.error('DocumentStyler: Error initializing dock panel:', error);
        }
    }

    async updatePanel(): Promise<void> {
        if (!this.panelElement) return;

        try {
            await this.updateSettingsUI();
            await this.updateFiguresList();
            // 刷新后重新绑定事件，确保切换全局/文档模式时交互正确
            this.bindPanelEvents();
        } catch (error) {
            console.error('更新面板失败:', error);
        }
    }

    showPanel(): void {
        // 显示面板的逻辑由思源的dock系统处理
    }

    hidePanel(): void {
        // 隐藏面板的逻辑由思源的dock系统处理
    }

    /**
     * 防抖更新标题编号
     */
    private debounceApplyHeadingNumbering(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(async () => {
            if (this.pluginInstance) {
                try {
                    await this.pluginInstance.applyHeadingNumbering();
                } catch (error) {
                    console.error('防抖应用标题编号失败:', error);
                }
            }
        }, 300); // 300ms延迟
    }

    /**
     * 生成面板HTML
     */
    private async generatePanelHTML(): Promise<string> {
        const docId = this.documentManager.getCurrentDocId();
        let docSettings = null;

        if (docId) {
            try {
                docSettings = await this.settingsManager.getDocumentSettings(docId);
            } catch (error) {
                console.error('获取文档设置失败:', error);
            }
        }

        // 如果没有文档设置，使用默认设置
        if (!docSettings) {
            docSettings = this.settingsManager.getDefaultDocumentSettings();
        }

        return `
            <div class="document-styler-panel">
                <div class="block__icons">
                    <div class="block__logo">
                        <svg class="block__logoicon"><use xlink:href="#iconEdit"></use></svg>
                        ${docId ? '文档样式设置' : '全局默认设置'}
                    </div>
                </div>
                
                <div class="document-styler-content">
                    <div id="global-mode-tip" class="document-styler-info" style="margin-bottom: 12px; display: ${docId ? 'none' : ''};">
                        当前未打开文档，所做更改将作为全局默认设置应用。
                    </div>
                    <!-- 当前文档状态 -->
                    <div class="document-styler-section">
                        <h3 class="document-styler-section-title">当前文档状态</h3>

                        <label class="fn__flex label-padding">
                            <div class="fn__flex-1">
                                标题自动编号
                                <div class="b3-label__text">启用标题编号功能</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-enabled" type="checkbox" checked="">
                        </label>

                        <label class="fn__flex label-padding" style="${this.betaFeatureManager.isBetaVerified() ? '' : 'opacity: 0.5; pointer-events: none;'}">
                            <div class="fn__flex-1">
                                交叉引用${this.betaFeatureManager.isBetaVerified() ? '' : ' (内测功能)'}
                                <div class="b3-label__text">${this.betaFeatureManager.isBetaVerified() ? '图表将获得类latex的全局自动编号，并支持引用' : '此功能仅对内测用户开放'}</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-crossref-enabled" type="checkbox" checked="" ${this.betaFeatureManager.isBetaVerified() ? '' : 'disabled'}>
                        </label>

                        <label class="fn__flex label-padding">
                            <div class="fn__flex-1">
                                文章字体自定义
                                <div class="b3-label__text">启用文档字体自定义功能</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-custom-font-enabled" type="checkbox" checked="">
                        </label>

                        <label class="fn__flex label-padding">
                            <div class="fn__flex-1">
                                连续图片堆叠
                                <div class="b3-label__text">将连续图片块堆叠显示，滚轮切换</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-imgstack-enabled" type="checkbox" ${docSettings.imageStackEnabled ? 'checked' : ''}>
                        </label>

                        <div class="fn__flex label-padding" id="doc-imgstack-options" style="${docSettings.imageStackEnabled ? '' : 'display:none;'}">
                            <select class="b3-select fn__flex-center fn__size200" id="doc-imgstack-mode">
                                <option value="hide" ${docSettings.imageStackMode === 'hide' ? 'selected' : ''}>隐藏其它</option>
                                <option value="compact" ${docSettings.imageStackMode !== 'hide' ? 'selected' : ''}>收起提示</option>
                            </select>
                            <input class="b3-text-field fn__flex-center fn__size120" id="doc-imgstack-height" value="${docSettings.imageStackCollapsedHeight || '48px'}" placeholder="48px">
                        </div>
                        <div id="doc-override-tip" class="document-styler-info" style="display:none; margin: 0 24px 12px;">当前文档设置已覆盖全局默认设置</div>
                    </div>

                    <!-- 标题编号样式设置 -->
                    <div class="document-styler-section" id="heading-styles-section" style="${docSettings.headingNumberingEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">标题编号样式</h3>
                        <div id="heading-styles-container">
                            ${this.generateHeadingStylesHTML(docSettings.numberingFormats, docSettings.headingNumberStyles)}
                        </div>
                        <label class="fn__flex label-padding" style="margin-bottom: 8px;">
                            <div class="fn__flex-1">
                                是否在块属性显示（右上角）
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-in-attr" type="checkbox" ${docSettings.showHeadingNumberInBlockAttr ? 'checked' : ''}>
                        </label>
                        <label class="fn__flex label-padding" style="margin-bottom: 8px;">
                            <div class="fn__flex-1">
                                在大纲中显示编号
                                <div class="b3-label__text">同步在大纲项前显示与正文一致的编号</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-in-outline" type="checkbox" ${docSettings.showHeadingNumberInOutline ? 'checked' : ''}>
                        </label>
                        <label class="fn__flex label-padding" style="margin-bottom: 8px;">
                            <div class="fn__flex-1">
                                序号颜色继承标题颜色
                                <div class="b3-label__text">开启后不强制设置序号颜色，使用当前标题颜色</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-color-inherit" type="checkbox" ${docSettings.headingNumberColorInherit !== false ? 'checked' : ''}>
                        </label>
                        <label class="fn__flex label-padding" style="margin-bottom: 8px;">
                            <div class="fn__flex-1">
                                在正文中显示编号
                                <div class="b3-label__text">关闭后，仅大纲显示或完全隐藏</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-switch fn__flex-center" id="doc-heading-in-protyle" type="checkbox" ${docSettings.showHeadingNumberInProtyle !== false ? 'checked' : ''}>
                        </label>
                        <div id="override-tip" class="document-styler-info" style="display:none; margin: 8px 24px 0;">当前文档设置已覆盖全局默认设置</div>
                    </div>



                    <!-- 图表编号前缀设置 -->
                    <div class="document-styler-section" id="figure-prefix-section" style="${docSettings.crossReferenceEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">图表编号前缀</h3>

                        <div class="fn__flex label-padding config__item">
                            <div class="fn__flex-1">
                                图片编号前缀
                                <div class="b3-label__text">自定义图片编号前缀，如"图"、"Figure"等</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-text-field fn__flex-center fn__size200" id="figure-prefix-input" value="${docSettings.figurePrefix}" placeholder="图">
                        </div>

                        <div class="fn__flex label-padding config__item">
                            <div class="fn__flex-1">
                                表格编号前缀
                                <div class="b3-label__text">自定义表格编号前缀，如"表"、"Table"等</div>
                            </div>
                            <span class="fn__space"></span>
                            <input class="b3-text-field fn__flex-center fn__size200" id="table-prefix-input" value="${docSettings.tablePrefix}" placeholder="表">
                        </div>
                    </div>

                    <!-- 字体设置 -->
                    <div class="document-styler-section" id="font-settings-section" style="${docSettings.customFontEnabled ? '' : 'display: none;'}">
                        <div class="fn__flex" style="align-items: center; margin-bottom: 8px;">
                            <h3 class="document-styler-section-title" style="margin: 0; flex: 1;">字体设置</h3>
                            <button class="b3-button b3-button--small" id="reset-font-settings" style="margin-left: 8px;">
                                重置为默认
                            </button>
                        </div>
                        ${this.generateFontSettingsHTML(docSettings.fontSettings)}
                        ${docId ? '<div id="font-override-tip" class="document-styler-info" style="display:none; margin-top: 8px;">当前文档字体设置已覆盖全局默认</div>' : ''}
                    </div>

                    <!-- 图片表格列表 -->
                    <div class="document-styler-section" id="figures-section" style="${docSettings.crossReferenceEnabled ? '' : 'display: none;'}">
                        <h3 class="document-styler-section-title">文档内容</h3>
                        <div class="document-styler-figures-list" id="figures-list">
                            <!-- 动态生成的图片表格列表 -->
                        </div>
                    </div>

                    <!-- 内测功能 -->
                    <div class="document-styler-section">
                        ${this.generateBetaFeatureHTML()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成标题编号样式设置HTML
     */
    private generateHeadingStylesHTML(numberingFormats: string[], headingNumberStyles: HeadingNumberStyle[]): string {
        const styleOptions = NumberStyleConverter.getStyleOptions();
        let html = '';

        for (let i = 0; i < 6; i++) {
            const level = i + 1;
            const currentStyle = headingNumberStyles[i];
            const format = numberingFormats[i];

            html += `
                <div class="document-styler-option">
                    <div class="document-styler-option-header">
                        <span class="document-styler-level-label">H${level} 样式</span>
                    </div>

                    <input type="text" class="b3-text-field"
                            id="format-${i}"
                            value="${format}"
                            placeholder="例如: {1}. 或 第{1}章">

                    <select class="b3-select" id="heading-style-${i}">
                        ${styleOptions.map(option =>
                `<option value="${option.value}" ${option.value === currentStyle ? 'selected' : ''}>
                                ${option.example}
                            </option>`
            ).join('')}
                    </select>
                </div>
            `;
        }

        return html;
    }

    /**
     * 生成字体设置HTML
     */
    private generateFontSettingsHTML(fontSettings: IFontSettings): string {
        return `
            <div class="document-styler-font-settings">
                <div class="fn__flex label-padding config__item">
                    <div class="fn__flex-1">
                        字体族
                        <div class="b3-label__text">设置文档的字体族，留空使用系统默认</div>
                    </div>
                    <span class="fn__space"></span>
                    <select class="b3-select fn__flex-center fn__size200" id="font-family-select">
                        <option value="">默认字体</option>
                        <!-- 字体选项将通过JavaScript动态加载 -->
                    </select>
                </div>

                <div class="fn__flex label-padding config__item">
                    <div class="fn__flex-1">
                        字体大小
                        <div class="b3-label__text">设置文档的字体大小（px）</div>
                    </div>
                    <span class="fn__space"></span>
                    <div class="fn__flex" style="align-items: center;">
                        <button class="b3-button b3-button--small" id="font-size-decrease" style="margin-right: 4px;">-</button>
                        <input class="b3-text-field fn__flex-center"
                               id="font-size-input"
                               value="${this.parseFontSize(fontSettings.fontSize)}"
                               style="width: 60px; text-align: center; margin: 0 4px;"
                               type="number"
                               min="8"
                               max="72">
                        <button class="b3-button b3-button--small" id="font-size-increase" style="margin-left: 4px;">+</button>
                        <span style="margin-left: 8px; color: var(--b3-theme-on-surface-light);">px</span>
                    </div>
                </div>

                <div class="fn__flex label-padding config__item">
                    <div class="fn__flex-1">
                        行高
                        <div class="b3-label__text">设置文档的行高</div>
                    </div>
                    <span class="fn__space"></span>
                    <div class="fn__flex" style="align-items: center;">
                        <button class="b3-button b3-button--small" id="line-height-decrease" style="margin-right: 4px;">-</button>
                        <input class="b3-text-field fn__flex-center"
                               id="line-height-input"
                               value="${parseFloat(fontSettings.lineHeight || '1.6').toFixed(1)}"
                               style="width: 60px; text-align: center; margin: 0 4px;"
                               type="number"
                               min="1.0"
                               max="3.0"
                               step="0.1">
                        <button class="b3-button b3-button--small" id="line-height-increase" style="margin-left: 4px;">+</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 解析字体大小，提取数字部分
     */
    private parseFontSize(fontSize: string): number {
        if (!fontSize) return 16;
        const match = fontSize.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 16;
    }

    /**
     * 生成内测功能HTML
     */
    private generateBetaFeatureHTML(): string {
        const betaStatus = this.betaFeatureManager.getBetaStatus();
        const isVerified = this.betaFeatureManager.isBetaVerified();

        if (isVerified) {
            const verifiedDate = betaStatus.verifiedAt ? new Date(betaStatus.verifiedAt).toLocaleDateString() : '未知';
            return `
                <div class="beta-feature-verified" style="padding: 16px; background: var(--b3-theme-primary-lightest); border-radius: 8px;">
                    <div class="fn__flex" style="align-items: center; margin-bottom: 8px;">
                        <svg style="width: 20px; height: 20px; margin-right: 8px; color: var(--b3-theme-primary);"><use xlink:href="#iconCheck"></use></svg>
                        <span style="color: var(--b3-theme-primary); font-weight: 500;">内测验证已完成</span>
                    </div>
                    <div style="color: var(--b3-theme-on-surface-light); font-size: 12px; margin-bottom: 12px;">
                        验证时间: ${verifiedDate} | 已验证 ${betaStatus.verifiedCodes.length} 个内测码
                    </div>
                    <div style="color: var(--b3-theme-on-surface); font-size: 14px;">
                        🎉 您已成功加入内测，可以使用所有内测功能和提前体验新特性！遇到任何问题随时反馈哦~！
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="beta-feature-unverified" style="padding: 16px; background: var(--b3-theme-surface); border: 1px dashed var(--b3-theme-on-surface-light); border-radius: 8px;">
                    <div style="margin-bottom: 12px;">
                        <div style="color: var(--b3-theme-on-surface); font-weight: 500; margin-bottom: 4px;">🚀 加入内测群，更快获取更多功能</div>
                        <div style="color: var(--b3-theme-on-surface-light); font-size: 12px; line-height: 1.4;">
                            输入内测码解锁专属功能，抢先体验最新特性和改进
                        </div>
                    </div>
                    <button class="b3-button b3-button--primary" id="open-beta-verification" style="width: 100%;">
                        输入内测码
                    </button>
                </div>
            `;
        }
    }

    /**
     * 绑定面板事件
     */
    private bindPanelEvents(): void {
        if (!this.panelElement) return;

        // 清除之前的事件监听器
        this.clearPanelEvents();

        // 根据是否有文档，绑定不同的事件
        const currentDocId = this.documentManager.getCurrentDocId();

        // 绑定字体与图片堆叠设置事件（支持文档级与全局级）
        if (currentDocId) {
            this.bindFontSettingsEvents();
            this.bindImageStackEvents();
        } else {
            this.bindGlobalFontSettingsEvents();
            this.bindGlobalImageStackEvents();
        }

        // 绑定重置字体设置事件
        if (currentDocId) {
            this.bindResetFontSettingsEvent();
        }

        // 绑定内测功能事件
        this.bindBetaFeatureEvents();

        // 标题编号样式选择器
        for (let i = 0; i < 6; i++) {
            const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
            if (styleSelect) {
                const handler = async (e: Event) => {
                    const style = (e.target as HTMLSelectElement).value as HeadingNumberStyle;

                    const docId = this.documentManager.getCurrentDocId();
                    if (docId) {
                        await this.settingsManager.setDocumentHeadingNumberStyle(docId, i, style);
                        this.updateStyleExample(i, style);
                        const docSettings = await this.settingsManager.getDocumentSettings(docId);
                        if (docSettings.headingNumberingEnabled) {
                            this.debounceApplyHeadingNumbering();
                        }
                    } else {
                        await this.settingsManager.setHeadingNumberStyle(i, style);
                    }
                };
                styleSelect.addEventListener('change', handler);
                // 存储事件处理器以便后续清理
                (styleSelect as any)._documentStylerHandler = handler;
            }
        }

        // 编号格式输入框
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            if (formatInput) {
                const handler = async (e: Event) => {
                    const format = (e.target as HTMLInputElement).value;

                    const docId = this.documentManager.getCurrentDocId();
                    if (docId) {
                        await this.settingsManager.setDocumentNumberingFormat(docId, i, format);
                        const docSettings = await this.settingsManager.getDocumentSettings(docId);
                        if (docSettings.headingNumberingEnabled) {
                            this.debounceApplyHeadingNumbering();
                        }
                    } else {
                        await this.settingsManager.setNumberingFormat(i, format);
                    }
                };
                formatInput.addEventListener('change', handler);
                (formatInput as any)._documentStylerHandler = handler;
            }
        }

        // 标题编号显示位置开关（仅文档级；全局模式禁用）
        const headingInAttr = this.panelElement.querySelector('#doc-heading-in-attr') as HTMLInputElement;
        if (headingInAttr) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;
                const preferAttr = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setDocumentSettings(docId, { showHeadingNumberInBlockAttr: preferAttr });
                // 重新应用标题编号以切换渲染目标
                const latest = await this.settingsManager.getDocumentSettings(docId);
                if (latest.headingNumberingEnabled) {
                    this.debounceApplyHeadingNumbering();
                }
            };
            // 先移除旧的事件再绑定，避免重复
            if ((headingInAttr as any)._documentStylerHandler) {
                headingInAttr.removeEventListener('change', (headingInAttr as any)._documentStylerHandler);
            }
            headingInAttr.addEventListener('change', handler);
            (headingInAttr as any)._documentStylerHandler = handler;
        }

        // 大纲编号显示开关（仅文档级；全局模式禁用）
        const headingInOutline = this.panelElement.querySelector('#doc-heading-in-outline') as HTMLInputElement;
        if (headingInOutline) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;
                const enableOutline = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setDocumentSettings(docId, { showHeadingNumberInOutline: enableOutline });
                // 重新应用标题编号以刷新CSS（包含大纲）
                const latest = await this.settingsManager.getDocumentSettings(docId);
                if (latest.headingNumberingEnabled) {
                    this.debounceApplyHeadingNumbering();
                }
            };
            if ((headingInOutline as any)._documentStylerHandler) {
                headingInOutline.removeEventListener('change', (headingInOutline as any)._documentStylerHandler);
            }
            headingInOutline.addEventListener('change', handler);
            (headingInOutline as any)._documentStylerHandler = handler;
        }

        // 序号颜色继承开关（文档/全局）
        const headingColorInherit = this.panelElement.querySelector('#doc-heading-color-inherit') as HTMLInputElement;
        if (headingColorInherit) {
            const old = (headingColorInherit as any)._documentStylerHandler;
            if (old) {
                headingColorInherit.removeEventListener('change', old);
            }
            const handler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                const docId = this.documentManager.getCurrentDocId();
                if (docId) {
                    await this.settingsManager.setDocumentSettings(docId, { headingNumberColorInherit: enabled });
                    const latest = await this.settingsManager.getDocumentSettings(docId);
                    if (latest.headingNumberingEnabled) {
                        this.debounceApplyHeadingNumbering();
                    }
                } else {
                    await this.settingsManager.updateSettings({ defaultHeadingNumberColorInherit: enabled } as any);
                    const currentDocId = this.documentManager.getCurrentDocId();
                    if (currentDocId) {
                        const docSettings = await this.settingsManager.getDocumentSettings(currentDocId);
                        if (docSettings.headingNumberingEnabled) {
                            this.debounceApplyHeadingNumbering();
                        }
                    }
                }
            };
            headingColorInherit.addEventListener('change', handler);
            (headingColorInherit as any)._documentStylerHandler = handler;
        }

        // 图表编号前缀输入框
        const figurePrefixInput = this.panelElement.querySelector('#figure-prefix-input') as HTMLInputElement;
        if (figurePrefixInput) {
            const handler = async (e: Event) => {
                const prefix = (e.target as HTMLInputElement).value;

                const docId = this.documentManager.getCurrentDocId();
                if (docId) {
                    await this.settingsManager.setDocumentFigurePrefix(docId, prefix);
                    await this.applyCrossReferenceSettings(docId, true);
                } else {
                    await this.settingsManager.updateSettings({ figurePrefix: prefix });
                }
            };
            figurePrefixInput.addEventListener('change', handler);
            (figurePrefixInput as any)._documentStylerHandler = handler;
        }

        const tablePrefixInput = this.panelElement.querySelector('#table-prefix-input') as HTMLInputElement;
        if (tablePrefixInput) {
            const handler = async (e: Event) => {
                const prefix = (e.target as HTMLInputElement).value;

                const docId = this.documentManager.getCurrentDocId();
                if (docId) {
                    await this.settingsManager.setDocumentTablePrefix(docId, prefix);
                    await this.applyCrossReferenceSettings(docId, true);
                } else {
                    await this.settingsManager.updateSettings({ tablePrefix: prefix });
                }
            };
            tablePrefixInput.addEventListener('change', handler);
            (tablePrefixInput as any)._documentStylerHandler = handler;
        }

        // 绑定状态事件（文档/全局）
        if (currentDocId) {
            this.bindDocumentStatusEvents(currentDocId);
        } else {
            this.bindGlobalStatusEvents();
        }

        // 正文(Protyle)编号显示开关（文档级/全局）
        const headingInProtyle = this.panelElement.querySelector('#doc-heading-in-protyle') as HTMLInputElement;
        if (headingInProtyle) {
            // 先移除旧的事件再绑定，避免重复
            const old = (headingInProtyle as any)._documentStylerHandler;
            if (old) {
                headingInProtyle.removeEventListener('change', old);
                headingInProtyle.removeEventListener('input', old);
            }

            const handler = async (e: Event) => {
                const enableProtyle = (e.target as HTMLInputElement).checked;
                const docId = this.documentManager.getCurrentDocId();
                try {
                    if (docId) {
                        await this.settingsManager.setDocumentSettings(docId, { showHeadingNumberInProtyle: enableProtyle });
                        const latest = await this.settingsManager.getDocumentSettings(docId);
                        if (latest.headingNumberingEnabled) {
                            this.debounceApplyHeadingNumbering();
                        }
                    } else {
                        await this.settingsManager.updateSettings({ defaultShowHeadingNumberInProtyle: enableProtyle } as any);
                        const currentDocId = this.documentManager.getCurrentDocId();
                        if (currentDocId) {
                            const docSettings = await this.settingsManager.getDocumentSettings(currentDocId);
                            if (docSettings.headingNumberingEnabled) {
                                this.debounceApplyHeadingNumbering();
                            }
                        }
                    }
                } catch (err) {
                    console.error('DocumentStyler: 切换正文编号失败', err);
                }
            };

            headingInProtyle.addEventListener('change', handler);
            headingInProtyle.addEventListener('input', handler);
            (headingInProtyle as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 绑定字体设置事件
     */
    private bindFontSettingsEvents(): void {
        if (!this.panelElement) return;

        // 字体族选择器
        const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement;
        if (fontFamilySelect) {
            // 加载系统字体
            this.loadSystemFonts(fontFamilySelect);

            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontFamily = (e.target as HTMLSelectElement).value;


                await this.settingsManager.setDocumentFontFamily(docId, fontFamily);
                await this.applyFontSettings(docId);
            };
            fontFamilySelect.addEventListener('change', handler);
            (fontFamilySelect as any)._documentStylerHandler = handler;
        }

        // 字体大小输入框
        const fontSizeInput = this.panelElement.querySelector('#font-size-input') as HTMLInputElement;
        if (fontSizeInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const fontSize = (e.target as HTMLInputElement).value + 'px';


                await this.settingsManager.setDocumentFontSize(docId, fontSize);
                await this.applyFontSettings(docId);
            };
            fontSizeInput.addEventListener('change', handler);
            (fontSizeInput as any)._documentStylerHandler = handler;
        }

        // 字体大小减少按钮
        const fontSizeDecreaseBtn = this.panelElement.querySelector('#font-size-decrease') as HTMLButtonElement;
        if (fontSizeDecreaseBtn) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const input = this.panelElement.querySelector('#font-size-input') as HTMLInputElement;
                const currentSize = parseInt(input.value) || 16;
                const newSize = Math.max(8, currentSize - 1);
                input.value = newSize.toString();

                const fontSize = newSize + 'px';


                await this.settingsManager.setDocumentFontSize(docId, fontSize);
                await this.applyFontSettings(docId);
            };
            fontSizeDecreaseBtn.addEventListener('click', handler);
            (fontSizeDecreaseBtn as any)._documentStylerHandler = handler;
        }

        // 字体大小增加按钮
        const fontSizeIncreaseBtn = this.panelElement.querySelector('#font-size-increase') as HTMLButtonElement;
        if (fontSizeIncreaseBtn) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const input = this.panelElement.querySelector('#font-size-input') as HTMLInputElement;
                const currentSize = parseInt(input.value) || 16;
                const newSize = Math.min(72, currentSize + 1);
                input.value = newSize.toString();

                const fontSize = newSize + 'px';


                await this.settingsManager.setDocumentFontSize(docId, fontSize);
                await this.applyFontSettings(docId);
            };
            fontSizeIncreaseBtn.addEventListener('click', handler);
            (fontSizeIncreaseBtn as any)._documentStylerHandler = handler;
        }

        // 行高输入框
        const lineHeightInput = this.panelElement.querySelector('#line-height-input') as HTMLInputElement;
        if (lineHeightInput) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const lineHeight = (e.target as HTMLInputElement).value;


                await this.settingsManager.setDocumentFontSettings(docId, { lineHeight });
                await this.applyFontSettings(docId);
            };
            lineHeightInput.addEventListener('change', handler);
            (lineHeightInput as any)._documentStylerHandler = handler;
        }

        // 行高减少按钮
        const lineHeightDecreaseBtn = this.panelElement.querySelector('#line-height-decrease') as HTMLButtonElement;
        if (lineHeightDecreaseBtn) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const input = this.panelElement.querySelector('#line-height-input') as HTMLInputElement;
                const currentHeight = parseFloat(input.value) || 1.6;
                const newHeight = Math.max(1.0, Math.round((currentHeight - 0.1) * 10) / 10);
                input.value = newHeight.toFixed(1);

                const lineHeight = newHeight.toString();


                await this.settingsManager.setDocumentFontSettings(docId, { lineHeight });
                await this.applyFontSettings(docId);
            };
            lineHeightDecreaseBtn.addEventListener('click', handler);
            (lineHeightDecreaseBtn as any)._documentStylerHandler = handler;
        }

        // 行高增加按钮
        const lineHeightIncreaseBtn = this.panelElement.querySelector('#line-height-increase') as HTMLButtonElement;
        if (lineHeightIncreaseBtn) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;

                const input = this.panelElement.querySelector('#line-height-input') as HTMLInputElement;
                const currentHeight = parseFloat(input.value) || 1.6;
                const newHeight = Math.min(3.0, Math.round((currentHeight + 0.1) * 10) / 10);
                input.value = newHeight.toFixed(1);

                const lineHeight = newHeight.toString();


                await this.settingsManager.setDocumentFontSettings(docId, { lineHeight });
                await this.applyFontSettings(docId);
            };
            lineHeightIncreaseBtn.addEventListener('click', handler);
            (lineHeightIncreaseBtn as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 绑定重置字体设置按钮事件
     */
    private bindResetFontSettingsEvent(): void {
        if (!this.panelElement) return;

        const resetButton = this.panelElement.querySelector('#reset-font-settings') as HTMLButtonElement;
        if (resetButton) {
            const handler = async () => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;



                // 重置字体设置
                await this.settingsManager.resetDocumentFontSettings(docId);

                // 更新UI显示
                const docSettings = await this.settingsManager.getDocumentSettings(docId);
                await this.updateFontSettingsUI(docSettings.fontSettings);

                // 应用字体设置
                await this.applyFontSettings(docId);
            };
            resetButton.addEventListener('click', handler);
            (resetButton as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 绑定全局字体设置事件
     */
    private bindGlobalFontSettingsEvents(): void {
        if (!this.panelElement) return;

        // 字体族选择器（全局默认）
        const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement | null;
        if (fontFamilySelect) {
            const handler = async (e: Event) => {
                const val = (e.target as HTMLSelectElement).value || '';
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, fontFamily: val } as any });
                await this.updatePanel();
            };
            fontFamilySelect.addEventListener('change', handler);
            (fontFamilySelect as any)._documentStylerHandler = handler;
        }

        // 字体大小
        const fontSizeInput = this.panelElement.querySelector('#font-size-input') as HTMLInputElement | null;
        if (fontSizeInput) {
            const handler = async (e: Event) => {
                const px = ((e.target as HTMLInputElement).value || '16') + 'px';
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, fontSize: px } as any });
                await this.updatePanel();
            };
            fontSizeInput.addEventListener('change', handler);
            (fontSizeInput as any)._documentStylerHandler = handler;
        }

        const decBtn = this.panelElement.querySelector('#font-size-decrease') as HTMLButtonElement | null;
        if (decBtn) {
            const handler = async () => {
                const input = this.panelElement!.querySelector('#font-size-input') as HTMLInputElement | null;
                if (!input) return;
                const cur = parseInt(input.value) || 16;
                const next = Math.max(8, cur - 1);
                input.value = String(next);
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, fontSize: next + 'px' } as any });
                await this.updatePanel();
            };
            decBtn.addEventListener('click', handler);
            (decBtn as any)._documentStylerHandler = handler;
        }

        const incBtn = this.panelElement.querySelector('#font-size-increase') as HTMLButtonElement | null;
        if (incBtn) {
            const handler = async () => {
                const input = this.panelElement!.querySelector('#font-size-input') as HTMLInputElement | null;
                if (!input) return;
                const cur = parseInt(input.value) || 16;
                const next = Math.min(72, cur + 1);
                input.value = String(next);
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, fontSize: next + 'px' } as any });
                await this.updatePanel();
            };
            incBtn.addEventListener('click', handler);
            (incBtn as any)._documentStylerHandler = handler;
        }

        // 行高
        const lineHeightInput = this.panelElement.querySelector('#line-height-input') as HTMLInputElement | null;
        if (lineHeightInput) {
            const handler = async (e: Event) => {
                const lh = (e.target as HTMLInputElement).value || '1.6';
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, lineHeight: lh } as any });
                await this.updatePanel();
            };
            lineHeightInput.addEventListener('change', handler);
            (lineHeightInput as any)._documentStylerHandler = handler;
        }

        const lhDec = this.panelElement.querySelector('#line-height-decrease') as HTMLButtonElement | null;
        if (lhDec) {
            const handler = async () => {
                const input = this.panelElement!.querySelector('#line-height-input') as HTMLInputElement | null;
                if (!input) return;
                const cur = parseFloat(input.value || '1.6') || 1.6;
                const next = Math.max(1.0, Math.round((cur - 0.1) * 10) / 10);
                input.value = next.toFixed(1);
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, lineHeight: String(next) } as any });
                await this.updatePanel();
            };
            lhDec.addEventListener('click', handler);
            (lhDec as any)._documentStylerHandler = handler;
        }

        const lhInc = this.panelElement.querySelector('#line-height-increase') as HTMLButtonElement | null;
        if (lhInc) {
            const handler = async () => {
                const input = this.panelElement!.querySelector('#line-height-input') as HTMLInputElement | null;
                if (!input) return;
                const cur = parseFloat(input.value || '1.6') || 1.6;
                const next = Math.min(3.0, Math.round((cur + 0.1) * 10) / 10);
                input.value = next.toFixed(1);
                const s = this.settingsManager.getSettings() as any;
                const prev = (s.defaultFontSettings || this.settingsManager.getDefaultFontSettings()) as any;
                await this.settingsManager.updateSettings({ defaultFontSettings: { ...prev, lineHeight: String(next) } as any });
                await this.updatePanel();
            };
            lhInc.addEventListener('click', handler);
            (lhInc as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 绑定全局图片堆叠设置事件
     */
    private bindGlobalImageStackEvents(): void {
        if (!this.panelElement) return;
        const enabledEl = this.panelElement.querySelector('#doc-imgstack-enabled') as HTMLInputElement | null;
        const modeEl = this.panelElement.querySelector('#doc-imgstack-mode') as HTMLSelectElement | null;
        const heightEl = this.panelElement.querySelector('#doc-imgstack-height') as HTMLInputElement | null;
        const optionsRow = this.panelElement.querySelector('#doc-imgstack-options') as HTMLElement | null;

        if (enabledEl) {
            const handler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                await this.settingsManager.updateSettings({ defaultImageStackEnabled: enabled });
                if (optionsRow) optionsRow.style.display = enabled ? '' : 'none';
                await this.updatePanel();
            };
            enabledEl.addEventListener('change', handler);
            (enabledEl as any)._documentStylerHandler = handler;
        }

        if (modeEl) {
            const handler = async (e: Event) => {
                const mode = (e.target as HTMLSelectElement).value as any;
                await this.settingsManager.updateSettings({ defaultImageStackMode: mode });
                await this.updatePanel();
            };
            modeEl.addEventListener('change', handler);
            (modeEl as any)._documentStylerHandler = handler;
        }

        if (heightEl) {
            const handler = async (e: Event) => {
                const height = (e.target as HTMLInputElement).value || '48px';
                await this.settingsManager.updateSettings({ defaultImageStackCollapsedHeight: height });
                await this.updatePanel();
            };
            heightEl.addEventListener('change', handler);
            (heightEl as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 清除面板事件监听器
     */
    private clearPanelEvents(): void {
        if (!this.panelElement) return;

        // 清除标题编号样式选择器事件
        for (let i = 0; i < 6; i++) {
            const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
            if (styleSelect && (styleSelect as any)._documentStylerHandler) {
                styleSelect.removeEventListener('change', (styleSelect as any)._documentStylerHandler);
                delete (styleSelect as any)._documentStylerHandler;
            }
        }

        // 清除编号格式输入框事件
        for (let i = 0; i < 6; i++) {
            const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
            if (formatInput && (formatInput as any)._documentStylerHandler) {
                formatInput.removeEventListener('change', (formatInput as any)._documentStylerHandler);
                delete (formatInput as any)._documentStylerHandler;
            }
        }

        // 清除字体设置事件
        this.clearFontSettingsEvents();

        // 清除文档状态事件
        this.clearDocumentStatusEvents();

        // 清除图片堆叠事件
        this.clearImageStackEvents();
    }

    private bindImageStackEvents(): void {
        if (!this.panelElement) return;
        const enabledEl = this.panelElement.querySelector('#doc-imgstack-enabled') as HTMLInputElement | null;
        const modeEl = this.panelElement.querySelector('#doc-imgstack-mode') as HTMLSelectElement | null;
        const heightEl = this.panelElement.querySelector('#doc-imgstack-height') as HTMLInputElement | null;
        const optionsRow = this.panelElement.querySelector('#doc-imgstack-options') as HTMLElement | null;

        if (enabledEl) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;
                const enabled = (e.target as HTMLInputElement).checked;
                await this.settingsManager.setDocumentSettings(docId, { imageStackEnabled: enabled });
                if (optionsRow) optionsRow.style.display = enabled ? '' : 'none';
                // 触发立即应用
                if (this.pluginInstance && typeof this.pluginInstance.applyImageStack === 'function') {
                    await this.pluginInstance.applyImageStack();
                }
            };
            enabledEl.addEventListener('change', handler);
            (enabledEl as any)._documentStylerHandler = handler;
        }

        if (modeEl) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;
                const mode = (e.target as HTMLSelectElement).value as any;
                await this.settingsManager.setDocumentSettings(docId, { imageStackMode: mode });
                if (this.pluginInstance && typeof this.pluginInstance.applyImageStack === 'function') {
                    await this.pluginInstance.applyImageStack();
                }
            };
            modeEl.addEventListener('change', handler);
            (modeEl as any)._documentStylerHandler = handler;
        }

        if (heightEl) {
            const handler = async (e: Event) => {
                const docId = this.documentManager.getCurrentDocId();
                if (!docId) return;
                const height = (e.target as HTMLInputElement).value || '48px';
                await this.settingsManager.setDocumentSettings(docId, { imageStackCollapsedHeight: height });
                if (this.pluginInstance && typeof this.pluginInstance.applyImageStack === 'function') {
                    await this.pluginInstance.applyImageStack();
                }
            };
            heightEl.addEventListener('change', handler);
            (heightEl as any)._documentStylerHandler = handler;
        }
    }

    private clearImageStackEvents(): void {
        if (!this.panelElement) return;
        const ids = ['#doc-imgstack-enabled', '#doc-imgstack-mode', '#doc-imgstack-height'];
        ids.forEach(sel => {
            const el = this.panelElement!.querySelector(sel) as any;
            if (el && el._documentStylerHandler) {
                const type = sel === '#doc-imgstack-enabled' ? 'change' : 'change';
                el.removeEventListener(type, el._documentStylerHandler);
                delete el._documentStylerHandler;
            }
        });
    }

    /**
     * 清除字体设置事件
     */
    private clearFontSettingsEvents(): void {
        if (!this.panelElement) return;

        const fontElements = [
            '#font-family-select',
            '#font-size-input',
            '#font-size-decrease',
            '#font-size-increase',
            '#line-height-input',
            '#line-height-decrease',
            '#line-height-increase',
            '#reset-font-settings'
        ];

        fontElements.forEach(selector => {
            const element = this.panelElement.querySelector(selector) as HTMLElement;
            if (element && (element as any)._documentStylerHandler) {
                const eventType = element.tagName === 'BUTTON' ? 'click' : 'change';
                element.removeEventListener(eventType, (element as any)._documentStylerHandler);
                delete (element as any)._documentStylerHandler;
            }
        });
    }

    /**
     * 加载系统字体
     */
    private async loadSystemFonts(selectElement: HTMLSelectElement): Promise<void> {
        try {
            // 调用思源的API获取系统字体
            const response = await fetch('/api/system/getSysFonts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                const data = await response.json();
                if (data.code === 0 && Array.isArray(data.data)) {
                    // 清空现有选项（保留默认选项）
                    const defaultOption = selectElement.querySelector('option[value=""]');
                    selectElement.innerHTML = '';
                    if (defaultOption) {
                        selectElement.appendChild(defaultOption);
                    }

                    // 添加系统字体选项
                    data.data.forEach((fontFamily: string) => {
                        const option = document.createElement('option');
                        option.value = fontFamily;
                        option.textContent = fontFamily;
                        option.style.fontFamily = fontFamily;
                        selectElement.appendChild(option);
                    });

                    // 设置当前选中的字体
                    const docId = this.documentManager.getCurrentDocId();
                    if (docId) {
                        const fontSettings = await this.settingsManager.getDocumentFontSettings(docId);
                        selectElement.value = fontSettings.fontFamily || '';
                    }
                }
            }
        } catch (error) {
            console.error('DocumentStyler: 加载系统字体失败:', error);
        }
    }

    /**
     * 应用字体设置
     */
    private async applyFontSettings(docId: string): Promise<void> {
        if (!docId) return;

        try {

            
            // 调用主插件的字体设置应用方法
            if (this.pluginInstance && typeof this.pluginInstance.applyFontSettings === 'function') {
                await this.pluginInstance.applyFontSettings();

            } else {
                console.warn('DocumentStyler: 主插件实例不可用，无法应用字体设置');
            }
        } catch (error) {
            console.error(`DocumentStyler: 应用字体设置失败:`, error);
        }
    }

    /**
     * 应用文档设置
     * @param docId 文档ID
     */
    private async applyDocumentSettings(docId: string): Promise<void> {
        try {
            const settings = await this.settingsManager.getDocumentSettings(docId);
            await this.applyHeadingNumberingSettings(docId, settings.headingNumberingEnabled);
            await this.applyCrossReferenceSettings(docId, settings.crossReferenceEnabled);
        } catch (error) {
            console.error('应用文档设置失败:', error);
        }
    }

    /**
     * 应用标题编号设置
     * @param docId 文档ID
     * @param enabled 是否启用标题编号
     */
    private async applyHeadingNumberingSettings(docId: string, enabled: boolean): Promise<void> {
        try {
            if (enabled) {
                if (this.pluginInstance) {
                    await this.pluginInstance.applyHeadingNumbering();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法应用标题编号');
                }
            } else {
                if (this.pluginInstance) {
                    await this.pluginInstance.clearHeadingNumbering();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法清除标题编号');
                }
            }
        } catch (error) {
            console.error('应用标题编号设置失败:', error);
        }
    }

    /**
     * 应用交叉引用设置
     * @param docId 文档ID
     * @param enabled 是否启用交叉引用
     */
    private async applyCrossReferenceSettings(docId: string, enabled: boolean): Promise<void> {
        try {
            if (enabled) {
                if (this.pluginInstance) {
                    await this.pluginInstance.applyCrossReference();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法应用交叉引用');
                }
            } else {
                if (this.pluginInstance) {
                    await this.pluginInstance.clearCrossReference();
                } else {
                    console.warn('DocumentStyler: 插件实例不可用，无法清除交叉引用');
                }
            }
        } catch (error) {
            console.error('应用交叉引用设置失败:', error);
        }
    }

    /**
     * 更新样式示例显示
     */
    private updateStyleExample(level: number, style: HeadingNumberStyle): void {
        const exampleElement = this.panelElement?.querySelector(`#heading-style-${level}`)?.parentElement?.querySelector('.document-styler-style-example');
        if (exampleElement) {
            const example = NumberStyleConverter.getExample(style);
            exampleElement.textContent = example;

        } else {
            console.warn(`DocumentStyler: 未找到样式示例元素 - 级别${level + 1}`);
        }
    }



    /**
     * 更新设置UI
     */
    private async updateSettingsUI(): Promise<void> {
        if (!this.panelElement) return;

        const docId = this.documentManager.getCurrentDocId();

        try {
            const globalSettings = this.settingsManager.getSettings();
            let docSettings = docId
                ? await this.settingsManager.getDocumentSettings(docId)
                : this.settingsManager.getDefaultDocumentSettings();
            const defaultDocSettings = this.settingsManager.getDefaultDocumentSettings();

            // 更新当前状态显示（文档或全局）
            if (docId) {
                await this.updateCurrentDocumentStatus(docId);
            } else {
                // 全局模式：复用当前文档状态区域，但绑定与显示基于全局
                const headingCheckbox = this.panelElement.querySelector('#doc-heading-enabled') as HTMLInputElement | null;
                if (headingCheckbox) headingCheckbox.checked = !!globalSettings.headingNumbering;

                const crossRefCheckbox = this.panelElement.querySelector('#doc-crossref-enabled') as HTMLInputElement | null;
                if (crossRefCheckbox) crossRefCheckbox.checked = !!globalSettings.crossReference;

                const customFontCheckbox = this.panelElement.querySelector('#doc-custom-font-enabled') as HTMLInputElement | null;
                if (customFontCheckbox) {
                    const defaultCF = (globalSettings as any).defaultCustomFontEnabled ?? false;
                    customFontCheckbox.checked = !!defaultCF;
                    customFontCheckbox.disabled = false;
                }
            }

            // 切换全局模式提示显隐
            const globalTip = this.panelElement.querySelector('#global-mode-tip') as HTMLElement | null;
            if (globalTip) globalTip.style.display = docId ? 'none' : '';

            // 更新编号格式和样式（文档或全局）
            for (let i = 0; i < 6; i++) {
                const formatInput = this.panelElement.querySelector(`#format-${i}`) as HTMLInputElement;
                if (formatInput) formatInput.value = (docId ? docSettings.numberingFormats[i] : globalSettings.numberingFormats[i]);

                const styleSelect = this.panelElement.querySelector(`#heading-style-${i}`) as HTMLSelectElement;
                if (styleSelect) styleSelect.value = (docId ? docSettings.headingNumberStyles[i] : globalSettings.headingNumberStyles[i]);
            }

            // 更新字体设置（文档模式才可编辑）
            await this.updateFontSettingsUI(docSettings.fontSettings);
            const globalCF = (globalSettings as any).defaultCustomFontEnabled ?? false;
            this.toggleFontSettingsSection(docId ? docSettings.customFontEnabled : globalCF);

            // 更新节显示状态
            const headingEnabled = docId ? docSettings.headingNumberingEnabled : globalSettings.headingNumbering;
            this.toggleHeadingStylesSection(headingEnabled);
            this.toggleNumberingFormatsSection(headingEnabled);

            const crossRefEnabled = docId ? docSettings.crossReferenceEnabled : globalSettings.crossReference;
            this.toggleFiguresSection(crossRefEnabled);

            // 大纲/块属性开关（全局模式禁用）
            const outlineSwitch = this.panelElement.querySelector('#doc-heading-in-outline') as HTMLInputElement | null;
            if (outlineSwitch) {
                if (docId) {
                    outlineSwitch.checked = !!docSettings.showHeadingNumberInOutline;
                    outlineSwitch.disabled = false;
                } else {
                    outlineSwitch.checked = !!(globalSettings as any).defaultShowHeadingNumberInOutline;
                    outlineSwitch.disabled = false;
                }
            }
            const attrSwitch = this.panelElement.querySelector('#doc-heading-in-attr') as HTMLInputElement | null;
            if (attrSwitch) {
                if (docId) {
                    attrSwitch.checked = !!docSettings.showHeadingNumberInBlockAttr;
                    attrSwitch.disabled = false;
                } else {
                    attrSwitch.checked = !!(globalSettings as any).defaultShowHeadingNumberInBlockAttr;
                    attrSwitch.disabled = false;
                }
            }

            // 图片堆叠（全局模式禁用设置）
            const imgStackEnabled = this.panelElement.querySelector('#doc-imgstack-enabled') as HTMLInputElement | null;
            if (imgStackEnabled) {
                if (docId) {
                    imgStackEnabled.checked = !!docSettings.imageStackEnabled;
                    imgStackEnabled.disabled = false;
                } else {
                    imgStackEnabled.checked = !!(globalSettings as any).defaultImageStackEnabled;
                    imgStackEnabled.disabled = false;
                }
            }
            const imgStackMode = this.panelElement.querySelector('#doc-imgstack-mode') as HTMLSelectElement | null;
            if (imgStackMode) {
                if (docId) {
                    imgStackMode.value = (docSettings.imageStackMode === 'hide' ? 'hide' : 'compact');
                    imgStackMode.disabled = false;
                } else {
                    const v = (globalSettings as any).defaultImageStackMode;
                    imgStackMode.value = (v === 'hide' ? 'hide' : 'compact');
                    imgStackMode.disabled = false;
                }
            }
            const imgStackHeight = this.panelElement.querySelector('#doc-imgstack-height') as HTMLInputElement | null;
            if (imgStackHeight) {
                if (docId) {
                    imgStackHeight.value = docSettings.imageStackCollapsedHeight || '48px';
                    imgStackHeight.disabled = false;
                } else {
                    imgStackHeight.value = (globalSettings as any).defaultImageStackCollapsedHeight || '48px';
                    imgStackHeight.disabled = false;
                }
            }
            const imgStackRow = this.panelElement.querySelector('#doc-imgstack-options') as HTMLElement | null;
            if (imgStackRow) imgStackRow.style.display = ((docId ? docSettings.imageStackEnabled : ((globalSettings as any).defaultImageStackEnabled ?? false)) ? '' : 'none');

            // 覆盖提示（仅文档模式）：与当前全局默认派生的默认文档设置比较
            const isOverridden = !!docId && (
                docSettings.headingNumberingEnabled !== defaultDocSettings.headingNumberingEnabled ||
                docSettings.crossReferenceEnabled !== defaultDocSettings.crossReferenceEnabled ||
                JSON.stringify(docSettings.numberingFormats) !== JSON.stringify(defaultDocSettings.numberingFormats) ||
                JSON.stringify(docSettings.headingNumberStyles) !== JSON.stringify(defaultDocSettings.headingNumberStyles) ||
                docSettings.figurePrefix !== defaultDocSettings.figurePrefix ||
                docSettings.tablePrefix !== defaultDocSettings.tablePrefix ||
                (!!docSettings.customFontEnabled) !== (!!defaultDocSettings.customFontEnabled) ||
                JSON.stringify(docSettings.fontSettings || {}) !== JSON.stringify(defaultDocSettings.fontSettings || {}) ||
                (!!docSettings.imageStackEnabled) !== (!!defaultDocSettings.imageStackEnabled) ||
                (docSettings.imageStackMode || 'compact') !== (defaultDocSettings.imageStackMode || 'compact') ||
                (docSettings.imageStackCollapsedHeight || '48px') !== (defaultDocSettings.imageStackCollapsedHeight || '48px')
            );

            const overrideTip = this.panelElement.querySelector('#override-tip') as HTMLElement | null;
            if (overrideTip) overrideTip.style.display = isOverridden ? '' : 'none';
            const docOverrideTip = this.panelElement.querySelector('#doc-override-tip') as HTMLElement | null;
            if (docOverrideTip) docOverrideTip.style.display = isOverridden ? '' : 'none';
            const fontOverrideTip = this.panelElement.querySelector('#font-override-tip') as HTMLElement | null;
            if (fontOverrideTip) fontOverrideTip.style.display = isOverridden ? '' : 'none';
        } catch (error) {
            console.error('更新设置UI失败:', error);
        }
    }

    /**
     * 更新字体设置UI
     */
    private async updateFontSettingsUI(fontSettings: any): Promise<void> {
        if (!this.panelElement || !fontSettings) return;

        try {
            // 更新字体族选择器
            const fontFamilySelect = this.panelElement.querySelector('#font-family-select') as HTMLSelectElement;
            if (fontFamilySelect) {
                fontFamilySelect.value = fontSettings.fontFamily || '';
            }

            // 更新字体大小输入框
            const fontSizeInput = this.panelElement.querySelector('#font-size-input') as HTMLInputElement;
            if (fontSizeInput) {
                fontSizeInput.value = this.parseFontSize(fontSettings.fontSize || '16px').toString();
            }

            // 更新行高输入框
            const lineHeightInput = this.panelElement.querySelector('#line-height-input') as HTMLInputElement;
            if (lineHeightInput) {
                const lineHeight = parseFloat(fontSettings.lineHeight || '1.6');
                lineHeightInput.value = lineHeight.toFixed(1);
            }


        } catch (error) {
            console.error('DocumentStyler: 更新字体设置UI失败:', error);
        }
    }

    /**
     * 更新当前文档状态显示
     */
    private async updateCurrentDocumentStatus(docId: string | null): Promise<void> {
        if (!docId) return;

        try {
            const docSettings = await this.settingsManager.getDocumentSettings(docId);


            // 更新标题编号开关
            const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
            if (headingCheckbox) {
                headingCheckbox.checked = docSettings.headingNumberingEnabled;
            }

            // 更新交叉引用开关
            const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;
            if (crossRefCheckbox) {
                crossRefCheckbox.checked = docSettings.crossReferenceEnabled;
            }

            // 更新文章字体自定义开关
            const customFontCheckbox = this.panelElement?.querySelector('#doc-custom-font-enabled') as HTMLInputElement;
            if (customFontCheckbox) {
                customFontCheckbox.checked = docSettings.customFontEnabled;
            }

            // 只在初始化时绑定事件，避免重复绑定
            if (!this.eventsInitialized) {
                this.bindDocumentStatusEvents(docId);
                this.eventsInitialized = true;
            }
        } catch (error) {
            console.error('更新文档状态失败:', error);
        }
    }

    /**
     * 绑定文档状态事件
     */
    private bindDocumentStatusEvents(_docId: string): void {
        // 先清除之前的事件监听器
        this.clearDocumentStatusEvents();

        const headingCheckbox = this.panelElement?.querySelector('#doc-heading-enabled') as HTMLInputElement;
        const crossRefCheckbox = this.panelElement?.querySelector('#doc-crossref-enabled') as HTMLInputElement;
        const customFontCheckbox = this.panelElement?.querySelector('#doc-custom-font-enabled') as HTMLInputElement;

        if (headingCheckbox) {
            const headingHandler = async (e: Event) => {
                // 实时获取当前文档ID，而不是使用闭包中的旧ID
                const currentDocId = this.documentManager.getCurrentDocId();
                if (!currentDocId) {
                    console.warn('DocumentStyler: 无法获取当前文档ID，跳过标题编号设置');
                    return;
                }

                const enabled = (e.target as HTMLInputElement).checked;


                await this.settingsManager.setDocumentSettings(currentDocId, { headingNumberingEnabled: enabled });
                this.toggleHeadingStylesSection(enabled);
                this.toggleNumberingFormatsSection(enabled);

                // 只应用标题编号相关的设置，不影响交叉引用
                await this.applyHeadingNumberingSettings(currentDocId, enabled);
            };
            headingCheckbox.addEventListener('change', headingHandler);
            (headingCheckbox as any)._documentStylerHandler = headingHandler;
        }

        if (crossRefCheckbox) {
            const crossRefHandler = async (e: Event) => {
                // 检查是否为内测用户
                if (!this.betaFeatureManager.isBetaVerified()) {

                    // 恢复复选框状态
                    (e.target as HTMLInputElement).checked = !(e.target as HTMLInputElement).checked;
                    return;
                }

                // 实时获取当前文档ID，而不是使用闭包中的旧ID
                const currentDocId = this.documentManager.getCurrentDocId();
                if (!currentDocId) {
                    console.warn('DocumentStyler: 无法获取当前文档ID，跳过交叉引用设置');
                    return;
                }

                const enabled = (e.target as HTMLInputElement).checked;


                await this.settingsManager.setDocumentSettings(currentDocId, { crossReferenceEnabled: enabled });
                this.toggleFiguresSection(enabled);

                // 只应用交叉引用相关的设置，不影响标题编号
                await this.applyCrossReferenceSettings(currentDocId, enabled);
            };
            crossRefCheckbox.addEventListener('change', crossRefHandler);
            (crossRefCheckbox as any)._documentStylerHandler = crossRefHandler;
        }

        if (customFontCheckbox) {
            const customFontHandler = async (e: Event) => {
                // 实时获取当前文档ID，而不是使用闭包中的旧ID
                const currentDocId = this.documentManager.getCurrentDocId();
                if (!currentDocId) {
                    console.warn('DocumentStyler: 无法获取当前文档ID，跳过文章字体自定义设置');
                    return;
                }

                const enabled = (e.target as HTMLInputElement).checked;


                await this.settingsManager.setDocumentSettings(currentDocId, { customFontEnabled: enabled });
                this.toggleFontSettingsSection(enabled);

                // 如果禁用了字体自定义，清除字体设置
                if (!enabled) {
                    await this.settingsManager.resetDocumentFontSettings(currentDocId);
                    await this.applyFontSettings(currentDocId);
                }
            };
            customFontCheckbox.addEventListener('change', customFontHandler);
            (customFontCheckbox as any)._documentStylerHandler = customFontHandler;
        }
    }

    /**
     * 绑定全局状态事件（无文档时）
     */
    private bindGlobalStatusEvents(): void {
        if (!this.panelElement) return;

        // 先清除可能已有的事件
        this.clearDocumentStatusEvents();

        const headingCheckbox = this.panelElement.querySelector('#doc-heading-enabled') as HTMLInputElement | null;
        const crossRefCheckbox = this.panelElement.querySelector('#doc-crossref-enabled') as HTMLInputElement | null;
        const headingInAttr = this.panelElement.querySelector('#doc-heading-in-attr') as HTMLInputElement | null;
        const headingInOutline = this.panelElement.querySelector('#doc-heading-in-outline') as HTMLInputElement | null;
        const customFontCheckbox = this.panelElement.querySelector('#doc-custom-font-enabled') as HTMLInputElement | null;

        if (headingCheckbox) {
            const handler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;

                await this.settingsManager.updateSettings({ headingNumbering: enabled });
                await this.updatePanel();
            };
            headingCheckbox.addEventListener('change', handler);
            (headingCheckbox as any)._documentStylerHandler = handler;
        }

        if (crossRefCheckbox) {
            const handler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;

                await this.settingsManager.updateSettings({ crossReference: enabled });
                await this.updatePanel();
            };
            crossRefCheckbox.addEventListener('change', handler);
            (crossRefCheckbox as any)._documentStylerHandler = handler;
        }

        if (headingInAttr) {
            const handler = async (e: Event) => {
                const preferAttr = (e.target as HTMLInputElement).checked;
                await this.settingsManager.updateSettings({ defaultShowHeadingNumberInBlockAttr: preferAttr } as any);
                await this.updatePanel();
            };
            headingInAttr.addEventListener('change', handler);
            (headingInAttr as any)._documentStylerHandler = handler;
        }

        if (headingInOutline) {
            const handler = async (e: Event) => {
                const enableOutline = (e.target as HTMLInputElement).checked;
                await this.settingsManager.updateSettings({ defaultShowHeadingNumberInOutline: enableOutline } as any);
                await this.updatePanel();
            };
            headingInOutline.addEventListener('change', handler);
            (headingInOutline as any)._documentStylerHandler = handler;
        }

        if (customFontCheckbox) {
            const handler = async (e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                await this.settingsManager.updateSettings({ defaultCustomFontEnabled: enabled } as any);
                this.toggleFontSettingsSection(enabled);
                await this.updatePanel();
            };
            customFontCheckbox.addEventListener('change', handler);
            (customFontCheckbox as any)._documentStylerHandler = handler;
        }
    }

    /**
     * 清除文档状态事件监听器
     */
    private clearDocumentStatusEvents(): void {
        if (!this.panelElement) return;

        const headingCheckbox = this.panelElement.querySelector('#doc-heading-enabled') as HTMLInputElement;
        if (headingCheckbox && (headingCheckbox as any)._documentStylerHandler) {
            headingCheckbox.removeEventListener('change', (headingCheckbox as any)._documentStylerHandler);
            delete (headingCheckbox as any)._documentStylerHandler;
        }

        const crossRefCheckbox = this.panelElement.querySelector('#doc-crossref-enabled') as HTMLInputElement;
        if (crossRefCheckbox && (crossRefCheckbox as any)._documentStylerHandler) {
            crossRefCheckbox.removeEventListener('change', (crossRefCheckbox as any)._documentStylerHandler);
            delete (crossRefCheckbox as any)._documentStylerHandler;
        }

        const customFontCheckbox = this.panelElement.querySelector('#doc-custom-font-enabled') as HTMLInputElement;
        if (customFontCheckbox && (customFontCheckbox as any)._documentStylerHandler) {
            customFontCheckbox.removeEventListener('change', (customFontCheckbox as any)._documentStylerHandler);
            delete (customFontCheckbox as any)._documentStylerHandler;
        }
    }

    /**
     * 更新图片表格列表
     */
    private async updateFiguresList(): Promise<void> {
        const listElement = this.panelElement?.querySelector('#figures-list');
        if (!listElement) return;

        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            listElement.innerHTML = '<div class="b3-list--empty">未选择文档</div>';
            return;
        }

        // 检查是否为内测用户
        if (!this.betaFeatureManager.isBetaVerified()) {
            listElement.innerHTML = '<div class="b3-list--empty">交叉引用功能仅对内测用户开放</div>';
            return;
        }

        try {
            const figures = await this.crossReference.getFiguresList(docId);
            listElement.innerHTML = this.generateFiguresListHTML(figures);
        } catch (error) {
            console.error('更新图片表格列表失败:', error);
            listElement.innerHTML = '<div class="b3-list--empty">加载失败</div>';
        }
    }

    /**
     * 生成图片表格列表HTML
     */
    private generateFiguresListHTML(figures: IFigureInfo[]): string {
        if (figures.length === 0) {
            return '<div class="b3-list--empty">当前文档中没有图片或表格</div>';
        }

        const images = figures.filter(f => f.type === 'image');
        const tables = figures.filter(f => f.type === 'table');

        let html = '';

        if (images.length > 0) {
            html += '<div class="document-styler-subsection"><h4>图片</h4>';
            images.forEach((figure) => {
                const displayText = figure.caption || figure.content || `图片 ${figure.number}`;
                html += `
                    <div class="document-styler-figure-item" data-id="${figure.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${figure.id}')">
                        <span class="figure-label">Figure ${figure.number}</span>
                        <span class="figure-content">${this.truncateText(displayText, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (tables.length > 0) {
            html += '<div class="document-styler-subsection"><h4>表格</h4>';
            tables.forEach((table) => {
                const displayText = table.caption || table.content || `表格 ${table.number}`;
                html += `
                    <div class="document-styler-figure-item" data-id="${table.id}" onclick="window.documentStylerPlugin?.scrollToFigure('${table.id}')">
                        <span class="table-label">Table ${table.number}</span>
                        <span class="figure-content">${this.truncateText(displayText, 50)}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        return html;
    }

    /**
     * 切换标题编号样式节的显示
     */
    private toggleHeadingStylesSection(show: boolean): void {
        const section = this.panelElement?.querySelector('#heading-styles-section') as HTMLElement;
        if (section) {
            section.style.display = show ? '' : 'none';
        }
    }

    /**
     * 切换编号格式设置节的显示
     */
    private toggleNumberingFormatsSection(show: boolean): void {
        const section = this.panelElement?.querySelector('#numbering-formats-section') as HTMLElement;
        if (section) {
            section.style.display = show ? '' : 'none';
        }
    }

    /**
     * 切换图片表格节的显示
     */
    private toggleFiguresSection(show: boolean): void {
        const figuresSection = this.panelElement?.querySelector('#figures-section') as HTMLElement;
        if (figuresSection) {
            figuresSection.style.display = show ? '' : 'none';
        }

        const prefixSection = this.panelElement?.querySelector('#figure-prefix-section') as HTMLElement;
        if (prefixSection) {
            prefixSection.style.display = show ? '' : 'none';
        }
    }

    /**
     * 切换字体设置节的显示
     */
    private toggleFontSettingsSection(show: boolean): void {
        const fontSection = this.panelElement?.querySelector('#font-settings-section') as HTMLElement;
        if (fontSection) {
            fontSection.style.display = show ? '' : 'none';
        }
    }

    /**
     * 截断文本
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 绑定内测功能事件
     */
    private bindBetaFeatureEvents(): void {
        if (!this.panelElement) return;

        const betaButton = this.panelElement.querySelector('#open-beta-verification') as HTMLButtonElement;
        if (betaButton) {
            const handler = () => {

                this.betaFeatureManager.openVerificationDialog();
            };
            betaButton.addEventListener('click', handler);
            // 存储事件处理器以便后续清理
            (betaButton as any)._documentStylerHandler = handler;
        }
    }

}
