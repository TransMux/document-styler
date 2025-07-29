# Document Styler Plugin

文档样式设置插件，为SiYuan提供强大的文档样式定制功能。

## 功能特性

### 1. 标题自动编号
- 支持1-6级标题的自动编号
- 采用层级编号格式（如：1. 1.1. 1.1.1.）
- 可通过侧边栏开关控制启用/禁用
- 编号样式与SiYuan主题自动适配

### 2. 图片表格交叉引用
- 为文档中的图片和表格自动添加编号标签
- 支持Figure和Table两种类型的标签
- 自动生成Caption区域，支持用户编辑
- 编号自动更新，无需手动维护

### 3. @符号交叉引用选择
- 在编辑器中输入@符号触发交叉引用选择
- 通过SQL查询当前文档中的所有图片和表格
- 提供友好的选择界面，显示图片表格预览
- 插入的引用支持点击跳转到对应位置

## 使用方法

### 启用插件
1. 插件已内置在SiYuan中，无需额外安装
2. 在右侧边栏中找到"文档样式设置"面板
3. 点击面板图标打开设置界面

### 标题自动编号
1. 在设置面板中勾选"自动编号"选项
2. 当前文档的所有标题将自动显示编号
3. 编号格式为层级式：1. 1.1. 1.1.1. 等
4. 取消勾选即可关闭编号显示

### 图片表格交叉引用
1. 在设置面板中勾选"支持交叉引用"选项
2. 文档中的图片和表格将自动添加编号标签
3. 图片显示为"Figure 1:"，表格显示为"Table 1:"
4. 可以编辑Caption文本内容

### 使用@符号引用
1. 确保已启用"支持交叉引用"功能
2. 在编辑器中输入@符号
3. 从弹出的菜单中选择要引用的图片或表格
4. 插入的引用文本支持点击跳转

## 技术实现

### 架构设计
- 基于SiYuan内置插件系统开发
- 使用TypeScript编写，提供完整的类型支持
- 采用模块化设计，功能独立可扩展

### 核心技术
- **CSS计数器**：实现标题自动编号
- **DOM操作**：动态添加图片表格标签
- **SQL查询**：获取文档中的图片表格信息
- **事件监听**：响应文档切换和加载事件
- **本地存储**：保存用户设置偏好

### 样式系统
- 完全适配SiYuan的主题系统
- 使用CSS变量确保样式一致性
- 支持深色/浅色主题自动切换
- 响应式设计，适配不同屏幕尺寸

## 文件结构

```
DocumentStyler/
├── index.ts          # 主插件文件
├── styles.css        # 样式文件
├── test.ts          # 测试文件
└── README.md        # 说明文档
```

## API接口

### 主要方法

#### `applyHeadingNumbering()`
应用标题自动编号样式

#### `applyCrossReference()`
应用图片表格交叉引用功能

#### `queryDocumentFigures()`
查询当前文档中的图片和表格
```typescript
async queryDocumentFigures(): Promise<any[]>
```

#### `showCrossReferenceHint(protyle, nodeElement)`
显示交叉引用选择提示
```typescript
showCrossReferenceHint(protyle: any, nodeElement: HTMLElement): void
```

### 设置选项

```typescript
interface Settings {
    headingNumbering: boolean;    // 标题自动编号
    crossReference: boolean;      // 交叉引用支持
}
```

## 自定义样式

### 标题编号样式
可以通过修改CSS来自定义标题编号的外观：

```css
.protyle-wysiwyg [data-subtype="h1"]:before {
    color: var(--b3-theme-primary);
    font-weight: bold;
    margin-right: 8px;
}
```

### 图片表格标签样式
自定义Figure和Table标签的样式：

```css
.figure-caption .figure-label {
    color: var(--b3-theme-primary);
    font-weight: bold;
}

.table-caption .table-label {
    color: var(--b3-theme-secondary);
    font-weight: bold;
}
```

## 兼容性

- 支持SiYuan v2.0+
- 兼容所有官方主题
- 支持桌面端和移动端
- 兼容现有的插件生态

## 开发指南

### 本地开发
1. 克隆SiYuan源码
2. 进入插件目录：`cd app/src/plugin/builtin/DocumentStyler`
3. 修改代码后重新编译SiYuan

### 测试
运行测试文件：
```typescript
import { runCrossReferenceControllerTests, runPerformanceTests } from './tests';

// 运行功能测试
await runCrossReferenceControllerTests();

// 运行性能测试
await runPerformanceTests();
```

### 调试
在浏览器控制台中运行：
```javascript
// 需要先导入测试模块
// 然后运行相应的测试函数
```

## 常见问题

### Q: 标题编号不显示？
A: 请确保已在设置面板中启用"自动编号"选项。

### Q: @符号不能触发交叉引用？
A: 请确保已启用"支持交叉引用"功能，且当前文档中存在图片或表格。

### Q: 编号顺序不正确？
A: 编号基于文档中元素的出现顺序，请检查文档结构。

### Q: 样式与主题不匹配？
A: 插件使用CSS变量适配主题，如有问题请尝试刷新页面。

## 新架构特性 (v2.0.0)

### 核心改进
- **基于API获取大纲**: 使用 `/api/outline/getDocOutline` 获取完整文档结构，避免DOM依赖
- **CSS动态生成**: 通过CSS `:before` 伪元素显示编号，避免直接修改DOM内容
- **智能事件监听**: 分析WebSocket transaction事件，精确识别需要更新的内容
- **缓存优化**: 大纲数据缓存机制，减少API调用频率
- **防抖更新**: 避免频繁更新导致的性能问题和用户体验下降

### 技术架构重构

**新增模块**:
- `OutlineManager`: 大纲数据管理，负责获取、缓存和解析文档大纲
- `CSSGenerator`: CSS样式生成器，动态生成标题编号样式
- `TransactionAnalyzer`: 事件分析器，智能分析WebSocket事件

**增强模块**:
- `HeadingNumbering`: 重构为基于API和CSS的实现
- `StyleManager`: 增强样式管理功能，支持动态CSS生成
- `EventHandler`: 增强事件处理，使用智能事件分析

### 性能优化
- 大纲数据缓存（30秒有效期）
- 防抖更新机制（1秒延迟）
- CSS选择器优化
- 批量DOM操作减少

### 兼容性保持
- 保持原有API接口不变
- 向后兼容旧版本设置
- 平滑升级，无需用户干预

## 更新日志

### v2.0.0 (重构版本)
- 🚀 全新架构：基于API获取大纲和CSS动态生成
- ⚡ 性能优化：缓存机制和防抖更新
- 🔧 智能事件监听：精确识别文档变化
- 🎨 CSS动态生成：避免DOM直接修改
- 📊 事件分析器：智能分析WebSocket事件

### v1.0.0
- 初始版本发布
- 支持标题自动编号
- 支持图片表格交叉引用
- 支持@符号触发引用选择

## 贡献

欢迎提交Issue和Pull Request来改进这个插件。

## 许可证

本插件遵循SiYuan的开源许可证。
