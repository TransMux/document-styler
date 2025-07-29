/**
 * 交互处理器 - 负责用户交互事件的处理
 * 统一处理点击、切换等用户操作
 */

export type FigureClickCallback = (figureId: string, figureType: string) => void;
export type SettingToggleCallback = (setting: string, enabled: boolean) => void;
export type RefreshClickCallback = () => void;

export class InteractionHandler {
    private figureClickCallbacks: FigureClickCallback[] = [];
    private settingToggleCallbacks: SettingToggleCallback[] = [];
    private refreshClickCallbacks: RefreshClickCallback[] = [];
    private isInitialized = false;
    private interactionCount = 0;

    /**
     * 初始化交互处理器
     */
    async init(): Promise<void> {
        if (this.isInitialized) {
            console.warn('InteractionHandler: 已经初始化，跳过重复初始化');
            return;
        }

        this.isInitialized = true;
        console.log('InteractionHandler: 初始化完成');
    }

    /**
     * 注册图表点击回调
     * @param callback 回调函数
     * @returns 取消注册函数
     */
    onFigureClick(callback: FigureClickCallback): () => void {
        this.figureClickCallbacks.push(callback);
        
        return () => {
            const index = this.figureClickCallbacks.indexOf(callback);
            if (index !== -1) {
                this.figureClickCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * 注册设置切换回调
     * @param callback 回调函数
     * @returns 取消注册函数
     */
    onSettingToggle(callback: SettingToggleCallback): () => void {
        this.settingToggleCallbacks.push(callback);
        
        return () => {
            const index = this.settingToggleCallbacks.indexOf(callback);
            if (index !== -1) {
                this.settingToggleCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * 注册刷新点击回调
     * @param callback 回调函数
     * @returns 取消注册函数
     */
    onRefreshClick(callback: RefreshClickCallback): () => void {
        this.refreshClickCallbacks.push(callback);
        
        return () => {
            const index = this.refreshClickCallbacks.indexOf(callback);
            if (index !== -1) {
                this.refreshClickCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * 触发图表点击事件
     * @param figureId 图表ID
     * @param figureType 图表类型
     */
    triggerFigureClick(figureId: string, figureType: string): void {
        if (!this.isInitialized) {
            return;
        }

        this.interactionCount++;
        
        for (const callback of this.figureClickCallbacks) {
            try {
                callback(figureId, figureType);
            } catch (error) {
                console.error('InteractionHandler: 图表点击回调执行失败:', error);
            }
        }

        console.log(`InteractionHandler: 触发图表点击 ${figureType} ${figureId}`);
    }

    /**
     * 触发设置切换事件
     * @param setting 设置名称
     * @param enabled 是否启用
     */
    triggerSettingToggle(setting: string, enabled: boolean): void {
        if (!this.isInitialized) {
            return;
        }

        this.interactionCount++;
        
        for (const callback of this.settingToggleCallbacks) {
            try {
                callback(setting, enabled);
            } catch (error) {
                console.error('InteractionHandler: 设置切换回调执行失败:', error);
            }
        }

        console.log(`InteractionHandler: 触发设置切换 ${setting} = ${enabled}`);
    }

    /**
     * 触发刷新点击事件
     */
    triggerRefreshClick(): void {
        if (!this.isInitialized) {
            return;
        }

        this.interactionCount++;
        
        for (const callback of this.refreshClickCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('InteractionHandler: 刷新点击回调执行失败:', error);
            }
        }

        console.log('InteractionHandler: 触发刷新点击');
    }

    /**
     * 处理键盘快捷键
     * @param event 键盘事件
     */
    handleKeyboardShortcut(event: KeyboardEvent): void {
        if (!this.isInitialized) {
            return;
        }

        // Ctrl/Cmd + R: 刷新
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.triggerRefreshClick();
            return;
        }

        // Ctrl/Cmd + Shift + F: 切换交叉引用
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
            event.preventDefault();
            // 获取当前设置状态并切换
            const currentState = this.getCurrentCrossRefState();
            this.triggerSettingToggle('cross-ref', !currentState);
            return;
        }
    }

    /**
     * 获取当前交叉引用状态
     * @returns 当前状态
     */
    private getCurrentCrossRefState(): boolean {
        const toggle = document.querySelector('#cross-ref-toggle') as HTMLInputElement;
        return toggle ? toggle.checked : false;
    }

    /**
     * 处理鼠标悬停事件
     * @param figureId 图表ID
     * @param isHovering 是否悬停
     */
    handleFigureHover(figureId: string, isHovering: boolean): void {
        if (!this.isInitialized) {
            return;
        }

        try {
            // 查找目标图表元素
            const targetElement = document.querySelector(`[data-node-id="${figureId}"]`);
            if (targetElement) {
                if (isHovering) {
                    targetElement.classList.add('document-styler-hover');
                } else {
                    targetElement.classList.remove('document-styler-hover');
                }
            }

        } catch (error) {
            console.error('InteractionHandler: 处理图表悬停失败:', error);
        }
    }

    /**
     * 处理右键菜单
     * @param figureId 图表ID
     * @param figureType 图表类型
     * @param event 鼠标事件
     */
    handleContextMenu(figureId: string, figureType: string, event: MouseEvent): void {
        if (!this.isInitialized) {
            return;
        }

        event.preventDefault();
        
        // 创建上下文菜单
        const menu = this.createContextMenu(figureId, figureType);
        
        // 显示菜单
        this.showContextMenu(menu, event.clientX, event.clientY);
    }

    /**
     * 创建上下文菜单
     * @param figureId 图表ID
     * @param figureType 图表类型
     * @returns 菜单元素
     */
    private createContextMenu(figureId: string, figureType: string): HTMLElement {
        const menu = document.createElement('div');
        menu.className = 'b3-menu document-styler-context-menu';
        
        menu.innerHTML = `
            <div class="b3-menu__item" data-action="goto">
                <svg class="b3-menu__icon"><use xlink:href="#iconGoto"></use></svg>
                <span class="b3-menu__label">跳转到${figureType === 'image' ? '图片' : '表格'}</span>
            </div>
            <div class="b3-menu__item" data-action="copy-id">
                <svg class="b3-menu__icon"><use xlink:href="#iconCopy"></use></svg>
                <span class="b3-menu__label">复制ID</span>
            </div>
            <div class="b3-menu__separator"></div>
            <div class="b3-menu__item" data-action="refresh">
                <svg class="b3-menu__icon"><use xlink:href="#iconRefresh"></use></svg>
                <span class="b3-menu__label">刷新列表</span>
            </div>
        `;

        // 绑定菜单项点击事件
        menu.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const menuItem = target.closest('.b3-menu__item') as HTMLElement;
            if (!menuItem) return;

            const action = menuItem.getAttribute('data-action');
            this.handleContextMenuAction(action, figureId, figureType);
            
            // 移除菜单
            menu.remove();
        });

        return menu;
    }

    /**
     * 显示上下文菜单
     * @param menu 菜单元素
     * @param x X坐标
     * @param y Y坐标
     */
    private showContextMenu(menu: HTMLElement, x: number, y: number): void {
        document.body.appendChild(menu);
        
        // 设置位置
        menu.style.position = 'fixed';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.zIndex = '9999';

        // 点击其他地方时关闭菜单
        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    /**
     * 处理上下文菜单动作
     * @param action 动作类型
     * @param figureId 图表ID
     * @param figureType 图表类型
     */
    private handleContextMenuAction(action: string | null, figureId: string, figureType: string): void {
        switch (action) {
            case 'goto':
                this.triggerFigureClick(figureId, figureType);
                break;
                
            case 'copy-id':
                this.copyToClipboard(figureId);
                break;
                
            case 'refresh':
                this.triggerRefreshClick();
                break;
        }
    }

    /**
     * 复制文本到剪贴板
     * @param text 要复制的文本
     */
    private async copyToClipboard(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            console.log(`InteractionHandler: 已复制到剪贴板: ${text}`);
        } catch (error) {
            console.error('InteractionHandler: 复制到剪贴板失败:', error);
        }
    }

    /**
     * 获取统计信息
     * @returns 统计信息
     */
    getStats(): {
        isInitialized: boolean;
        interactionCount: number;
        callbackCounts: {
            figureClick: number;
            settingToggle: number;
            refreshClick: number;
        };
    } {
        return {
            isInitialized: this.isInitialized,
            interactionCount: this.interactionCount,
            callbackCounts: {
                figureClick: this.figureClickCallbacks.length,
                settingToggle: this.settingToggleCallbacks.length,
                refreshClick: this.refreshClickCallbacks.length
            }
        };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.interactionCount = 0;
        console.log('InteractionHandler: 统计信息已重置');
    }

    /**
     * 销毁交互处理器
     */
    async destroy(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            // 清除所有回调
            this.figureClickCallbacks.length = 0;
            this.settingToggleCallbacks.length = 0;
            this.refreshClickCallbacks.length = 0;

            // 移除可能存在的上下文菜单
            const contextMenus = document.querySelectorAll('.document-styler-context-menu');
            contextMenus.forEach(menu => menu.remove());

            this.isInitialized = false;
            this.resetStats();

            console.log('InteractionHandler: 销毁完成');

        } catch (error) {
            console.error('InteractionHandler: 销毁失败:', error);
            throw error;
        }
    }
}
