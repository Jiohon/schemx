/**
 * Form Facade - 公共表单门面（骨架）
 *
 * @module core/runtimeGraph/formFacade
 */

import type { RuntimeGraph, FormFacade } from "./types"
import type {
  SchemxInstance,
  SchemxFormApi,
  Values,
} from "../types/form"
import type { SchemxViewSchema } from "../view/types"
import type { ValidateResult } from "../validator"

/**
 * 创建 Form Facade。
 */
export function createFormFacade<TValues extends Values = Values>(
  runtimeGraph: RuntimeGraph<TValues>
): FormFacade<TValues> {
  const facade = new FormFacadeImpl(runtimeGraph)
  return facade as unknown as FormFacade<TValues>
}

/**
 * Form Facade 实现。
 */
class FormFacadeImpl<TValues extends Values = Values> {
  private runtimeGraph: RuntimeGraph<TValues>
  private _destroyed = false

  constructor(runtimeGraph: RuntimeGraph<TValues>) {
    this.runtimeGraph = runtimeGraph
  }

  // 表单 API（传递给 dynamic slot renderer）
  get formApi(): SchemxFormApi<TValues> {
    return {
      setValue: this.setFieldValue.bind(this),
      setValues: this.setFieldsValue.bind(this),
      getValue: this.getFieldValue.bind(this),
      getValues: this.getFieldsValue.bind(this),
      getSnapshots: this.getFieldsSnapshot.bind(this),
      setPending: this.setFieldPending.bind(this),
      isPending: this.isFieldPending.bind(this),
      setTouched: this.setFieldTouched.bind(this),
      isTouched: this.isFieldTouched.bind(this),
      getError: this.getFieldError.bind(this),
      setError: this.setFieldError.bind(this),
      resetFields: this.resetFields.bind(this),
      reset: this.reset.bind(this),
      validateField: this.validateField.bind(this),
      validate: this.validate.bind(this),
    } as unknown as SchemxFormApi<TValues>
  }

  // 值操作
  setFieldValue<TName extends keyof TValues>(
    name: TName,
    value: TValues[TName] | undefined
  ): void {
    if (this._destroyed) return
    this.runtimeGraph.setFieldValue(name, value)
  }

  setFieldsValue(values: Partial<TValues>): void {
    if (this._destroyed) return
    for (const [name, value] of Object.entries(values) as [
      keyof TValues,
      TValues[keyof TValues]
    ][]) {
      this.runtimeGraph.setFieldValue(name, value)
    }
  }

  getFieldValue<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined {
    return this.runtimeGraph.getFieldValue(name)
  }

  getFieldsValue(): TValues {
    return this.runtimeGraph.valueGraph.snapshot.values
  }

  getFieldSnapshot<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined {
    return this.runtimeGraph.getFieldValue(name)
  }

  getFieldsSnapshot(): TValues {
    return this.runtimeGraph.valueGraph.snapshot.values
  }

  getInitialValue<TName extends keyof TValues>(
    name: TName
  ): TValues[TName] | undefined {
    // TODO: 从 valueGraph 获取 initialValue
    return undefined
  }

  getInitialValues(): Partial<TValues> {
    // TODO: 从 valueGraph 获取 initialValues
    return {}
  }

  setInitialValues(values: Partial<TValues>): void {
    if (this._destroyed) return
    this.runtimeGraph.valueGraph.setInitialValues(values)
  }

  // 状态操作
  isFieldTouched(name: keyof TValues): boolean {
    return this.runtimeGraph.valueGraph.snapshot.touched[name] ?? false
  }

  setFieldTouched(name: keyof TValues, touched: boolean): void {
    if (this._destroyed) return
    this.runtimeGraph.valueGraph.setTouched(name, touched)
  }

  getTouchedFields(): Partial<Record<keyof TValues, boolean>> {
    return this.runtimeGraph.valueGraph.snapshot.touched
  }

  setFieldPending(name: keyof TValues, pending: boolean): void {
    if (this._destroyed) return
    this.runtimeGraph.valueGraph.setValidating(name, pending)
  }

  isFieldPending(name: keyof TValues): boolean {
    return this.runtimeGraph.valueGraph.snapshot.validating[name] ?? false
  }

  getPendingFields(): Partial<Record<keyof TValues, boolean>> {
    return this.runtimeGraph.valueGraph.snapshot.validating
  }

  // 错误操作
  getFieldError(name: keyof TValues): readonly string[] {
    return this.runtimeGraph.valueGraph.snapshot.errors[name] ?? []
  }

  setFieldError(name: keyof TValues, errors: readonly string[]): void {
    if (this._destroyed) return
    this.runtimeGraph.valueGraph.setErrors(name, errors)
  }

  // 校验操作
  async validateField(name: keyof TValues): Promise<ValidateResult<TValues>> {
    // TODO: Phase 4 实现完整的校验
    return { ok: true, values: this.getFieldsValue() }
  }

  async validate(): Promise<ValidateResult<TValues>> {
    const valid = await this.runtimeGraph.validate()
    if (valid) {
      return { ok: true, values: this.getFieldsValue() }
    }
    return {
      ok: false,
      error: {
        errors: [],
        values: this.getFieldsValue(),
      },
    }
  }

  // 重置操作
  resetFields(): void {
    // TODO: 实现重置
  }

  reset(): void {
    this.resetFields()
  }

  // 提交操作
  async submit(): Promise<void> {
    const result = await this.validate()
    if (result.ok) {
      // TODO: 调用 onFinish 回调
    } else {
      // TODO: 调用 onFinishFailed 回调
    }
  }

  // Schema 操作
  setSchemas(schemas: unknown): void {
    if (this._destroyed) return
    this.runtimeGraph.setSchemas(schemas as any)
  }

  updateSchemas(updater: (schemas: unknown[]) => unknown[]): void {
    // TODO: 实现
  }

  updateDefaultProps(partial: Record<string, unknown>): void {
    // TODO: 实现
  }

  // 视图操作
  getViewRevision(): number {
    // TODO: 从 viewGraph 获取 revision
    return 0
  }

  getViewSchemas(): readonly SchemxViewSchema<TValues>[] {
    return this.runtimeGraph.viewGraph.getCurrentViewSchemas()
  }

  subscribeViewSchemas(
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): () => void {
    return this.runtimeGraph.viewGraph.subscribe(callback)
  }

  async waitForDependencies(timeout?: number): Promise<boolean> {
    // TODO: 实现
    return true
  }

  // 渲染器和校验器注册表（兼容旧 API）
  getRenderer(key: string): unknown {
    return undefined
  }

  registerRenderer(key: string, renderer: unknown): void {
    // TODO: 兼容
  }

  hasRenderer(key: string): boolean {
    return false
  }

  getValidator(key: string): unknown {
    return undefined
  }

  registerValidator(key: string, validator: unknown): void {
    // TODO: 兼容
  }

  hasValidator(key: string): boolean {
    return false
  }

  registerRules(name: keyof TValues, rules: unknown, defaultMessage?: string): void {
    // TODO: 兼容
  }

  unregisterRules(name: keyof TValues): void {
    // TODO: 兼容
  }

  // Effect 操作
  effect(fn: () => void): () => void {
    fn()
    return () => {}
  }

  batch(fn: () => void): void {
    fn()
  }

  // 销毁操作
  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true
    this.runtimeGraph.destroy()
  }
}
