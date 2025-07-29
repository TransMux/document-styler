# DocumentStyler API 文档

## CrossReferenceController

核心控制器，提供交叉引用功能的统一接口。

### 构造函数

```typescript
constructor(config?: ICrossReferenceConfig)
```

#### ICrossReferenceConfig

```typescript
interface ICrossReferenceConfig {
    /** 图片编号前缀 */
    imagePrefix?: string;
    /** 表格编号前缀 */
    tablePrefix?: string;
    /** 是否启用自动更新 */
    autoUpdate?: boolean;
    /** 是否启用UI面板 */
    enableUI?: boolean;
    /** 是否启用WebSocket监听 */
    enableWebSocket?: boolean;
    /** 事件处理延迟（毫秒） */
    eventDelay?: number;
}
```

### 主要方法

#### init()

初始化控制器。

```typescript
async init(): Promise<void>
```

#### handleDocumentSwitch(docId)

处理文档切换。

```typescript
async handleDocumentSwitch(docId: string): Promise<void>
```

**参数:**
- `docId`: 文档ID

#### getFiguresList(docId, config?)

获取文档的图表列表。

```typescript
async getFiguresList(docId: string, config?: IDataFetchConfig): Promise<IFigureInfo[]>
```

**参数:**
- `docId`: 文档ID
- `config`: 获取配置（可选）

**返回:** 图表信息数组

#### enableCrossReference(docId?)

启用交叉引用功能。

```typescript
async enableCrossReference(docId?: string): Promise<void>
```

**参数:**
- `docId`: 文档ID（可选，不传则使用当前文档）

#### disableCrossReference(docId?)

禁用交叉引用功能。

```typescript
async disableCrossReference(docId?: string): Promise<void>
```

**参数:**
- `docId`: 文档ID（可选，不传则使用当前文档）

#### refreshCurrentDocument()

刷新当前文档。

```typescript
async refreshCurrentDocument(): Promise<void>
```

#### getStats()

获取统计信息。

```typescript
getStats(): {
    isInitialized: boolean;
    currentDocId?: string;
    figureManager: any;
    styleManager: any;
    figureState: any;
    eventManager: any;
    uiManager: any;
    performance: any;
    memory: any;
}
```

#### getPerformanceReport()

获取性能报告。

```typescript
getPerformanceReport(): {
    summary: any;
    slowOperations: IPerformanceMetrics[];
    recentOperations: IPerformanceMetrics[];
    activeOperations: string[];
    timestamp: number;
}
```

#### getMemoryReport()

获取内存报告。

```typescript
getMemoryReport(): {
    currentStats: IMemoryStats;
    warnings: string[];
    trend: any;
    history: IMemoryStats[];
}
```

#### optimizePerformance()

执行性能优化。

```typescript
async optimizePerformance(): Promise<void>
```

#### checkSystemHealth()

检查系统健康状态。

```typescript
checkSystemHealth(): {
    isHealthy: boolean;
    warnings: string[];
    recommendations: string[];
}
```

#### updateConfig(config)

更新配置。

```typescript
updateConfig(config: Partial<ICrossReferenceConfig>): void
```

**参数:**
- `config`: 新配置

#### destroy()

销毁控制器。

```typescript
async destroy(): Promise<void>
```

## 数据类型

### IFigureInfo

图表信息接口。

```typescript
interface IFigureInfo {
    /** 块ID */
    id: string;
    /** 类型 */
    type: 'image' | 'table';
    /** 内容 */
    content: string;
    /** 标题/描述 */
    caption?: string;
    /** 编号 */
    number?: number;
    /** 标题元素ID */
    captionId?: string;
    /** DOM顺序 */
    domOrder?: number;
    /** 原始数据 */
    rawData?: any;
}
```

### IDataFetchConfig

数据获取配置接口。

```typescript
interface IDataFetchConfig {
    /** 是否使用缓存 */
    useCache?: boolean;
    /** 缓存过期时间（毫秒） */
    cacheExpiry?: number;
    /** 是否强制刷新 */
    forceRefresh?: boolean;
    /** 包含的图表类型 */
    includeTypes?: ('image' | 'table')[];
}
```

### IPerformanceMetrics

性能指标接口。

```typescript
interface IPerformanceMetrics {
    /** 操作名称 */
    operation: string;
    /** 开始时间 */
    startTime: number;
    /** 结束时间 */
    endTime: number;
    /** 持续时间（毫秒） */
    duration: number;
    /** 内存使用量（字节） */
    memoryUsage?: number;
    /** 额外数据 */
    metadata?: Record<string, any>;
}
```

### IMemoryStats

内存统计接口。

```typescript
interface IMemoryStats {
    /** 总内存使用量（字节） */
    totalMemory: number;
    /** 各组件内存使用量 */
    componentMemory: Record<string, number>;
    /** 缓存内存使用量 */
    cacheMemory: number;
    /** 事件监听器数量 */
    eventListeners: number;
    /** DOM元素数量 */
    domElements: number;
    /** 最后更新时间 */
    lastUpdated: number;
}
```

## 事件系统

### 支持的事件类型

```typescript
// 文档事件
'document:switch'    // 文档切换
'document:loaded'    // 文档加载
'document:edited'    // 文档编辑
'document:closed'    // 文档关闭

// 图表事件
'figure:added'       // 图表添加
'figure:removed'     // 图表移除
'figure:updated'     // 图表更新
'figure:reordered'   // 图表重排序

// 样式事件
'style:applied'      // 样式应用
'style:removed'      // 样式移除
'style:updated'      // 样式更新

// 状态事件
'state:changed'      // 状态变更
'state:loading'      // 状态加载
'state:error'        // 状态错误
'state:cleared'      // 状态清除

// WebSocket事件
'websocket:transaction'    // WebSocket事务
'websocket:connected'      // WebSocket连接
'websocket:disconnected'   // WebSocket断开

// 系统事件
'system:ready'       // 系统就绪
'system:error'       // 系统错误
'system:cleanup'     // 系统清理
```

### 事件监听

```typescript
// 监听事件
const unsubscribe = controller.eventManager.on('document:switch', (data) => {
    console.log('文档切换:', data);
});

// 取消监听
unsubscribe();

// 一次性监听
await controller.eventManager.once('system:ready', () => {
    console.log('系统已就绪');
});

// 发送事件
await controller.eventManager.emit('custom:event', data);
```

## 使用示例

### 基本使用

```typescript
import { CrossReferenceController } from './core/CrossReferenceController';

// 创建控制器
const controller = new CrossReferenceController({
    imagePrefix: '图',
    tablePrefix: '表',
    autoUpdate: true,
    enableUI: true
});

// 初始化
await controller.init();

// 处理文档切换
await controller.handleDocumentSwitch('20231201120000-abc123');

// 获取图表列表
const figures = await controller.getFiguresList('20231201120000-abc123');
console.log('图表列表:', figures);

// 获取性能报告
const performanceReport = controller.getPerformanceReport();
console.log('性能报告:', performanceReport);

// 检查系统健康
const health = controller.checkSystemHealth();
if (!health.isHealthy) {
    console.warn('系统警告:', health.warnings);
    console.log('建议:', health.recommendations);
}

// 销毁控制器
await controller.destroy();
```

### 高级使用

```typescript
// 自定义配置
const controller = new CrossReferenceController({
    imagePrefix: 'Figure',
    tablePrefix: 'Table',
    autoUpdate: false,
    enableUI: false,
    enableWebSocket: true,
    eventDelay: 200
});

// 监听事件
controller.eventManager.on('figure:added', (data) => {
    console.log('新增图表:', data);
});

// 性能监控
const performanceMonitor = controller.performanceMonitor;
const operationId = performanceMonitor.startOperation('custom-operation');
// ... 执行操作
performanceMonitor.endOperation(operationId);

// 内存管理
const memoryManager = controller.memoryManager;
memoryManager.registerComponent('custom-component', () => {
    return customComponent.getMemoryUsage();
});

// 定期优化
setInterval(async () => {
    await controller.optimizePerformance();
}, 5 * 60 * 1000); // 每5分钟优化一次
```

## 错误处理

所有异步方法都会抛出错误，建议使用 try-catch 进行错误处理：

```typescript
try {
    await controller.handleDocumentSwitch(docId);
} catch (error) {
    console.error('处理文档切换失败:', error);
    // 错误恢复逻辑
}
```

## 性能建议

1. **合理使用缓存**: 启用缓存可以显著提高性能
2. **定期清理**: 定期调用 `optimizePerformance()` 清理缓存和内存
3. **监控性能**: 定期检查性能报告，优化慢操作
4. **控制并发**: 避免同时处理过多文档
5. **及时销毁**: 不使用时及时调用 `destroy()` 释放资源

## 调试技巧

1. **启用详细日志**: 在开发环境中启用详细的控制台日志
2. **使用性能监控**: 利用内置的性能监控功能定位性能瓶颈
3. **检查内存使用**: 定期检查内存报告，防止内存泄漏
4. **监听事件**: 监听相关事件了解系统状态变化
5. **使用健康检查**: 定期调用 `checkSystemHealth()` 了解系统状态
