import { describe, expect, test } from "vitest"

import * as pluginModule from "../index"

describe("createPackageResolutionCompatPlugin", () => {
  test("提供 createPackageResolutionCompatPlugin 工厂函数", () => {
    expect(pluginModule.createPackageResolutionCompatPlugin).toBeTypeOf("function")
    expect("default" in pluginModule).toBe(false)
  })

  test("组合安装包预构建配置和 realpath fallback", async () => {
    const plugins = pluginModule.createPackageResolutionCompatPlugin({
      packages: ["@schemx/core", "@schemx/vue", "@schemx/vant"],
      fallbackDependencies: ["classnames", "es-toolkit"],
    })

    expect(plugins).toHaveLength(2)

    const [configPlugin, fallbackPlugin] = plugins

    if (!configPlugin || typeof configPlugin.config !== "function") {
      throw new Error("Missing config hook")
    }

    const config = await configPlugin.config.call({} as never, {}, {} as never)

    expect(config).toEqual({
      optimizeDeps: {
        exclude: ["@schemx/core", "@schemx/vue", "@schemx/vant"],
      },
      resolve: {
        dedupe: [
          "vue",
          "@vue/runtime-core",
          "@vue/runtime-dom",
          "@vue/reactivity",
          "@vue/shared",
        ],
        preserveSymlinks: true,
      },
    })

    expect(fallbackPlugin?.name).toBe("vite:realpath-fallback")
  })
})
