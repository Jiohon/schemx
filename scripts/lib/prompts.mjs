import { createTerminalUi } from "./terminal-feedback/index.mjs"

function resolveUi(options = {}) {
  return createTerminalUi({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stderr,
  })
}

/** 单选提示。 */
export function promptSelect(options) {
  return resolveUi(options).select(options)
}

/** 文本输入提示。 */
export function promptText(options) {
  return resolveUi(options).text(options)
}

/** 多选提示。 */
export function promptMultiselect(options) {
  return resolveUi(options).multiselect(options)
}

/** 分组多选提示；组标题可用于批量勾选组内选项。 */
export function promptGroupMultiselect(options) {
  return resolveUi(options).groupMultiselect(options)
}

/** 判断提示是否被用户取消。 */
export function isPromptCancelled(value) {
  return resolveUi().isCancelled(value)
}

/** 用统一样式输出取消提示。 */
export function cancelSelection(message = "已取消选择", options = {}) {
  resolveUi(options).cancel(message)
}
