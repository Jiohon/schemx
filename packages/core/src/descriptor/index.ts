/**
 * Descriptor 模块统一导出。
 *
 * 提供 schema 编译和内部 descriptor 类型。
 *
 * @module core/descriptor
 */

export { compileToDescriptors, CompileError, type CompileOptions } from "./compiler"

export {
  isDependencyDescriptor,
  isFieldDescriptor,
  isGroupDescriptor,
  type DependencyDescriptor,
  type DependencyRenderer,
  type FieldDescriptor,
  type FormDescriptor,
  type GroupDescriptor,
  type ValidationDescriptor,
} from "./descriptor"
