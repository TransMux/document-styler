# DocumentStyler 交叉引用系统架构文档

## 概述

DocumentStyler 的交叉引用系统经过完全重构，采用分层架构设计，实现了清晰的职责分离、优雅的数据流动和高效的性能管理。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    CrossReferenceController                 │
│                        (核心控制器)                          │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
┌───────────────▼───┐  ┌────────▼────────┐  ┌──▼──────────────┐
│   数据层 (Data)   │  │ 业务逻辑层 (BL) │  │ 表现层 (Pres.)  │
│                   │  │                 │  │                 │
│ • FigureDataProv. │  │ • FigureManager │  │ • StyleManager  │
│ • FigureDataCache │  │ • FigureProc.   │  │ • CSSGenerator  │
│ • DOMParser       │  │ • FigureNumber. │  │ • StyleApplicat.│
│ • APIClient       │  │ • FigureValid.  │  │                 │
└───────────────────┘  └─────────────────┘  └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
┌───────────────▼───┐  ┌────────▼────────┐  ┌──▼──────────────┐
│ 状态管理 (State)  │  │ 事件处理 (Event)│  │ UI交互 (UI)     │
│                   │  │                 │  │                 │
│ • FigureState     │  │ • EventManager  │  │ • UIManager     │
│ • StateCache      │  │ • EventDisp.    │  │ • PanelRenderer │
│ • StateValidator  │  │ • WebSocketHand.│  │ • InteractionH. │
│ • StateNotifier   │  │ • DocumentEventH│  │                 │
└───────────────────┘  └─────────────────┘  └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
┌───────────────▼───┐  ┌────────▼────────┐
│ 性能监控 (Perf.)  │  │ 内存管理 (Mem.) │
│                   │  │                 │
│ • PerformanceMon. │  │ • MemoryManager │
└───────────────────┘  └─────────────────┘
```

### 分层职责

#### 1. 数据层 (Data Layer)
- **职责**: 统一数据获取、缓存管理、DOM解析、API调用
- **核心组件**:
  - `FigureDataProvider`: 统一数据获取入口
  - `FigureDataCache`: 智能缓存管理
  - `DOMParser`: 专门的DOM解析器
  - `APIClient`: API调用封装

#### 2. 业务逻辑层 (Business Layer)
- **职责**: 核心业务逻辑、数据处理、编号算法、数据验证
- **核心组件**:
  - `FigureManager`: 核心业务逻辑管理器
  - `FigureProcessor`: 数据处理和转换
  - `FigureNumbering`: 编号算法
  - `FigureValidator`: 数据验证

#### 3. 表现层 (Presentation Layer)
- **职责**: CSS样式生成、样式应用、样式管理
- **核心组件**:
  - `StyleManager`: 统一样式管理
  - `CSSGenerator`: CSS生成器
  - `StyleApplicator`: 样式应用器

#### 4. 状态管理层 (State Management Layer)
- **职责**: 状态存储、状态验证、状态变更通知
- **核心组件**:
  - `FigureState`: 状态管理中心
  - `StateCache`: 状态缓存
  - `StateValidator`: 状态验证
  - `StateNotifier`: 状态变更通知

#### 5. 事件处理层 (Event Layer)
- **职责**: 事件监听、事件分发、WebSocket处理、文档事件处理
- **核心组件**:
  - `EventManager`: 统一事件管理
  - `EventDispatcher`: 核心事件分发
  - `WebSocketHandler`: WebSocket消息处理
  - `DocumentEventHandler`: 文档事件处理

#### 6. UI交互层 (UI Layer)
- **职责**: 用户界面管理、面板渲染、用户交互处理
- **核心组件**:
  - `UIManager`: UI管理器
  - `PanelRenderer`: 面板渲染器
  - `InteractionHandler`: 交互处理器

#### 7. 工具层 (Utils Layer)
- **职责**: 性能监控、内存管理、系统优化
- **核心组件**:
  - `PerformanceMonitor`: 性能监控器
  - `MemoryManager`: 内存管理器

## 数据流动

### 1. 文档切换流程

```
用户切换文档
    │
    ▼
EventManager 监听到文档切换事件
    │
    ▼
CrossReferenceController.handleDocumentSwitch()
    │
    ├─► FigureState.setLoadingState() ─► UI显示加载状态
    │
    ├─► FigureManager.getFiguresList()
    │   │
    │   ├─► FigureDataProvider.getFigures()
    │   │   │
    │   │   ├─► FigureDataCache.get() (检查缓存)
    │   │   │
    │   │   ├─► APIClient.getDocumentContent() (获取文档内容)
    │   │   │
    │   │   ├─► DOMParser.parseFigures() (解析DOM)
    │   │   │
    │   │   └─► FigureDataCache.set() (缓存结果)
    │   │
    │   ├─► FigureProcessor.processFigures() (处理数据)
    │   │
    │   ├─► FigureNumbering.assignNumbers() (分配编号)
    │   │
    │   └─► FigureValidator.validateFigures() (验证数据)
    │
    ├─► FigureState.setState() ─► StateNotifier 通知状态变更
    │
    ├─► StyleManager.applyCrossReferenceStyles()
    │   │
    │   ├─► CSSGenerator.generateFigureStyles() (生成CSS)
    │   │
    │   └─► StyleApplicator.applyStyles() (应用样式)
    │
    └─► UIManager.setFigures() ─► PanelRenderer.render() (更新UI)
```

### 2. 性能监控流程

```
操作开始
    │
    ▼
PerformanceMonitor.startOperation()
    │
    ▼
执行业务逻辑
    │
    ▼
PerformanceMonitor.endOperation()
    │
    ├─► 记录性能指标
    │
    ├─► 检查性能警告
    │
    └─► 触发优化建议
```

### 3. 内存管理流程

```
系统运行
    │
    ▼
MemoryManager 定期监控
    │
    ├─► 收集各组件内存使用量
    │
    ├─► 检查内存警告
    │
    ├─► 执行清理任务
    │   │
    │   ├─► 清理过期缓存
    │   │
    │   ├─► 优化样式存储
    │   │
    │   └─► 清理无效引用
    │
    └─► 生成内存报告
```

## 设计原则

### 1. 单一职责原则 (SRP)
每个组件只负责一个明确的功能，避免职责混乱。

### 2. 依赖倒置原则 (DIP)
高层模块不依赖低层模块，都依赖抽象接口。

### 3. 开闭原则 (OCP)
对扩展开放，对修改关闭，便于功能扩展。

### 4. 数据流单向性
数据流向清晰，避免循环依赖和状态不一致。

### 5. 性能优先
内置性能监控和内存管理，确保系统高效运行。

## 关键特性

### 1. 智能缓存
- 多层缓存策略
- LRU淘汰算法
- 自动过期清理
- 缓存命中率监控

### 2. 性能监控
- 实时性能指标收集
- 慢操作检测
- 性能趋势分析
- 自动优化建议

### 3. 内存管理
- 组件内存使用监控
- 自动内存清理
- 内存泄漏检测
- 内存使用趋势分析

### 4. 事件驱动
- 统一事件分发机制
- 事件去重和队列管理
- WebSocket实时监听
- 文档事件自动处理

### 5. 状态一致性
- 统一状态管理
- 状态变更通知
- 状态验证和修复
- 状态持久化缓存

## 扩展性

### 1. 新增图表类型
只需在 `FigureValidator` 和 `FigureProcessor` 中添加相应的处理逻辑。

### 2. 新增样式主题
在 `CSSGenerator` 中添加新的主题生成方法。

### 3. 新增事件类型
在 `EventManager` 中注册新的事件监听器。

### 4. 新增UI组件
在 `UIManager` 中集成新的UI组件。

## 性能优化

### 1. 减少DOM操作
- 批量DOM更新
- 虚拟DOM diff
- 样式合并应用

### 2. 智能缓存策略
- 多级缓存
- 预加载机制
- 缓存预热

### 3. 异步处理
- 非阻塞操作
- 任务队列管理
- 并发控制

### 4. 内存优化
- 对象池复用
- 弱引用使用
- 定期垃圾回收

## 测试策略

### 1. 单元测试
每个组件都有对应的单元测试，确保功能正确性。

### 2. 集成测试
测试组件间的协作和数据流动。

### 3. 性能测试
监控关键操作的性能表现，确保满足性能要求。

### 4. 内存测试
检测内存泄漏和内存使用优化。

## 维护指南

### 1. 日志监控
关注控制台日志，及时发现和解决问题。

### 2. 性能监控
定期查看性能报告，优化慢操作。

### 3. 内存监控
监控内存使用趋势，防止内存泄漏。

### 4. 错误处理
完善的错误捕获和恢复机制。

## 总结

重构后的交叉引用系统具有以下优势：

1. **架构清晰**: 分层设计，职责明确
2. **性能优异**: 内置监控和优化机制
3. **扩展性强**: 易于添加新功能
4. **维护性好**: 代码结构清晰，易于维护
5. **稳定性高**: 完善的错误处理和恢复机制

这个新架构为DocumentStyler插件的长期发展奠定了坚实的基础。
