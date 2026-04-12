/**
 * schemx 组件导出
 *
 * 为 SchemxForm 组件挂载静态方法（install、FormItem、registerRequest 等），
 * 并作为默认导出。
 *
 * @module formExport
 */

import type { App } from "vue"

import { requestProvider } from "@/utils/requestProvider"

import FormItem from "./components/FormItem"
import SchemxForm from "./form.vue"

/**
 * 为组件挂载静态属性并保留原始类型
 *
 * @param comp - 原始组件
 * @param extra - 要挂载的静态属性
 */
export function withInstall<T extends object, E extends Record<string, unknown>>(
  comp: T,
  extra: E
) {
  return Object.assign(comp, extra) as T & E
}

const SchemxFormExport = withInstall(SchemxForm, {
  /** Vue 插件安装方法 */
  install(app: App) {
    app.component("SchemxForm", SchemxForm)
  },
  /** FormItem 子组件引用 */
  FormItem,
  /** 注册全局请求器 */
  registerRequest: requestProvider.register,
  /** 清除全局请求器 */
  clearRequest: requestProvider.clear,
})

export default SchemxFormExport
