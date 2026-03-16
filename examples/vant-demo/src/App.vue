<script setup lang="ts">
  import { ref } from "vue"
  import schemx from "@schemx/vue"
  import { rendererRegistry } from "@schemx/core"
  import { registerDefaultRenderers } from "@schemx/vant"
  import type { SchemaField } from "@schemx/core"

  import "@schemx/vue/style.css"

  /** 注册 Vant 渲染器 */
  registerDefaultRenderers(rendererRegistry)

  /** 表单值 */
  const formValues = ref({})

  /** 表单列配置 */
  const schemas: SchemaField[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "input",
      placeholder: "请输入用户名",
      rules: "required",
    },
    {
      name: "age",
      label: "年龄",
      componentType: "stepper",
      initialValue: 18,
    },
    {
      name: "gender",
      label: "性别",
      componentType: "radio",
      componentProps: {
        options: [
          { label: "男", value: "male" },
          { label: "女", value: "female" },
        ],
      },
    },
    {
      name: "subscribe",
      label: "订阅通知",
      componentType: "switch",
      initialValue: true,
    },
  ]

  /** 提交回调 */
  function onFinish(values: Record<string, unknown>) {
    console.log("提交成功:", values)
  }

  /** 提交失败回调 */
  function onFinishFailed(errors: unknown[]) {
    console.log("校验失败:", errors)
  }
</script>

<template>
  <div style="padding: 16px">
    <h3 style="margin-bottom: 16px">schemx + Vant 示例</h3>
    <schemx
      v-model="formValues"
      :schemas="schemas"
      :on-finish="onFinish"
      :on-finish-failed="onFinishFailed"
      label-width="80px"
      label-align="left"
      label-position="left"
    />
  </div>
</template>
