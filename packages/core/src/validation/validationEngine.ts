/**
 * Validation Engine - 校验引擎（骨架）
 *
 * @module core/validation/validationEngine
 */

import type { ValidationEngine, ValidationState, ValidationResult } from "./types"
import type { NodeId } from "../schemaGraph/types"
import type { Values } from "../types"

/**
 * Validation Engine 实现（骨架）。
 */
export class ValidationEngineImpl<TValues extends Values = Values>
  implements ValidationEngine<TValues>
{
  private states: Map<NodeId, ValidationState> = new Map()

  mountField(nodeId: NodeId, fieldName: keyof TValues): void {
    this.states.set(nodeId, {
      errors: [],
      validating: false,
    })
  }

  async validateField(nodeId: NodeId): Promise<ValidationResult> {
    // TODO: Phase 4 实现
    return { valid: true, errors: [] }
  }

  async validateForm(): Promise<ValidationResult> {
    // TODO: Phase 4 实现
    return { valid: true, errors: [] }
  }

  getState(nodeId: NodeId): ValidationState | undefined {
    return this.states.get(nodeId)
  }

  clearErrors(nodeId: NodeId): void {
    const state = this.states.get(nodeId)
    if (state) {
      this.states.set(nodeId, { ...state, errors: [] })
    }
  }

  disposeNode(nodeId: NodeId): void {
    this.states.delete(nodeId)
  }
}

/**
 * 创建 ValidationEngine 实例。
 */
export function createValidationEngine<
  TValues extends Values = Values
>(): ValidationEngine<TValues> {
  return new ValidationEngineImpl<TValues>()
}
