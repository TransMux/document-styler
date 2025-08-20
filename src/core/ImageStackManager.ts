import { SettingsManager } from "./SettingsManager";
import { DocumentManager } from "./DocumentManager";
import { StyleManager } from "../ui/StyleManager";

/**
 * 连续图片堆叠与滚轮切换
 * 规则：当检测到两个及以上连续“纯图片段落块”（块内只含图片）时，将其视为一个组；
 * - 根据模式隐藏/收起非激活图片
 * - 在图片上滚轮切换显示目标图片
 */
export class ImageStackManager {
    private settingsManager: SettingsManager;
    private documentManager: DocumentManager;
    private styleManager: StyleManager;
    private groupStates: Map<string, { ids: string[]; activeIndex: number; mode: 'hide' | 'compact'; height: string } > = new Map();
    private wheelHandlers: Map<string, (e: WheelEvent) => void> = new Map();

    constructor(settingsManager: SettingsManager, documentManager: DocumentManager, styleManager: StyleManager) {
        this.settingsManager = settingsManager;
        this.documentManager = documentManager;
        this.styleManager = styleManager;
    }

    async init(): Promise<void> {}
    destroy(): void {}

    /**
     * 在当前文档应用图片堆叠
     */
    async applyForCurrentDocument(): Promise<void> {
        const docId = this.documentManager.getCurrentDocId();
        const protyle = this.documentManager.getCurrentProtyle();
        if (!docId || !protyle) return;

        const docSettings = await this.settingsManager.getDocumentSettings(docId);
        if (!docSettings.imageStackEnabled) {
            this.cleanup(protyle);
            return;
        }

        const mode = docSettings.imageStackMode === 'hide' ? 'hide' : 'compact';
        const collapsedHeight = docSettings.imageStackCollapsedHeight || '48px';
        this.buildGroups(protyle, mode, collapsedHeight);
    }

    /**
     * 检测并标记连续图片块组
     */
    private buildGroups(protyle: any, mode: 'hide' | 'compact', collapsedHeight: string): void {
        const container = protyle?.wysiwyg?.element as HTMLElement | undefined;
        if (!container) return;

        // 清理旧标记
        this.cleanup(protyle);

        const blocks = Array.from(container.querySelectorAll('.protyle-wysiwyg [data-node-id]')) as HTMLElement[];

        const imageOnly = (block: HTMLElement): boolean => {
            const editable = block.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (!editable) return false;
            // 克隆后检查是否只包含图片span
            const clone = editable.cloneNode(true) as HTMLElement;
            const imgs = clone.querySelectorAll('span[data-type="img"] img');
            // 去掉零宽空格和空白
            const text = (clone.textContent || '').replace(/\u200b/g, '').trim();
            return imgs.length > 0 && text === '';
        };

        let i = 0;
        while (i < blocks.length) {
            if (!imageOnly(blocks[i])) { i++; continue; }
            let j = i;
            while (j + 1 < blocks.length && imageOnly(blocks[j + 1])) j++;
            const length = j - i + 1;
            if (length >= 2) {
                const groupBlocks = blocks.slice(i, j + 1);
                this.applyGroup(protyle, groupBlocks, mode, collapsedHeight);
            }
            i = j + 1;
        }
    }

    private applyGroup(protyle: any, groupBlocks: HTMLElement[], mode: 'hide' | 'compact', collapsedHeight: string): void {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;
        const groupIds = groupBlocks.map(b => b.getAttribute('data-node-id')!).filter(Boolean);
        if (groupIds.length < 2) return;
        const groupKey = groupIds[0];
        this.groupStates.set(groupKey, { ids: groupIds, activeIndex: 0, mode, height: collapsedHeight });
        // 初始样式：显示第一个，隐藏/收起其它，并显示指示
        this.styleManager.setImageStackVisibility(docId, groupKey, mode, collapsedHeight, groupIds[0], groupIds, 0);

        // 绑定滚轮事件到每个块
        for (const block of groupBlocks) {
            const editable = block.querySelector('[contenteditable="true"]') as HTMLElement | null;
            const blockId = block.getAttribute('data-node-id') || '';
            if (!editable || !blockId) continue;
            // 清理旧 handler
            const old = this.wheelHandlers.get(blockId);
            if (old) editable.removeEventListener('wheel', old as any);
            const handler = (e: WheelEvent) => {
                const delta = e.deltaY;
                if (Math.abs(delta) < 1) return;
                e.preventDefault();
                const dir = delta > 0 ? 1 : -1;
                this.switchInGroup(docId, groupKey, dir);
            };
            this.wheelHandlers.set(blockId, handler);
            editable.addEventListener('wheel', handler, { passive: false });
        }
    }

    private switchInGroup(docId: string, groupKey: string, dir: number): void {
        const state = this.groupStates.get(groupKey);
        if (!state) return;
        const { ids, mode, height } = state;
        let nextIndex = state.activeIndex + dir;
        if (nextIndex < 0 || nextIndex >= ids.length) {
            // 边界：不循环
            nextIndex = Math.max(0, Math.min(ids.length - 1, nextIndex));
            if (nextIndex === state.activeIndex) return; // 无变化直接返回
        }
        state.activeIndex = nextIndex;
        this.groupStates.set(groupKey, state);
        const activeId = ids[nextIndex];
        this.styleManager.setImageStackVisibility(docId, groupKey, mode, height, activeId, ids, nextIndex);
        // 滚动激活块到可视
        const protyle = this.documentManager.getCurrentProtyle();
        const container = protyle?.wysiwyg?.element as HTMLElement | undefined;
        const blockEl = container?.querySelector(`[data-node-id="${activeId}"]`) as HTMLElement | null;
        blockEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    private cleanup(protyle: any): void {
        const container = protyle?.wysiwyg?.element as HTMLElement | undefined;
        if (!container) return;
        const docId = this.documentManager.getCurrentDocId();
        // 移除样式
        for (const key of this.groupStates.keys()) {
            if (docId) this.styleManager.clearImageStackVisibility(docId, key);
        }
        this.groupStates.clear();
        // 移除事件
        for (const [blockId, handler] of this.wheelHandlers) {
            const block = container.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`) as HTMLElement | null;
            if (block) block.removeEventListener('wheel', handler as any);
        }
        this.wheelHandlers.clear();
    }
}


