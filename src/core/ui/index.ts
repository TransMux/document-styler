/**
 * UI交互层模块导出
 * 统一导出所有UI交互组件
 */

export { UIManager, type IUIManagerConfig, type IUIState } from './UIManager';
export { PanelRenderer, type IPanelRendererConfig } from './PanelRenderer';
export { 
    InteractionHandler, 
    type FigureClickCallback, 
    type SettingToggleCallback, 
    type RefreshClickCallback 
} from './InteractionHandler';
