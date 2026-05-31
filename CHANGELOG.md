## RendererRegistry 重构

### TSX 转 SFC

将 `packages/vant/src/renderers/*` 下的所有子渲染器转换为 Vue SFC 写法。

例如文件结构：

```
UploadRenderer/
  index.ts        — 统一入口，导出组件 default + 类型
  index.vue       — SFC 组件，defineProps<UploadRendererProps> + withDefaults
  index.scss      — 样式
  types.ts        — UploadFile、UploadRendererProps 类型定义，并增加类型注释
```

使用 `defineProps<UploadRendererProps>` 配合 `withDefaults` 实现完整类型推断，类型单独抽离到 `types.ts`。
