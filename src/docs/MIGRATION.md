# DocumentStyler 重构迁移指南

## 概述

本文档描述了从旧版 DocumentStyler 交叉引用系统迁移到新重构版本的详细步骤和注意事项。

## 重构前后对比

### 旧版架构问题

1. **代码重复**: 多个地方存在相似的数据获取和处理逻辑
2. **职责混乱**: 单个类承担过多职责，违反单一职责原则
3. **缓存混乱**: 多套缓存机制，容易出现数据不一致
4. **性能问题**: 缺乏性能监控，存在性能瓶颈
5. **内存泄漏**: 缺乏内存管理，长时间使用后性能下降
6. **难以维护**: 代码结构复杂，难以扩展和维护

### 新版架构优势

1. **分层清晰**: 采用分层架构，职责明确
2. **性能优异**: 内置性能监控和优化机制
3. **内存管理**: 完善的内存监控和清理机制
4. **扩展性强**: 易于添加新功能和修改现有功能
5. **维护性好**: 代码结构清晰，易于理解和维护
6. **测试完善**: 完整的测试用例覆盖

## 迁移步骤

### 第一阶段：准备工作

1. **备份现有代码**
   ```bash
   git checkout -b backup-old-version
   git add .
   git commit -m "备份旧版本代码"
   ```

2. **了解新架构**
   - 阅读 [ARCHITECTURE.md](./ARCHITECTURE.md)
   - 阅读 [API.md](./API.md)
   - 运行测试用例了解新功能

3. **分析现有使用场景**
   - 识别所有使用交叉引用功能的地方
   - 记录当前的配置和自定义设置
   - 确定需要保留的功能

### 第二阶段：逐步迁移

#### 1. 更新导入语句

**旧版:**
```typescript
import { CrossReference } from './core/CrossReference';
```

**新版:**
```typescript
import { CrossReferenceController } from './core/CrossReferenceController';
```

#### 2. 更新初始化代码

**旧版:**
```typescript
const crossRef = new CrossReference(documentManager);
await crossRef.init();
```

**新版:**
```typescript
const controller = new CrossReferenceController({
    imagePrefix: '图',
    tablePrefix: '表',
    autoUpdate: true,
    enableUI: true
});
await controller.init();
```

#### 3. 更新方法调用

**旧版:**
```typescript
// 应用交叉引用
await crossRef.applyCrossReference(protyle);

// 获取图表列表
const figures = await crossRef.getFiguresList(docId);

// 更新前缀样式
await crossRef.updateFigurePrefixStyles(docId);
```

**新版:**
```typescript
// 启用交叉引用
await controller.enableCrossReference(docId);

// 获取图表列表
const figures = await controller.getFiguresList(docId);

// 更新配置（包括前缀）
controller.updateConfig({
    imagePrefix: '新图片前缀',
    tablePrefix: '新表格前缀'
});
await controller.refreshCurrentDocument();
```

#### 4. 更新事件处理

**旧版:**
```typescript
// 手动监听WebSocket
window.addEventListener('message', handleWebSocketMessage);

// 手动监听文档切换
window.addEventListener('switch-protyle', handleDocumentSwitch);
```

**新版:**
```typescript
// 使用统一事件管理
controller.eventManager.on('document:switch', (data) => {
    console.log('文档切换:', data);
});

controller.eventManager.on('figure:updated', (data) => {
    console.log('图表更新:', data);
});
```

### 第三阶段：功能验证

#### 1. 基本功能测试

```typescript
// 运行基本功能测试
import { runCrossReferenceControllerTests } from './tests';
await runCrossReferenceControllerTests();
```

#### 2. 性能测试

```typescript
// 运行性能测试
import { runPerformanceTests } from './tests';
await runPerformanceTests();
```

#### 3. 手动测试

1. **文档切换测试**
   - 切换不同文档，验证交叉引用是否正常工作
   - 检查图表编号是否正确

2. **样式应用测试**
   - 验证CSS样式是否正确应用
   - 检查样式是否会冲突

3. **性能测试**
   - 测试大文档的处理性能
   - 检查内存使用情况

### 第四阶段：配置迁移

#### 1. 设置管理器集成

**旧版:**
```typescript
crossRef.setSettingsManager(settingsManager);
```

**新版:**
```typescript
// 监听设置变更
settingsManager.on('figurePrefix:changed', (docId, prefix) => {
    controller.updateConfig({ imagePrefix: prefix });
    controller.refreshCurrentDocument();
});

settingsManager.on('tablePrefix:changed', (docId, prefix) => {
    controller.updateConfig({ tablePrefix: prefix });
    controller.refreshCurrentDocument();
});
```

#### 2. 面板更新回调

**旧版:**
```typescript
crossRef.setPanelUpdateCallback(updateCallback);
```

**新版:**
```typescript
// 使用事件监听
controller.eventManager.on('state:changed', async () => {
    await updateCallback();
});
```

### 第五阶段：清理工作

#### 1. 移除旧代码

```typescript
// 移除旧的导入
// import { CrossReference } from './core/CrossReference';

// 移除旧的初始化代码
// const crossRef = new CrossReference(documentManager);

// 移除旧的方法调用
// await crossRef.applyCrossReference(protyle);
```

#### 2. 更新类型定义

确保所有类型定义都使用新的接口：

```typescript
import { IFigureInfo, ICrossReferenceConfig } from './types';
```

#### 3. 更新文档和注释

更新代码中的注释和文档，确保与新架构一致。

## 兼容性处理

### 向后兼容

为了确保平滑迁移，新版本保留了一些旧版本的接口：

```typescript
// 保留的兼容接口
class CrossReference {
    private controller: CrossReferenceController;
    
    constructor(documentManager: DocumentManager) {
        this.controller = new CrossReferenceController({
            enableUI: false // 保持向后兼容
        });
    }
    
    async applyCrossReference(protyle: any): Promise<void> {
        const docId = protyle?.block?.rootID;
        if (docId) {
            await this.controller.enableCrossReference(docId);
        }
    }
    
    // ... 其他兼容方法
}
```

### 渐进式迁移

可以采用渐进式迁移策略：

1. **第一步**: 保留旧接口，内部使用新控制器
2. **第二步**: 逐步替换调用点为新接口
3. **第三步**: 移除旧接口

## 常见问题

### Q1: 迁移后性能是否会受影响？

A: 新版本在性能方面有显著提升：
- 智能缓存机制减少重复计算
- 内置性能监控帮助识别瓶颈
- 内存管理防止内存泄漏

### Q2: 现有的自定义样式是否需要修改？

A: 大部分自定义样式无需修改，但建议：
- 检查CSS选择器是否仍然有效
- 利用新的样式管理功能
- 使用新的主题适配功能

### Q3: 如何处理现有的事件监听器？

A: 建议迁移到新的事件系统：
- 使用统一的事件管理器
- 利用事件去重和队列管理
- 享受更好的错误处理

### Q4: 数据格式是否有变化？

A: 核心数据格式保持兼容，但新增了一些字段：
- 新增性能相关字段
- 新增状态管理字段
- 保持向后兼容

## 迁移检查清单

- [ ] 备份现有代码
- [ ] 了解新架构和API
- [ ] 更新导入语句
- [ ] 更新初始化代码
- [ ] 更新方法调用
- [ ] 更新事件处理
- [ ] 运行功能测试
- [ ] 运行性能测试
- [ ] 手动验证功能
- [ ] 迁移配置设置
- [ ] 清理旧代码
- [ ] 更新文档和注释

## 回滚计划

如果迁移过程中遇到问题，可以按以下步骤回滚：

1. **恢复备份分支**
   ```bash
   git checkout backup-old-version
   git checkout -b rollback-to-old
   ```

2. **保留有用的修改**
   - 保留配置文件的修改
   - 保留新增的测试用例
   - 保留文档更新

3. **逐步重新迁移**
   - 分析失败原因
   - 修复问题后重新迁移
   - 采用更小的迁移步骤

## 技术支持

如果在迁移过程中遇到问题，可以：

1. **查看日志**: 检查控制台日志中的错误信息
2. **运行测试**: 使用内置测试用例验证功能
3. **性能分析**: 使用性能监控功能分析问题
4. **内存分析**: 使用内存管理功能检查内存使用

## 总结

重构后的 DocumentStyler 交叉引用系统提供了更好的性能、更清晰的架构和更强的扩展性。虽然迁移需要一些工作，但长期来看将大大提高系统的可维护性和用户体验。

建议采用渐进式迁移策略，确保每个步骤都经过充分测试，这样可以最大程度地降低迁移风险。
