<template>
  <div class="example-container">
    <h2>表单验证示例</h2>

    <SchemaForm
      ref="formRef"
      v-model="formData"
      :columns="columns"
      :footer="true"
      submit-button-text="注册"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
    />

    <button @click="handleEmil">验证邮箱</button>
  </div>
</template>

<script setup lang="ts">
  import { ref } from "vue"
  import { z } from "zod"
  import SchemaForm from "@"
  import type { SchemaColumn, FormInstance } from "@"

  const formRef = ref<FormInstance>()
  const formData = ref<Record<string, any>>({})

  // 自定义验证器：检查用户名是否已存在
  const checkUsernameExists = async (value: string): Promise<boolean> => {
    // 模拟异步检查
    await new Promise((resolve) => setTimeout(resolve, 500))
    const existingUsers = ["admin", "test", "user"]
    return !existingUsers.includes(value.toLowerCase())
  }

  // 表单配置（使用 Zod schema 作为验证规则）
  const columns: SchemaColumn[] = [
    {
      name: "username",
      label: "用户名",
      componentType: "text",
      required: true,
      validationTrigger: "onChange",
      rules: z
        .string()
        .min(3, "用户名长度为 3-16 个字符")
        .max(16, "用户名长度为 3-16 个字符")
        .regex(
          /^[a-zA-Z][a-zA-Z0-9_]*$/,
          "用户名必须以字母开头，只能包含字母、数字和下划线"
        )
        .refine(
          async (val) => {
            if (!val) return true
            return await checkUsernameExists(val)
          },
          { message: "该用户名已被使用" }
        ),
    },
    {
      name: "email",
      label: "邮箱",
      componentType: "text",
      // required: true,
      componentProps: {
        placeholder: "请输入邮箱地址",
      },
      rules: "required",
      // rules: z.string().email("请输入有效的邮箱地址"),
    },
    {
      name: "phone",
      label: "手机号",
      componentType: "text",
      required: true,
      componentProps: {
        type: "tel",
        maxlength: 11,
      },
      rules: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
    },
    {
      name: "password",
      label: "密码",
      componentType: "text",
      required: true,
      componentProps: {
        type: "password",
        placeholder: "至少8位，包含大小写字母和数字",
      },
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
      componentType: "text",
      required: true,
      componentProps: {
        type: "password",
        placeholder: "请再次输入密码",
      },
      rules: z.string().min(1, "请确认密码"),
      // 注意：跨字段验证需要在 onFinish 中处理或使用 Zod 的 superRefine
    },
    {
      name: "age",
      label: "年龄",
      componentType: "stepper",
      componentProps: {
        min: 0,
        max: 150,
      },
      rules: z.number().min(18, "年龄必须大于等于18岁").max(100, "年龄必须小于等于100岁"),
    },
    {
      name: "agreement",
      label: "用户协议",
      componentType: "checkbox",
      required: true,
      componentProps: {
        options: [{ label: "我已阅读并同意用户协议", value: true }],
      },
      rules: z
        .array(z.boolean())
        .refine((val) => Array.isArray(val) && val.includes(true), {
          message: "请阅读并同意用户协议",
        }),
    },
  ]

  // 提交处理
  const handleSubmit = (values: Record<string, any>) => {
    // 跨字段验证：确认密码
    if (values.password !== values.confirmPassword) {
      alert("两次输入的密码不一致")
      return
    }

    console.log("注册信息:", values)
    alert("注册成功！")
  }

  // 提交失败处理
  const handleSubmitFailed = (errorInfo: any) => {
    console.error("验证失败:", errorInfo)
  }

  const handleEmil = () => {
    formRef.value?.validateField("email")
  }
</script>

<style scoped>
  .example-container {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .example-container h2 {
    margin-bottom: 20px;
    color: #333;
  }
</style>
