/**
 * 命名格式检测与转换工具。
 *
 * 提供 camelCase / kebab-case / lowercase 三种命名风格的检测，
 * 以及 camelCase ↔ kebab-case 的双向转换。
 * 主要用于渲染器类型标识的格式归一化。
 *
 * @module utils/slot
 *
 * @example
 * ```typescript
 * import { isCamelCase, camelToKebab, kebabToCamel } from './slot'
 *
 * isCamelCase('myComponent')      // => true
 * camelToKebab('myComponent')     // => 'my-component'
 * kebabToCamel('my-component')    // => 'myComponent'
 * ```
 */

/**
 * 检查字符串是否包含大写字母（驼峰格式特征）。
 *
 * 只要包含至少一个大写字母即视为驼峰格式，
 * 不严格校验是否为标准 camelCase（如首字母小写）。
 *
 * @param str - 待检测的字符串
 *
 * @returns 是否包含大写字母
 *
 * @example
 * ```typescript
 * isCamelCase('myComponent')  // => true
 * isCamelCase('MyComponent')  // => true（PascalCase 也会返回 true）
 * isCamelCase('my-component') // => false
 * isCamelCase('mycomponent')  // => false
 * ```
 */
export const isCamelCase = (str: string): boolean => /[A-Z]/.test(str)

/**
 * 检查字符串是否包含连字符（kebab-case 特征）。
 *
 * 只要包含 `-` 即视为 kebab-case 格式，
 * 不严格校验是否为标准 kebab-case（如全小写、无连续连字符）。
 *
 * @param str - 待检测的字符串
 *
 * @returns 是否包含连字符
 *
 * @example
 * ```typescript
 * isKebabCase('my-component')  // => true
 * isKebabCase('my--component') // => true
 * isKebabCase('myComponent')   // => false
 * isKebabCase('mycomponent')   // => false
 * ```
 */
export const isKebabCase = (str: string): boolean => str.includes("-")

/**
 * 检查字符串是否全小写且不含连字符。
 *
 * 同时排除 camelCase（含大写）和 kebab-case（含连字符）两种格式，
 * 用于识别纯小写标识符（如 `text`、`number`）。
 *
 * @param str - 待检测的字符串
 *
 * @returns 是否为纯小写格式
 *
 * @example
 * ```typescript
 * isLowerCase('text')          // => true
 * isLowerCase('number')        // => true
 * isLowerCase('myComponent')   // => false
 * isLowerCase('my-component')  // => false
 * ```
 */
export const isLowerCase = (str: string): boolean =>
  str === str.toLowerCase() && !str.includes("-")

/**
 * 将驼峰命名转换为连字符命名（kebab-case）。
 *
 * 在每个大写字母前插入 `-` 并转为小写。
 * 如果首字母大写（PascalCase），结果会以 `-` 开头，
 * 调用方需自行处理此情况。
 *
 * @param str - 驼峰格式的字符串
 *
 * @returns 转换后的 kebab-case 字符串
 *
 * @example
 * ```typescript
 * camelToKebab('myComponent')   // => 'my-component'
 * camelToKebab('backgroundColor') // => 'background-color'
 * camelToKebab('MyComponent')   // => '-my-component'（注意前导连字符）
 * ```
 */
export const camelToKebab = (str: string): string => {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * 将连字符命名转换为驼峰命名（camelCase）。
 *
 * 将 `-x` 模式替换为大写字母 `X`。
 * 仅处理小写字母跟在连字符后的情况，
 * 连字符后的数字或大写字母不受影响。
 *
 * @param str - kebab-case 格式的字符串
 *
 * @returns 转换后的 camelCase 字符串
 *
 * @example
 * ```typescript
 * kebabToCamel('my-component')     // => 'myComponent'
 * kebabToCamel('background-color') // => 'backgroundColor'
 * kebabToCamel('font-size')        // => 'fontSize'
 * ```
 */
export const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
}

/**
 * 将命名格式归一化为 kebab-case。
 *
 * 根据输入格式自动选择转换策略：
 * - 驼峰格式 → 调用 camelToKebab 转换
 * - 已是 kebab-case → 原样返回
 * - 纯小写 → 原样返回（无需转换）
 *
 * @param str - 任意命名格式的字符串
 *
 * @returns kebab-case 格式的字符串
 *
 * @example
 * ```typescript
 * normalizeToKebab('myComponent')   // => 'my-component'
 * normalizeToKebab('my-component')  // => 'my-component'
 * normalizeToKebab('text')          // => 'text'
 * ```
 */
export const normalizeToKebab = (str: string): string => {
  if (isCamelCase(str)) return camelToKebab(str)

  return str
}

/**
 * 将命名格式归一化为 camelCase。
 *
 * 根据输入格式自动选择转换策略：
 * - kebab-case → 调用 kebabToCamel 转换
 * - 已是驼峰格式 → 原样返回
 * - 纯小写 → 原样返回（无需转换）
 *
 * @param str - 任意命名格式的字符串
 *
 * @returns camelCase 格式的字符串
 *
 * @example
 * ```typescript
 * normalizeToCamel('my-component')  // => 'myComponent'
 * normalizeToCamel('myComponent')   // => 'myComponent'
 * normalizeToCamel('text')          // => 'text'
 * ```
 */
export const normalizeToCamel = (str: string): string => {
  if (isKebabCase(str)) return kebabToCamel(str)

  return str
}

/**
 * 从插槽对象中按名称查找插槽，同时支持 camelCase 和 kebab-case。
 *
 * 优先查找原始名称，未找到时尝试另一种命名格式。
 * 例如传入 `userName` 时，先查 `userName`，再查 `user-name`；
 * 传入 `user-name` 时，先查 `user-name`，再查 `userName`。
 *
 * @param slots - Vue 插槽对象
 * @param name - 插槽名称（camelCase 或 kebab-case）
 *
 * @returns 匹配的插槽函数，未找到返回 undefined
 *
 * @example
 * ```typescript
 * // slots 中定义了 'user-name' 插槽
 * resolveSlot(slots, 'userName')   // => 找到 'user-name' 插槽
 * resolveSlot(slots, 'user-name')  // => 找到 'user-name' 插槽
 * ```
 */
export const resolveSlot = (
  slots: Record<string, any>,
  name: string
): ((...args: any[]) => any) | undefined => {
  if (slots[name]) return slots[name]

  const alt = isCamelCase(name)
    ? camelToKebab(name)
    : isKebabCase(name)
      ? kebabToCamel(name)
      : undefined

  if (alt && slots[alt]) return slots[alt]

  return undefined
}

/**
 * 从父级插槽中提取子渲染器插槽。
 *
 * 按 `fieldName:slotName` 和 `fieldName:slot-name` 格式匹配，
 * 提取后去掉前缀作为子渲染器的插槽名。
 * 同时支持 camelCase 和 kebab-case 的 fieldName。
 *
 * @param fieldName - 字段名
 * @param allSlots - 父级全部插槽
 *
 * @returns 子渲染器的插槽对象
 *
 * @example
 * ```typescript
 * // 父级插槽: { 'userName:prefix': fn, 'userName:suffix': fn, 'userNameLabel': fn }
 * extractChildSlots('userName', slots)
 * // => { prefix: fn, suffix: fn }
 * ```
 */
export const extractChildSlots = (
  fieldName: string,
  allSlots: Record<string, any>
): Record<string, any> => {
  const result: Record<string, any> = {}
  const camelPrefix = normalizeToCamel(String(fieldName)) + ":"
  const kebabPrefix = normalizeToKebab(String(fieldName)) + ":"

  for (const [key, value] of Object.entries(allSlots)) {
    if (key.startsWith(camelPrefix)) {
      result[key.slice(camelPrefix.length)] = value
    } else if (key.startsWith(kebabPrefix) && kebabPrefix !== camelPrefix) {
      result[key.slice(kebabPrefix.length)] = value
    }
  }

  return result
}
