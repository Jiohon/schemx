先确认一下现有的导出和引用关系，确保计划覆盖所有需要改动的文件。

Analyzed code

index.ts
Searched workspace
查找所有引用 subscriber 模块的文件
[MODE: PLAN]

让我再确认几个关键引用点，确保计划完整。

Searched workspace
查找 Vue 层对 FieldSubscribeCallback 等类型的引用
查找 createForm 中 subscriber 的所有使用方式
查找 FieldsSubscribeCallback 在 core 中的导出和使用
好，现在我对所有引用关系都清楚了。下面是完整的实现计划。

实现计划
变更文件清单
[CHANGE PLAN]

- Files:
  packages/core/package.json — 添加 @preact/signals-core 依赖
  packages/core/src/store.ts — 重写：signal Map + 订阅能力
  packages/core/src/subscriber.ts — 保留文件，改为从 store 重导出类型
  packages/core/src/createForm.ts — 适配新 Store API，移除 Subscriber 实例
  packages/core/src/index.ts — 调整导出来源
  packages/core/src/types/form.ts — 调整类型导入来源
  packages/core/src/createWatch.ts — 调整类型导入来源
  packages/vue/src/hooks/useField/index.ts — 用 signalEffect 替代 subscribe 桥接
- Rationale: 用 @preact/signals-core 替代手动发布订阅，Store 吸收 Subscriber 能力
  详细规格

1.  package.json

添加依赖："@preact/signals-core": "^1.13.0"

2.  store.ts
    — 重写

新的 FormStore 内部结构：

class FormStore<T extends FormValues> {
// signal 存储：每个字段路径一个 signal
private signals: Map<string, Signal<any>>

// 初始值（普通对象，不需要 signal）
private initialValues: T

// 全局订阅者（保留手动回调模式）
private globalSubscribers: Set<GlobalSubscribeCallback<T>>

// 多字段组订阅者（保留手动回调模式）
private fieldsSubscribers: Map<string, { paths: Set<NamePath<T>>; callbacks: Set<FieldsSubscribeCallback<T>> }>
}
关键方法实现逻辑：

getOrCreateSignal(path) — 从 signals Map 取或创建新 signal
getFieldValue(path) — 读 getOrCreateSignal(path).value（在 signal effect 中自动收集依赖）
setFieldValue(path, value) — 写 signal.value + 手动通知全局/多字段组订阅者
setFieldsValue(values) — batch(() => { 逐字段写 signal }) + 手动通知
subscribe(path, cb) — 用 effect(() => { 读 signal → 调 cb }) 实现，返回 dispose
subscribeFields(paths, cb) — 用 effect(() => { 读多个 signal → 调 cb }) 实现
subscribeAll(cb) — 手动回调模式，加入 globalSubscribers Set
reset() — batch(() => { 重置所有 signal }) + 通知全局
getFieldsSnapshot() — 遍历 signals Map 构建普通对象（用 signal.peek() 避免收集依赖）
clear() — 清除所有订阅者
destroy() — dispose 所有内部 effect + clear
回调类型（FieldSubscribeCallback / FieldsSubscribeCallback / GlobalSubscribeCallback）从 subscriber.ts 移到 store.ts 中定义。

3.  subscriber.ts
    — 改为重导出

不删除文件（避免破坏外部可能的直接引用），改为从 store 重导出所有类型：

export type {
FieldSubscribeCallback,
FieldsSubscribeCallback,
GlobalSubscribeCallback,
} from "./store"

// 保留 Subscriber 类和 createSubscriber 的导出，标记 @deprecated
实际上考虑到这是内部项目，直接删除 Subscriber class 和 createSubscriber，只保留类型重导出即可。

4.  createForm.ts
    — 适配

移除 import { createSubscriber, Subscriber }
移除 private subscriber: Subscriber<T> 字段
移除 this.subscriber = createSubscriber<T>()
subscribe / subscribeFields / subscribeAll 改为调 this.store.subscribe(...) 等
setFieldValue / setFieldsValue 移除手动 this.notify(...) 调用（Store 内部自动处理）
notify 方法删除
destroy 改为调 this.store.destroy()
onValuesChange / onFieldsChange 回调注册改为调 this.store.subscribeAll(...) 5.
index.ts
— 调整导出

Subscriber 相关导出改为从 store 导出
移除 Subscriber class 和 createSubscriber 的导出
保留 FieldSubscribeCallback / FieldsSubscribeCallback / GlobalSubscribeCallback 类型导出（来源改为 store）6.
form.ts
— 调整导入

FieldSubscribeCallback / FieldsSubscribeCallback / GlobalSubscribeCallback 的 import 来源从 "../subscriber" 改为 "../store" 7.
createWatch.ts
— 调整导入

同上，类型导入来源从 "./subscriber" 改为 "./store" 8.
index.ts
— 桥接改造

添加 import { effect as signalEffect } from '@preact/signals-core'
移除 subscribe 回调桥接
用 signalEffect(() => { fieldValue.value = form.getFieldValue(name) }) 替代
error 同步保持手动模式（validate / setError / clearError 时更新 fieldError ref）
返回值接口不变
subscribe 方法中 prevSnapshot / latestSnapshot 的处理
当前 subscribe 回调签名是 (payload, prevSnapshot, latestSnapshot) => void。在 signal effect 实现中：

subscribe(path, callback) {
let prevValue = this.getFieldValue(path) // 用 peek 避免收集依赖

return effect(() => {
const value = this.getOrCreateSignal(path).value // 收集依赖
const prev = prevValue
prevValue = value

    callback(
      { path, value, prevValue: prev },
      /* prevSnapshot 和 latestSnapshot 在 effect 中难以高效提供 */
    )

})
}
这里有个问题：prevSnapshot 和 latestSnapshot 需要全量快照，在 effect 中每次都 clone 整个 values 对象代价较大。

解决方案：subscribe 的 effect 实现中，prevSnapshot 和 latestSnapshot 改为惰性获取 — 传入 getter 函数或者在 setFieldValue 时缓存最近一次的 prevSnapshot。

最简单的做法：Store 维护一个 lastPrevSnapshot 和 lastLatestSnapshot，在 setFieldValue / setFieldsValue 时更新：

setFieldValue(path, value) {
this.lastPrevSnapshot = this.getFieldsSnapshot()
this.getOrCreateSignal(path).value = value
this.lastLatestSnapshot = this.getFieldsSnapshot()
// effect 自动触发，回调中读 this.lastPrevSnapshot / lastLatestSnapshot
this.notifyGlobal(...)
}
IMPLEMENTATION CHECKLIST

1. 安装 @preact/signals-core 依赖到 packages/core
2. 重写 packages/core/src/store.ts
   2.1 定义回调类型（从 subscriber.ts 迁移）
   2.2 实现 signal Map 存储（getOrCreateSignal）
   2.3 实现 getFieldValue / setFieldValue（signal 读写）
   2.4 实现 setFieldsValue（batch 包裹）
   2.5 实现 getFieldsValue / getFieldsSnapshot（peek 读取）
   2.6 实现 getInitialValues / setInitialValues
   2.7 实现 isFieldTouched / isFieldsTouched / getTouchedFields
   2.8 实现 reset / resetField（batch + 通知）
   2.9 实现 subscribe（signal effect）
   2.10 实现 subscribeFields（signal effect + batch）
   2.11 实现 subscribeAll（手动回调）
   2.12 实现 notifyGlobal / notifyFieldFields（内部方法）
   2.13 实现 clear / destroy
3. 改写 packages/core/src/subscriber.ts 为类型重导出
4. 改写 packages/core/src/createForm.ts 适配新 Store
   4.1 移除 Subscriber 相关导入和实例化
   4.2 subscribe/subscribeFields/subscribeAll 委托给 store
   4.3 setFieldValue/setFieldsValue 移除手动 notify
   4.4 reset/resetFields 适配
   4.5 destroy 适配
5. 调整 packages/core/src/index.ts 导出
6. 调整 packages/core/src/types/form.ts 类型导入
7. 调整 packages/core/src/createWatch.ts 类型导入
8. 改写 packages/vue/src/hooks/useField/index.ts 桥接层
9. 运行现有测试验证兼容性
   确认这个计划没问题的话，说 "ENTER EXECUTE MODE" 我就开始实现。
