# Core、Vue 与 Vant README 完整化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `@schemx/core`、`@schemx/vue` 和 `@schemx/vant` 的 README 补充为覆盖全部公开语法、API、组件、实例方法和类型的独立文档。

**架构：** 以三个包构建后的根入口声明、公开源码类型和测试行为为事实来源。每个 README 按“快速开始 → 常用语法 → 完整参考 → 导出清单”分层编写，并用 TypeScript Compiler API 对根入口导出名称与 README 文本进行机械比对。

**技术栈：** Markdown、TypeScript、Vue 3、Vant 4、Prettier、Vitest、TypeScript Compiler API

---

## 执行约束

- 不创建 Git commit，不执行 `git add`；
- 保留 `packages/vant/src/renderers/CascaderRenderer/index.ts` 和 `packages/vue/src/types/index.ts` 中现有的用户改动；
- 除非发现文档无法准确描述的公开类型错误，否则只修改 README、规格和计划文件；
- 如果发现源码与类型声明不一致，先记录证据并向用户报告，不擅自扩大实现范围；
- 不将未从包根入口导出的内部实现写成公开 API；
- 不复制 Vant 上游的完整 Props，只记录继承来源、排除项、覆盖项和本包字段。

## 文件结构

- 修改 `packages/core/README.md`：Core Schema、表单实例、Registry、Watch、ViewSchemas、工具与类型的完整参考。
- 修改 `packages/vue/README.md`：Vue 表单组件、Dictionary、Renderer 协议、Composition API、组件与类型的完整参考。
- 修改 `packages/vant/README.md`：18 个 Renderer、Dictionary、公共组件、工具与导出类型的完整参考。
- 修改 `docs/superpowers/specs/2026-07-14-package-readme-refresh-design.md`：已确认的完整化规格，仅在实现发现规格矛盾时校准。
- 修改 `docs/superpowers/plans/2026-07-14-package-readme-refresh.md`：勾选实施进度并记录验证结果。

### 任务 1：建立公开导出与文档覆盖基线

**文件：**
- 读取：`packages/core/src/index.ts`
- 读取：`packages/vue/src/index.ts`
- 读取：`packages/vant/src/index.ts`
- 读取：`packages/core/dist/index.d.ts`
- 读取：`packages/vue/dist/index.d.ts`
- 读取：`packages/vant/dist/index.d.ts`
- 验证：`packages/core/README.md`
- 验证：`packages/vue/README.md`
- 验证：`packages/vant/README.md`

- [x] **步骤 1：构建三个包的最新声明文件**

运行：

```bash
pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... build
```

预期：Core、Vue 和 Vant 均构建成功，三个 `dist/index.d.ts` 与当前工作区源码一致。

- [x] **步骤 2：使用 TypeScript Compiler API 输出每个根入口的完整导出名称**

运行：

```bash
node --input-type=module -e '
import ts from "typescript";
for (const pkg of ["core", "vue", "vant"]) {
  const file = `packages/${pkg}/dist/index.d.ts`;
  const program = ts.createProgram([file], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const names = checker.getExportsOfModule(moduleSymbol)
    .map((symbol) => symbol.getName())
    .filter((name) => name !== "default")
    .sort();
  console.log(`\n[${pkg}] ${names.length}`);
  console.log(names.join("\n"));
}'
```

预期：依次输出 Core、Vue、Vant 的全部命名导出，且命令退出码为 0。

- [x] **步骤 3：保存人工核对分类**

按以下分类整理终端输出，编写 README 时逐项消化：

```text
运行时值：函数、组件、Registry 实例、常量
表单类型：CreateFormOptions、SchemxInstance、Schema、ViewSchema
扩展类型：RendererDefinition、RuleDefinition、FieldDefinition
适配层类型：组件 Props、Hook 返回值、Dictionary
Renderer 类型：每个 Renderer 的 Props、Value、Option、FieldNames
重新导出：Vue <- Core，Vant <- Vue <- Core
```

预期：没有把 `compiler`、`reconciler` 或 RuntimeNodeManager 内部符号加入公开清单。

### 任务 2：完整化 Core 的 Schema 与表单基础文档

**文件：**
- 修改：`packages/core/README.md`
- 读取：`packages/core/src/types/schema.ts`
- 读取：`packages/core/src/types/dependencies.ts`
- 读取：`packages/core/src/types/form.ts`
- 读取：`packages/core/src/createForm.ts`
- 读取：`packages/core/src/defaultConfig.ts`
- 读取：`packages/core/src/types/rule.ts`

- [x] **步骤 1：重组 README 前半部分的阅读路径**

保留包定位、特性、安装和快速开始，将后续一级章节固定为：

```markdown
## Schema 完整语法
## 创建表单
## 表单实例 API
## Schema 集合与动态更新
## 字段实例
## Watch 与 Effect
## Registry 与校验器
## ViewSchemas
## 工具函数
## 类型参考
## 完整导出清单
```

预期：旧内容按主题迁移，不重复保留同一 API 的两份冲突说明。

- [x] **步骤 2：补齐普通字段 Schema 字段表**

对照 `SchemxBase`、`SchemxBaseField`、`SchemxFormItemProps`、`SchemxBaseComponentProps` 和 `SchemxComponentProps`，逐字段记录：

```text
key、name、componentType、label、description、required、rules、
validateTrigger、visible、readonly、disabled、placeholder、class、style、
componentProps、dependencies、initialValue
```

每行至少包含“字段、类型、必填、说明”，并注明 `Dynamic<T>` 字段既可传静态值，也可通过 `dependencies` 动态计算。

- [x] **步骤 3：补齐 Group 与 Dependency 语法**

分别记录：

```text
Group：componentType: "group"、children、分组自身展示属性、子级 key 作用域
Dependency：componentType: "dependency"、to、renderer(values, form, context)
Context：abortSignal
Renderer 返回值：单个 Schema、Schema 数组、Promise
```

保留同步条件子树和异步可取消请求两个示例，并明确 `waitForDependencies()` 的使用时机。

- [x] **步骤 4：补齐 `dependencies` 字段表和执行规则**

对照 `SchemxDependencies` 记录 `triggerFields` 及全部可动态计算的字段，说明触发字段、条件函数参数、静态回退值和批量更新行为。示例至少同时展示 `visible`、`required`、`rules` 和 `componentProps`。

- [x] **步骤 5：完整记录 `CreateFormOptions`**

对照 `packages/core/src/createForm.ts` 逐字段记录表单初始值、Schemas、默认 Props、Registry、提交回调和生命周期 Hooks。每个回调注明参数和调用条件。

- [x] **步骤 6：完整记录 `SchemxInstance`**

按以下分类逐方法记录签名摘要、用途和返回值：

```text
值与快照
初始值
touched / pending
校验与错误
提交与重置
响应式订阅
Schema 更新
默认配置
ViewSchemas 与依赖等待
Renderer / Validator
生命周期与销毁
```

预期：`packages/core/src/types/form.ts` 中每个公开成员都能在表格中检索到。

### 任务 3：完整化 Core 的进阶 API 与类型文档

**文件：**
- 修改：`packages/core/README.md`
- 读取：`packages/core/src/createSchemas.ts`
- 读取：`packages/core/src/createField.ts`
- 读取：`packages/core/src/createWatch.ts`
- 读取：`packages/core/src/createEffect.ts`
- 读取：`packages/core/src/registry/index.ts`
- 读取：`packages/core/src/validator/index.ts`
- 读取：`packages/core/src/view/index.ts`
- 读取：`packages/core/src/utils/index.ts`
- 读取：`packages/core/src/types/index.ts`

- [x] **步骤 1：记录 Schema 集合 API**

补齐 `createSchemas` 的空参数和初始数组重载、`isSchemxSchemas`、集合读取/订阅/替换行为，以及 `SchemxSchemas`、`SchemxSchemasInput`、`SchemxSchemasListener`。

- [x] **步骤 2：记录字段实例 API**

补齐 `createField`、`SchemxFieldInstance` 的值、状态、校验和销毁能力，说明它与 `form` 实例之间的关系。

- [x] **步骤 3：记录 Watch 与 Effect**

分别记录 `createWatch`、`createWatchField`、`createWatchFields`、`createWatchAll`、`createEffect` 的签名、依赖追踪方式、立即执行选项、清理函数和返回的取消订阅函数。

- [x] **步骤 4：记录 Registry 与 Validator**

补齐 `createRendererRegistry`、`createValidatorsRegistry`、`createValidator`、内置规则、注册/覆盖/查询方法和所有公开 Registry 类型。增加 RendererDefinition 与 RuleDefinition 声明合并示例。

- [x] **步骤 5：记录 ViewSchemas**

区分原始 Schema、Resolved Schema 和 ViewSchema，逐项说明 `SchemxViewFieldSchema`、`SchemxViewGroupSchema`、`SchemxViewSchema`、`SchemxViewDebugMeta`，并展示订阅和读取示例。

- [x] **步骤 6：记录公开工具与类型工具**

对照根入口，只记录实际公开的以下工具：

```text
isBaseSchema、isGroupSchema、isDependencySchema、
isBaseResolvedSchema、isGroupResolvedSchema、
getByPath、setByPath、collectObjectPathsByLeaf
```

类型章节覆盖 Values、NamePath、FieldValue、DeepReadonly、CSSProperties、ValidationTrigger、StandardSchemaV1、Dynamic、Schema 联合类型、依赖类型和扩展接口。

- [x] **步骤 7：写入 Core 完整导出清单**

用“分类、导出、用途”三列表格列出任务 1 获取的每个 Core 根入口符号，并明确 Core 没有默认导出，`createForm` 是命名导出。

### 任务 4：完整化 Vue 组件、Renderer 与 Dictionary 文档

**文件：**
- 修改：`packages/vue/README.md`
- 读取：`packages/vue/src/form.ts`
- 读取：`packages/vue/src/types/form.ts`
- 读取：`packages/vue/src/types/field.ts`
- 读取：`packages/vue/src/types/dictionary.ts`
- 读取：`packages/vue/src/hooks/useDictionary.ts`
- 读取：`packages/vue/src/hocs/withRemoteOptions.ts`
- 读取：`packages/vue/src/components/FormItem/index.vue`
- 读取：`packages/vue/src/components/FormGroup/index.vue`

- [x] **步骤 1：建立 Vue README 完整章节**

采用以下一级章节：

```markdown
## 安装与样式
## 快速开始
## Schemx 组件
## Schema 写法
## Dictionary
## 自定义 Renderer
## WithRemoteOptions
## Composition API
## FormItem 与 FormGroup
## Registry
## 类型参考
## Core API
## 完整导出清单
```

- [x] **步骤 2：完整记录 `Schemx` 组件契约**

对照 `SchemxProps`、Vue 组件声明和 `SchemxInstallOptions`，分别列出 Props、`v-model`、Events、Slots、组件 `ref` 暴露实例和 `app.use()` 配置。说明 `initialValues` 与 `modelValue` 的职责差异。

- [x] **步骤 3：完整记录 Dictionary 配置类型**

对照 `SchemxDictionary<T, R>` 逐字段记录：

```text
静态/请求数据来源
请求参数与返回值转换
依赖字段
立即加载与刷新条件
选项 label/value 映射
错误处理相关回调
```

字段名称必须直接取自源码，不使用上述概念名替代真实属性名。示例覆盖静态字典、异步字典和依赖字段字典。

- [x] **步骤 4：完整记录 `useDictionary`**

列出函数泛型、`options`、`fieldName` 和 `UseDictionaryReturn` 的全部成员，说明 loading、错误、刷新、取消过期请求以及表单字段依赖的行为。

- [x] **步骤 5：记录 `SchemxWithDictionary` 与 `WithRemoteOptions`**

说明前者如何扩展 Renderer Props，后者如何读取 `dict`、调用 `useDictionary` 并注入 `options`/`loading`。提供自定义 Select Renderer 的完整包装示例。

- [x] **步骤 6：完整记录自定义 Renderer 协议**

列出公共 Props、更新事件、change/blur 触发时机、fieldName、只读/禁用状态、错误展示和 `componentProps` 透传边界。保留全局 Registry 与表单独立 Registry 两种注册示例。

- [x] **步骤 7：记录 `FormItem` 与 `FormGroup`**

对照组件 Props 和 Slots 逐项记录公开契约，说明它们通常由 `Schemx` 内部消费，也可用于自定义 Adapter。

### 任务 5：完整化 Vue Composition API 与类型文档

**文件：**
- 修改：`packages/vue/README.md`
- 读取：`packages/vue/src/hooks/index.ts`
- 读取：`packages/vue/src/hooks/useForm.ts`
- 读取：`packages/vue/src/hooks/useField.ts`
- 读取：`packages/vue/src/hooks/provideFormContext.ts`
- 读取：`packages/vue/src/hooks/provideFieldContext.ts`
- 读取：`packages/vue/src/hooks/provideFormConfigContext.ts`
- 读取：`packages/vue/src/hooks/useWatch.ts`
- 读取：`packages/vue/src/hooks/useEffect.ts`
- 读取：`packages/vue/src/hooks/useStableRef.ts`
- 读取：`packages/vue/src/hooks/useViewSchemas.ts`
- 读取：`packages/vue/src/types/index.ts`

- [x] **步骤 1：逐个记录所有 Composition API**

每个 Hook 采用“签名、参数、返回值、上下文要求、生命周期、示例”格式，覆盖：

```text
useForm
createFormContext / useFormContext
useField
createFieldContext / useFieldContext
createFormConfigContext / useFormConfigContext
useWatch / useWatchField / useWatchFields / useWatchAll
useDictionary
useEffect
useStableRef
useViewSchemas
```

- [x] **步骤 2：明确 Context 职责**

记录 `useForm()` 不自动 provide；三个 `create*Context()` 分别提供表单实例、字段实例和表单展示配置；对应的 `use*Context()` 只负责读取。

- [x] **步骤 3：记录 Vue 自有类型**

逐项覆盖 `SchemxInstallOptions`、`SchemxDictionary`、`SchemxWithDictionary`、`UseDictionaryReturn`、`FormContextProps` 以及 `packages/vue/src/types` 最终从根入口可见的其他公开类型。

- [x] **步骤 4：写入 Vue 完整导出清单**

按“Vue 自有运行时、Vue 自有类型、从 Core 重新导出”分类列出任务 1 获取的全部符号。默认组件和 `schemxForm` 指向同一组件的关系需要明确。

### 任务 6：完整化 Vant Renderer 与 Dictionary 文档

**文件：**
- 修改：`packages/vant/README.md`
- 读取：`packages/vant/src/renderers/index.ts`
- 读取：`packages/vant/src/renderers/defaultRenderers.ts`
- 读取：`packages/vant/src/types/schemx.ts`
- 读取：`packages/vant/src/renderers/*/types.ts`
- 读取：`packages/vant/src/renderers/*/index.vue`
- 读取：`packages/vant/src/renderers/*/index.ts`

- [x] **步骤 1：建立 Vant README 完整章节**

采用以下一级章节：

```markdown
## 安装与样式
## 快速开始
## Renderer 总览
## Dictionary
## Renderer API
## 公共组件与工具
## 默认注册行为
## 类型参考
## Vue 与 Core API
## 完整导出清单
```

- [x] **步骤 2：建立 18 个 Renderer 总览矩阵**

每行列出：

```text
componentType、导出组件、值类型、选项类型、支持 dict、主要 Vant 组件
```

Renderer 必须与 `DEFAULT_RENDERER_TYPES` 一一对应：input、text、textarea、number、switch、radio、checkbox、date、calendar、picker、selectPicker、selector、sensitiveInput、rate、slider、stepper、upload、cascader。

- [x] **步骤 3：核对 Dictionary 支持矩阵**

同时检查 `types/schemx.ts` 的类型注入和每个 Renderer 的运行时包装。只有两者一致时才标记“完整支持”；若 Cascader 当前只完成运行时包装但类型未注入 `SchemxWithDictionary`，记录为源码与类型不一致并暂停该项文档定稿。

- [x] **步骤 4：逐项记录 Renderer API**

18 个 Renderer 均使用固定模板：

```markdown
### `<componentType>` / `<ExportedRenderer>`

- 值类型：`<ValueType>`
- Props：继承 `<VantProps>`，排除或重写 `<fields>`
- Schemx 扩展：`<package-defined fields>`
- Dictionary：支持/不支持，选项结构为 `<OptionType>`
- 行为：格式化、确认、清空、只读与禁用规则
```

每个包自定义 Props 字段都进入表格；Date、Calendar、Upload、Picker、SelectPicker、Cascader 等存在转换逻辑的 Renderer 各提供一个示例。

- [x] **步骤 5：记录辅助类型与函数**

逐项记录各 Renderer 根入口导出的 Props、Value、Option、FieldNames、Autosize、ConfirmEventParams、MaskFormatter 等类型，以及 `defaultMaskFormatter` 和 `DEFAULT_RENDERER_TYPES`。

### 任务 7：完整化 Vant 公共组件、工具与聚合导出文档

**文件：**
- 修改：`packages/vant/README.md`
- 读取：`packages/vant/src/components/Cell/index.vue`
- 读取：`packages/vant/src/utils/index.ts`
- 读取：`packages/vant/src/index.ts`
- 读取：`packages/vue/src/index.ts`
- 读取：`packages/core/src/index.ts`

- [x] **步骤 1：记录 `Cell` 组件**

列出公开 Props、Slots 和只读展示职责，说明哪些 Renderer 会复用该组件。

- [x] **步骤 2：记录 Vant 公开工具函数和类型**

对照 `utils/index.ts`，逐项记录只读值判断、显示值转换、Renderer 模式解析和交互判断工具的参数、返回值与适用场景。

- [x] **步骤 3：记录默认注册副作用**

说明导入 `@schemx/vant` 会自动向 Vue 全局 `rendererRegistry` 注册 18 个默认 Renderer；记录自定义覆盖方式和 `DEFAULT_RENDERER_TYPES` 的用途。

- [x] **步骤 4：记录 Vue/Core 聚合能力**

明确默认导出、`SchemxForm`、Vue Hooks、Registry 和全部 Core API 的来源。详细说明通过章节锚点复用，但所有传递导出名称仍进入完整导出清单。

- [x] **步骤 5：写入 Vant 完整导出清单**

按“组件、Renderer、工具、Renderer 类型、Vue 重新导出、Core 传递导出”分类列出任务 1 获取的每个符号。

### 任务 8：执行机械完整性核对

**文件：**
- 验证：`packages/core/README.md`
- 验证：`packages/vue/README.md`
- 验证：`packages/vant/README.md`

- [x] **步骤 1：运行根入口导出覆盖检查**

运行：

```bash
node --input-type=module -e '
import fs from "node:fs";
import ts from "typescript";
let failed = false;
for (const pkg of ["core", "vue", "vant"]) {
  const file = `packages/${pkg}/dist/index.d.ts`;
  const readme = fs.readFileSync(`packages/${pkg}/README.md`, "utf8");
  const program = ts.createProgram([file], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const missing = checker.getExportsOfModule(moduleSymbol)
    .map((symbol) => symbol.getName())
    .filter((name) => name !== "default" && !readme.includes(name))
    .sort();
  console.log(`${pkg}: ${missing.length ? `缺少 ${missing.join(", ")}` : "完整"}`);
  failed ||= missing.length > 0;
}
process.exitCode = failed ? 1 : 0;
'
```

预期：

```text
core: 完整
vue: 完整
vant: 完整
```

- [x] **步骤 2：检查关键语法覆盖**

运行：

```bash
rg -n "SchemxBaseField|SchemxGroupField|SchemxDependencyField|SchemxDependencies|CreateFormOptions|SchemxInstance" packages/core/README.md
rg -n "dict|SchemxDictionary|SchemxWithDictionary|useDictionary|WithRemoteOptions" packages/vue/README.md
rg -n "DEFAULT_RENDERER_TYPES|Dictionary|CascaderRenderer|SelectPickerRenderer|SensitiveInputRenderer" packages/vant/README.md
```

预期：每个关键词均至少匹配一次，并分别出现在语法说明或 API 表格中，而不只是完整导出清单。

- [x] **步骤 3：检查过期说明**

运行：

```bash
rg -n "vite-plugin-package-resolution-compat|createPackageResolutionCompatPlugin|compileToDescriptors|viewGraph" packages/core/README.md packages/vue/README.md packages/vant/README.md
```

预期：无匹配。

### 任务 9：格式、测试与发布前验证

**文件：**
- 验证：`packages/core/README.md`
- 验证：`packages/vue/README.md`
- 验证：`packages/vant/README.md`
- 验证：当前工作区全部既有改动

- [x] **步骤 1：格式化三个 README**

运行：

```bash
pnpm exec prettier --write packages/core/README.md packages/vue/README.md packages/vant/README.md
pnpm exec prettier --check packages/core/README.md packages/vue/README.md packages/vant/README.md
```

预期：第二条命令报告 3 个文件均符合格式要求。

- [ ] **步骤 2：运行三个包测试**

运行：

```bash
pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... test
```

预期：Core、Vue 和 Vant 全部测试通过。

- [x] **步骤 3：运行三个包类型检查**

运行：

```bash
pnpm --filter @schemx/core... --filter @schemx/vue... --filter @schemx/vant... type-check
```

预期：三个包全部退出码为 0。

- [ ] **步骤 4：运行完整发布前检查**

运行：

```bash
CI=true pnpm release:check
```

预期：依赖一致性、包配置、测试、lint、构建和 pack dry-run 全部通过。

验证结果：未满足。Core 378 个测试中有 1 个既有源码用例失败：
`compiler.test.ts` 期望 `staticSchema.contentAlign` 为 `"center"`，实际为
`undefined`。`release:check` 在测试阶段停止。按用户要求，本次只在文档中
记录源码、类型与运行时差异，不修改该运行时问题。Vue 37 个测试与 Vant
56 个测试通过；三包 type-check、独立 lint、build 和 pack dry-run 通过。

- [x] **步骤 5：检查最终差异**

运行：

```bash
git diff --check
git status --short
```

预期：`git diff --check` 无输出；状态中保留用户原有源码改动，并只新增本次规格、计划和三个 README 修改，不包含 `dist`、`tsconfig.tsbuildinfo` 或 tarball 等生成文件。

- [x] **步骤 6：汇报结果但不提交**

最终说明必须包含：三个 README 的新增范围、Dictionary 支持边界、公开导出覆盖检查结果、测试结果、已知 warning，以及所有仍未解决的源码/类型不一致。不得执行 `git add` 或 `git commit`。
