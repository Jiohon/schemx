<template>
  <div class="app">
    <header class="header">
      <h1>SchemaForm 示例</h1>
      <nav class="nav">
        <button
          v-for="example in examples"
          :key="example.id"
          :class="{ active: currentExample === example.id }"
          @click="currentExample = example.id"
        >
          {{ example.name }}
        </button>
      </nav>
    </header>

    <main class="main">
      <component :is="currentComponent" />
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, markRaw, ref } from "vue"

  import BasicForm from "./basic/BasicForm.vue"
  import CustomRendererForm from "./custom-renderer/CustomRendererForm.vue"
  import DependencyForm from "./dependency/DependencyForm.vue"
  import DynamicForm from "./dynamic/DynamicForm.vue"
  import SlotsForm from "./slots/SlotsForm.vue"
  import SlotsFormJsx from "./slots/SlotsFormJsx"
  import ValidationForm from "./validation/ValidationForm.vue"

  const examples = [
    { id: "basic", name: "基础表单", component: markRaw(BasicForm) },
    { id: "validation", name: "表单验证", component: markRaw(ValidationForm) },
    { id: "dynamic", name: "动态表单", component: markRaw(DynamicForm) },
    { id: "dependency", name: "字段联动", component: markRaw(DependencyForm) },
    { id: "custom", name: "自定义渲染器", component: markRaw(CustomRendererForm) },
    { id: "slots", name: "插槽系统", component: markRaw(SlotsForm) },
    { id: "slots-jsx", name: "插槽系统（JSX）", component: markRaw(SlotsFormJsx) },
  ]

  const currentExample = ref("basic")

  const currentComponent = computed(() => {
    const example = examples.find((e) => e.id === currentExample.value)

    return example?.component || BasicForm
  })
</script>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      sans-serif;
    background: #f5f5f5;
  }

  .app {
    min-height: 100vh;
  }

  .header {
    background: white;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header h1 {
    margin: 0 0 16px 0;
    font-size: 20px;
    color: #333;
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .nav button {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    transition: all 0.2s;
  }

  .nav button:hover {
    border-color: #1989fa;
    color: #1989fa;
  }

  .nav button.active {
    background: #1989fa;
    border-color: #1989fa;
    color: white;
  }

  .main {
    padding: 16px;
    max-width: 100%;
    overflow-x: hidden;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
    padding: 0 16px;
  }

  .btn {
    padding: 8px 20px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: all 0.2s;
  }

  .btn:hover {
    border-color: #1989fa;
    color: #1989fa;
  }

  .btn-primary {
    background: #1989fa;
    border-color: #1989fa;
    color: white;
  }

  .btn-primary:hover {
    background: #1478de;
  }

  .example-container {
    padding: 16px;
    border-radius: 8px;
    background-color: #fff;
  }
</style>
