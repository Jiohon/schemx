<template>
  <div class="example-container">
    <h2>自定义渲染器示例</h2>
    <p class="description">演示如何注册和使用自定义渲染器</p>

    <SchemaForm
      ref="formRef"
      :form="form"
      v-model="formData"
      :columns="columns"
      :footer="true"
      submit-button-text="提交"
      @finish="handleSubmit"
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
  import SchemaForm, { useForm } from "@"

  import type { SchemaColumn, FormInstance } from "@"

  // ==================== 表单配置 ====================
  // 注意：自定义渲染器需要在 SchemaForm 外部注册
  // 这里演示的是使用 slot 方式实现自定义渲染

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
      componentType: "color", // 使用 slot 覆盖
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
      name: "rating",
      label: "评分",
      componentType: "rate", // 使用内置 rate 渲染器
      componentProps: {
        count: 5,
      },
      rules: z.number().min(1, "请选择评分"),
    },
    {
      name: "tags",
      label: "标签",
      componentType: "text", // 使用 slot 覆盖
      componentProps: {
        placeholder: "输入标签后按回车",
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
  ]

  const formRef = ref<FormInstance>()
  const formData = ref<Record<string, any>>({
    color: "#1989fa",
    rating: 3,
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

  /* 颜色选择器样式 */
  :deep(.color-picker) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  :deep(.color-item) {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  :deep(.color-item:hover) {
    transform: scale(1.1);
  }

  :deep(.color-item.active) {
    border-color: #333;
  }

  :deep(.current-color) {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 16px;
    font-size: 12px;
    color: #666;
  }

  :deep(.color-preview) {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  /* 星级评分样式 */
  :deep(.star-rating) {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  :deep(.star) {
    font-size: 24px;
    cursor: pointer;
    color: #ddd;
    transition: color 0.2s;
  }

  :deep(.star.active) {
    color: #ffcc00;
  }

  :deep(.star:hover) {
    color: #ffdd00;
  }

  :deep(.rating-text) {
    margin-left: 12px;
    font-size: 14px;
    color: #666;
  }

  /* 标签输入样式 */
  :deep(.tag-input) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  :deep(.tags) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  :deep(.tag) {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    background: #1989fa;
    color: white;
    border-radius: 4px;
    font-size: 12px;
  }

  :deep(.tag-close) {
    margin-left: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  :deep(.tag-close:hover) {
    color: #ffcc00;
  }

  :deep(.tag-input-field) {
    flex: 1;
    min-width: 120px;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    outline: none;
  }

  :deep(.tag-input-field:focus) {
    border-color: #1989fa;
  }
</style>
