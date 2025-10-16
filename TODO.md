## 项目信息

这是一个思源笔记插件，目标是在思源的基础上提供更多高级功能，旨在让思源胜任专业的报告写作（各种输出场景，例如日报，周报，月报）

## 项目结构

```
document-styler/
├── src/
│   ├── index.ts                 # 主插件入口，管理所有组件
│   ├── api.ts                   # SiYuan API 封装
│   ├── types/                   # TypeScript 类型定义
│   │   └── index.ts
│   ├── core/                    # 核心功能模块
│   │   ├── SettingsManager.ts   # 设置管理（文档级别设置）
│   │   ├── DocumentManager.ts   # 文档管理器
│   │   ├── HeadingNumbering.ts  # 标题自动编号系统
│   │   ├── CrossReference.ts    # 交叉引用系统
│   │   ├── FontStyleManager.ts  # 字体样式管理
│   │   ├── BetaFeatureManager.ts # 内测功能管理
│   │   └── ImageStackManager.ts # 图片堆叠管理
│   ├── ui/                      # 用户界面组件
│   │   ├── DockPanel.ts         # 侧边栏面板
│   │   ├── StyleManager.ts      # CSS 样式管理
│   │   └── CrossReferenceMenu.ts # 交叉引用菜单
│   └── utils/                   # 工具函数
│       ├── apiUtils.ts          # API 工具
│       ├── outlineUtils.ts      # 大纲处理
│       ├── numberUtils.ts       # 编号工具
│       ├── numberStyleConverter.ts # 编号样式转换
│       └── siyuan-api.ts        # SiYuan API 封装

## 核心架构说明

### 1. 主要组件关系
- **DocumentStylerPlugin (index.ts)**: 主插件类，协调所有组件
- **SettingsManager**: 管理插件的全局和文档级别设置
- **HeadingNumbering**: 核心的标题编号功能，基于大纲数据生成编号
- **StyleManager**: 负责将编号应用为 CSS 样式
- **DockPanel**: 提供用户界面进行设置

### 2. 数据流
1. 用户在 DockPanel 中调整设置
2. SettingsManager 保存设置到 SiYuan 存储
3. HeadingNumbering 根据设置和大纲数据生成编号映射
4. StyleManager 将编号映射转换为 CSS 规则应用到文档

### 3. 事件处理
- 监听文档切换事件 (switch-protyle)
- 监听文档加载事件 (loaded-protyle-static) 
- 监听 WebSocket 消息处理实时更新
- 防抖机制避免频繁更新

### 4. 关键特性
- **文档级别设置**: 每个文档可以独立配置编号格式
- **实时更新**: 文档结构变化时自动更新编号
- **CSS 方式渲染**: 使用 CSS 伪元素显示编号，不修改原文档内容
- **内测功能**: 交叉引用等高级功能需要内测验证
```

## 补充信息

- 思源源代码位于： "/root/projects/siyuan"

## TODO List （请阅读完成整个文件）

- [√] 阅读思源笔记源代码，让导出的时候同样带有标题编号
- [√] 提炼，抽象整个插件结构，将其写在这个TODO文件的"项目结构"板块中
- [ ] 清理整个数据流，删除冗余的代码，让整个插件的数据流变得清晰，保证代码优雅简洁

## 导出标题编号的实现思路

基于对思源源代码的分析，发现以下关键点：

### 1. 思源导出机制
- 导出功能主要在 `kernel/model/export.go` 中实现
- `ExportMarkdownContent` 函数负责 Markdown 导出
- `adjustHeadingLevel` 函数会调整标题层级
- 导出时会遍历 AST 树结构处理各种节点

### 2. 插件集成方案
当前插件使用 CSS 方式显示编号，需要在导出时将 CSS 编号转换为实际文本：

**方案 A: 修改导出 API**
- 在思源的导出流程中集成插件编号
- 修改 `exportMarkdownContent0` 函数
- 在生成 Markdown 前将编号插入到标题文本中

**方案 B: 插件导出功能**
- 在插件中实现独立的导出功能
- 获取当前文档的编号映射
- 生成带编号的 Markdown 内容
- 提供专用的导出按钮/命令

**推荐方案 B**，因为：
- 不需要修改思源核心代码
- 可以完全控制导出格式
- 更易于维护和扩展
