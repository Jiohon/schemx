import { resolve } from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      // 集成测试运行时加载 @schemx/core，指向源码以避免依赖 core dist 构建产物。
      "@schemx/core": resolve(__dirname, "../core/src"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
})
