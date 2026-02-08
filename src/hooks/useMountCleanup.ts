import { onMounted, onUnmounted } from "vue"

/**
 * 组件挂载时执行回调，卸载时执行清理函数
 * @param callback - 挂载时执行的回调函数，返回清理函数
 */
export const useMountCleanup = (callback: () => (() => void) | void): void => {
  let cleanup: (() => void) | void

  onMounted(() => {
    cleanup = callback()
  })

  onUnmounted(() => {
    if (typeof cleanup === "function") {
      cleanup()
    }
  })
}

export default useMountCleanup
