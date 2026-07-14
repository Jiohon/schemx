# @schemx/vant 示例

本目录是 `@schemx/vant` 的 Vue 3 + Vant 4 示例项目，用于验证内置 renderer、字段联动、校验、插槽和运行时 schema 更新能力。

## 示例列表

1. **basic**：基础表单示例，覆盖内置 Vant renderer、`initialValues`、实例方法和实时数据预览。
2. **validation**：表单校验示例，覆盖必填、正则、Zod 规则和提交失败处理。
3. **dynamic**：动态表单示例，覆盖字段联动、条件显示、动态属性和运行时 schema 更新。
4. **dependency**：`componentType: "dependency"` 示例，覆盖复杂条件子树和嵌套 dependency。
5. **slots**：插槽示例，覆盖 `FieldItem`、`FieldGroup` 和 renderer slot 的自定义展示。
6. **slots-jsx**：JSX 插槽示例，展示通过 TSX 编写插槽内容。

## 运行示例

```bash
# 在仓库根目录（交互选择目标，选 Examples · vant）
pnpm dev

# 或只运行示例包
pnpm --filter vant-demo dev
```

然后在浏览器中访问 <http://localhost:5173> 查看示例。

## 快速开始

```vue
<template>
  <Schemx v-model="formData" :schemas="schemas" @finish="handleSubmit" />
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import Schemx from "@schemx/vant"

  import type { SchemxField } from "@schemx/vant"

  const formData = ref({})

  const schemas: SchemxField[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "input",
      rules: "required",
      placeholder: "请输入用户名",
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "input",
      placeholder: "请输入邮箱",
    },
  ]

  function handleSubmit(values: Readonly<Record<string, unknown>>) {
    console.log("提交数据：", values)
  }
</script>
```
