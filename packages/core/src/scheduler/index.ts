/**
 * 调度器模块。
 *
 * 提供统一的运行时任务调度能力，支持按 channel 去重、优先级排序和空闲检测。
 * 用于 dependency renderer、动态属性解析、校验等异步任务的协调。
 *
 * @module core/scheduler
 */

export {
  createRuntimeScheduler,
  type RuntimeJob,
  type RuntimeJobChannel,
  type RuntimeScheduler,
  type SchedulerPhase,
} from "./scheduler"
