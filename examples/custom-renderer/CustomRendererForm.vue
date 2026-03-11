<template>
  <div class="example-container">
    <h2>自定义渲染器示例</h2>
    <p class="description">
      演示自定义渲染器（color、starRating、tagInput）的注册和使用， 以及 useForm
      创建表单实例、isFieldTouched / getTouchedFields 等 API
    </p>

    <SchemaForm
      ref="formRef"
      :form="form"
      v-model="formData"
      :columns="columns"
      @finish="handleSubmit"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
      <button class="btn" @click="formRef?.reset()">重置</button>
      <button class="btn" @click="checkTouched">检查修改状态</button>
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
      componentType: "color",
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
      componentType: "starRating",
      componentProps: {
        max: 5,
      },
    },
    {
      name: "tags",
      label: "标签",
      componentType: "tagInput",
      componentProps: {
        placeholder: "输入后按回车添加",
        maxTags: 5,
      },
    },
    {
      name: "description",
      label: "描述",
      componentType: "textarea",
      componentProps: {
        placeholder: "请输入描述",
        maxlength: 200,
        showWordLimit: true,
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
    rating: 3,
    tags: [],
    priority: 5,
  })

  const form = useForm({ initialValues: formData.value, columns })

  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
    alert("提交成功！数据已打印到控制台")
  }

  // 检查字段修改状态
  const checkTouched = () => {
    const touched = form.getTouchedFields()
    const titleTouched = form.isFieldTouched("title")
    console.log("已修改字段:", touched)
    console.log("标题是否修改:", titleTouched)
    alert(`已修改字段: ${touched.length ? touched.join(", ") : "无"}`)
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
