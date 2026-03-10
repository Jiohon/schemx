<template>
  <div class="example-container">
    <h2>FormDependency 示例</h2>
    <p class="description">演示使用 FormDependency 组件实现复杂的字段联动</p>

    <SchemaForm
      ref="formRef"
      v-model="formData"
      :columns="columns"
      :initial-values="{ orderType: 'standard', customRequirement: 'xx定制' }"
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
  import SchemaForm from "@"
  import type { SchemaColumn, SchemaFormInstance } from "@"

  const formRef = ref<SchemaFormInstance>()
  const formData = ref<Record<string, any>>({
    orderType: "standard",
  })

  // 表单配置
  const columns: SchemaColumn[] = [
    {
      name: "orderType",
      label: "订单类型",
      componentType: "text",
      required: true,
      componentProps: {
        placeholder: "输入 standard / express / custom",
      },
      initialValue: "express",
    },
    // 使用 dependency 类型实现复杂联动
    {
      componentType: "dependency",
      to: ["orderType"], // 依赖 orderType 字段
      renderer: (values: Record<string, any>, form: SchemaFormInstance) => {
        const orderType = values.orderType

        // 根据订单类型返回不同的字段配置
        if (orderType === "standard") {
          return [
            {
              name: "productName",
              label: "商品名称",
              componentType: "text",
              required: true,
              rules: z.string().min(1, "请输入商品名称"),
            },
            {
              name: "quantity",
              label: "数量",
              componentType: "number",
              componentProps: {
                min: 1,
              },
            },
            {
              name: "shippingAddress",
              label: "收货地址",
              componentType: "textarea",
              required: true,
              rules: z.string().min(1, "请输入收货地址"),
            },
          ]
        } else if (orderType === "express") {
          return [
            {
              name: "productName",
              label: "商品名称",
              componentType: "text",
              required: true,
              rules: "required",
            },
            {
              name: "quantity",
              label: "数量",
              componentType: "number",
              componentProps: {
                min: 1,
              },
            },
            {
              name: "expressFee",
              label: "加急费用",
              componentType: "number",
              componentProps: {
                min: 0,
              },
            },
            {
              name: "shippingAddress",
              label: "收货地址",
              componentType: "textarea",
              required: true,
              rules: z.string().min(1, "请输入收货地址"),
            },
          ]
        } else {
          return [
            {
              name: "customRequirement",
              label: "定制需求",
              componentType: "textarea",
              required: true,
              componentProps: {
                placeholder: "请详细描述您的定制需求",
                maxlength: 500,
                showWordLimit: true,
              },
              rules: z.string().min(1, "请输入定制需求"),
            },
            {
              name: "budget",
              label: "预算",
              componentType: "number",
              componentProps: {
                min: 0,
              },
            },
            {
              name: "contactInfo",
              label: "联系方式",
              componentType: "text",
              required: true,
              rules: z.string().min(1, "请输入联系方式"),
            },
          ]
        }
      },
    },
    {
      name: "price",
      label: "价格",
      componentType: "number",
      required: true,
      componentProps: {
        min: 0,
      },
      initialValue: null,
      rules: z.number({ error: "请输入价格" }).min(0.01, "价格必须大于 0"),
    },
    // 另一个 dependency 示例：根据价格动态显示折扣信息
    {
      componentType: "dependency",
      to: ["price"],
      renderer: (values: Record<string, any>) => {
        const price = values.price || 0

        if (price >= 1000) {
          return [
            {
              name: "discountCode",
              label: "优惠码",
              componentType: "text",
              componentProps: {
                placeholder: "满1000可使用优惠码",
              },
            },
          ]
        }

        return []
      },
    },
    {
      name: "remark",
      label: "备注",
      componentType: "textarea",
      componentProps: {
        placeholder: "请输入备注信息",
        maxlength: 200,
      },
    },
  ]

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
