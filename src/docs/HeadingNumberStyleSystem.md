# 标题编号样式系统和文档属性管理

## 概述

这次更新实现了两个重要功能：
1. **丰富的标题编号样式系统** - 支持16种不同的编号样式
2. **文档属性管理** - 自动编号状态记录在文档属性中，切换文档时自动选择打开或关闭

## 🎨 标题编号样式系统

### 支持的样式类型

| 样式类型 | 枚举值 | 示例 | 说明 |
|---------|--------|------|------|
| 阿拉伯数字 | `ARABIC` | 1, 2, 3 | 标准数字 |
| 中文数字 | `CHINESE` | 一, 二, 三 | 中文小写数字 |
| 中文大写 | `CHINESE_UPPER` | 壹, 贰, 叁 | 中文大写数字 |
| 圆圈数字 | `CIRCLED` | ①, ②, ③ | 带圆圈的数字 |
| 圆圈中文 | `CIRCLED_CHINESE` | ❶, ❷, ❸ | 带圆圈的中文数字 |
| 表情数字 | `EMOJI` | 1️⃣, 2️⃣, 3️⃣ | 表情符号数字 |
| 英文大写 | `UPPER_ALPHA` | A, B, C | 大写字母 |
| 英文小写 | `LOWER_ALPHA` | a, b, c | 小写字母 |
| 罗马数字大写 | `UPPER_ROMAN` | I, II, III | 大写罗马数字 |
| 罗马数字小写 | `LOWER_ROMAN` | i, ii, iii | 小写罗马数字 |
| 带括号数字 | `PARENTHESES` | (1), (2), (3) | 括号包围的数字 |
| 方括号数字 | `BRACKETS` | [1], [2], [3] | 方括号包围的数字 |
| 点号数字 | `DOT` | 1., 2., 3. | 数字后跟点号 |
| 双点号数字 | `DOUBLE_DOT` | 1), 2), 3) | 数字后跟右括号 |
| 天干 | `HEAVENLY_STEMS` | 甲, 乙, 丙 | 中国传统天干 |
| 地支 | `EARTHLY_BRANCHES` | 子, 丑, 寅 | 中国传统地支 |

### 样式转换器

```typescript
// 使用样式转换器
import { NumberStyleConverter, HeadingNumberStyle } from './types';

// 转换数字为指定样式
const result = NumberStyleConverter.convert(3, HeadingNumberStyle.CHINESE); // "三"
const result2 = NumberStyleConverter.convert(5, HeadingNumberStyle.CIRCLED); // "⑤"

// 获取样式的显示名称和示例
const displayName = NumberStyleConverter.getDisplayName(HeadingNumberStyle.CHINESE); // "中文数字"
const example = NumberStyleConverter.getExample(HeadingNumberStyle.CHINESE); // "一, 二, 三"

// 获取所有可用样式选项
const options = NumberStyleConverter.getStyleOptions();
```

### 配置示例

```typescript
// 为不同级别的标题设置不同样式
const headingNumberStyles = [
    HeadingNumberStyle.ARABIC,        // H1: 1, 2, 3
    HeadingNumberStyle.CHINESE,       // H2: 一, 二, 三
    HeadingNumberStyle.CIRCLED,       // H3: ①, ②, ③
    HeadingNumberStyle.LOWER_ALPHA,   // H4: a, b, c
    HeadingNumberStyle.LOWER_ROMAN,   // H5: i, ii, iii
    HeadingNumberStyle.PARENTHESES    // H6: (1), (2), (3)
];
```

## 📄 文档属性管理

### 文档属性常量

```typescript
export const DOCUMENT_ATTR_KEYS = {
    /** 标题编号启用状态 */
    HEADING_NUMBERING_ENABLED: 'custom-heading-numbering-enabled',
    /** 交叉引用启用状态 */
    CROSS_REFERENCE_ENABLED: 'custom-cross-reference-enabled'
} as const;
```

### 文档属性API

```typescript
// 获取文档属性
const value = await getDocumentAttr(docId, attrName);

// 设置文档属性
await setDocumentAttr(docId, {
    'custom-heading-numbering-enabled': 'true'
});
```

### SettingsManager 新方法

```typescript
// 检查文档是否启用标题编号
const isEnabled = await settingsManager.isDocumentHeadingNumberingEnabled(docId);

// 设置文档的标题编号启用状态
await settingsManager.setDocumentHeadingNumberingEnabled(docId, true);

// 获取/设置标题编号样式
const style = settingsManager.getHeadingNumberStyle(level);
await settingsManager.setHeadingNumberStyle(level, HeadingNumberStyle.CHINESE);
```

## 🔄 自动切换逻辑

### 文档切换时的行为

1. **文档加载时**：
   - 检查文档属性中的编号启用状态
   - 如果没有设置属性，使用全局默认设置
   - 自动应用或移除编号

2. **文档切换时**：
   - 清除当前文档的编号样式
   - 检查新文档的编号启用状态
   - 根据状态决定是否应用编号

3. **实时更新**：
   - WebSocket 消息处理时检查文档属性
   - 只对启用编号的文档进行更新

### 实现示例

```typescript
// HeadingNumbering.handleTransactionMessage
async handleTransactionMessage(msg: any): Promise<void> {
    // 检查当前文档是否受影响
    if (!this.documentManager.isCurrentDocumentAffected(msg)) {
        return;
    }

    const currentDocId = this.documentManager.getCurrentDocId();
    if (!currentDocId) return;

    // 🔑 关键：检查文档是否启用了标题编号
    const isEnabled = await this.settingsManager.isDocumentHeadingNumberingEnabled(currentDocId);
    if (!isEnabled) return;

    // 分析是否需要更新标题编号
    if (this.needsHeadingUpdate(msg)) {
        await this.updateNumberingForDoc(currentDocId);
    }
}
```

## 🏗️ 架构变更

### 设置结构变更

```typescript
// ❌ 旧的设置结构
interface IDocumentStylerSettings {
    useChineseNumbers: boolean[];  // 移除
    // ...
}

// ✅ 新的设置结构
interface IDocumentStylerSettings {
    headingNumberStyles: HeadingNumberStyle[];  // 新增
    // ...
}
```

### 核心组件更新

1. **OutlineManager**：
   - `getHeadingNumberMap()` 方法签名更新
   - 支持新的样式系统参数

2. **HeadingNumbering**：
   - 新增文档属性检查逻辑
   - 使用新的样式转换器

3. **SettingsManager**：
   - 新增文档属性管理方法
   - 移除旧的中文数字设置方法

## 🎯 用户体验改进

### 1. 个性化编号样式
- 每个标题级别可以设置不同的编号样式
- 支持传统中文、现代符号、国际标准等多种风格
- 满足不同文档类型和用户偏好

### 2. 智能文档管理
- 编号状态跟随文档，不需要手动切换
- 新建文档继承全局默认设置
- 文档间切换无缝衔接

### 3. 灵活配置
- 全局设置作为默认值
- 文档级别可以独立覆盖
- 支持批量管理和个别调整

## 🔧 开发者指南

### 添加新的编号样式

1. **在枚举中添加新样式**：
```typescript
export enum HeadingNumberStyle {
    // 现有样式...
    NEW_STYLE = 'new_style'
}
```

2. **创建转换器**：
```typescript
class NewStyleConverter implements INumberConverter {
    convert(num: number): string {
        // 实现转换逻辑
        return convertedString;
    }
    
    getDisplayName(): string {
        return "新样式";
    }
    
    getExample(): string {
        return "示例1, 示例2, 示例3";
    }
}
```

3. **注册转换器**：
```typescript
const converterMap = new Map([
    // 现有转换器...
    [HeadingNumberStyle.NEW_STYLE, new NewStyleConverter()]
]);
```

### 扩展文档属性

```typescript
// 添加新的文档属性常量
export const DOCUMENT_ATTR_KEYS = {
    // 现有属性...
    NEW_FEATURE_ENABLED: 'custom-new-feature-enabled'
} as const;

// 在 SettingsManager 中添加相应方法
async isDocumentNewFeatureEnabled(docId: string): Promise<boolean> {
    const value = await getDocumentAttr(docId, DOCUMENT_ATTR_KEYS.NEW_FEATURE_ENABLED);
    return value === 'true';
}
```

## 📈 性能优化

### 1. 缓存机制
- 文档属性查询结果缓存
- 样式转换结果缓存
- 大纲数据缓存

### 2. 懒加载
- 只在需要时查询文档属性
- 按需加载样式转换器
- 延迟初始化复杂组件

### 3. 批量操作
- 批量设置文档属性
- 批量更新编号样式
- 减少API调用次数

## 🔮 未来扩展

### 1. 更多编号样式
- 其他语言的数字系统
- 自定义符号组合
- 用户自定义样式

### 2. 高级文档属性
- 编号起始值设置
- 跳过特定标题级别
- 条件性编号规则

### 3. 样式模板
- 预定义样式组合
- 导入/导出样式配置
- 样式主题系统

这个新的标题编号样式系统为用户提供了前所未有的灵活性和个性化选项，同时通过文档属性管理实现了智能的状态跟踪，大大提升了用户体验。
