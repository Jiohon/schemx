# 实现计划：Lint 和导入排序功能

## 概述

本计划将增强项目的代码整理功能，添加 TypeScript ESLint 支持并优化导入排序配置。

## 任务

- [x] 1. 安装必要的依赖包
  - 安装 `@typescript-eslint/eslint-plugin`
  - 安装 `@typescript-eslint/parser`
  - 安装 `eslint-import-resolver-typescript`
  - _需求: 4.1, 4.2_

- [x] 2. 更新 ESLint 配置以支持 TypeScript
  - [x] 2.1 更新 `.eslintrc.cjs` 的解析器配置
    - 添加 `@typescript-eslint/parser` 作为 TypeScript 文件解析器
    - 配置 `parserOptions.project` 指向 `tsconfig.json`
    - 添加 `extraFileExtensions: [".vue"]` 支持 Vue 文件
    - _需求: 4.1, 4.4, 5.1, 5.2_
  
  - [x] 2.2 更新 extends 配置
    - 添加 `plugin:@typescript-eslint/recommended`
    - 添加 `plugin:import/typescript`
    - 确保 `prettier` 在最后
    - _需求: 4.2_
  
  - [x] 2.3 更新 plugins 配置
    - 添加 `@typescript-eslint` 插件
    - _需求: 4.2_
  
  - [x] 2.4 更新 import/resolver 设置
    - 添加 `typescript` 解析器配置
    - 更新 `alias.extensions` 包含 `.ts` 和 `.tsx`
    - 更新 `import/parsers` 配置
    - _需求: 4.5_
  
  - [x] 2.5 添加 TypeScript 特定规则
    - 配置 `@typescript-eslint/no-unused-vars` 替代 `no-unused-vars`
    - 配置其他 TypeScript 相关规则
    - _需求: 1.2, 1.3_

- [x] 3. 更新 .eslintignore 文件
  - 移除对 `.ts`、`.tsx`、`.d.ts` 文件的忽略
  - 保留对 `node_modules`、`dist` 等目录的忽略
  - _需求: 4.3_

- [x] 4. 更新 package.json 添加 lint 脚本
  - 添加 `lint` 脚本：`eslint src --ext .vue,.ts,.tsx,.js,.jsx`
  - 添加 `lint:fix` 脚本：`eslint src --ext .vue,.ts,.tsx,.js,.jsx --fix`
  - 添加 `format` 脚本：`prettier --write "src/**/*.{vue,ts,tsx,js,jsx,json,css,scss}"`
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. 检查点 - 验证配置
  - 运行 `npm run lint` 确保配置无错误
  - 确保所有测试通过，如有问题请询问用户

- [x] 6. 验证导入排序功能
  - [x] 6.1 验证导入排序规则生效
    - 在测试文件中验证导入排序
    - 确认 vue/vant 在 external 组最前
    - 确认 @/ 别名在 internal 组
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 6.2 编写导入排序幂等性属性测试
    - **Property 1: 导入排序幂等性**
    - **验证: 需求 2.1, 2.4, 2.5, 2.6**

- [x] 7. 最终检查点
  - 运行 `npm run lint` 确保无配置错误
  - 运行 `npm run lint:fix` 验证自动修复功能
  - 确保所有测试通过，如有问题请询问用户

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务都引用了具体的需求以便追溯
- 检查点确保增量验证
