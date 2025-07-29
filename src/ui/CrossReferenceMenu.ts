/**
 * 交叉引用菜单组件
 * 用于显示图表选择菜单，允许用户选择要引用的图表
 */

import { IFigureInfo } from '../types';
import { DocumentManager } from '../core/DocumentManager';
import { FigureManager } from '../core/business/FigureManager';

export class CrossReferenceMenu {
    private menuElement: HTMLElement | null = null;
    private documentManager: DocumentManager;
    private figureManager: FigureManager;
    private onSelectCallback: ((figure: IFigureInfo) => void) | null = null;

    constructor(documentManager: DocumentManager, figureManager: FigureManager) {
        this.documentManager = documentManager;
        this.figureManager = figureManager;
    }

    /**
     * 显示图表选择菜单
     * @param position 菜单位置
     * @param onSelect 选择回调函数
     */
    async show(position: { x: number; y: number }, onSelect: (figure: IFigureInfo) => void): Promise<void> {
        this.onSelectCallback = onSelect;
        
        // 获取当前文档ID
        const docId = this.documentManager.getCurrentDocId();
        if (!docId) {
            console.warn('CrossReferenceMenu: 无法获取当前文档ID');
            return;
        }

        // 获取图表数据
        const figures = await this.figureManager.getFiguresList(docId);
        
        // 创建菜单
        this.createMenu(figures, position);
    }

    /**
     * 创建菜单DOM
     * @param figures 图表数据
     * @param position 菜单位置
     */
    private createMenu(figures: IFigureInfo[], position: { x: number; y: number }): void {
        // 移除已存在的菜单
        this.hide();

        // 创建菜单容器
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'b3-menu b3-list b3-list--background';
        this.menuElement.style.position = 'fixed';
        this.menuElement.style.left = `${position.x}px`;
        this.menuElement.style.top = `${position.y}px`;
        this.menuElement.style.zIndex = '9999';
        this.menuElement.style.maxHeight = '300px';
        this.menuElement.style.overflowY = 'auto';
        this.menuElement.style.minWidth = '200px';

        if (figures.length === 0) {
            // 没有图表时显示提示
            this.menuElement.innerHTML = `
                <div class="b3-list-item b3-list-item--readonly">
                    <span class="b3-list-item__text">当前文档中没有图片或表格</span>
                </div>
            `;
        } else {
            // 生成图表列表
            const menuHTML = figures.map(figure => this.generateFigureItem(figure)).join('');
            this.menuElement.innerHTML = menuHTML;

            // 添加点击事件监听
            this.menuElement.addEventListener('click', this.handleMenuClick.bind(this));
        }

        // 添加到页面
        document.body.appendChild(this.menuElement);

        // 添加全局点击事件监听，点击菜单外部时关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.handleGlobalClick.bind(this), { once: true });
        }, 0);

        // 调整菜单位置，确保不超出屏幕边界
        this.adjustMenuPosition();
    }

    /**
     * 生成单个图表项的HTML
     * @param figure 图表信息
     * @returns HTML字符串
     */
    private generateFigureItem(figure: IFigureInfo): string {
        const typeText = figure.type === 'image' ? '图' : '表';
        const iconName = figure.type === 'image' ? 'iconImage' : 'iconTable';
        const displayText = `${typeText} ${figure.number}`;
        const captionText = figure.caption ? `: ${figure.caption}` : '';

        return `
            <div class="b3-list-item" data-figure-id="${figure.id}" data-figure-type="${figure.type}" data-figure-number="${figure.number}">
                <div class="b3-list-item__first">
                    <svg class="b3-list-item__graphic">
                        <use xlink:href="#${iconName}"></use>
                    </svg>
                    <span class="b3-list-item__text">${displayText}${captionText}</span>
                </div>
            </div>
        `;
    }

    /**
     * 处理菜单项点击事件
     * @param event 点击事件
     */
    private handleMenuClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const listItem = target.closest('.b3-list-item') as HTMLElement;
        
        if (listItem && listItem.dataset.figureId) {
            const figureId = listItem.dataset.figureId;
            const figureType = listItem.dataset.figureType as 'image' | 'table';
            const figureNumber = parseInt(listItem.dataset.figureNumber || '0');

            // 创建图表信息对象
            const figure: IFigureInfo = {
                id: figureId,
                type: figureType,
                number: figureNumber,
                content: '',
                caption: '',
                captionId: '',
                domOrder: 0
            };

            // 调用选择回调
            if (this.onSelectCallback) {
                this.onSelectCallback(figure);
            }

            // 关闭菜单
            this.hide();
        }
    }

    /**
     * 处理全局点击事件（点击菜单外部时关闭菜单）
     * @param event 点击事件
     */
    private handleGlobalClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (this.menuElement && !this.menuElement.contains(target)) {
            this.hide();
        }
    }

    /**
     * 调整菜单位置，确保不超出屏幕边界
     */
    private adjustMenuPosition(): void {
        if (!this.menuElement) return;

        const rect = this.menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 调整水平位置
        if (rect.right > viewportWidth) {
            const newLeft = viewportWidth - rect.width - 10;
            this.menuElement.style.left = `${Math.max(10, newLeft)}px`;
        }

        // 调整垂直位置
        if (rect.bottom > viewportHeight) {
            const newTop = viewportHeight - rect.height - 10;
            this.menuElement.style.top = `${Math.max(10, newTop)}px`;
        }
    }

    /**
     * 隐藏菜单
     */
    hide(): void {
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
        this.onSelectCallback = null;
    }

    /**
     * 销毁菜单组件
     */
    destroy(): void {
        this.hide();
    }
}
