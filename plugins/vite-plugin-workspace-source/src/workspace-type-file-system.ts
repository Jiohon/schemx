import fs from "node:fs"
import path from "node:path"

export interface WorkspaceTypeFileSystem {
  fileExists(filename: string): boolean
  readFile(filename: string): string | undefined
  realpath(filename: string): string
}

export interface WorkspaceTypeFileSystemOptions {
  /** 应用源码根目录，用于解析以 `@/` 开头的文件。 */
  appRoot: string

  /** 读取文件后执行的源码转换，例如 uni-app 的条件编译。 */
  transform?: (source: string, filename: string) => string
}

/**
 * 创建供 Vue SFC 类型解析使用的 Node 文件系统适配。
 *
 * 与 `existsSync()` 不同，`fileExists()` 只会把普通文件报告为存在，避免
 * Vue 在解析目录入口时把目录交给 `readFile()`。
 */
export function createWorkspaceTypeFileSystem(
  options: WorkspaceTypeFileSystemOptions
): WorkspaceTypeFileSystem {
  const appRoot = path.resolve(options.appRoot)

  function resolveFilename(filename: string): string {
    return filename.startsWith("@/") ? path.resolve(appRoot, filename.slice(2)) : filename
  }

  return {
    fileExists(filename) {
      try {
        const resolvedFilename = resolveFilename(filename)
        return fs.statSync(resolvedFilename).isFile()
      } catch {
        return false
      }
    },

    readFile(filename) {
      const resolvedFilename = resolveFilename(filename)

      try {
        if (!fs.statSync(resolvedFilename).isFile()) {
          return undefined
        }

        const source = fs.readFileSync(resolvedFilename, "utf8")

        return options.transform?.(source, resolvedFilename) ?? source
      } catch {
        return undefined
      }
    },

    realpath(filename) {
      const resolvedFilename = resolveFilename(filename)

      try {
        return fs.realpathSync(resolvedFilename)
      } catch {
        return resolvedFilename
      }
    },
  }
}
