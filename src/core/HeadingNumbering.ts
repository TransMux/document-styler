/**
 * 标题自动编号系统
 * 基于 siyuan-auto-seq-number 插件的设计思路重新实现
 */

import { IHeadingNumbering, HeadingNumberStyle, IHeadingNumberMap } from "../types";
import { SettingsManager } from "./SettingsManager";
import { DocumentManager } from "./DocumentManager";
import { StyleManager } from "../ui/StyleManager";
import { getVersion, getDocumentOutline } from "../utils/apiUtils";
// import { NumberStyleConverter } from "../utils/numberStyleConverter";
import { parseOutlineToNumberMap } from "../utils/outlineUtils";

export class HeadingNumbering implements IHeadingNumbering {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private styleManager: StyleManager;
    private version: string = "";

    // 简化缓存机制
    private numberMapCache: Map<string, IHeadingNumberMap> = new Map();
    // 记录上次渲染时的标题 ID 集合，避免重复请求
    private lastHeadingIdsPerDoc: Map<string, Set<string>> = new Map();

    constructor(
        settingsManager: SettingsManager,
        documentManager: DocumentManager,
        styleManager: StyleManager
    ) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.styleManager = styleManager;
    }

    async init(): Promise<void> {
        this.version = await getVersion();
    }

    destroy(): void {
        // 清除样式
        this.styleManager.clearHeadingNumbering();
        // 清除缓存
        this.numberMapCache.clear();
    }

    async applyNumbering(protyle: any): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            // 先清除现有编号
            await this.clearNumbering(protyle);

            // 应用新编号
            await this.updateNumbering(protyle);
        } catch (error) {
            console.error('应用标题编号失败:', error);
            throw error;
        }
    }

    async clearNumbering(protyle: any): Promise<void> {
        try {
            // 使用CSS方式清除编号，只需要清除样式即可
            this.styleManager.clearHeadingNumbering();
        } catch (error) {
            console.error('清除标题编号失败:', error);
            throw error;
        }
    }

    async updateNumbering(protyle: any): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;

        try {
            // 获取文档特定设置，而不是全局设置
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log('HeadingNumbering: 获取文档设置', docSettings);

            // 获取标题编号映射，只在必要时强制刷新
            const headingMap = await this.getHeadingNumberMap(
                docId,
                docSettings.numberingFormats,
                docSettings.headingNumberStyles,
                false // 使用缓存，提升性能
            );

            // 应用CSS样式
            this.styleManager.applyHeadingNumbering(headingMap);
            console.log('HeadingNumbering: 标题编号更新完成');
        } catch (error) {
            console.error('更新标题编号失败:', error);
            throw error;
        }
    }

    hasNumbering(protyle: any): boolean {
        try {
            // 检查样式管理器中是否有应用的编号样式
            return this.styleManager.isNumberingApplied();
        } catch (error) {
            console.error('检查标题编号失败:', error);
            return false;
        }
    }

    /**
     * 更新指定文档的标题编号
     * @param docId 文档ID
     */
    async updateNumberingForDoc(docId: string): Promise<void> {
        try {
            console.log(`DocumentStyler: 开始更新文档${docId}的标题编号`);

            // 获取文档设置
            const docSettings = await this.settingsManager.getDocumentSettings(docId);
            console.log('DocumentStyler: 文档设置', docSettings);

            // 获取标题编号映射，只在必要时强制刷新
            const headingMap = await this.getHeadingNumberMap(
                docId,
                docSettings.numberingFormats,
                docSettings.headingNumberStyles,
                false // 使用缓存，提升性能
            );
            console.log('DocumentStyler: 标题编号映射获取成功', headingMap);

            // 应用CSS样式
            this.styleManager.applyHeadingNumbering(headingMap);
            console.log('DocumentStyler: CSS样式应用完成');
        } catch (error) {
            console.error(`更新文档${docId}的标题编号失败:`, error);
            throw error;
        }
    }

    /**
     * 获取标题编号映射 - 简化版本，直接在这里实现
     * @param docId 文档ID
     * @param formats 编号格式配置
     * @param numberStyles 标题编号样式配置
     * @param forceRefresh 是否强制刷新
     * @returns 标题编号映射
     */
    private async getHeadingNumberMap(
        docId: string,
        formats: string[],
        numberStyles: HeadingNumberStyle[],
        forceRefresh: boolean = false
    ): Promise<IHeadingNumberMap> {
        const cacheKey = `${docId}_${JSON.stringify(formats)}_${JSON.stringify(numberStyles)}`;

        // 检查缓存
        if (!forceRefresh && this.numberMapCache.has(cacheKey)) {
            const cached = this.numberMapCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            // 获取大纲数据
            const outlineData = await getDocumentOutline(docId);

            // 解析生成编号映射
            const numberMap = parseOutlineToNumberMap(outlineData, formats, numberStyles);

            // 更新缓存
            this.numberMapCache.set(cacheKey, numberMap);
            // 记录最近一次渲染时的标题 ID
            this.lastHeadingIdsPerDoc.set(docId, new Set(Object.keys(numberMap)));

            return numberMap;
        } catch (error) {
            console.error('生成标题编号映射失败:', error);
            throw error;
        }
    }

    /**
     * 检查文档是否包含标题
     * @param docId 文档ID
     * @returns 是否包含标题
     */
    async hasHeadingsInDoc(docId: string): Promise<boolean> {
        try {
            const outlineData = await getDocumentOutline(docId);
            return outlineData && outlineData.length > 0;
        } catch (error) {
            console.error(`检查文档${docId}是否包含标题失败:`, error);
            return false;
        }
    }

    /**
     * 获取文档的标题统计信息
     * @param docId 文档ID
     * @returns 标题统计信息
     */
    async getHeadingStats(docId: string): Promise<{
        totalCount: number;
        levelCounts: Record<number, number>;
        maxLevel: number;
        minLevel: number;
    }> {
        try {
            const outlineData = await getDocumentOutline(docId);
            const stats = {
                totalCount: 0,
                levelCounts: {} as Record<number, number>,
                maxLevel: 0,
                minLevel: 6
            };

            if (outlineData && outlineData.length > 0) {
                outlineData.forEach((item: any) => {
                    const level = item.depth || 1;
                    stats.totalCount++;
                    stats.levelCounts[level] = (stats.levelCounts[level] || 0) + 1;
                    stats.maxLevel = Math.max(stats.maxLevel, level);
                    stats.minLevel = Math.min(stats.minLevel, level);
                });
            }

            return stats;
        } catch (error) {
            console.error(`获取文档${docId}的标题统计失败:`, error);
            return {
                totalCount: 0,
                levelCounts: {},
                maxLevel: 0,
                minLevel: 0
            };
        }
    }

    /**
     * 获取当前编号样式统计
     * @returns 样式统计信息
     */
    getNumberingStats(): { headingCount: number; figureCount: number } {
        return this.styleManager.getNumberingStats();
    }

    /**
     * 启用实时更新（保留接口兼容性）
     */
    enableRealTimeUpdate(): void {
        // 新架构中实时更新由EventHandler处理
    }

    /**
     * 禁用实时更新（保留接口兼容性）
     */
    disableRealTimeUpdate(): void {
        // 新架构中实时更新由EventHandler处理
    }

    /**
     * 清除指定文档的缓存
     * @param docId 文档ID
     */
    clearDocumentCache(docId: string): void {
        // 清除所有与该文档相关的缓存
        for (const key of this.numberMapCache.keys()) {
            if (key.startsWith(docId + '_')) {
                this.numberMapCache.delete(key);
            }
        }
    }

    /**
     * 处理 WebSocket transaction 消息
     * @param msg WebSocket 消息
     */
    async handleTransactionMessage(msg: any): Promise<void> {
        try {
            // 检查当前文档是否受影响
            if (!this.documentManager.isCurrentDocumentAffected(msg)) {
                return;
            }

            // 获取当前文档ID
            const currentDocId = this.documentManager.getCurrentDocId();
            if (!currentDocId) return;

            // 检查当前文档是否启用了标题编号
            const isEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(currentDocId);
            if (!isEnabled) return;

            // 分析是否需要更新标题编号
            if (this.needsHeadingUpdate(msg)) {
                // 清除缓存，确保获取最新数据
                this.clearDocumentCache(currentDocId);
                await this.updateNumberingForDoc(currentDocId);
            }
        } catch (error) {
            console.error('HeadingNumbering: 处理 transaction 消息失败:', error);
        }
    }

    /**
     * 检查消息是否需要更新标题编号
     * @param msg WebSocket 消息
     * @returns 是否需要更新
     */
    private needsHeadingUpdate(msg: any): boolean {
        if (!msg.data || !Array.isArray(msg.data)) {
            return false;
        }

        // 检查是否包含标题相关的操作
        return msg.data.some((transaction: any) => {
            if (!transaction.doOperations || !Array.isArray(transaction.doOperations)) {
                return false;
            }

            return transaction.doOperations.some((operation: any) => {
                // 检查操作数据中是否包含标题节点
                if (operation.data && typeof operation.data === 'string') {
                    return operation.data.includes('data-type="NodeHeading"');
                }
                return false;
            });
        });
    }

    /**
     * 处理 WebSocket savedoc 消息
     * 支持两种情况：
     * 1) 拖拽导致的内容更新（action: "move"，判断 id 是否为已知标题 id）
     * 2) 标题转换为段落块（action: "update"，判断是否包含标题更新）
     */
    async handleSaveDocMessage(msg: any): Promise<void> {
        try {
            const rootId = msg?.data?.rootID;
            const sources = msg?.data?.sources;
            if (!rootId || !Array.isArray(sources) || sources.length === 0) return;

            // 仅处理当前文档
            const currentDocId = this.documentManager.getCurrentDocId();
            if (!currentDocId || currentDocId !== rootId) return;

            // 检查当前文档是否启用了标题编号
            const isEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(currentDocId);
            if (!isEnabled) return;

            const ops = sources[0];
            const doOps: any[] = Array.isArray(ops?.doOperations) ? ops.doOperations : [];
            const undoOps: any[] = Array.isArray(ops?.undoOperations) ? ops.undoOperations : [];

            let needUpdate = false;

            // 1) 检测 move：如果移动的 id 是已知的标题 id，则需要更新
            const knownHeadingIds = this.getKnownHeadingIdsFromCache(currentDocId);
            for (const op of doOps) {
                if (op?.action === 'move' && op?.id && knownHeadingIds.has(op.id)) {
                    needUpdate = true;
                    break;
                }
            }

            // 2) 检测 update：是否包含标题相关更新（标题变段落或段落变标题等都会影响编号）
            if (!needUpdate) {
                const containsHeadingChange = (operation: any) => {
                    const data = operation?.data;
                    if (typeof data !== 'string') return false;
                    // 只要出现/消失 NodeHeading 都会影响
                    return data.indexOf('data-type="NodeHeading"') > -1;
                };
                needUpdate = doOps.some(op => op?.action === 'update' && containsHeadingChange(op));
                if (!needUpdate && undoOps.length > 0) {
                    needUpdate = undoOps.some(op => op?.action === 'update' && containsHeadingChange(op));
                }
            }

            if (needUpdate) {
                this.clearDocumentCache(currentDocId);
                await this.updateNumberingForDoc(currentDocId);
            }
        } catch (error) {
            console.error('HeadingNumbering: 处理 savedoc 消息失败:', error);
        }
    }

    private getKnownHeadingIdsFromCache(docId: string): Set<string> {
        // 优先使用上次渲染记录
        const recorded = this.lastHeadingIdsPerDoc.get(docId);
        if (recorded && recorded.size > 0) return recorded;

        // 回退：从编号映射缓存中提取（不触发任何新的请求）
        for (const [key, map] of this.numberMapCache.entries()) {
            if (key.startsWith(docId + '_')) {
                const ids = new Set<string>(Object.keys(map));
                if (ids.size > 0) {
                    this.lastHeadingIdsPerDoc.set(docId, ids);
                    return ids;
                }
            }
        }
        return new Set<string>();
    }
}
