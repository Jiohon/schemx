/**
 * 路径工具函数
 * 
 * 提供嵌套路径的解析和设置功能，支持点号分隔的路径格式（如 `user.address.city`）。
 * 
 * @module core/utils/path
 * 
 * @example
 * ```typescript
 * import { getByPath, setByPath } from './path'
 * 
 * const obj = { user: { address: { city: 'Beijing' } } }
 * 
 * // 获取嵌套值
 * getByPath(obj, 'user.address.city') // => 'Beijing'
 * 
 * // 设置嵌套值（会自动创建中间对象）
 * setByPath(obj, 'user.profile.name', 'John')
 * // obj => { user: { address: { city: 'Beijing' }, profile: { name: 'John' } } }
 * ```
 */

/**
 * 从对象中根据路径获取嵌套值
 * 
 * 支持点号分隔的路径格式，如 `user.address.city`。
 * 如果路径中的任何部分为 null 或 undefined，则返回 undefined。
 * 
 * @param obj - 要获取值的源对象
 * @param path - 点号分隔的路径字符串
 * @returns 路径对应的值，如果路径不存在则返回 undefined
 * 
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', address: { city: 'Beijing' } } }
 * 
 * getByPath(obj, 'user.name')           // => 'John'
 * getByPath(obj, 'user.address.city')   // => 'Beijing'
 * getByPath(obj, 'user.age')            // => undefined
 * getByPath(obj, 'user.profile.bio')    // => undefined
 * getByPath(null, 'any.path')           // => undefined
 * getByPath(obj, '')                    // => obj (返回原对象)
 * ```
 */
export function getByPath(obj: any, path: string): any {
  // 处理空路径的情况
  if (path === '') {
    return obj
  }

  const keys = path.split('.')
  let result = obj

  for (const key of keys) {
    // 如果当前结果为 null 或 undefined，无法继续访问
    if (result == null) {
      return undefined
    }

    result = result[key]
  }

  return result
}

/**
 * 在对象中根据路径设置嵌套值
 * 
 * 支持点号分隔的路径格式，如 `user.address.city`。
 * 如果路径中的中间对象不存在，会自动创建空对象。
 * 
 * @param obj - 要设置值的目标对象
 * @param path - 点号分隔的路径字符串
 * @param value - 要设置的值
 * 
 * @example
 * ```typescript
 * const obj = { user: { name: 'John' } }
 * 
 * setByPath(obj, 'user.age', 25)
 * // obj => { user: { name: 'John', age: 25 } }
 * 
 * setByPath(obj, 'user.address.city', 'Beijing')
 * // obj => { user: { name: 'John', age: 25, address: { city: 'Beijing' } } }
 * 
 * setByPath(obj, 'settings.theme', 'dark')
 * // obj => { user: {...}, settings: { theme: 'dark' } }
 * ```
 */
export function setByPath(obj: any, path: string, value: any): void {
  // 处理空路径的情况 - 无法设置
  if (path === '') {
    return
  }

  // 处理 null/undefined 对象的情况
  if (obj == null) {
    return
  }

  const keys = path.split('.')
  let current = obj

  // 遍历到倒数第二个 key，确保中间路径存在
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    
    // 如果当前 key 对应的值不存在或不是对象，创建空对象
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {}
    }
    
    current = current[key]
  }

  // 设置最终的值
  const lastKey = keys[keys.length - 1]
  current[lastKey] = value
}

/**
 * 检查路径是否为有效的嵌套路径格式
 * 
 * 有效的路径应该是非空字符串，可以包含点号分隔的多个部分。
 * 每个部分应该是有效的对象属性名。
 * 
 * @param path - 要检查的路径字符串
 * @returns 是否为有效路径
 * 
 * @example
 * ```typescript
 * isValidPath('user.name')        // => true
 * isValidPath('user.address.city') // => true
 * isValidPath('name')             // => true
 * isValidPath('')                 // => false
 * isValidPath('.')                // => false
 * isValidPath('user..name')       // => false
 * ```
 */
export function isValidPath(path: string): boolean {
  if (typeof path !== 'string' || path === '') {
    return false
  }

  const keys = path.split('.')
  
  // 检查是否有空的 key（如 'user..name' 或 '.name' 或 'name.'）
  return keys.every(key => key.length > 0)
}

/**
 * 解析路径为 key 数组
 * 
 * @param path - 点号分隔的路径字符串
 * @returns key 数组
 * 
 * @example
 * ```typescript
 * parsePath('user.address.city') // => ['user', 'address', 'city']
 * parsePath('name')              // => ['name']
 * parsePath('')                  // => []
 * ```
 */
export function parsePath(path: string): string[] {
  if (path === '') {
    return []
  }

  return path.split('.')
}

/**
 * 检查对象中是否存在指定路径
 * 
 * @param obj - 要检查的对象
 * @param path - 点号分隔的路径字符串
 * @returns 路径是否存在
 * 
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', address: null } }
 * 
 * hasPath(obj, 'user.name')      // => true
 * hasPath(obj, 'user.address')   // => true (值为 null 但路径存在)
 * hasPath(obj, 'user.age')       // => false
 * hasPath(obj, 'user.profile.bio') // => false
 * ```
 */
export function hasPath(obj: any, path: string): boolean {
  if (path === '') {
    return true
  }

  const keys = path.split('.')
  let current = obj

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    
    // 检查当前对象是否为 null/undefined
    if (current == null || typeof current !== 'object') {
      return false
    }
    
    // 检查 key 是否存在于当前对象中
    if (!(key in current)) {
      return false
    }
    
    current = current[key]
  }

  return true
}

/**
 * 删除对象中指定路径的值
 * 
 * @param obj - 要操作的对象
 * @param path - 点号分隔的路径字符串
 * @returns 是否成功删除
 * 
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', age: 25 } }
 * 
 * deleteByPath(obj, 'user.age')  // => true, obj => { user: { name: 'John' } }
 * deleteByPath(obj, 'user.bio')  // => false (路径不存在)
 * ```
 */
export function deleteByPath(obj: any, path: string): boolean {
  if (path === '' || obj == null) {
    return false
  }

  const keys = path.split('.')
  let current = obj

  // 遍历到倒数第二个 key
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    
    if (current[key] == null || typeof current[key] !== 'object') {
      return false
    }
    
    current = current[key]
  }

  const lastKey = keys[keys.length - 1]
  
  // 检查最后一个 key 是否存在
  if (!(lastKey in current)) {
    return false
  }

  delete current[lastKey]

  return true
}
