/**
 * 事件处理层模块导出
 * 统一导出所有事件处理组件
 */

export { EventManager, type IEventManagerConfig } from './EventManager';
export { EventDispatcher, type IEventHandler, type IEventDispatcherConfig } from './EventDispatcher';
export { WebSocketHandler, type IWebSocketMessage, type ITransactionData } from './WebSocketHandler';
export { DocumentEventHandler, type IDocumentEventData } from './DocumentEventHandler';
