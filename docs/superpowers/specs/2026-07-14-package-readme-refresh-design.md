# Core、Vue 与 Vant README 完整化设计

## 背景

`@schemx/core`、`@schemx/vue` 和 `@schemx/vant` 是当前项目对使用者公开的三个主要包，但仓库暂时没有独立文档站点，README 是使用者了解语法、API 和类型的唯一入口。

现有 README 的完整度不一致：Core 已包含部分核心能力，Vue 和 Vant 主要停留在快速开始与概览层面；Dictionary 等已经公开的能力缺少完整配置语法，部分组件、Hooks、Renderer Props、实例方法和类型也只有名称，没有使用说明。文档需要从“功能概览”升级为可独立使用的完整参考。

## 目标

- 以三个包根入口的实际公开导出为准，完整记录所有函数、组件、常量、实例方法和类型；
- 补齐普通字段、Group、Dependency、动态属性、校验和 Dictionary 等 Schema 语法；
- 为包内自行定义的公开配置类型和 Props 提供字段级说明；
- 为主要能力提供可直接参考的 TypeScript 或 Vue 示例；
- 统一三个 README 的术语、章节层级、表格结构和代码风格；
- 建立“完整导出清单”，使后续版本可以人工核对文档遗漏；
- 校准样式自动加载、包依赖和 Adapter 边界等容易过期的信息。

## 文档边界

### 事实来源

文档按以下优先级核对事实：

1. 包根入口及其 `export *` 形成的公开导出；
2. 公开函数、组件与类型的源码声明；
3. 单元测试中能够确认的运行行为；
4. `package.json` 中的 exports、peer dependencies 和构建结果。

源码内部存在但未从包根入口导出的实现不进入公开 API 清单，也不将 compiler、reconciler 和 RuntimeNodeManager 等内部基础设施描述为用户 API。

### 类型记录规则

- 包内自行定义的配置接口和 Props 逐字段记录类型、必填性、默认行为与限制；
- 函数记录主要签名、参数、返回值、生命周期和异常行为；
- 组件记录 Props、Events、Slots、`v-model` 和通过 `ref` 暴露的实例；
- 类型工具记录用途、泛型参数和典型使用场景；
- 继承自 Vue、Vant 或 Standard Schema 的第三方类型不复制上游的全部字段，而是注明继承来源、排除项、覆盖项和本包新增字段；
- Vue 和 Vant 重新导出的上游符号需要出现在完整导出清单中，详细说明可链接到同一 README 的对应章节或上游包章节。

## 信息架构

三个 README 统一采用分层结构：先帮助使用者完成安装和首次渲染，再讲解常用语法，最后提供穷举式 API 与类型参考。完整性不能以牺牲快速开始的可读性为代价。

### `@schemx/core`

1. 包定位与安装；
2. 快速开始；
3. Schema 完整语法；
   - 普通字段；
   - Group；
   - Dependency；
   - `dependencies` 动态属性；
   - 校验规则；
4. `createForm` 配置；
5. `SchemxInstance` 完整实例 API；
6. Schema 集合与动态更新；
7. 字段实例；
8. Watch、Effect 与响应式批处理；
9. Renderer 和 Validator 注册表；
10. ViewSchemas 与节点生命周期；
11. Schema、路径和类型判断工具；
12. 类型系统与声明合并；
13. 完整导出清单。

### `@schemx/vue`

1. 包定位、安装与样式加载；
2. Renderer 注册及快速开始；
3. `Schemx` 组件；
   - Props；
   - `v-model`；
   - Events；
   - Slots；
   - 暴露的表单实例；
   - Vue 插件安装；
4. Schema 在 Vue 中的写法；
5. Dictionary 完整指南；
6. 自定义 Renderer 协议；
7. `WithRemoteOptions`；
8. Composition API；
   - Form、Field 与 Context；
   - Watch 与 Effect；
   - Dictionary；
   - ViewSchemas；
9. `FormItem` 和 `FormGroup`；
10. 全局 Registry；
11. 类型参考；
12. 从 Core 重新导出的 API；
13. 完整导出清单。

### `@schemx/vant`

1. 包定位、安装与样式加载；
2. 快速开始；
3. Renderer 总览矩阵；
4. Dictionary 支持矩阵与示例；
5. 18 个 Renderer 逐项参考；
   - `componentType`；
   - 值类型；
   - 本包自定义 Props；
   - 继承的 Vant Props；
   - Events 与格式转换；
   - 使用示例；
6. 公共组件与工具函数；
7. 默认 Renderer 注册行为；
8. 导出的组件、常量和类型；
9. 从 Vue 和 Core 重新导出的 API；
10. 完整导出清单。

## Dictionary 文档设计

Dictionary 作为跨 Vue 与 Vant 的完整功能链路记录，不只在类型清单中列出名称。

文档覆盖以下内容：

- Schema 中的 `dict` 字段及其与 `componentProps.options` 的优先关系；
- 本地列表、同步返回、Promise 和请求函数等数据来源；
- 依赖其他表单字段刷新选项的配置方式；
- `SchemxDictionary` 的全部字段、泛型参数和回调参数；
- `SchemxWithDictionary` 如何为 Renderer Props 注入 `dict`；
- `useDictionary` 的参数、返回值、loading、错误、刷新和竞态处理；
- `WithRemoteOptions` 如何加载字典并向被包装组件注入 `options`；
- Vant 中支持 `dict` 的 Renderer、值类型和选项结构；
- 静态 `options`、Dictionary 和 Renderer 自身 loading 的组合行为。

如果当前运行时支持 Dictionary 但类型声明未完整表达，先将其列为源码与类型不一致问题，不在 README 中虚构类型能力。

## 示例规范

- TypeScript 示例使用包根入口导入，不依赖内部路径；
- Vue 示例优先使用 `<script setup lang="ts">`；
- 示例中的类型、字段名和事件名必须能从当前源码确认；
- 同一概念只保留一个主示例，其他章节通过短示例或锚点引用，避免大段重复；
- 示例明确区分 `initialValues`、`v-model` 当前值和提交结果；
- 样式说明区分 Schemx 自身样式与 Vant 组件库样式；
- 中文与英文、数字之间保留空格，中文语境使用全角标点。

## 现有改动保护

当前工作区存在未提交的 `CascaderRenderer` Dictionary 包装和 Vue 类型聚合出口调整。README 工作必须保留这些改动，并以最终工作区源码核对文档，不得覆盖或回退用户修改。

## 非目标

- 不扩大任何包的公开导出范围；
- 不为补文档而修改运行时逻辑；
- 不复制 Vant 上游全部 Props 声明；
- 不新增独立文档站点或文档生成依赖；
- 不修改插件文档和示例项目文档；
- 不创建 Git commit。

## 验证方式

1. 收集三个根入口及其传递导出的完整公开符号；
2. 将公开符号与 README 的完整导出清单逐项比对；
3. 核对公开函数重载、组件 Props、Events、Slots、实例方法和类型字段；
4. 对复杂运行行为同时核对源码与测试；
5. 检查所有代码示例的导入路径、字段名、参数和返回值；
6. 搜索并清理旧 API、错误命名和过期的手动样式引入说明；
7. 使用 Prettier 检查三个 README；
8. 运行三个包的 type-check、测试、构建和 `release:check`；
9. 检查工作区状态，确认未覆盖用户既有改动且没有生成文件残留。

## 验收标准

- 每个包根入口公开的符号至少在对应 README 中出现一次；
- 每个包自行定义的公开配置类型都有字段级说明；
- 每种 Schema 语法都有完整说明和示例；
- 每个 Vant Renderer 都有值类型、Props 来源和用法说明；
- Dictionary 从 Schema 配置到 Renderer 消费形成完整闭环；
- 三个 README 的术语、章节层级和示例风格一致；
- 文档只描述当前可用能力，不包含无法由源码验证的接口；
- 三个包的质量检查和完整发布前检查通过；
- 不创建 Git commit，现有用户改动保持不变。
