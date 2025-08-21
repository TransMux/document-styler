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
    private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();
    private touchStartHandlers: Map<string, (e: TouchEvent) => void> = new Map();
    private touchMoveHandlers: Map<string, (e: TouchEvent) => void> = new Map();
    private touchEndHandlers: Map<string, (e: TouchEvent) => void> = new Map();
    private touchState: Map<string, { startX: number; startY: number; moved: boolean }> = new Map();
    private groupCooldowns: Map<string, number> = new Map();

    private readonly PROGRESS_STORAGE_KEY = 'document-styler-imgstack-progress';
    private readonly SWITCH_COOLDOWN_MS = 260;

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

    private applyGroup(_protyle: any, groupBlocks: HTMLElement[], mode: 'hide' | 'compact', collapsedHeight: string): void {
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) return;
        const groupIds = groupBlocks.map(b => b.getAttribute('data-node-id')!).filter(Boolean);
        if (groupIds.length < 2) return;
        const groupKey = groupIds[0];
        const savedIndex = this.getSavedProgress(docId, groupKey);
        const initialIndex = Math.max(0, Math.min(groupIds.length - 1, savedIndex ?? 0));
        this.groupStates.set(groupKey, { ids: groupIds, activeIndex: initialIndex, mode, height: collapsedHeight });
        // 初始样式：显示激活项，隐藏/收起其它，并显示指示
        this.styleManager.setImageStackVisibility(docId, groupKey, mode, collapsedHeight, groupIds[initialIndex], groupIds, initialIndex);

        // 绑定滚轮事件到每个块
        for (const block of groupBlocks) {
            const editable = block.querySelector('[contenteditable="true"]') as HTMLElement | null;
            const blockId = block.getAttribute('data-node-id') || '';
            if (!editable || !blockId) continue;
            // 清理旧 handler
            const old = this.wheelHandlers.get(blockId);
            if (old) editable.removeEventListener('wheel', old as any);
            const handler = (e: WheelEvent) => {
                // 节流，避免一次滚动步进多张
                const now = Date.now();
                const last = this.groupCooldowns.get(groupKey) || 0;
                if (now - last < this.SWITCH_COOLDOWN_MS) {
                    e.preventDefault();
                    return;
                }

                // 根据水平/垂直方向决定切换
                const absX = Math.abs(e.deltaX || 0);
                const absY = Math.abs(e.deltaY || 0);
                let dir = 0;
                if (absX > absY) {
                    dir = e.deltaX > 0 ? 1 : -1;
                } else {
                    dir = e.deltaY > 0 ? 1 : -1;
                }
                if (dir === 0) return;

                e.preventDefault();
                this.groupCooldowns.set(groupKey, now);
                this.switchInGroup(docId, groupKey, dir);
            };
            this.wheelHandlers.set(blockId, handler);
            editable.addEventListener('wheel', handler, { passive: false });

            // 键盘左右箭头切换
            const oldKey = this.keyHandlers.get(blockId);
            if (oldKey) editable.removeEventListener('keydown', oldKey as any);
            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const now = Date.now();
                    const last = this.groupCooldowns.get(groupKey) || 0;
                    if (now - last < this.SWITCH_COOLDOWN_MS) return;
                    e.preventDefault();
                    const dir = e.key === 'ArrowRight' ? 1 : -1;
                    this.groupCooldowns.set(groupKey, now);
                    this.switchInGroup(docId, groupKey, dir);
                }
            };
            this.keyHandlers.set(blockId, keyHandler);
            editable.addEventListener('keydown', keyHandler);

            // 触摸滑动切换（移动端/触摸板）
            const onTouchStart = (e: TouchEvent) => {
                if (!e.touches || e.touches.length === 0) return;
                this.touchState.set(blockId, { startX: e.touches[0].clientX, startY: e.touches[0].clientY, moved: false });
            };
            // 移除未使用的 onTouchMove，统一用 onTouchMoveRecord 处理
            const onTouchEnd = (_e: TouchEvent) => {
                const state = this.touchState.get(blockId);
                if (!state) return;
                const now = Date.now();
                const last = this.groupCooldowns.get(groupKey) || 0;
                if (now - last < this.SWITCH_COOLDOWN_MS) {
                    this.touchState.delete(blockId);
                    return;
                }
                const dx = (state ? (state as any).lastDx : 0) || 0;
                // 简单阈值判断
                const threshold = 30;
                if (Math.abs(dx) >= threshold) {
                    const dir = dx > 0 ? -1 : 1; // 右滑查看上一张，左滑查看下一张
                    this.groupCooldowns.set(groupKey, now);
                    this.switchInGroup(docId, groupKey, dir);
                }
                this.touchState.delete(blockId);
            };
            // 我们需要在 move 时记录最后 dx
            const onTouchMoveRecord = (e: TouchEvent) => {
                const state = this.touchState.get(blockId);
                if (!state || !e.touches || e.touches.length === 0) return;
                const dx = e.touches[0].clientX - state.startX;
                (state as any).lastDx = dx;
                const dy = e.touches[0].clientY - state.startY;
                if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
            };

            // 清理老的触摸事件
            const oldTs = this.touchStartHandlers.get(blockId);
            const oldTm = this.touchMoveHandlers.get(blockId);
            const oldTe = this.touchEndHandlers.get(blockId);
            if (oldTs) editable.removeEventListener('touchstart', oldTs as any);
            if (oldTm) editable.removeEventListener('touchmove', oldTm as any);
            if (oldTe) editable.removeEventListener('touchend', oldTe as any);

            this.touchStartHandlers.set(blockId, onTouchStart);
            this.touchMoveHandlers.set(blockId, onTouchMoveRecord);
            this.touchEndHandlers.set(blockId, onTouchEnd);
            editable.addEventListener('touchstart', onTouchStart, { passive: true });
            editable.addEventListener('touchmove', onTouchMoveRecord, { passive: false });
            editable.addEventListener('touchend', onTouchEnd, { passive: true });
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
        this.saveProgress(docId, groupKey, nextIndex);
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
        for (const [blockId, handler] of this.keyHandlers) {
            const block = container.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`) as HTMLElement | null;
            if (block) block.removeEventListener('keydown', handler as any);
        }
        this.keyHandlers.clear();
        for (const [blockId, handler] of this.touchStartHandlers) {
            const block = container.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`) as HTMLElement | null;
            if (block) block.removeEventListener('touchstart', handler as any);
        }
        for (const [blockId, handler] of this.touchMoveHandlers) {
            const block = container.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`) as HTMLElement | null;
            if (block) block.removeEventListener('touchmove', handler as any);
        }
        for (const [blockId, handler] of this.touchEndHandlers) {
            const block = container.querySelector(`[data-node-id="${blockId}"] [contenteditable="true"]`) as HTMLElement | null;
            if (block) block.removeEventListener('touchend', handler as any);
        }
        this.touchStartHandlers.clear();
        this.touchMoveHandlers.clear();
        this.touchEndHandlers.clear();
        this.touchState.clear();
        this.groupCooldowns.clear();
    }

    // ================= 持久化进度 =================
    private getSavedProgress(docId: string, groupKey: string): number | null {
        try {
            const raw = localStorage.getItem(this.PROGRESS_STORAGE_KEY);
            if (!raw) return null;
            const map = JSON.parse(raw) as Record<string, Record<string, number>>;
            const docMap = map[docId];
            if (!docMap) return null;
            const v = docMap[groupKey];
            return typeof v === 'number' ? v : null;
        } catch {
            return null;
        }
    }

    private saveProgress(docId: string, groupKey: string, index: number): void {
        try {
            const raw = localStorage.getItem(this.PROGRESS_STORAGE_KEY);
            const map: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {};
            if (!map[docId]) map[docId] = {};
            map[docId][groupKey] = index;
            localStorage.setItem(this.PROGRESS_STORAGE_KEY, JSON.stringify(map));
        } catch {
            // ignore
        }
    }
}


