# @schemx/vue

`@schemx/vue` 将 `@schemx/core` 的表单实例和 ViewSchemas 渲染为 Vue 组件树。它不绑定具体 UI 组件库，适合接入业务组件、设计系统或新的 UI adapter。

如果项目使用 Vant，推荐直接安装 [`@schemx/vant`](../vant)。该包已经注册好常用移动端表单 renderer。

## 特性

- 提供 Vue 3 表单组件和 Composition API。
- 通过 `rendererRegistry` 注册自定义 renderer。
- 支持 `v-model`、`initialValues`、表单级事件和实例方法。
- 复用 `@schemx/core` 的字段依赖、校验、运行时 schema node 和 ViewSchemas。
- 直接导出 `@schemx/core` 的公开类型与工具。

## 安装

```bash
pnpm add @schemx/vue @schemx/core vue
```

`@schemx/core` 是 `@schemx/vue` 的 peer dependency，业务项目需要显式安装。

## 快速开始

`@schemx/vue` 默认不提供具体输入控件。使用前需要注册 renderer：

```ts
import { markRaw } from "vue"

import { rendererRegistry } from "@schemx/vue"

import InputRenderer from "./components/InputRenderer.vue"

rendererRegistry.register("input", markRaw(InputRenderer))
```

然后通过默认导出的 `Schemx` 组件渲染表单：

```vue
<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vue"

  import type { SchemxField } from "@schemx/vue"

  type ProfileValues = {
    nickname: string
  }

  const formData = ref<ProfileValues>({
    nickname: "",
  })

  const schemas: SchemxField<ProfileValues>[] = [
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
      rules: "required",
      placeholder: "请输入昵称",
    },
  ]
</script>

<template>
  <Schemx v-model="formData" :schemas="schemas" />
</template>
```

`@schemx/vue` 的 ESM 入口会自动加载基础样式，常规 Vite / Vue 项目不需要手动引入。直接使用 CommonJS 入口或构建工具未处理入口 CSS import 时，请显式引入 `@schemx/vue/style.css`。

## 自定义 Renderer

renderer 会接收到 `value`、`onUpdate:value`、`onChange`、`onBlur`、`readonly`、`disabled` 和 `placeholder` 等公共属性。可以使用标准 Vue 事件更新字段值：

```vue
<script setup lang="ts">
  defineProps<{
    value?: string
    readonly?: boolean
    disabled?: boolean
    placeholder?: string
  }>()

  const emit = defineEmits<{
    "update:value": [value: string]
    change: [value: string]
    blur: [value: string]
  }>()
</script>

<template>
  <input
    :value="value"
    :readonly="readonly"
    :disabled="disabled"
    :placeholder="placeholder"
    @input="emit('update:value', ($event.target as HTMLInputElement).value)"
    @change="emit('change', ($event.target as HTMLInputElement).value)"
    @blur="emit('blur', ($event.target as HTMLInputElement).value)"
  />
</template>
```

也可以为单个表单实例传入独立的 registry：

```ts
import { createRendererRegistry } from "@schemx/vue"

const rendererRegistry = createRendererRegistry("input")

rendererRegistry.register("input", InputRenderer)
```

```vue
<Schemx :schemas="schemas" :renderer-registry="rendererRegistry" />
```

## Composition API

| API                         | 说明                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `useForm()`                 | 创建由当前 Vue effect scope 管理生命周期的表单实例；不会自动执行 `provide` |
| `createFormContext()`       | 向后代组件提供表单实例                                                     |
| `useFormContext()`          | 获取上层提供的表单实例                                                     |
| `useField()`                | 创建字段级读写、校验和状态控制器                                           |
| `createFieldContext()`      | 向后代组件提供字段控制器                                                   |
| `useFieldContext()`         | 获取当前字段控制器                                                         |
| `createFormConfigContext()` | 向后代组件提供表单展示配置                                                 |
| `useFormConfigContext()`    | 获取上层提供的表单展示配置                                                 |
| `useWatch()`                | 按单字段、多字段或全表签名监听变化                                         |
| `useWatchField()`           | 监听单个字段                                                               |
| `useWatchFields()`          | 监听多个字段                                                               |
| `useWatchAll()`             | 监听整张表单                                                               |
| `useDictionary()`           | 管理依赖字段的远程或本地选项                                               |
| `useEffect()`               | 创建字段依赖追踪 effect，并在 scope 销毁时清理                             |
| `useStableRef()`            | 创建引用保持稳定的 `shallowRef`                                            |
| `useViewSchemas()`          | 把 `subscribeViewSchemas()` 桥接为 Vue `shallowRef`                        |

## 根入口导出

以下内容均可直接从 `@schemx/vue` 引入：

| 分类            | API                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| 表单组件        | 默认导出的表单组件、命名导出的 `schemxForm`、`FormItem`、`FormGroup`                                          |
| 全局注册表      | `rendererRegistry`、`validatorRegistry`                                                                       |
| Composition API | 上表中的全部 context、field、watch、dictionary、effect 和 ViewSchemas API                                     |
| 高阶组件        | `WithRemoteOptions`                                                                                           |
| 类型            | `SchemxInstallOptions`、`SchemxDictionary`、`SchemxWithDictionary`、`UseDictionaryReturn`、`FormContextProps` |
| Core API        | `@schemx/core` 根入口的全部公开 API 与类型                                                                    |

`schemxForm` 与默认导出指向同一个可安装组件。`@schemx/vue` 不额外导出命名为 `SchemxForm` 的组件；需要该命名时，可以在业务代码中自行给默认导入命名。

## Adapter 边界

Vue 适配层只负责将 core 输出的 ViewSchemas 映射为 Vue 组件树。descriptor 编译、dependency 执行、validation、scheduler 和 node 生命周期由 `@schemx/core` 管理。

自定义 adapter 应优先使用 `form.getViewSchemas()`、`form.subscribeViewSchemas()` 和 `form.registerRenderer()` 等公开 API，避免依赖 core 内部目录。
