/**
 * 示例应用入口
 */
import { createApp } from 'vue'
import App from './App.vue'

// 导入 Vant 组件库
import Vant from 'vant'
import 'vant/lib/index.css'

// 导入 SchemaForm 样式
import '../src/styles/index.scss'

const app = createApp(App)

app.use(Vant)
app.mount('#app')
