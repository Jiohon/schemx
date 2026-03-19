/**
 * 示例应用入口
 */
import { createApp } from "vue"

import "vant/lib/index.css"

import { registerDefaultRenderers } from "@schemx/vant"
import { rendererRegistry } from "@schemx/vue"

import App from "./App.vue"

// 注册 Vant 默认渲染器
registerDefaultRenderers(rendererRegistry)

const app = createApp(App)

app.mount("#app")
