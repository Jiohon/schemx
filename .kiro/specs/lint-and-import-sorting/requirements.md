# 需求文档

## 简介

本功能旨在增强 Vue/TypeScript 项目的代码整理能力，包括完善 lint 和 fix 功能，以及添加导入语句的自动整理和排序功能。项目已有 ESLint 和 Prettier 基础配置，需要扩展以支持 TypeScript 并优化导入排序。

## 术语表

- **Linter**: 静态代码分析工具，用于检测代码中的问题和不规范写法
- **ESLint**: JavaScript/TypeScript 代码检查工具
- **Prettier**: 代码格式化工具
- **Import_Sorter**: 导入语句排序工具，自动整理 import 语句的顺序
- **TypeScript_ESLint**: ESLint 的 TypeScript 解析器和规则插件

## 需求

### 需求 1：TypeScript 支持

**用户故事：** 作为开发者，我希望 ESLint 能够检查 TypeScript 文件，以便在开发过程中发现类型相关的问题。

#### 验收标准

1. WHEN 运行 lint 命令 THEN Linter SHALL 检查所有 .ts 和 .tsx 文件
2. WHEN TypeScript 文件存在类型错误 THEN Linter SHALL 报告这些错误
3. WHEN TypeScript 文件使用了未定义的类型 THEN Linter SHALL 发出警告
4. WHEN 运行 lint:fix 命令 THEN Linter SHALL 自动修复可修复的 TypeScript 问题

### 需求 2：导入语句排序

**用户故事：** 作为开发者，我希望导入语句能够自动按规则排序，以便保持代码整洁和一致性。

#### 验收标准

1. WHEN 运行 lint:fix 命令 THEN Import_Sorter SHALL 按以下顺序排列导入语句：内置模块、外部依赖、内部模块、父级模块、同级模块、索引文件、类型导入
2. WHEN 导入语句来自 vue 或 vant THEN Import_Sorter SHALL 将其置于外部依赖的最前面
3. WHEN 导入语句使用 @/ 别名 THEN Import_Sorter SHALL 将其归类为内部模块
4. WHEN 同一分组内有多个导入 THEN Import_Sorter SHALL 按字母顺序排列
5. WHEN 不同分组的导入相邻 THEN Import_Sorter SHALL 在分组之间添加空行
6. WHEN 单个导入语句有多个成员 THEN Import_Sorter SHALL 按字母顺序排列成员

### 需求 3：NPM 脚本配置

**用户故事：** 作为开发者，我希望有便捷的 npm 脚本来执行代码检查和修复，以便快速整理代码。

#### 验收标准

1. THE package.json SHALL 包含 lint 脚本用于检查代码问题
2. THE package.json SHALL 包含 lint:fix 脚本用于自动修复问题
3. THE package.json SHALL 包含 format 脚本用于格式化代码
4. WHEN 运行 lint 脚本 THEN Linter SHALL 检查 src 目录下的所有 .vue、.ts、.tsx、.js、.jsx 文件
5. WHEN 运行 format 脚本 THEN Prettier SHALL 格式化 src 目录下的所有支持的文件

### 需求 4：配置文件更新

**用户故事：** 作为开发者，我希望 ESLint 配置能正确支持 TypeScript，以便获得完整的代码检查能力。

#### 验收标准

1. THE .eslintrc.cjs SHALL 包含 @typescript-eslint/parser 作为 TypeScript 文件的解析器
2. THE .eslintrc.cjs SHALL 包含 @typescript-eslint/eslint-plugin 的推荐规则
3. THE .eslintignore SHALL 不再忽略 .ts 和 .tsx 文件
4. WHEN ESLint 解析 TypeScript 文件 THEN Linter SHALL 使用 tsconfig.json 中的配置
5. THE import/resolver 设置 SHALL 支持 .ts 和 .tsx 扩展名

### 需求 5：Vue 文件中的 TypeScript 支持

**用户故事：** 作为开发者，我希望 Vue 单文件组件中的 TypeScript 代码也能被正确检查，以便保持一致的代码质量。

#### 验收标准

1. WHEN Vue 文件包含 `<script lang="ts">` THEN Linter SHALL 使用 TypeScript 规则检查该脚本块
2. WHEN Vue 文件包含 `<script setup lang="ts">` THEN Linter SHALL 正确解析 setup 语法
3. WHEN Vue 文件中存在类型错误 THEN Linter SHALL 报告这些错误
