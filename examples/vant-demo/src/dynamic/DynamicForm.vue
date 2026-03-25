<template>
  <div class="example-container">
    <h2>动态表单示例</h2>
    <p class="description">
      演示 dependencies 声明式字段联动：动态 visible、disabled、readonly、required、
      componentProps 函数形式、条件显示/隐藏
    </p>

    <schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">提交</button>
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

  import schemx from "@schemx/vue"
  import { z } from "zod"

  import type { SchemxField, SchemxInstance } from "@schemx/vue"

  const formRef = ref<SchemxInstance>()
  const formData = ref<Record<string, any>>({
    userType: "personal",
  })

  const schemas: SchemxField[] = [
    // 控制字段：用户类型
    {
      name: "userType",
      label: "用户类型",
      componentType: "text",
      componentProps: {
        placeholder: "输入 personal 或 enterprise",
      },
      initialValue: "personal",
    },

    // 动态 visible：个人用户才显示姓名
    {
      name: "name",
      label: "姓名",
      componentType: "text",
      required: true,
      dependencies: ["userType"],
      visible: (values: Record<string, any>) => values.userType !== "enterprise",
      rules: z.string().min(2, "姓名至少 2 个字符"),
    },

    // 动态 visible：企业用户才显示企业名称
    {
      name: "companyName",
      label: "企业名称",
      componentType: "text",
      required: true,
      dependencies: ["userType"],
      visible: (values: Record<string, any>) => values.userType === "enterprise",
      rules: z.string().min(2, "企业名称至少 2 个字符"),
    },

    // 动态 required：企业用户时必填
    {
      name: "businessLicense",
      label: "营业执照号",
      componentType: "text",
      dependencies: ["userType"],
      visible: (values: Record<string, any>) => values.userType === "enterprise",
      required: (values: Record<string, any>) => values.userType === "enterprise",
      rules: z.string().min(15, "请输入有效的营业执照号").optional().or(z.literal("")),
    },

    // 动态 componentProps 函数形式：省市联动
    {
      name: "province",
      label: "省份",
      componentType: "text",
      componentProps: {
        placeholder: "请输入省份",
      },
    },
    {
      name: "city",
      label: "城市",
      componentType: "text",
      dependencies: ["province"],
      componentProps: (values: Record<string, any>) => ({
        placeholder: values.province ? `请输入${values.province}的城市` : "请先输入省份",
        disabled: !values.province,
      }),
    },

    // 动态 disabled
    {
      name: "salary",
      label: "期望薪资",
      componentType: "number",
      dependencies: ["userType"],
      disabled: (values: Record<string, any>) => values.userType === "enterprise",
      componentProps: {
        min: 0,
        max: 1000000,
      },
    },

    // 动态 readonly + 动态 componentProps
    {
      name: "remark",
      label: "备注",
      componentType: "textarea",
      dependencies: ["userType"],
      readonly: (values: Record<string, any>) => values.userType === "enterprise",
      componentProps: (values: Record<string, any>) => ({
        placeholder:
          values.userType === "enterprise" ? "企业用户备注为只读" : "请输入备注信息",
        maxlength: 200,
      }),
    },
  ]

  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
    alert("提交成功！数据已打印到控制台")
  }

  const handleSubmitFailed = (errorInfo: any) => {
    console.error("验证失败:", errorInfo)
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
