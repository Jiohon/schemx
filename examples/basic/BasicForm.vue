<template>
  <div class="example-container">
    <h2>基础表单示例</h2>

    <SchemaForm
      ref="formRef"
      v-model="formData"
      :columns="columns"
      :initial-values="initialValues"
      :footer="true"
      submit-button-text="提交"
      @onFinish="handleSubmit"
      @values-change="handleValuesChange"
    />

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"
  import { z } from "zod"
  import SchemaForm from "@"
  import type { SchemaColumn, FormInstance } from "@"

  const formRef = ref<FormInstance>()
  const formData = ref<Record<string, any>>({})

  // 初始值
  const initialValues = {
    username: "张三",
    gender: "male",
    age: 25,
  }

  // 表单配置（使用 Zod schema 作为验证规则）
  const columns: SchemaColumn[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: true,
      rules: z.string().min(2, "用户名至少 2 个字符").max(20, "用户名最多 20 个字符"),
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      componentProps: {
        placeholder: "请输入邮箱地址",
      },
      rules: z.string().email("请输入有效的邮箱地址").optional().or(z.literal("")),
    },
    {
      name: "phone",
      label: "手机号",
      componentType: "text",
      componentProps: {
        placeholder: "请输入手机号",
        maxlength: 11,
      },
      rules: z
        .string()
        .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号")
        .optional()
        .or(z.literal("")),
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
      name: "age",
      label: "年龄",
      componentType: "stepper",
      componentProps: {
        min: 0,
        max: 150,
      },
      rules: z.number().min(0, "年龄不能为负数").max(150, "年龄不能超过 150"),
    },
    {
      name: "birthday",
      label: "生日",
      componentType: "date",
      componentProps: {
        placeholder: "请选择生日",
      },
    },
    {
      name: "bio",
      label: "个人简介",
      componentType: "textarea",
      componentProps: {
        placeholder: "请输入个人简介",
        maxlength: 200,
        showWordLimit: true,
      },
    },
    {
      name: "subscribe",
      label: "订阅通知",
      componentType: "switch",
    },
    {
      label: "订阅通知",
      componentType: "group",
      columns: [
        {
          name: "subscribe1",
          label: "订阅通知1",
          componentType: "switch",
        },
        {
          componentType: "dependency",
          to: ["subscribe11"],
          renderer: () => {
            return []
          },
        },
      ],
    },
    {
      label: "group",
      componentType: "group",
      columns: [],
    },
  ]

  // 提交处理
  const handleSubmit = (values: Record<string, any>, done: () => void) => {
    console.log("表单提交:", values)

    // 模拟异步提交
    setTimeout(() => {
      alert("提交成功！")
      done()
    }, 1000)
  }

  // 值变化处理
  const handleValuesChange = (
    changedValues: Record<string, any>,
    latestValues: Record<string, any>
  ) => {
    console.log("值变化:", changedValues, latestValues)
  }

  // 暴露方法供外部调用
  defineExpose({
    // 重置表单
    reset: () => formRef.value?.reset(),
    // 获取表单数据
    getData: () => formRef.value?.getFieldsValue(),
    // 设置表单数据
    setData: (values: Record<string, any>) => formRef.value?.setFieldsValue(values),
  })
</script>

<style scoped>
  .example-container {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .example-container h2 {
    margin-bottom: 20px;
    color: #333;
  }

  .form-data-preview {
    margin-top: 24px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .form-data-preview h3 {
    margin-bottom: 12px;
    font-size: 14px;
    color: #666;
  }

  .form-data-preview pre {
    margin: 0;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
