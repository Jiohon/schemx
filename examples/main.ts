/**
 * 示例应用入口
 */
import { createApp } from "vue"

import { globalRegistry } from "@"

// 导入 SchemaForm 样式
import "../src/styles/index.css"

import App from "./App.vue"
import { ColorPickerRenderer } from "./components/custom/ColorPickerRenderer"
import { StarRatingRenderer } from "./components/custom/StarRatingRenderer"
import { TagInputRenderer } from "./components/custom/TagInputRenderer"
import { registerDefaultRenderers } from "./renderers/defaultRenderers"

registerDefaultRenderers(globalRegistry)

const app = createApp(App)

app.mount("#app")

globalRegistry.registerAll({
  color: ColorPickerRenderer,
  starRating: StarRatingRenderer,
  tagInput: TagInputRenderer,
})
