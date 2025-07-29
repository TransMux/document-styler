/**
 * 状态管理层模块导出
 * 统一导出所有状态管理组件
 */

export { FigureState, type IFigureState, type IStateUpdateOptions } from './FigureState';
export { StateCache } from './StateCache';
export { StateValidator, type IStateValidationResult } from './StateValidator';
export { StateNotifier, type StateChangeCallback, type StateChangeListener } from './StateNotifier';
