import { SchemxViewSchema } from "@schemx/core"

/**
 * 判断当前项是否为分组区间内的第一个或最后一个普通项。
 *
 * 这里的分组区间指：
 * - `group` 类型的数据作为分隔符；
 * - 两个 `group` 之间的普通项属于同一个区间；
 * - 数组开头到第一个 `group` 之间，也可以视为一个区间；
 * - 最后一个 `group` 到数组结尾之间，也可以视为一个区间。
 *
 * 判断规则：
 * - 当前项前一个元素不存在，或前一个元素是 `group`，则当前项是本区间第一个普通项；
 * - 当前项后一个元素不存在，或后一个元素是 `group`，则当前项是本区间最后一个普通项。
 *
 * 使用示例：
 *
 * const list = [
 *   { key: 'group-1', type: 'group' },
 *   { key: 'a' },
 *   { key: 'b' },
 *   { key: 'group-2', type: 'group' },
 *   { key: 'c' },
 * ]
 *
 * getSectionPosition(list, 'a')
 * // => { found: true, isFirst: true, isLast: false }
 *
 * getSectionPosition(list, 'b')
 * // => { found: true, isFirst: false, isLast: true }
 *
 * getSectionPosition(list, 'c')
 * // => { found: true, isFirst: true, isLast: true }
 *
 * getSectionPosition(list, 'group-1')
 * // => { found: true, isFirst: false, isLast: false }
 *
 * getSectionPosition(list, 'not-exist')
 * // => { found: false, isFirst: false, isLast: false }
 *
 * 注意：
 * 该函数只适用于“group 仅作为区间分隔符”的数据结构。
 * 如果区间内还存在其他需要忽略的类型，例如 hidden、disabled 等，
 * 则不能只判断相邻元素，需要改为向前 / 向后扫描。
 */
export function getSectionPosition<T extends SchemxViewSchema>(
  list: T[],
  currentKey: string
) {
  const currentIndex = list.findIndex((item) => item.key === currentKey)

  if (currentIndex === -1) {
    return {
      found: false,
      isFirst: false,
      isLast: false,
    }
  }

  const currentItem = list[currentIndex]

  if (isGroupItem(currentItem)) {
    return {
      found: true,
      isFirst: false,
      isLast: false,
    }
  }

  const prevItem = list[currentIndex - 1]
  const nextItem = list[currentIndex + 1]

  return {
    found: true,
    isFirst: !prevItem || isGroupItem(prevItem),
    isLast: !nextItem || isGroupItem(nextItem),
  }
}

/**
 * 判断当前项是否为 group 分隔项。
 */
function isGroupItem<T extends SchemxViewSchema>(item?: T) {
  return item?.componentType === "group"
}
