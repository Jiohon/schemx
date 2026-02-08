import type { IFormStore } from '../core/FormStore'
import type { UseFormReturn } from '../hooks/useForm'
import type { ISchemaRegistry } from '../renderer/createRegistry'

/**
 * 生命周期钩子名称
 */
export type HookName =
  | 'beforeMount'
  | 'afterMount'
  | 'beforeValidate'
  | 'afterValidate'
  | 'beforeSubmit'
  | 'afterSubmit'
  | 'onFieldChange'
  | 'onError'

/**
 * 各钩子的参数类型定义
 */
export interface HookParams {
  /** 表单挂载前 - 参数: formContext */
  beforeMount: [UseFormReturn<any>]
  /** 表单挂载后 - 参数: formContext */
  afterMount: [UseFormReturn<any>]
  /** 校验前 - 参数: fields */
  beforeValidate: [string[]]
  /** 校验后 - 参数: fields, errors */
  afterValidate: [string[], Record<string, string[]>]
  /** 提交前 - 参数: values */
  beforeSubmit: [Record<string, any>]
  /** 提交后 - 参数: values, result */
  afterSubmit: [Record<string, any>, any]
  /** 字段变化时 - 参数: field, value, oldValue */
  onFieldChange: [string, any, any]
  /** 发生错误时 - 参数: error */
  onError: [Error]
}

/**
 * 钩子回调函数类型
 */
export type HookCallback<T extends any[] = any[]> = (...args: T) => void | Promise<void>

/**
 * 插件上下文
 * 
 * 提供给插件的上下文信息，包含：
 * - version: 版本号
 * - store: FormStore 实例（可选）
 * - rendererRegistry: 渲染器注册中心（可选）
 * - utils: 工具函数集合
 */
export interface PluginContext {
  /** 版本号 */
  version: string
  /** FormStore 实例 */
  store?: IFormStore
  /** 渲染器注册中心 */
  rendererRegistry?: ISchemaRegistry
  /** 工具函数 */
  utils: Record<string, any>
  /** 其他扩展属性 */
  [key: string]: any
}

/**
 * 插件选项
 */
export interface PluginOptions {
  /** 插件 ID */
  id?: string
  /** 其他选项 */
  [key: string]: any
}

/**
 * 插件接口
 * 
 * 插件必须实现 install 方法，可选实现 uninstall 方法
 */
export interface Plugin {
  /** 插件名称 */
  name?: string
  /** 安装方法 */
  install: (context: PluginContext, options?: PluginOptions) => void
  /** 卸载方法 */
  uninstall?: (context: PluginContext) => void
}

/**
 * 已安装插件信息
 */
export interface InstalledPlugin {
  /** 插件对象或函数 */
  plugin: Plugin | Function
  /** 插件选项 */
  options: PluginOptions
}

/**
 * 插件管理器接口
 */
export interface IPluginManager {
  /** 安装插件 */
  use(plugin: Plugin | Function, options?: PluginOptions): void
  /** 卸载插件 */
  uninstall(pluginId: string): void
  /** 注册钩子回调 */
  tap<K extends HookName>(hookName: K, callback: (...args: HookParams[K]) => void | Promise<void>): void
  /** 调用钩子 */
  call<K extends HookName>(hookName: K, ...args: HookParams[K]): Promise<void>
  /** 获取上下文 */
  getContext(): PluginContext
  /** 设置上下文属性 */
  setContext(key: string, value: any): void
  /** 获取已安装插件列表 */
  getInstalledPlugins(): string[]
  /** 检查插件是否已安装 */
  isInstalled(pluginId: string): boolean
  /** 清除所有插件 */
  clear(): void
}

/**
 * SchemaForm 插件管理器
 * 
 * 实现类似 Pinia 的插件系统，支持生命周期钩子。
 * 
 * ## 生命周期钩子
 * 
 * | 钩子 | 触发时机 | 参数 |
 * |------|----------|------|
 * | beforeMount | 表单挂载前 | formContext |
 * | afterMount | 表单挂载后 | formContext |
 * | beforeValidate | 校验前 | fields |
 * | afterValidate | 校验后 | fields, errors |
 * | beforeSubmit | 提交前 | values |
 * | afterSubmit | 提交后 | values, result |
 * | onFieldChange | 字段变化时 | field, value, oldValue |
 * | onError | 发生错误时 | error |
 * 
 * ## 对外功能
 * 
 * | 方法 | 说明 |
 * |------|------|
 * | use(plugin, options?) | 安装插件 |
 * | uninstall(pluginId) | 卸载插件 |
 * | tap(hookName, fn) | 注册钩子回调 |
 * | call(hookName, ...args) | 调用钩子 |
 * | getContext() | 获取插件上下文 |
 * | setContext(key, value) | 设置上下文属性 |
 * 
 * @example
 * ```typescript
 * const pluginManager = new PluginManager()
 * 
 * // 安装插件
 * pluginManager.use({
 *   name: 'my-plugin',
 *   install(context, options) {
 *     console.log('Plugin installed', context.version)
 *   }
 * })
 * 
 * // 注册钩子
 * pluginManager.tap('beforeSubmit', (values) => {
 *   console.log('Before submit:', values)
 * })
 * 
 * // 调用钩子
 * await pluginManager.call('beforeSubmit', { name: 'John' })
 * ```
 */
class PluginManager implements IPluginManager {
  /** 已安装的插件 */
  private plugins: Map<string, InstalledPlugin>
  
  /** 插件上下文 */
  private context: PluginContext
  
  /** 生命周期钩子回调 */
  private hooks: Map<HookName, Set<HookCallback>>

  constructor() {
    this.plugins = new Map()
    this.hooks = new Map()
    this.context = {
      version: '1.0.0',
      utils: {
        /**
         * 日志工具函数
         * @param message - 日志消息
         */
        log: (message: string) => {
          console.log(`[SchemaForm Plugin] ${message}`)
        },
      },
    }
    
    // 初始化所有钩子
    this.initHooks()
  }

  /**
   * 初始化所有生命周期钩子
   * @private
   */
  private initHooks(): void {
    const hookNames: HookName[] = [
      'beforeMount',
      'afterMount',
      'beforeValidate',
      'afterValidate',
      'beforeSubmit',
      'afterSubmit',
      'onFieldChange',
      'onError',
    ]
    
    hookNames.forEach((hookName) => {
      this.hooks.set(hookName, new Set())
    })
  }

  /**
   * 安装插件
   * 
   * 支持两种插件形式：
   * 1. 对象插件：包含 install 方法的对象
   * 2. 函数插件：直接作为函数注入到上下文
   * 
   * @param plugin - 插件对象或函数
   * @param options - 插件配置选项
   * 
   * @example
   * ```typescript
   * // 对象插件
   * pluginManager.use({
   *   name: 'my-plugin',
   *   install(context, options) {
   *     // 插件逻辑
   *   }
   * })
   * 
   * // 函数插件
   * pluginManager.use((context) => {
   *   // 函数逻辑
   * })
   * 
   * // 带选项
   * pluginManager.use(myPlugin, { id: 'custom-id', debug: true })
   * ```
   */
  use(plugin: Plugin | Function, options: PluginOptions = {}): void {
    const pluginId = options.id || (plugin as Plugin).name || `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 检查是否已安装
    if (this.plugins.has(pluginId)) {
      console.warn(`[SchemaForm Plugin] Plugin "${pluginId}" is already installed, skipping`)

      return
    }

    try {
      if (typeof plugin === 'function') {
        // 函数插件：直接将函数注册到上下文
        this.context.request = plugin

        // 记录已安装的插件
        this.plugins.set(pluginId, { plugin, options })

        console.log(`✅ SchemaForm 函数插件已安装: ${pluginId}`)
      } else if (plugin && typeof plugin.install === 'function') {
        // 对象插件：调用 install 方法
        plugin.install(this.context, options)

        // 记录已安装的插件
        this.plugins.set(pluginId, { plugin, options })

        console.log(`✅ SchemaForm 插件已安装: ${pluginId}`)
      } else {
        throw new Error('插件必须是函数或包含 install 方法的对象')
      }
    } catch (error) {
      console.error(`[SchemaForm Plugin] Failed to install plugin "${pluginId}":`, error)
      // 根据错误处理策略，记录错误并跳过插件
    }
  }

  /**
   * 卸载插件
   * 
   * 如果插件实现了 uninstall 方法，会在卸载时调用。
   * 
   * @param pluginId - 插件ID
   * 
   * @example
   * ```typescript
   * pluginManager.uninstall('my-plugin')
   * ```
   */
  uninstall(pluginId: string): void {
    if (this.plugins.has(pluginId)) {
      const pluginData = this.plugins.get(pluginId)!
      const { plugin } = pluginData

      // 调用插件的卸载方法（如果存在）
      if (plugin && typeof plugin !== 'function' && typeof plugin.uninstall === 'function') {
        try {
          plugin.uninstall(this.context)
        } catch (error) {
          console.error(`[SchemaForm Plugin] Error during uninstall of "${pluginId}":`, error)
        }
      }

      this.plugins.delete(pluginId)
      console.log(`🗑️ SchemaForm 插件已卸载: ${pluginId}`)
    } else {
      console.warn(`[SchemaForm Plugin] Plugin "${pluginId}" is not installed`)
    }
  }

  /**
   * 注册钩子回调
   * 
   * 将回调函数注册到指定的生命周期钩子。
   * 当钩子被调用时，所有注册的回调都会按顺序执行。
   * 
   * @param hookName - 钩子名称
   * @param callback - 回调函数
   * 
   * @example
   * ```typescript
   * // 注册 beforeSubmit 钩子
   * pluginManager.tap('beforeSubmit', (values) => {
   *   console.log('Form values:', values)
   * })
   * 
   * // 注册异步钩子
   * pluginManager.tap('beforeSubmit', async (values) => {
   *   await validateWithServer(values)
   * })
   * 
   * // 注册 onFieldChange 钩子
   * pluginManager.tap('onFieldChange', (field, value, oldValue) => {
   *   console.log(`Field ${field} changed from ${oldValue} to ${value}`)
   * })
   * ```
   */
  tap<K extends HookName>(hookName: K, callback: (...args: HookParams[K]) => void | Promise<void>): void {
    const hookSet = this.hooks.get(hookName)
    
    if (!hookSet) {
      console.warn(`[SchemaForm Plugin] Unknown hook name: ${hookName}. Available hooks: ${Array.from(this.hooks.keys()).join(', ')}`)

      return
    }
    
    hookSet.add(callback as HookCallback)
  }

  /**
   * 调用钩子
   * 
   * 执行指定钩子的所有注册回调。回调按注册顺序依次执行，
   * 支持异步回调。如果某个回调抛出错误，会触发 onError 钩子
   * （除非当前就是 onError 钩子），然后继续执行其他回调。
   * 
   * @param hookName - 钩子名称
   * @param args - 传递给回调的参数
   * 
   * @example
   * ```typescript
   * // 调用 beforeSubmit 钩子
   * await pluginManager.call('beforeSubmit', { name: 'John', age: 25 })
   * 
   * // 调用 afterValidate 钩子
   * await pluginManager.call('afterValidate', ['name', 'email'], { name: ['Required'] })
   * 
   * // 调用 onFieldChange 钩子
   * await pluginManager.call('onFieldChange', 'name', 'Jane', 'John')
   * ```
   */
  async call<K extends HookName>(hookName: K, ...args: HookParams[K]): Promise<void> {
    const hookSet = this.hooks.get(hookName)
    
    if (!hookSet || hookSet.size === 0) {
      return
    }
    
    // 按顺序执行所有钩子回调
    for (const callback of hookSet) {
      try {
        await callback(...args)
      } catch (error) {
        console.error(`[SchemaForm Plugin] Hook "${hookName}" callback error:`, error)
        
        // 如果不是 onError 钩子，则触发 onError 钩子
        if (hookName !== 'onError') {
          await this.call('onError', error as Error)
        }
      }
    }
  }

  /**
   * 移除钩子回调
   * 
   * @param hookName - 钩子名称
   * @param callback - 要移除的回调函数
   * 
   * @example
   * ```typescript
   * const myCallback = (values) => console.log(values)
   * pluginManager.tap('beforeSubmit', myCallback)
   * // 稍后移除
   * pluginManager.untap('beforeSubmit', myCallback)
   * ```
   */
  untap<K extends HookName>(hookName: K, callback: (...args: HookParams[K]) => void | Promise<void>): void {
    const hookSet = this.hooks.get(hookName)
    
    if (hookSet) {
      hookSet.delete(callback as HookCallback)
    }
  }

  /**
   * 清除指定钩子的所有回调
   * 
   * @param hookName - 钩子名称
   * 
   * @example
   * ```typescript
   * pluginManager.clearHook('beforeSubmit')
   * ```
   */
  clearHook(hookName: HookName): void {
    const hookSet = this.hooks.get(hookName)
    
    if (hookSet) {
      hookSet.clear()
    }
  }

  /**
   * 获取插件上下文
   * 
   * 返回当前的插件上下文，包含版本信息、store、rendererRegistry 和工具函数。
   * 
   * @returns 插件上下文
   * 
   * @example
   * ```typescript
   * const context = pluginManager.getContext()
   * console.log(context.version) // '1.0.0'
   * console.log(context.store) // FormStore instance or undefined
   * ```
   */
  getContext(): PluginContext {
    return this.context
  }

  /**
   * 设置上下文属性
   * 
   * 动态设置插件上下文的属性，用于在运行时注入 store、rendererRegistry 等。
   * 
   * @param key - 属性名
   * @param value - 属性值
   * 
   * @example
   * ```typescript
   * // 设置 FormStore
   * pluginManager.setContext('store', formStore)
   * 
   * // 设置 RendererRegistry
   * pluginManager.setContext('rendererRegistry', rendererRegistry)
   * 
   * // 设置自定义属性
   * pluginManager.setContext('customData', { foo: 'bar' })
   * ```
   */
  setContext(key: string, value: any): void {
    this.context[key] = value
  }

  /**
   * 获取已安装的插件列表
   * 
   * @returns 插件ID数组
   * 
   * @example
   * ```typescript
   * const plugins = pluginManager.getInstalledPlugins()
   * console.log(plugins) // ['my-plugin', 'another-plugin']
   * ```
   */
  getInstalledPlugins(): string[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * 检查插件是否已安装
   * 
   * @param pluginId - 插件ID
   * @returns 是否已安装
   * 
   * @example
   * ```typescript
   * if (pluginManager.isInstalled('my-plugin')) {
   *   console.log('Plugin is installed')
   * }
   * ```
   */
  isInstalled(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  /**
   * 获取已注册的钩子名称列表
   * 
   * @returns 钩子名称数组
   * 
   * @example
   * ```typescript
   * const hooks = pluginManager.getRegisteredHooks()
   * console.log(hooks) // ['beforeMount', 'afterMount', ...]
   * ```
   */
  getRegisteredHooks(): HookName[] {
    return Array.from(this.hooks.keys())
  }

  /**
   * 获取指定钩子的回调数量
   * 
   * @param hookName - 钩子名称
   * @returns 回调数量
   * 
   * @example
   * ```typescript
   * const count = pluginManager.getHookCallbackCount('beforeSubmit')
   * console.log(count) // 2
   * ```
   */
  getHookCallbackCount(hookName: HookName): number {
    const hookSet = this.hooks.get(hookName)

    return hookSet ? hookSet.size : 0
  }

  /**
   * 清除所有插件和钩子
   * 
   * 卸载所有已安装的插件，并清除所有钩子回调。
   * 
   * @example
   * ```typescript
   * pluginManager.clear()
   * ```
   */
  clear(): void {
    // 先卸载所有插件
    for (const pluginId of this.plugins.keys()) {
      this.uninstall(pluginId)
    }
    
    this.plugins.clear()
    
    // 清除所有钩子回调
    for (const hookSet of this.hooks.values()) {
      hookSet.clear()
    }
    
    console.log('🗑️ 所有 SchemaForm 插件已清除')
  }
}

/**
 * 创建 PluginManager 实例的工厂函数
 * 
 * @returns 新的 PluginManager 实例
 * 
 * @example
 * ```typescript
 * const pluginManager = createPluginManager()
 * pluginManager.use(myPlugin)
 * ```
 */
export function createPluginManager(): PluginManager {
  return new PluginManager()
}

// 创建全局插件管理器实例
const pluginManager = new PluginManager()

export { PluginManager }
export default pluginManager
