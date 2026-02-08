<template>
  <div class="example-container">
    <h2>FormDependency 示例</h2>
    <p class="description">演示使用 FormDependency 组件实现复杂的字段联动</p>

    <SchemaForm
      ref="formRef"
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
  import SchemaForm from "@"
  import type { ColumnConfig, SchemaFormInstance } from "@"

  const formRef = ref<SchemaFormInstance>()
  const formData = ref<Record<string, any>>({
    productType: "physical",
    paymentMethod: "online",
  })

  // 产品类型选项
  const productTypes = [
    { label: "实物商品", value: "physical" },
    { label: "虚拟商品", value: "virtual" },
    { label: "服务", value: "service" },
  ]

  // 支付方式选项
  const paymentMethods = [
    { label: "在线支付", value: "online" },
    { label: "货到付款", value: "cod" },
    { label: "分期付款", value: "installment" },
  ]

  // 表单配置
  const columns: ColumnConfig[] = [
    {
      name: "productType",
      label: "产品类型",
      componentType: "radio",
      componentProps: {
        options: productTypes,
      },
    },
    // 使用 dependency 类型实现复杂联动
    {
      name: "productDetails",
      componentType: "dependency",
      to: ["productType"], // 依赖 productType 字段
      renderer: (
        values: Record<string, any>,
        form: SchemaFormInstance,
        isDependenceUpdated: boolean
      ) => {
        const productType = values.productType

        // 根据产品类型返回不同的字段配置
        if (productType === "physical") {
          return [
            {
              name: "productName",
              label: "商品名称",
              componentType: "text",
              required: true,
              rules: z.string().min(1, "请输入商品名称"),
            },
            {
              name: "weight",
              label: "重量(kg)",
              componentType: "number",
              componentProps: {
                min: 0,
                step: 0.1,
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
        } else if (productType === "virtual") {
          return [
            {
              name: "productName",
              label: "产品名称",
              componentType: "text",
              required: true,
              rules: z.string().min(1, "请输入产品名称"),
            },
            {
              name: "downloadLink",
              label: "下载链接",
              componentType: "text",
              componentProps: {
                placeholder: "请输入下载链接",
              },
            },
            {
              name: "validDays",
              label: "有效期(天)",
              componentType: "stepper",
              componentProps: {
                min: 1,
                max: 365,
              },
            },
          ]
        } else {
          return [
            {
              name: "serviceName",
              label: "服务名称",
              componentType: "text",
              required: true,
              rules: z.string().min(1, "请输入服务名称"),
            },
            {
              name: "serviceDate",
              label: "服务日期",
              componentType: "date",
              required: true,
            },
            {
              name: "serviceTime",
              label: "服务时长(小时)",
              componentType: "stepper",
              componentProps: {
                min: 1,
                max: 24,
              },
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
        step: 0.01,
      },
      rules: z.number().min(0.01, "价格必须大于 0"),
    },
    {
      name: "paymentMethod",
      label: "支付方式",
      componentType: "radio",
      componentProps: {
        options: paymentMethods,
      },
    },
    // 另一个 dependency 示例：根据支付方式显示不同字段
    {
      name: "paymentDetails",
      componentType: "dependency",
      to: ["paymentMethod", "price"], // 依赖多个字段
      renderer: (
        values: Record<string, any>,
        form: SchemaFormInstance,
        isDependenceUpdated: boolean
      ) => {
        const paymentMethod = values.paymentMethod
        const price = values.price || 0

        const baseFields: ColumnConfig[] = []

        if (paymentMethod === "cod") {
          baseFields.push({
            name: "codFee",
            label: "代收手续费",
            componentType: "text",
            readonly: true,
            componentProps: {
              modelValue: `¥${(price * 0.02).toFixed(2)}`,
            },
          })
        } else if (paymentMethod === "installment") {
          baseFields.push(
            {
              name: "installmentPeriod",
              label: "分期期数",
              componentType: "picker",
              required: true,
              componentProps: {
                columns: [
                  { label: "3期", value: 3 },
                  { label: "6期", value: 6 },
                  { label: "12期", value: 12 },
                  { label: "24期", value: 24 },
                ],
              },
            },
            {
              name: "monthlyPayment",
              label: "每期金额",
              componentType: "text",
              readonly: true,
              componentProps: {
                modelValue: values.installmentPeriod
                  ? `¥${(price / values.installmentPeriod).toFixed(2)}`
                  : "请选择分期期数",
              },
            }
          )
        }

        return baseFields
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
