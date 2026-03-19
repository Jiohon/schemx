<template>
  <div class="example-container">
    <h2>表单验证示例</h2>
    <p class="description">
      演示 Zod 规则校验、rules: "required" 快捷方式、异步校验（refine）、
      validationTrigger（onChange / onBlur）、跨字段校验、validateField 单字段校验
    </p>

    <schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
    />

    <div class="form-actions">
      <button class="btn btn-primary" @click="formRef?.submit()">注册</button>
      <button class="btn" @click="formRef?.validate()">全量校验</button>
      <button class="btn" @click="validateSingle">校验用户名</button>
      <button class="btn" @click="validatePhone">校验手机号</button>
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

  import type { SchemaField, SchemxInstance } from "@schemx/vue"

  const formRef = ref<SchemxInstance>()
  const formData = ref<Record<string, any>>({})

  // 模拟异步校验：检查用户名是否已存在（预留，取消注释 rules 中的 refine 即可启用）
  const _checkUsernameExists = async (value: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const existingUsers = ["admin", "test", "user"]

    return !existingUsers.includes(value.toLowerCase())
  }

  const schemas: SchemaField[] = [
    // Zod 规则 + 异步 refine + onChange 触发
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: true,
      validationTrigger: "onChange",
      rules: "required",

      // rules: z
      //   .string()
      //   .min(3, "用户名长度为 3-16 个字符")
      //   .max(16, "用户名长度为 3-16 个字符")
      //   .regex(
      //     /^[a-zA-Z][a-zA-Z0-9_]*$/,
      //     "用户名必须以字母开头，只能包含字母、数字和下划线"
      //   )
      //   .refine(
      //     async (val) => {
      //       if (!val) return true
      //       return await checkUsernameExists(val)
      //     },
      //     { message: "该用户名已被使用" }
      //   ),
    },
    // rules: "required" 快捷方式 + readonly 状态
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      componentProps: {
        placeholder: "请输入邮箱地址",
      },
      readonly: true,
      rules: "required",
    },
    // 依赖其他字段的 disabled 状态
    {
      name: "phone",
      label: "手机号",
      componentType: "input",
      required: true,
      componentProps: {
        type: "text",
        placeholder: "请输入手机号",
        maxlength: 11,
      },
      dependencies: ["username"],
      disabled: (values) => {
        return !!values.username
      },
      rules: ["required", z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号")],
    },
    // labelPosition: top + 密码复杂度校验
    {
      name: "password",
      label: "密码",
      componentType: "input",
      required: true,
      componentProps: {
        type: "password",
        placeholder: "至少8位，包含大小写字母和数字",
      },
      labelPosition: "top",
      rules: z
        .string()
        .min(8, "密码至少8位")
        .regex(/\d/, "密码必须包含数字")
        .regex(/[a-z]/, "密码必须包含小写字母")
        .regex(/[A-Z]/, "密码必须包含大写字母"),
    },
    {
      name: "confirmPassword",
      label: "确认密码",
      componentType: "input",
      required: true,
      componentProps: {
        type: "password",
        placeholder: "请再次输入密码",
      },
      rules: z.string().min(1, "请确认密码"),
    },
    // number 类型 + 范围校验
    {
      name: "age",
      label: "年龄",
      componentType: "number",
      componentProps: {
        min: 0,
        max: 150,
      },
      rules: z.number().min(18, "年龄必须大于等于18岁").max(100, "年龄必须小于等于100岁"),
    },
    // 正则校验
    {
      name: "idCard",
      label: "身份证号",
      componentType: "text",
      required: true,
      componentProps: {
        placeholder: "请输入身份证号",
        maxlength: 18,
      },
      rules: z.string().regex(/^\d{17}[\dXx]$/, "请输入有效的身份证号"),
    },
  ]

  // 提交处理（含跨字段校验）
  const handleSubmit = (values: Record<string, any>) => {
    if (values.password !== values.confirmPassword) {
      formRef.value?.setFieldError("confirmPassword", ["两次输入的密码不一致"])

      return
    }

    console.log("注册信息:", values)
    alert("注册成功！")
  }

  const handleSubmitFailed = (errorInfo: any) => {
    console.error("验证失败:", errorInfo)
  }

  // 单字段校验
  const validateSingle = async () => {
    const result = await formRef.value?.validateField("username")
    console.log("用户名校验结果:", result)
  }

  // 单字段校验
  const validatePhone = async () => {
    const result = await formRef.value?.validateField("phone")
    console.log("手机号校验结果:", result)
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
