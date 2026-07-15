import {
  cancel,
  groupMultiselect,
  isCancel,
  multiselect,
  select,
} from "@clack/prompts"

// 所有交互提示都显式使用当前终端流，保证方向键、空格和 Enter 能传递给 Clack。
function withTerminal(options = {}) {
  return {
    ...options,
    input: options.input ?? process.stdin,
    output: options.output ?? process.stderr,
  }
}

/** 单选提示。 */
export function promptSelect(options) {
  return select(withTerminal(options))
}

/** 多选提示。 */
export function promptMultiselect(options) {
  return multiselect(withTerminal(options))
}

/** 分组多选提示；组标题可用于批量勾选组内选项。 */
export function promptGroupMultiselect(options) {
  return groupMultiselect({
    selectableGroups: true,
    ...withTerminal(options),
  })
}

/** 判断提示是否被用户取消。 */
export function isPromptCancelled(value) {
  return isCancel(value)
}

/** 用统一样式输出取消提示。 */
export function cancelSelection(message = "已取消选择", options = {}) {
  cancel(message, withTerminal(options))
}
