<template>
  <div class="example-container">
    <h2>动态表单示例</h2>
    <p class="description">演示字段联动、条件显示等动态功能</p>

    <SchemaForm
      ref="formRef"
      v-model="formData"
      :columns="columns"
      :footer="true"
      submit-button-text="提交"
      @finish="handleSubmit"
      @finish-failed="handleFailed"
    />

    <div class="form-data-preview">
      <h3>表单数据预览</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from "vue"
  import { z } from "zod"
  import SchemaForm from "@"
  import type { SchemaColumn, FormInstance } from "@"

  const formRef = ref<FormInstance>()
  const formData = ref<Record<string, any>>({
    userType: "personal",
    hasCompany: false,
  })

  // 省市数据
  const provinces = [
    { label: "北京", value: "beijing" },
    { label: "上海", value: "shanghai" },
    { label: "广东", value: "guangdong" },
    { label: "浙江", value: "zhejiang" },
  ]

  const cityMap: Record<string, Array<{ label: string; value: string }>> = {
    beijing: [{ label: "北京市", value: "beijing" }],
    shanghai: [{ label: "上海市", value: "shanghai" }],
    guangdong: [
      { label: "广州", value: "guangzhou" },
      { label: "深圳", value: "shenzhen" },
      { label: "东莞", value: "dongguan" },
    ],
    zhejiang: [
      { label: "杭州", value: "hangzhou" },
      { label: "宁波", value: "ningbo" },
      { label: "温州", value: "wenzhou" },
    ],
  }

  // 表单配置 - 使用动态属性
  const columns = computed(
    () =>
      [
        {
          name: "userType",
          label: "用户类型",
          componentType: "radio",
          componentProps: {
            options: [
              { label: "个人用户", value: "personal" },
              { label: "企业用户", value: "enterprise" },
            ],
          },
        },
        {
          name: "name",
          label: "姓名",
          componentType: "text",
          required: true,
          // 根据用户类型动态显示/隐藏
          hidden: (values) => values.userType === "enterprise",
          rules: z.string().min(2, "姓名至少 2 个字符"),
        },
        {
          name: "companyName",
          label: "企业名称",
          componentType: "text",
          required: true,
          // 仅企业用户显示
          hidden: (values) => {
            console.log(values, values.userType)

            return values.userType !== "enterprise"
          },
          rules: z.string().min(2, "企业名称至少 2 个字符"),
        },
        {
          name: "businessLicense",
          label: "营业执照号",
          componentType: "text",
          // 仅企业用户显示且必填
          hidden: (values) => values.userType !== "enterprise",
          required: (values) => values.userType === "enterprise",
          rules: z
            .string()
            .min(15, "请输入有效的营业执照号")
            .optional()
            .or(z.literal("")),
        },
        {
          name: "contactPerson",
          label: "联系人",
          componentType: "text",
          // 仅企业用户显示
          hidden: (values) => values.userType !== "enterprise",
        },
        {
          name: "phone",
          label: "联系电话",
          componentType: "text",
          required: true,
          componentProps: {
            type: "tel",
            maxlength: 11,
          },
          rules: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
        },
        {
          name: "province",
          label: "省份",
          componentType: "picker",
          componentProps: {
            columns: provinces,
            placeholder: "请选择省份",
          },
        },
        {
          name: "city",
          label: "城市",
          componentType: "picker",
          // 动态 componentProps - 根据省份显示对应城市
          componentProps: (values) => ({
            columns: values.province ? cityMap[values.province as string] || [] : [],
            placeholder: values.province ? "请选择城市" : "请先选择省份",
            disabled: !values.province,
          }),
        },
        {
          name: "hasCompany",
          label: "是否有公司",
          componentType: "switch",
          // 仅个人用户显示
          hidden: (values) => values.userType === "enterprise",
        },
        {
          name: "companyInfo",
          label: "公司信息",
          componentType: "text",
          // 个人用户且选择有公司时显示
          hidden: (values) => values.userType === "enterprise" || !values.hasCompany,
          componentProps: {
            placeholder: "请输入您所在公司名称",
          },
        },
        {
          name: "salary",
          label: "期望薪资",
          componentType: "slider",
          // 动态禁用 - 企业用户禁用此字段
          disabled: (values) => values.userType === "enterprise",
          componentProps: {
            min: 0,
            max: 100,
            step: 5,
          },
        },
        // {
        //   name: "remark",
        //   label: "备注",
        //   componentType: "textarea",
        //   // 动态只读 - 根据条件设置只读
        //   readonly: (values) => values.userType === "enterprise" && !values.contactPerson,
        //   componentProps: (values) => ({
        //     placeholder:
        //       values.userType === "enterprise" && !values.contactPerson
        //         ? "请先填写联系人"
        //         : "请输入备注信息",
        //     maxlength: 200,
        //   }),
        // },
      ] as SchemaColumn[]
  )

  // 提交处理
  const handleSubmit = (values: Record<string, any>) => {
    console.log("提交数据:", values)
  }

  const handleFailed = (errorInfo: any) => {
    console.log(errorInfo)
    // do something
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
