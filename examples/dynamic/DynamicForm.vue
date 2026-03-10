<template>
  <div class="example-container">
    <h2>动态表单示例</h2>
    <p class="description">演示 dependencies 声明式字段联动、条件显示等动态功能</p>

    <SchemaForm
      ref="formRef"
      v-model="formData"
      :columns="columns"
      @finish="handleSubmit"
      @finish-failed="handleFailed"
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
  import { readonly, ref } from "vue"
  import { z } from "zod"
  import SchemaForm from "@"
  import type { SchemaColumn, SchemaFormInstance } from "@"

  const formRef = ref<SchemaFormInstance>()
  const formData = ref<Record<string, any>>({
    userType: "personal",
  })

  // 表单配置 - 使用 dependencies 声明式依赖
  const columns: SchemaColumn[] = [
    {
      name: "userType",
      label: "用户类型",
      componentType: "text",
      componentProps: {
        placeholder: "输入 personal 或 enterprise",
      },
      initialValue: "enterprise",
    },

    // 个人用户字段 - 通过 dependencies 声明依赖 userType
    {
      name: "name",
      label: "姓名",
      componentType: "text",
      required: true,
      dependencies: "userType",
      hidden: (values) => {
        console.log(values)
        return values.userType === "enterprise"
      },
      rules: z.string().min(2, "姓名至少 2 个字符"),
    },

    // 企业用户字段 - 依赖 userType
    {
      name: "companyName",
      label: "企业名称",
      componentType: "text",
      required: true,
      dependencies: "userType",
      hidden: (values) => values.userType !== "enterprise",
      rules: z.string().min(2, "企业名称至少 2 个字符"),
    },
    {
      name: "businessLicense",
      label: "营业执照号",
      componentType: "text",
      dependencies: "userType",
      hidden: (values) => values.userType !== "enterprise",
      required: (values) => values.userType === "enterprise",
      rules: z.string().min(15, "请输入有效的营业执照号").optional().or(z.literal("")),
    },
    {
      name: "contactPerson",
      label: "联系人",
      componentType: "text",
      dependencies: "userType",
      hidden: (values) => values.userType !== "enterprise",
    },

    // 通用字段
    {
      name: "phone",
      label: "联系电话",
      componentType: "input",
      required: true,
      componentProps: {
        type: "text",
        placeholder: "请输入手机号",
        maxlength: 11,
      },
      rules: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
    },

    // 省市联动 - city 依赖 province
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
      dependencies: "province",
      componentProps: (values) => ({
        placeholder: values.province ? "请输入城市" : "请先输入省份",
        disabled: !values.province,
      }),
    },

    // 个人用户附加信息 - 依赖 userType
    {
      name: "companyInfo",
      label: "公司信息",
      componentType: "text",
      dependencies: "userType",
      hidden: (values) => values.userType === "enterprise",
      componentProps: {
        placeholder: "请输入您所在公司名称",
      },
    },

    // 薪资 - 依赖 userType 控制禁用状态
    {
      name: "salary",
      label: "期望薪资",
      componentType: "number",
      dependencies: "userType",
      disabled: (values) => values.userType === "enterprise",
      componentProps: {
        min: 0,
        max: 1000000,
      },
    },

    // 备注 - 依赖 userType 和 contactPerson 控制只读和占位符
    {
      name: "remark",
      label: "备注",
      componentType: "textarea",
      dependencies: "userType",
      readonly: (values) => values.userType === "enterprise" && !values.contactPerson,
      componentProps: (values) => ({
        placeholder:
          values.userType === "enterprise" && !values.contactPerson
            ? "请先填写联系人"
            : "请输入备注信息",
        maxlength: 200,
      }),
    },
  ]

  // 提交处理
  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
  }

  const handleFailed = (errorInfo: any) => {
    console.log(errorInfo)
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
