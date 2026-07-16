import { SchemxViewSchema } from "@schemx/core"

/**
 * 判断当前项是否为顶层可见普通字段所在区段的第一个或最后一个。
 *
 * 可见 Group 是区段边界；不可见字段和不可见 Group 不参与计算。
 *
 * 使用示例：
 *
 * const list = [
 *   { key: 'group-1', children: [] },
 *   { key: 'a' },
 *   { key: 'b' },
 *   { key: 'group-2', children: [] },
 *   { key: 'c' },
 * ]
 *
 * getSectionPosition(list, 'a')
 * // => { found: true, isFirst: true, isLast: false }
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

  if (!isPositionItem(currentItem)) {
    return {
      found: true,
      isFirst: false,
      isLast: false,
    }
  }

  return {
    found: true,
    isFirst: !hasPositionItemInSection(list, currentIndex, -1),
    isLast: !hasPositionItemInSection(list, currentIndex, 1),
  }
}

/**
 * 判断 schema 是否为 Group ViewSchema。
 */
function isViewGroupSchema<T extends SchemxViewSchema>(
  item?: T
): item is Extract<T, { children: readonly SchemxViewSchema[] }> {
  return !!item && "children" in item
}

function isPositionItem<T extends SchemxViewSchema>(item?: T) {
  return !!item && !isViewGroupSchema(item) && item.visible !== false
}

function hasPositionItemInSection<T extends SchemxViewSchema>(
  list: T[],
  startIndex: number,
  step: 1 | -1
): boolean {
  for (let index = startIndex + step; index >= 0 && index < list.length; index += step) {
    const item = list[index]

    if (item.visible === false) {
      continue
    }

    if (isViewGroupSchema(item)) {
      return false
    }

    if (isPositionItem(item)) {
      return true
    }
  }

  return false
}
