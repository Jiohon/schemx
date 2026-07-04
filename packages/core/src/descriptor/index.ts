/**
 * Descriptor 模块统一导出。
 *
 * 提供 descriptor 创建函数和 descriptor 类型。
 *
 * @module core/descriptor
 */

export { createDescriptor } from "./createDescriptor"

export { isDependencyDescriptor, isFieldDescriptor, isGroupDescriptor } from "./helper"

export type {
  BaseDescriptor,
  CreateDependencyDescriptorOptions,
  CreateDescriptorOptions,
  CreateFieldDescriptorOptions,
  CreateGroupDescriptorOptions,
  DescriptorMeta,
  DescriptorType,
  DependencyDescriptor,
  DependencyRenderer,
  FieldDescriptor,
  FieldDynamicPropsDescriptor,
  FieldValidationDescriptor,
  FormDescriptor,
  GroupDescriptor,
} from "./types"
