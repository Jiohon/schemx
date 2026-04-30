<template>
  <div class="example-container">
    <h2>字段联动示例</h2>
    <p class="description">
      演示 componentType: "dependency" 实现复杂字段联动：
      根据字段值动态生成不同的表单结构，多个 dependency 组合使用
    </p>

    <Schemx
      ref="formRef"
      v-model="formData"
      :schemas="schemas"
      :initial-values="{ orderType: 'standard' }"
      @finish="handleSubmit"
      @finish-failed="handleSubmitFailed"
      @values-change="handleValuesChange"
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

  import Schemx from "@schemx/vant"
  import { z } from "zod"

  import type { DependencyFormValues } from "../types"
  import type { SchemxField, SchemxInstance } from "@schemx/vant"

  /** 表单实例引用，提供 submit、reset 等方法 */
  const formRef = ref<SchemxInstance>()

  /** 表单数据，通过 v-model 双向绑定实时展示动态结构变化 */
  const formData = ref<Record<string, any>>({
    orderType: "standard",
  })

  /**
   * 级联地址选项数据
   *
   * 用于定制订单分支的 cascader 级联地址选择，
   * 包含省 -> 市 -> 区三级结构。
   */
  const cascaderOptions = [
    {
      label: "浙江省",
      value: "zhejiang",
      children: [
        {
          label: "杭州市",
          value: "hangzhou",
          children: [
            { label: "西湖区", value: "xihu" },
            { label: "余杭区", value: "yuhang" },
          ],
        },
        {
          label: "宁波市",
          value: "ningbo",
          children: [
            { label: "海曙区", value: "haishu" },
            { label: "江北区", value: "jiangbei" },
          ],
        },
      ],
    },
    {
      label: "广东省",
      value: "guangdong",
      children: [
        {
          label: "广州市",
          value: "guangzhou",
          children: [
            { label: "天河区", value: "tianhe" },
            { label: "越秀区", value: "yuexiu" },
          ],
        },
        {
          label: "深圳市",
          value: "shenzhen",
          children: [
            { label: "南山区", value: "nanshan" },
            { label: "福田区", value: "futian" },
          ],
        },
      ],
    },
  ]

  /**
   * 表单 Schema 配置
   *
   * 通过 componentType: "dependency" 实现复杂字段联动，展示两种 dependency 组合：
   * - 第一个 dependency：根据 orderType（selector）动态生成不同字段结构
   *   - 标准订单：stepper（数量）+ date（预计日期）
   *   - 加急订单：slider（加急费用范围）+ rate（服务评分）
   *   - 定制订单：cascader（级联地址）+ calendar（日历区间选择）
   * - 第二个 dependency：根据 additionalServices（checkbox）动态生成字段
   *   - 选中"需要发票"时：upload（发票附件上传）+ number（金额输入）
   */
  const schemas: SchemxField<DependencyFormValues>[] = [
    /** 控制字段：订单类型（selector 选择 standard / express / custom 切换分支） */
    {
      name: "orderType",
      label: "订单类型",
      componentType: "selector",
      required: true,
      componentProps: {
        options: [
          { label: "标准订单", value: "standard" },
          { label: "加急订单", value: "express" },
          { label: "定制订单", value: "custom" },
        ],
      },
      initialValue: "standard",
    },

    /** 第一个 dependency：根据 orderType 动态生成不同字段 */
    {
      componentType: "dependency",
      to: ["orderType"],
      renderer: (values): SchemxField[] => {
        const orderType = values.orderType

        /** 标准订单分支：stepper（数量）+ date（预计日期） */
        if (orderType === "standard") {
          return [
            {
              name: "quantity",
              label: "数量",
              componentType: "stepper",
              required: true,
              componentProps: { min: 1, max: 999, integer: true },
              rules: z.number({ message: "请输入数量" }).min(1, "数量至少为 1"),
            },
            {
              name: "expectedDate",
              label: "预计日期",
              componentType: "date",
              required: true,
              rules: "required",
            },
          ]
        }

        /** 加急订单分支：slider（加急费用范围）+ rate（服务评分） */
        if (orderType === "express") {
          return [
            {
              name: "expressFee",
              label: "加急费用范围",
              componentType: "slider",
              required: true,
              componentProps: { min: 50, max: 500, step: 50 },
              rules: z
                .number({ message: "请选择加急费用" })
                .min(50, "加急费用至少 50 元"),
            },
            {
              name: "serviceRating",
              label: "服务评分",
              componentType: "rate",
              required: true,
              componentProps: { count: 5, allowHalf: true },
              rules: z.number({ message: "请选择服务评分" }).min(1, "请至少给 1 分"),
            },
          ]
        }

        /** 定制订单分支：cascader（级联地址）+ calendar（日历区间选择） */
        return [
          {
            name: "address",
            label: "级联地址",
            componentType: "cascader",
            required: true,
            componentProps: {
              options: cascaderOptions,
            },
            rules: "required",
          },
          {
            name: "dateRange",
            label: "日历区间选择",
            componentType: "calendar",
            required: true,
            componentProps: {
              type: "range",
            },
            rules: "required",
          },
        ]
      },
    },

    /** 控制字段：附加服务（checkbox 多选，选中"需要发票"时动态生成字段） */
    {
      name: "additionalServices",
      label: "附加服务",
      componentType: "checkbox",
      componentProps: {
        options: [
          { label: "需要发票", value: "invoice" },
          { label: "礼品包装", value: "gift_wrap" },
          { label: "延保服务", value: "warranty" },
        ],
      },
    },

    /** 第二个 dependency：根据 additionalServices 动态生成发票相关字段 */
    {
      componentType: "dependency",
      to: ["additionalServices"],
      renderer: (values): SchemxField[] => {
        const services: string[] = values.additionalServices || []

        if (services.includes("invoice")) {
          return [
            {
              name: "invoiceAttachment",
              label: "发票附件上传",
              componentType: "upload",
              required: true,
              componentProps: {
                accept: "image/*,.pdf",
              },
              rules: "required",
            },
            {
              name: "invoiceAmount",
              label: "金额",
              componentType: "number",
              required: true,
              componentProps: {
                min: 0,
              },
              rules: z.number({ message: "请输入金额" }).min(0.01, "金额必须大于 0"),
            },
          ]
        }

        return []
      },
    },
  ]

  /**
   * 表单值变化回调
   *
   * 同步表单数据到预览区域。
   *
   * @param changedValues - 本次变化的字段键值对
   * @param latestValues - 变化后的完整表单数据
   */
  const handleValuesChange = (
    changedValues: Record<string, any>,
    latestValues: Record<string, any>
  ) => {
    formData.value = latestValues
  }

  /**
   * 表单提交回调
   *
   * 校验通过后触发，输出表单数据到控制台。
   *
   * @param values - 校验通过的表单数据
   */
  const handleSubmit = (values: DependencyFormValues) => {
    console.log("提交数据:", values)
    alert("提交成功！数据已打印到控制台")
  }

  /**
   * 表单校验失败回调
   *
   * 校验未通过时触发，输出错误信息到控制台。
   *
   * @param errorInfo - 校验失败的错误信息
   */
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
