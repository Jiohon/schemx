<template>
  <div class="example-container">
    <h2>基础表单示例</h2>
    <p class="description">
      演示基础字段类型（text、input、number、textarea）、初始值、labelPosition、labelWidth、colon
      等配置
    </p>

    <schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      :initial-values="initialValues"
      label-width="100px"
      label-align="right"
      label-position="left"
      :colon="true"
      @finish="handleSubmit"
      @values-change="handleValuesChange"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="formRef?.validate()">校验</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
      <button class="btn" @click="handleSetValues">设置值</button>
      <button class="btn" @click="handleGetSnapshot">获取快照</button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"

  import schemx from "@schemx/vue"

  import type { SchemaField, SchemxInstance } from "@schemx/vue"

  const formRef = ref<SchemxInstance>()
  const formData = ref<Record<string, any>>({})

  // 初始值
  const initialValues = {
    username: "张三",
    age: 25,
  }

  // 表单配置
  const schemas: SchemaField[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: true,
      componentProps: {
        placeholder: "请输入用户名",
        clearable: true,
      },
    },
    {
      name: "nickname",
      label: "昵称",
      componentType: "input",
      componentProps: {
        placeholder: "请输入昵称",
      },
    },
    {
      name: "age",
      label: "年龄",
      componentType: "number",
      componentProps: {
        min: 0,
        max: 150,
      },
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      componentProps: {
        placeholder: "请输入邮箱地址",
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
      name: "website",
      label: "个人网站",
      componentType: "input",
      componentProps: {
        placeholder: "请输入个人网站地址",
      },
    },
    // labelPosition: top 示例
    {
      name: "address",
      label: "详细地址",
      componentType: "textarea",
      labelPosition: "top",
      componentProps: {
        placeholder: "请输入详细地址",
      },
    },
  ]

  // 提交处理
  const handleSubmit = (values: Record<string, any>) => {
    console.log("表单提交:", values)
    alert("提交成功！数据已打印到控制台")
  }

  // 值变化处理
  const handleValuesChange = (
    changedValues: Record<string, any>,
    latestValues: Record<string, any>
  ) => {
    console.log("值变化:", changedValues, latestValues)
  }

  // 手动设置值
  const handleSetValues = () => {
    formRef.value?.setFieldsValue({
      username: "李四",
      age: 30,
      email: "example@test.com",
    })
  }

  // 获取快照
  const handleGetSnapshot = () => {
    const snapshot = formRef.value?.getFieldsSnapshot()
    console.log("表单快照:", snapshot)
    alert("快照已打印到控制台")
  }
</script>

<style scoped>
  .example-container {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .example-container h2 {
    margin-bottom: 8px;
    color: #333;
  }

  .description {
    margin-bottom: 20px;
    color: #666;
    font-size: 14px;
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
