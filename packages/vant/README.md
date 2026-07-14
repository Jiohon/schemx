# @schemx/vant

`@schemx/vant` 是基于 Vue 3 和 Vant 4 的 Schema 表单组件。导入该包时会自动注册默认 renderer，适合快速构建移动端动态表单。

## 特性

- 开箱即用的 Vue 3 + Vant 表单渲染。
- 内置 18 种常用 renderer，覆盖输入、脱敏输入、选择、日期、评分、上传等场景。
- 支持 `v-model`、`initialValues`、校验、表单实例方法和字段联动。
- 支持同步或异步 dictionary，可用于远程选项加载。
- 复用 `@schemx/vue` 和 `@schemx/core` 的表单能力，并重新导出常用 API。

## 安装

```bash
pnpm add @schemx/vant @schemx/vue @schemx/core vant vue
```

`@schemx/core`、`@schemx/vue`、`vant` 和 `vue` 都是 `@schemx/vant` 的 peer dependencies，业务项目需要显式安装。

业务项目直接引入 `@schemx/vant` 即可，不需要为该包额外配置 Schemx Vite 插件。

## 快速开始

```vue
<script setup lang="ts">
  import { ref } from "vue"
  import "vant/lib/index.css"

  import Schemx from "@schemx/vant"

  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  type ProfileValues = {
    name: string
    city: string
    notification: boolean
  }

  const formRef = ref<SchemxInstance<ProfileValues>>()
  const initialValues: ProfileValues = {
    name: "",
    city: "",
    notification: true,
  }
  const formData = ref<ProfileValues>({ ...initialValues })

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "name",
      label: "姓名",
      componentType: "input",
      rules: "required",
      placeholder: "请输入姓名",
    },
    {
      name: "city",
      label: "城市",
      componentType: "picker",
      componentProps: {
        options: [
          { text: "杭州", value: "hangzhou" },
          { text: "上海", value: "shanghai" },
        ],
      },
    },
    {
      name: "notification",
      label: "接收通知",
      componentType: "switch",
    },
  ]

  function handleFinish(values: Readonly<ProfileValues>) {
    console.log(values)
  }
</script>

<template>
  <Schemx
    ref="formRef"
    v-model="formData"
    :schemas="schemas"
    :initial-values="initialValues"
    @finish="handleFinish"
  />

  <button type="button" @click="formRef?.submit()">提交</button>
</template>
```

`@schemx/vant` 的 ESM 入口会自动加载自身样式和 `@schemx/vue` 基础样式，常规 Vite / Vue 项目不需要手动引入 Schemx 样式。直接使用 CommonJS 入口或构建工具未处理入口 CSS import 时，才需要显式引入 `@schemx/vant/style.css` 和 `@schemx/vue/style.css`。上面的 `vant/lib/index.css` 是 Vant 组件库样式；如果业务项目已经通过 Vant 官方插件或自动按需方案处理样式，可以省略这一行。

## 内置 Renderer

| `componentType`  | 说明          |
| ---------------- | ------------- |
| `text`           | 文本展示      |
| `input`          | 单行文本输入  |
| `sensitiveInput` | 脱敏输入      |
| `textarea`       | 多行文本输入  |
| `number`         | 数字输入      |
| `switch`         | 开关          |
| `radio`          | 单选          |
| `checkbox`       | 多选          |
| `date`           | 日期选择      |
| `calendar`       | 日历选择      |
| `picker`         | Picker 选择   |
| `selectPicker`   | 弹窗单选/多选 |
| `selector`       | 选项选择      |
| `rate`           | 评分          |
| `slider`         | 滑块          |
| `stepper`        | 步进器        |
| `upload`         | 文件上传      |
| `cascader`       | 级联选择      |

## 字段联动

使用 `dependencies` 可以根据其他字段的值动态调整字段状态：

```ts
const schemas: SchemxField[] = [
  {
    name: "accountType",
    label: "账号类型",
    componentType: "radio",
    componentProps: {
      options: [
        { label: "个人", value: "personal" },
        { label: "企业", value: "company" },
      ],
    },
  },
  {
    name: "companyName",
    label: "企业名称",
    componentType: "input",
    dependencies: {
      triggerFields: ["accountType"],
      visible: (values) => values.accountType === "company",
      required: (values) => values.accountType === "company",
    },
  },
]
```

## 表单实例

通过组件 `ref` 可以调用完整的 `SchemxInstance`：

| 分类       | 方法                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 值         | `getFieldValue`、`getFieldsValue`、`setFieldValue`、`setFieldsValue`                              |
| 快照       | `getFieldSnapshot`、`getFieldsSnapshot`                                                           |
| 初始值     | `getInitialValue`、`getInitialValues`、`setInitialValues`                                         |
| touched    | `isFieldTouched`、`setFieldTouched`、`getTouchedFields`                                           |
| pending    | `setFieldPending`、`isFieldPending`、`getPendingFields`                                           |
| 校验       | `registerRules`、`unregisterRules`、`validateField`、`validate`、`getFieldError`、`setFieldError` |
| 提交与重置 | `submit`、`reset`、`resetFields`                                                                  |
| 响应式     | `effect`、`batch`                                                                                 |
| schema     | `setSchemas`、`updateSchemas`、`updateFieldSchema`                                                |
| 默认配置   | `updateDefaultProps`                                                                              |
| view       | `getViewSchemas`、`subscribeViewSchemas`、`waitForDependencies`                                   |
| renderer   | `getRenderer`、`registerRenderer`、`hasRenderer`                                                  |
| validator  | `getValidator`、`registerValidator`、`hasValidator`                                               |
| 生命周期   | `destroy`                                                                                         |

## 根入口导出

以下内容均可直接从 `@schemx/vant` 引入：

| 分类            | API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 表单组件        | 默认导出、命名导出的 `SchemxForm`，以及 `@schemx/vue` 的全部组件与 API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Renderer 组件   | `InputRenderer`、`TextRenderer`、`TextAreaRenderer`、`SensitiveInputRenderer`、`NumberRenderer`、`SwitchRenderer`、`RadioRenderer`、`CheckboxRenderer`、`DateRenderer`、`CalendarRenderer`、`PickerRenderer`、`SelectPickerRenderer`、`SelectorRenderer`、`RateRenderer`、`SliderRenderer`、`StepperRenderer`、`UploadRenderer`、`CascaderRenderer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Renderer 类型   | `InputRendererProps`、`InputValue`、`TextRendererProps`、`TextValue`、`TextAreaRendererProps`、`TextAreaAutosize`、`TextAreaValue`、`SensitiveInputRendererProps`、`SensitiveInputValue`、`NumberRendererProps`、`NumberValue`、`SwitchRendererProps`、`SwitchValue`、`RadioRendererProps`、`RadioOption`、`RadioValue`、`CheckboxRendererProps`、`CheckboxOption`、`CheckboxValue`、`DateRendererProps`、`DateValue`、`CalendarRendererProps`、`CalendarValue`、`PickerRendererProps`、`PickerFieldNames`、`PickerValue`、`SelectPickerFieldNames`、`SelectPickerOption`、`SelectPickerRendererProps`、`SelectPickerValue`、`SelectorRendererProps`、`SelectorOption`、`SelectorProps`、`SelectValue`、`RateRendererProps`、`RateValue`、`SliderRendererProps`、`SliderValue`、`StepperRendererProps`、`StepperValue`、`UploadRendererProps`、`UploadFile`、`UploadValue`、`CascaderRendererProps`、`CascaderFieldNames`、`CascaderValue` |
| Renderer 元数据 | `DEFAULT_RENDERER_TYPES`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 基础组件        | `Cell`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 工具            | `getFieldProps`、`isEmptyDisplayValue`、`getReadonlyDisplayValue`、`resolveRendererMode`、`isRendererInteractive`、`findTreeItem`、`getFileName`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 工具类型        | `RendererMode`、`FindTreeItemResult`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Vue 与 Core API | `@schemx/vue` 根入口的全部公开 API 与类型，包含 `@schemx/core` 的公开导出                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 相关包

- [`@schemx/core`](../core)：框架无关的 headless 表单引擎。
- [`@schemx/vue`](../vue)：Vue 3 适配层，可用于注册自定义 renderer。
