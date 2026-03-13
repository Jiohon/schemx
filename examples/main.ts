/**
 * 示例应用入口
 */
import { createApp } from "vue"

// 导入 SchemaForm 样式
import "../packages/core/src/styles/index.css"

import { defineRenderers } from "../packages/core/src/core/rendererRegistry"

import App from "./App.vue"
import { ColorPickerRenderer } from "./components/custom/ColorPickerRenderer"
import { StarRatingRenderer } from "./components/custom/StarRatingRenderer"
import { TagInputRenderer } from "./components/custom/TagInputRenderer"
import { registerDefaultRenderers } from "./renderers/defaultRenderers"

registerDefaultRenderers()

const app = createApp(App)

app.mount("#app")

defineRenderers({
  color: ColorPickerRenderer,
  starRating: StarRatingRenderer,
  tagInput: TagInputRenderer,
})
