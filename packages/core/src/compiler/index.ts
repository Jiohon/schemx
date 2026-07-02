/**
 * Schema 编译器入口。
 *
 * 仅用于向外导出，实现见 `./createCompile`，类型见 `./types`。
 *
 * @module core/compiler
 */

export { createCompile } from "./createCompile"

export type { Compile, CompileCache, CompileOptions, CompileError } from "./types"
