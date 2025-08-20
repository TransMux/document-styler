/**
 * 设置管理器
 * 负责插件配置的加载、保存和管理
 */

import { Plugin } from "../../../index";
import { ISettingsManager, IDocumentStylerSettings, HeadingNumberStyle, DOCUMENT_ATTR_KEYS, IDocumentStylerDocumentSettings, IFontSettings, FONT_SETTINGS_CONSTANTS, IBetaFeatureSettings } from "../types";
import { getDocumentAttr, setDocumentAttr } from "../utils/apiUtils";

// 存储配置的键名
const STORAGE_NAME = "document-styler-settings";

// 默认配置
const DEFAULT_SETTINGS: IDocumentStylerSettings = {
    headingNumbering: false,
    crossReference: false,
    numberingFormats: [
        "{1}. ",        // h1
        "{1}.{2}. ",     // h2
        "{1}.{2}.{3}. ", // h3
        "{1}.{2}.{3}.{4}. ", // h4
        "{1}.{2}.{3}.{4}.{5}. ", // h5
        "{1}.{2}.{3}.{4}.{5}.{6}. ", // h6
    ],
    headingNumberStyles: [
        HeadingNumberStyle.ARABIC,    // h1: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h2: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h3: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h4: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h5: 1, 2, 3
        HeadingNumberStyle.ARABIC,    // h6: 1, 2, 3
    ],
    figurePrefix: "图",
    tablePrefix: "表",
    betaFeatures: {
        isVerified: false,
        verifiedCodes: [],
        verifiedAt: undefined
    }
};

export class SettingsManager implements ISettingsManager {
    private plugin: Plugin;
    private settings: IDocumentStylerSettings;
    private documentSettingsCache: Map<string, { settings: IDocumentStylerDocumentSettings; timestamp: number }> = new Map();

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
    }

    async init(): Promise<void> {
        await this.loadSettings();
    }

    destroy(): void {
        // 清理缓存
        this.documentSettingsCache.clear();
    }

    getSettings(): IDocumentStylerSettings {
        return Object.assign({}, this.settings);
    }

    async updateSettings(newSettings: Partial<IDocumentStylerSettings>): Promise<void> {
        this.settings = Object.assign({}, this.settings, newSettings);
        await this.saveSettings();
    }

    async saveSettings(): Promise<void> {
        try {
            await this.plugin.saveData(STORAGE_NAME, this.settings);
        } catch (error) {
            console.error('保存设置失败:', error);
            throw error;
        }
    }

    async loadSettings(): Promise<void> {
        try {
            const stored = await this.plugin.loadData(STORAGE_NAME);
            if (stored && typeof stored === 'object') {
                // 合并默认设置和存储的设置，确保新增的配置项有默认值
                this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
            } else {
                this.settings = Object.assign({}, DEFAULT_SETTINGS);
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    /**
     * 重置设置为默认值
     */
    async resetSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
        await this.saveSettings();
    }



    /**
     * 获取标题编号格式
     * @param level 标题级别 (0-5)
     * @returns 格式字符串
     */
    getNumberingFormat(level: number): string {
        if (level < 0 || level >= this.settings.numberingFormats.length) {
            return "{1}. ";
        }
        return this.settings.numberingFormats[level];
    }

    /**
     * 设置标题编号格式
     * @param level 标题级别 (0-5)
     * @param format 格式字符串
     */
    async setNumberingFormat(level: number, format: string): Promise<void> {
        if (level < 0 || level >= this.settings.numberingFormats.length) {
            return;
        }

        this.settings.numberingFormats[level] = format;
        await this.saveSettings();
    }

    /**
     * 获取指定级别的标题编号样式
     * @param level 标题级别 (0-5)
     * @returns 标题编号样式
     */
    getHeadingNumberStyle(level: number): HeadingNumberStyle {
        if (level < 0 || level >= this.settings.headingNumberStyles.length) {
            return HeadingNumberStyle.ARABIC;
        }
        return this.settings.headingNumberStyles[level];
    }

    /**
     * 设置指定级别的标题编号样式
     * @param level 标题级别 (0-5)
     * @param style 标题编号样式
     */
    async setHeadingNumberStyle(level: number, style: HeadingNumberStyle): Promise<void> {
        if (level < 0 || level >= this.settings.headingNumberStyles.length) {
            return;
        }

        this.settings.headingNumberStyles[level] = style;
        await this.saveSettings();
    }

    /**
     * 获取文档的设置
     * @param docId 文档ID
     * @returns 文档设置
     */
    async getDocumentSettings(docId: string): Promise<IDocumentStylerDocumentSettings> {
        // 检查缓存（5秒有效期）
        const cached = this.documentSettingsCache.get(docId);
        if (cached && Date.now() - cached.timestamp < 5000) {
            return cached.settings;
        }

        try {
            const value = await getDocumentAttr(docId, DOCUMENT_ATTR_KEYS.DOCUMENT_STYLER_SETTINGS);
            let settings: IDocumentStylerDocumentSettings;

            if (value === null) {
                // 如果没有设置属性，返回默认设置
                console.log(`SettingsManager: 文档${docId}没有设置属性，使用默认设置`);
                settings = this.getDefaultDocumentSettings();
            } else {
                console.log(`SettingsManager: 从文档${docId}读取设置:`, value);
                const parsedSettings = JSON.parse(value);
                settings = this.validateAndFixDocumentSettings(parsedSettings);
                console.log(`SettingsManager: 解析后的设置:`, settings);
            }

            // 更新缓存
            this.documentSettingsCache.set(docId, {
                settings,
                timestamp: Date.now()
            });

            return settings;
        } catch (error) {
            console.error('获取文档设置失败:', error);
            return this.getDefaultDocumentSettings();
        }
    }

    /**
     * 设置文档的设置
     * @param docId 文档ID
     * @param settings 文档设置
     */
    async setDocumentSettings(docId: string, settings: Partial<IDocumentStylerDocumentSettings>): Promise<void> {
        try {
            const currentSettings = await this.getDocumentSettings(docId);
            const newSettings = { ...currentSettings, ...settings };

            console.log(`SettingsManager: 保存文档设置 - 文档ID: ${docId}`, newSettings);

            const success = await setDocumentAttr(docId, {
                [DOCUMENT_ATTR_KEYS.DOCUMENT_STYLER_SETTINGS]: JSON.stringify(newSettings)
            });

            if (success) {
                console.log(`SettingsManager: 文档设置保存成功 - 文档ID: ${docId}`);
            } else {
                console.error(`SettingsManager: 文档设置保存失败 - 文档ID: ${docId}`);
            }

            // 清除缓存，确保下次获取最新数据
            this.documentSettingsCache.delete(docId);
        } catch (error) {
            console.error('设置文档设置失败:', error);
        }
    }

    /**
     * 获取文档的标题编号启用状态
     * @param docId 文档ID
     * @returns 是否启用标题编号
     */
    async isDocumentHeadingNumberingEnabled(docId: string): Promise<boolean> {
        const settings = await this.getDocumentSettings(docId);
        return settings.headingNumberingEnabled;
    }

    /**
     * 设置文档的标题编号启用状态
     * @param docId 文档ID
     * @param enabled 是否启用
     */
    async setDocumentHeadingNumberingEnabled(docId: string, enabled: boolean): Promise<void> {
        await this.setDocumentSettings(docId, { headingNumberingEnabled: enabled });
    }

    /**
     * 获取文档的交叉引用启用状态
     * @param docId 文档ID
     * @returns 是否启用交叉引用
     */
    async isDocumentCrossReferenceEnabled(docId: string): Promise<boolean> {
        const settings = await this.getDocumentSettings(docId);
        return settings.crossReferenceEnabled;
    }

    /**
     * 设置文档的交叉引用启用状态
     * @param docId 文档ID
     * @param enabled 是否启用
     */
    async setDocumentCrossReferenceEnabled(docId: string, enabled: boolean): Promise<void> {
        await this.setDocumentSettings(docId, { crossReferenceEnabled: enabled });
    }

    /**
     * 获取文档的标题编号样式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @returns 标题编号样式
     */
    async getDocumentHeadingNumberStyle(docId: string, level: number): Promise<HeadingNumberStyle> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.headingNumberStyles.length) {
            return HeadingNumberStyle.ARABIC;
        }
        return settings.headingNumberStyles[level];
    }

    /**
     * 设置文档的标题编号样式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @param style 标题编号样式
     */
    async setDocumentHeadingNumberStyle(docId: string, level: number, style: HeadingNumberStyle): Promise<void> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.headingNumberStyles.length) {
            return;
        }

        const newStyles = [...settings.headingNumberStyles];
        newStyles[level] = style;
        await this.setDocumentSettings(docId, { headingNumberStyles: newStyles });
    }

    /**
     * 获取文档的编号格式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @returns 格式字符串
     */
    async getDocumentNumberingFormat(docId: string, level: number): Promise<string> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.numberingFormats.length) {
            return "{1}. ";
        }
        return settings.numberingFormats[level];
    }

    /**
     * 设置文档的编号格式
     * @param docId 文档ID
     * @param level 标题级别 (0-5)
     * @param format 格式字符串
     */
    async setDocumentNumberingFormat(docId: string, level: number, format: string): Promise<void> {
        const settings = await this.getDocumentSettings(docId);
        if (level < 0 || level >= settings.numberingFormats.length) {
            return;
        }

        const newFormats = [...settings.numberingFormats];
        newFormats[level] = format;
        await this.setDocumentSettings(docId, { numberingFormats: newFormats });
    }

    /**
     * 获取默认字体设置
     * @returns 默认字体设置
     */
    getDefaultFontSettings(): IFontSettings {
        return {
            fontFamily: FONT_SETTINGS_CONSTANTS.DEFAULT_FONT_FAMILY,
            fontSize: FONT_SETTINGS_CONSTANTS.DEFAULT_FONT_SIZE,
            lineHeight: FONT_SETTINGS_CONSTANTS.DEFAULT_LINE_HEIGHT,
        };
    }

    /**
     * 获取默认文档设置
     * @returns 默认文档设置
     */
    getDefaultDocumentSettings(): IDocumentStylerDocumentSettings {
        return {
            headingNumberingEnabled: false,
            crossReferenceEnabled: false,
            customFontEnabled: false,
            showHeadingNumberInBlockAttr: true,
            numberingFormats: [...this.settings.numberingFormats],
            headingNumberStyles: [...this.settings.headingNumberStyles],
            figurePrefix: this.settings.figurePrefix,
            tablePrefix: this.settings.tablePrefix,
            fontSettings: this.getDefaultFontSettings(),
            imageStackEnabled: false,
            imageStackMode: 'compact',
            imageStackCollapsedHeight: '48px',
        };
    }

    /**
     * 获取文档的图表编号前缀
     * @param docId 文档ID
     * @returns 图表编号前缀
     */
    async getDocumentFigurePrefix(docId: string): Promise<string> {
        const settings = await this.getDocumentSettings(docId);
        return settings.figurePrefix;
    }

    /**
     * 设置文档的图表编号前缀
     * @param docId 文档ID
     * @param prefix 图表编号前缀
     */
    async setDocumentFigurePrefix(docId: string, prefix: string): Promise<void> {
        await this.setDocumentSettings(docId, { figurePrefix: prefix });
    }

    /**
     * 获取文档的表格编号前缀
     * @param docId 文档ID
     * @returns 表格编号前缀
     */
    async getDocumentTablePrefix(docId: string): Promise<string> {
        const settings = await this.getDocumentSettings(docId);
        return settings.tablePrefix;
    }

    /**
     * 设置文档的表格编号前缀
     * @param docId 文档ID
     * @param prefix 表格编号前缀
     */
    async setDocumentTablePrefix(docId: string, prefix: string): Promise<void> {
        await this.setDocumentSettings(docId, { tablePrefix: prefix });
    }

    /**
     * 获取文档的字体设置
     * @param docId 文档ID
     * @returns 字体设置
     */
    async getDocumentFontSettings(docId: string): Promise<IFontSettings> {
        const settings = await this.getDocumentSettings(docId);
        return settings.fontSettings;
    }

    /**
     * 设置文档的字体设置
     * @param docId 文档ID
     * @param fontSettings 字体设置
     */
    async setDocumentFontSettings(docId: string, fontSettings: Partial<IFontSettings>): Promise<void> {
        const currentSettings = await this.getDocumentSettings(docId);
        const newFontSettings = { ...currentSettings.fontSettings, ...fontSettings };
        await this.setDocumentSettings(docId, { fontSettings: newFontSettings });
    }

    /**
     * 获取文档的字体族
     * @param docId 文档ID
     * @returns 字体族
     */
    async getDocumentFontFamily(docId: string): Promise<string> {
        const fontSettings = await this.getDocumentFontSettings(docId);
        return fontSettings.fontFamily;
    }

    /**
     * 设置文档的字体族
     * @param docId 文档ID
     * @param fontFamily 字体族
     */
    async setDocumentFontFamily(docId: string, fontFamily: string): Promise<void> {
        await this.setDocumentFontSettings(docId, { fontFamily });
    }

    /**
     * 获取文档的字体大小
     * @param docId 文档ID
     * @returns 字体大小
     */
    async getDocumentFontSize(docId: string): Promise<string> {
        const fontSettings = await this.getDocumentFontSettings(docId);
        return fontSettings.fontSize;
    }

    /**
     * 设置文档的字体大小
     * @param docId 文档ID
     * @param fontSize 字体大小
     */
    async setDocumentFontSize(docId: string, fontSize: string): Promise<void> {
        await this.setDocumentFontSettings(docId, { fontSize });
    }

    /**
     * 重置文档的字体设置为默认值
     * @param docId 文档ID
     */
    async resetDocumentFontSettings(docId: string): Promise<void> {
        const defaultFontSettings = this.getDefaultFontSettings();
        await this.setDocumentFontSettings(docId, defaultFontSettings);
    }

    /**
     * 验证并修复文档设置
     * @param settings 要验证的设置
     * @returns 修复后的设置
     */
    private validateAndFixDocumentSettings(settings: any): IDocumentStylerDocumentSettings {
        const defaultSettings = this.getDefaultDocumentSettings();

        if (!settings || typeof settings !== 'object') {
            return defaultSettings;
        }

        const fixed = { ...defaultSettings };

        // 验证并修复各个属性
        if (typeof settings.headingNumberingEnabled === 'boolean') {
            fixed.headingNumberingEnabled = settings.headingNumberingEnabled;
        }

        if (typeof settings.crossReferenceEnabled === 'boolean') {
            fixed.crossReferenceEnabled = settings.crossReferenceEnabled;
        }

        if (typeof settings.customFontEnabled === 'boolean') {
            fixed.customFontEnabled = settings.customFontEnabled;
        }

        if (typeof settings.showHeadingNumberInBlockAttr === 'boolean') {
            fixed.showHeadingNumberInBlockAttr = settings.showHeadingNumberInBlockAttr;
        }

        if (Array.isArray(settings.numberingFormats) && settings.numberingFormats.length === 6) {
            fixed.numberingFormats = [...settings.numberingFormats];
        }

        if (Array.isArray(settings.headingNumberStyles) && settings.headingNumberStyles.length === 6) {
            fixed.headingNumberStyles = [...settings.headingNumberStyles];
        }

        // 验证并修复图表编号前缀
        if (typeof settings.figurePrefix === 'string') {
            fixed.figurePrefix = settings.figurePrefix;
        }

        if (typeof settings.tablePrefix === 'string') {
            fixed.tablePrefix = settings.tablePrefix;
        }

        // 验证并修复字体设置
        if (settings.fontSettings && typeof settings.fontSettings === 'object') {
            const fontSettings = settings.fontSettings;
            const defaultFontSettings = this.getDefaultFontSettings();

            fixed.fontSettings = {
                fontFamily: typeof fontSettings.fontFamily === 'string' ? fontSettings.fontFamily : defaultFontSettings.fontFamily,
                fontSize: typeof fontSettings.fontSize === 'string' ? fontSettings.fontSize : defaultFontSettings.fontSize,
                lineHeight: typeof fontSettings.lineHeight === 'string' ? fontSettings.lineHeight : defaultFontSettings.lineHeight,
            };
        }

        // 新增：图片堆叠设置
        if (typeof settings.imageStackEnabled === 'boolean') {
            (fixed as any).imageStackEnabled = settings.imageStackEnabled;
        }
        if (settings.imageStackMode === 'hide' || settings.imageStackMode === 'compact') {
            (fixed as any).imageStackMode = settings.imageStackMode;
        }
        if (typeof settings.imageStackCollapsedHeight === 'string') {
            (fixed as any).imageStackCollapsedHeight = settings.imageStackCollapsedHeight;
        }

        return fixed;
    }

    /**
     * 获取默认配置
     * @returns 默认配置
     */
    static getDefaultSettings(): IDocumentStylerSettings {
        return Object.assign({}, DEFAULT_SETTINGS);
    }

    /**
     * 验证设置的有效性
     * @param settings 要验证的设置
     * @returns 是否有效
     */
    static validateSettings(settings: any): settings is IDocumentStylerSettings {
        if (!settings || typeof settings !== 'object') {
            return false;
        }

        // 检查必需的属性
        const requiredProps = [
            'headingNumbering',
            'crossReference',
            'numberingFormats',
            'headingNumberStyles',
        ];

        for (const prop of requiredProps) {
            if (!(prop in settings)) {
                return false;
            }
        }

        // 检查数组长度
        if (!Array.isArray(settings.numberingFormats) || settings.numberingFormats.length !== 6) {
            return false;
        }

        if (!Array.isArray(settings.headingNumberStyles) || settings.headingNumberStyles.length !== 6) {
            return false;
        }

        return true;
    }

    /**
     * 修复无效的设置
     * @param settings 要修复的设置
     * @returns 修复后的设置
     */
    static fixSettings(settings: any): IDocumentStylerSettings {
        const fixed = Object.assign({}, DEFAULT_SETTINGS);

        if (settings && typeof settings === 'object') {
            // 复制有效的属性
            if (typeof settings.headingNumbering === 'boolean') {
                fixed.headingNumbering = settings.headingNumbering;
            }
            if (typeof settings.crossReference === 'boolean') {
                fixed.crossReference = settings.crossReference;
            }
            if (Array.isArray(settings.numberingFormats) && settings.numberingFormats.length === 6) {
                fixed.numberingFormats = [...settings.numberingFormats];
            }
            if (Array.isArray(settings.headingNumberStyles) && settings.headingNumberStyles.length === 6) {
                fixed.headingNumberStyles = [...settings.headingNumberStyles];
            }
        }

        return fixed;
    }

    /**
     * 获取内测功能设置
     */
    getBetaFeatureSettings(): IBetaFeatureSettings {
        return this.settings.betaFeatures || {
            isVerified: false,
            verifiedCodes: [],
            verifiedAt: undefined
        };
    }

    /**
     * 更新内测功能设置
     */
    async updateBetaFeatureSettings(betaSettings: Partial<IBetaFeatureSettings>): Promise<void> {
        const currentBetaSettings = this.getBetaFeatureSettings();
        const updatedBetaSettings = Object.assign({}, currentBetaSettings, betaSettings);
        
        await this.updateSettings({
            betaFeatures: updatedBetaSettings
        });
    }

    /**
     * 检查是否已通过内测验证
     */
    isBetaVerified(): boolean {
        return this.getBetaFeatureSettings().isVerified;
    }

    /**
     * 添加验证过的内测码
     */
    async addVerifiedBetaCode(code: string): Promise<void> {
        const betaSettings = this.getBetaFeatureSettings();
        if (!betaSettings.verifiedCodes.includes(code)) {
            await this.updateBetaFeatureSettings({
                verifiedCodes: [...betaSettings.verifiedCodes, code],
                isVerified: true,
                verifiedAt: Date.now()
            });
        }
    }
}
