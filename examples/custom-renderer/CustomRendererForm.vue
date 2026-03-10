<template>
  <div class="example-container">
    <h2>自定义渲染器示例</h2>
    <p class="description">演示如何注册和使用自定义渲染器</p>

    <SchemaForm
      ref="formRef"
      :form="form"
      v-model="formData"
      :columns="columns"
      @finish="handleSubmit"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="formRef?.validate()">校验</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
    </div>

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"
  import { z } from "zod"
  import SchemaForm, { useForm } from "@"

  import type { SchemaColumn, SchemaFormInstance } from "@"

  // 注意：自定义渲染器（color、starRating、tagInput）在 main.ts 中通过 globalRegistry 注册

  const columns: SchemaColumn[] = [
    {
      name: "title",
      label: "标题",
      componentType: "text",
      required: true,
      rules: z.string().min(1, "请输入标题"),
    },
    {
      name: "color",
      label: "主题颜色",
      componentType: "color", // 自定义渲染器
      componentProps: {
        colors: [
          "#1989fa",
          "#07c160",
          "#ee0a24",
          "#ff976a",
          "#ffdd00",
          "#7232dd",
          "#000000",
        ],
      },
    },
    {
      name: "tags",
      label: "标签",
      componentType: "text",
      componentProps: {
        placeholder: "输入标签，用逗号分隔",
      },
    },
    {
      name: "description",
      label: "描述",
      componentType: "textarea",
      componentProps: {
        placeholder: "请输入描述",
        maxlength: 200,
      },
    },
    {
      name: "priority",
      label: "优先级",
      componentType: "number",
      componentProps: {
        min: 1,
        max: 10,
      },
    },
  ]

  const formRef = ref<SchemaFormInstance>()
  const formData = ref<Record<string, any>>({
    color: "#1989fa",
    priority: 5,
  })

  const form = useForm({ initialValues: formData.value, columns })

  // 提交处理
  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
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
