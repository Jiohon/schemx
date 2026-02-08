<template>
  <div class="example-container">
    <h2>自定义渲染器示例</h2>
    <p class="description">演示如何注册和使用自定义渲染器</p>
    
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
import { ref, h, defineComponent } from 'vue'
import { z } from 'zod'
import SchemaForm from '@'
import type { ColumnConfig, SchemaFormInstance } from '@'

const formRef = ref<SchemaFormInstance>()
const formData = ref<Record<string, any>>({
  color: '#1989fa',
  rating: 3,
})

// ==================== 自定义渲染器组件 ====================

// 颜色选择器渲染器
const ColorPickerRenderer = defineComponent({
  name: 'ColorPickerRenderer',
  props: {
    modelValue: String,
    colors: {
      type: Array as () => string[],
      default: () => ['#1989fa', '#07c160', '#ee0a24', '#ff976a', '#ffdd00', '#7232dd'],
    },
    disabled: Boolean,
    readonly: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const handleSelect = (color: string) => {
      if (props.disabled || props.readonly) return
      emit('update:modelValue', color)
    }

    return () => h('div', { class: 'color-picker' }, [
      props.colors.map((color: string) => 
        h('div', {
          class: ['color-item', { active: props.modelValue === color }],
          style: { backgroundColor: color },
          onClick: () => handleSelect(color),
        })
      ),
      h('div', { class: 'current-color' }, [
        h('span', '当前颜色: '),
        h('span', { 
          class: 'color-preview',
          style: { backgroundColor: props.modelValue },
        }),
        h('span', props.modelValue),
      ]),
    ])
  },
})

// 星级评分渲染器（自定义样式）
const StarRatingRenderer = defineComponent({
  name: 'StarRatingRenderer',
  props: {
    modelValue: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 5,
    },
    disabled: Boolean,
    readonly: Boolean,
    allowHalf: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const handleClick = (index: number) => {
      if (props.disabled || props.readonly) return
      emit('update:modelValue', index)
    }

    return () => h('div', { class: 'star-rating' }, [
      Array.from({ length: props.max }, (_, i) => i + 1).map(index =>
        h('span', {
          class: ['star', { active: index <= props.modelValue }],
          onClick: () => handleClick(index),
        }, index <= props.modelValue ? '★' : '☆')
      ),
      h('span', { class: 'rating-text' }, `${props.modelValue} / ${props.max}`),
    ])
  },
})

// 标签输入渲染器
const TagInputRenderer = defineComponent({
  name: 'TagInputRenderer',
  props: {
    modelValue: {
      type: Array as () => string[],
      default: () => [],
    },
    placeholder: {
      type: String,
      default: '输入后按回车添加',
    },
    maxTags: {
      type: Number,
      default: 10,
    },
    disabled: Boolean,
    readonly: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const inputValue = ref('')

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && inputValue.value.trim()) {
        e.preventDefault()
        if (props.modelValue.length >= props.maxTags) return
        if (props.modelValue.includes(inputValue.value.trim())) return
        
        emit('update:modelValue', [...props.modelValue, inputValue.value.trim()])
        inputValue.value = ''
      }
    }

    const handleRemove = (index: number) => {
      if (props.disabled || props.readonly) return
      const newTags = [...props.modelValue]
      newTags.splice(index, 1)
      emit('update:modelValue', newTags)
    }

    return () => h('div', { class: 'tag-input' }, [
      h('div', { class: 'tags' }, [
        props.modelValue.map((tag: string, index: number) =>
          h('span', { class: 'tag', key: tag }, [
            tag,
            !props.disabled && !props.readonly && h('span', {
              class: 'tag-close',
              onClick: () => handleRemove(index),
            }, '×'),
          ])
        ),
      ]),
      !props.disabled && !props.readonly && h('input', {
        class: 'tag-input-field',
        value: inputValue.value,
        placeholder: props.placeholder,
        onInput: (e: Event) => { inputValue.value = (e.target as HTMLInputElement).value },
        onKeydown: handleKeydown,
      }),
    ])
  },
})

// ==================== 表单配置 ====================
// 注意：自定义渲染器需要在 SchemaForm 外部注册
// 这里演示的是使用 slot 方式实现自定义渲染

const columns: ColumnConfig[] = [
  {
    name: 'title',
    label: '标题',
    componentType: 'text',
    required: true,
    rules: z.string().min(1, '请输入标题'),
  },
  {
    name: 'color',
    label: '主题颜色',
    componentType: 'text', // 使用 slot 覆盖
    componentProps: {
      colors: ['#1989fa', '#07c160', '#ee0a24', '#ff976a', '#ffdd00', '#7232dd', '#000000'],
    },
  },
  {
    name: 'rating',
    label: '评分',
    componentType: 'rate', // 使用内置 rate 渲染器
    componentProps: {
      count: 5,
    },
    rules: z.number().min(1, '请选择评分'),
  },
  {
    name: 'tags',
    label: '标签',
    componentType: 'text', // 使用 slot 覆盖
    componentProps: {
      placeholder: '输入标签后按回车',
      maxTags: 5,
    },
  },
  {
    name: 'description',
    label: '描述',
    componentType: 'textarea',
    componentProps: {
      placeholder: '请输入描述',
      maxlength: 200,
    },
  },
]

// 提交处理
const handleSubmit = (values: Record<string, any>, done: () => void) => {
  console.log('提交数据:', values)
  
  setTimeout(() => {
    alert('提交成功！')
    done()
  }, 1000)
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

/* 颜色选择器样式 */
:deep(.color-picker) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

:deep(.color-item) {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

:deep(.color-item:hover) {
  transform: scale(1.1);
}

:deep(.color-item.active) {
  border-color: #333;
}

:deep(.current-color) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
  font-size: 12px;
  color: #666;
}

:deep(.color-preview) {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

/* 星级评分样式 */
:deep(.star-rating) {
  display: flex;
  align-items: center;
  gap: 4px;
}

:deep(.star) {
  font-size: 24px;
  cursor: pointer;
  color: #ddd;
  transition: color 0.2s;
}

:deep(.star.active) {
  color: #ffcc00;
}

:deep(.star:hover) {
  color: #ffdd00;
}

:deep(.rating-text) {
  margin-left: 12px;
  font-size: 14px;
  color: #666;
}

/* 标签输入样式 */
:deep(.tag-input) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

:deep(.tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.tag) {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #1989fa;
  color: white;
  border-radius: 4px;
  font-size: 12px;
}

:deep(.tag-close) {
  margin-left: 4px;
  cursor: pointer;
  font-size: 14px;
}

:deep(.tag-close:hover) {
  color: #ffcc00;
}

:deep(.tag-input-field) {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
}

:deep(.tag-input-field:focus) {
  border-color: #1989fa;
}
</style>
