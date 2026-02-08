<template>
  <div class="example-container">
    <h2>Hooks API 示例</h2>
    <p class="description">演示 useForm、useField、useWatch 等 Hooks 的使用</p>

    <div class="form-wrapper">
      <!-- 使用 useForm 创建的表单 -->
      <div class="section">
        <h3>1. useForm + useField - 表单管理</h3>
        <div class="form-fields">
          <div class="field-row">
            <label>用户名:</label>
            <input
              :value="usernameField.value.value"
              @input="(e) => usernameField.setValue((e.target as HTMLInputElement).value)"
              @blur="() => usernameField.validate()"
              placeholder="请输入用户名"
            />
            <span v-if="usernameField.error.value" class="error">{{ usernameField.error.value }}</span>
            <span v-if="usernameField.touched.value" class="touched-badge">已修改</span>
          </div>

          <div class="field-row">
            <label>邮箱:</label>
            <input
              :value="emailField.value.value"
              @input="(e) => emailField.setValue((e.target as HTMLInputElement).value)"
              @blur="() => emailField.validate()"
              placeholder="请输入邮箱"
            />
            <span v-if="emailField.error.value" class="error">{{ emailField.error.value }}</span>
          </div>

          <div class="field-row">
            <label>年龄:</label>
            <input
              :value="ageField.value.value"
              @input="(e) => ageField.setValue(Number((e.target as HTMLInputElement).value))"
              type="number"
            />
          </div>
        </div>

        <div class="actions">
          <button @click="handleSubmit">提交</button>
          <button @click="handleReset">重置</button>
          <button @click="handleSetValues">设置值</button>
        </div>
      </div>

      <!-- 表单状态 -->
      <div class="section">
        <h3>2. 表单状态</h3>
        <div class="watch-info">
          <p><strong>是否正在提交:</strong> {{ form.submitting.value ? "是" : "否" }}</p>
          <p><strong>是否有字段被修改:</strong> {{ form.isFieldsTouched() ? "是" : "否" }}</p>
          <p><strong>被修改的字段:</strong> {{ form.getTouchedFields().join(', ') || '无' }}</p>
        </div>
      </div>

      <!-- 表单数据预览 -->
      <div class="section">
        <h3>3. 表单数据</h3>
        <pre>{{ JSON.stringify(form.values.value, null, 2) }}</pre>
      </div>

      <!-- 错误信息预览 -->
      <div class="section">
        <h3>4. 错误信息</h3>
        <pre>{{ JSON.stringify(form.errors.value, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from "zod"
import { useForm, useField } from "@"
import type { ColumnConfig } from "@"

// ==================== useForm 示例 ====================

// 定义表单字段配置（使用 Zod schema 作为验证规则）
const columns: ColumnConfig[] = [
  {
    name: "username",
    componentType: "text",
    rules: z.string().min(2, "用户名至少 2 个字符").max(20, "用户名最多 20 个字符"),
  },
  {
    name: "email",
    componentType: "text",
    rules: z.string().email("请输入有效的邮箱"),
  },
  {
    name: "age",
    componentType: "number",
  },
]

// 使用 useForm hook
const form = useForm({
  initialValues: {
    username: "",
    email: "",
    age: 18,
  },
  columns,
  onFinish: (formValues) => {
    console.log("提交数据:", formValues)
    alert("提交成功！")
  },
  onFinishFailed: (formErrors) => {
    console.log("验证失败:", formErrors)
    alert("请检查表单填写")
  },
  onValuesChange: (changedValues, allValues) => {
    console.log("值变化:", changedValues, allValues)
  },
})

// ==================== useField 示例 ====================

// 使用 useField hook 获取字段控制器
const usernameField = useField("username")
const emailField = useField("email")
const ageField = useField("age")

// ==================== 操作方法 ====================

const handleSubmit = async () => {
  const isValid = await form.validate()
  if (isValid) {
    console.log("提交数据:", form.values.value)
    alert("提交成功！")
  } else {
    alert("请检查表单填写")
  }
}

const handleReset = () => {
  form.reset()
}

const handleSetValues = () => {
  form.setFieldsValue({
    username: "测试用户",
    email: "test@example.com",
    age: 25,
  })
}
</script>

<style scoped>
.example-container {
  padding: 16px;
  max-width: 800px;
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

.form-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.section h3 {
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.field-row label {
  width: 80px;
  text-align: right;
  color: #666;
}

.field-row input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
}

.field-row input:focus {
  border-color: #1989fa;
}

.field-row .error {
  color: #ee0a24;
  font-size: 12px;
}

.field-row .touched-badge {
  padding: 2px 8px;
  background: #07c160;
  color: white;
  font-size: 12px;
  border-radius: 4px;
}

.actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.actions button {
  padding: 8px 16px;
  background: #1989fa;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.actions button:hover {
  background: #0d7de8;
}

.actions button:nth-child(2) {
  background: #666;
}

.actions button:nth-child(3) {
  background: #07c160;
}

.watch-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.watch-info p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.watch-info strong {
  color: #333;
}

pre {
  margin: 0;
  padding: 12px;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}
</style>
