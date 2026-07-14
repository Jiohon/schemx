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

### uni-app 兼容配置

在 pnpm workspace 或本地 tarball 场景中，uni-app 的 H5 开发服务器可能无法从 `@schemx/*` 包中继续解析 `classnames`、`dayjs`、`es-toolkit` 等依赖。此时安装兼容插件：

```bash
pnpm add -D @schemx/vite-plugin-package-resolution-compat
```

然后在 uni-app 项目的 `vite.config.ts` 中启用安装包解析兼容插件：

```ts
import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"
import { createPackageResolutionCompatPlugin } from "@schemx/vite-plugin-package-resolution-compat"

export default defineConfig({
  plugins: [
    createPackageResolutionCompatPlugin({
      packages: ["@schemx/core", "@schemx/vue", "@schemx/vant"],
      fallbackDependencies: [
        "@preact/signals-core",
        "es-toolkit",
        "csstype",
        "classnames",
        "dayjs",
        "@vant/use",
        "vant",
      ],
    }),
    uni(),
  ],
})
```

该插件会将 `@schemx/*` 排除在 Vite 依赖预构建之外，并在普通解析阶段使用 importer 的真实路径重试依赖解析。普通 Vite / Vue 项目没有上述依赖解析错误时，不需要安装或启用该插件。

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

`@schemx/vant` 的 ESM 入口会自动加载自身样式和 `@schemx/vue` 基础样式。直接使用 CommonJS 入口或构建工具未处理入口 CSS import 时，请显式引入 `@schemx/vant/style.css` 和 `@schemx/vue/style.css`。上面的 `vant/lib/index.css` 是 Vant 组件库样式；如果业务项目已经通过 Vant 插件或自动按需方案处理样式，可以省略这一行。

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

通过组件 `ref` 可以调用常用实例方法：

| 方法                         | 说明             |
| ---------------------------- | ---------------- |
| `submit()`                   | 校验并提交表单   |
| `validate()`                 | 校验整张表单     |
| `reset()`                    | 恢复初始值       |
| `setFieldValue(name, value)` | 设置单个字段值   |
| `setFieldsValue(values)`     | 批量设置字段值   |
| `getFieldsSnapshot()`        | 获取当前表单快照 |

## 相关包

- [`@schemx/core`](../core)：框架无关的 headless 表单引擎。
- [`@schemx/vue`](../vue)：Vue 3 适配层，可用于注册自定义 renderer。
