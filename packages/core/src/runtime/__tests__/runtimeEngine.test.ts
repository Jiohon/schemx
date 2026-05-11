import { describe, expect, it, vi } from "vitest"

import { createForm } from "../../createForm"

import type { SchemxField } from "../../types"

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("RuntimeEngine", () => {
  it("keeps the latest async dependency result when older renders resolve later", async () => {
    const schemas: SchemxField[] = [
      {
        componentType: "select",
        name: "type",
        label: "Type",
      } as any,
      {
        componentType: "dependency",
        to: ["type"],
        async renderer(values) {
          if (values.type === "user") {
            await sleep(30)

            return [
              {
                componentType: "input",
                name: "username",
                label: "Username",
              } as any,
            ]
          }

          if (values.type === "company") {
            await sleep(0)

            return [
              {
                componentType: "input",
                name: "companyName",
                label: "Company Name",
              } as any,
            ]
          }

          return []
        },
      },
    ]

    const form = createForm({ schemas })

    form.setFieldValue("type", "user")
    await Promise.resolve()
    form.setFieldValue("type", "company")

    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(form.getSchemas().map((schema) => "name" in schema && schema.name)).toEqual([
      "type",
      "companyName",
    ])

    form.destroy()
  })

  it("resolves nested dependency subtrees through the runtime tree", async () => {
    const schemas: SchemxField[] = [
      {
        componentType: "select",
        name: "level1",
        label: "Level 1",
      } as any,
      {
        componentType: "dependency",
        to: ["level1"],
        renderer(values) {
          if (values.level1 !== "on") return []

          return [
            {
              componentType: "select",
              name: "level2",
              label: "Level 2",
            } as any,
            {
              componentType: "dependency",
              to: ["level2"],
              renderer(level2Values) {
                if (level2Values.level2 !== "on") return []

                return [
                  {
                    componentType: "select",
                    name: "level3",
                    label: "Level 3",
                  } as any,
                  {
                    componentType: "dependency",
                    to: ["level3"],
                    renderer(level3Values) {
                      if (level3Values.level3 !== "on") return []

                      return [
                        {
                          componentType: "input",
                          name: "final",
                          label: "Final",
                        } as any,
                      ]
                    },
                  },
                ]
              },
            },
          ]
        },
      },
    ]

    const form = createForm({ schemas })

    form.setFieldValue("level1", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    form.setFieldValue("level2", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    form.setFieldValue("level3", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(form.getSchemas().map((schema) => "name" in schema && schema.name)).toEqual([
      "level1",
      "level2",
      "level3",
      "final",
    ])

    form.destroy()
  })

  it("disposes dependency watchers when form is destroyed", async () => {
    const renderer = vi.fn(() => [
      {
        componentType: "input",
        name: "child",
        label: "Child",
      } as any,
    ])
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer,
        },
      ],
    })

    form.setFieldValue("type", "a")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const callsBeforeDestroy = renderer.mock.calls.length

    form.destroy()
    form.setFieldValue("type", "b")
    await sleep(0)

    expect(renderer).toHaveBeenCalledTimes(callsBeforeDestroy)
  })

  it("unregisters field rules and errors when dependency subtree unmounts", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer(values) {
            if (values.type !== "on") return []

            return [
              {
                componentType: "input",
                name: "dynamicName",
                label: "Dynamic Name",
                rules: "required",
              } as any,
            ]
          },
        },
      ],
    })

    form.setFieldValue("type", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const invalidResult = await form.validate()
    expect(invalidResult.ok).toBe(false)
    expect(form.getFieldError("dynamicName")).toBeDefined()

    form.setFieldValue("type", "off")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const validResult = await form.validate()
    expect(validResult.ok).toBe(true)
    expect(form.getFieldError("dynamicName")).toBeUndefined()

    form.destroy()
  })

  it("initializes dependency field initialValue during runtime mount", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "deliveryMode",
          label: "Delivery Mode",
        } as any,
        {
          componentType: "dependency",
          to: ["deliveryMode"],
          renderer(values) {
            if (values.deliveryMode !== "pickup") return []

            return [
              {
                componentType: "select",
                name: "pickupStore",
                label: "Pickup Store",
                initialValue: "mixc",
              } as any,
            ]
          },
        },
      ],
    })

    form.setFieldValue("deliveryMode", "pickup")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(form.getFieldValue("pickupStore")).toBe("mixc")

    form.destroy()
  })

  it("does not overwrite an existing value when dependency field mounts", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "deliveryMode",
          label: "Delivery Mode",
        } as any,
        {
          componentType: "dependency",
          to: ["deliveryMode"],
          renderer(values) {
            if (values.deliveryMode !== "pickup") return []

            return [
              {
                componentType: "select",
                name: "pickupStore",
                label: "Pickup Store",
                initialValue: "mixc",
              } as any,
            ]
          },
        },
      ],
    })

    form.setFieldValue("pickupStore", "hubin")
    form.setFieldValue("deliveryMode", "pickup")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(form.getFieldValue("pickupStore")).toBe("hubin")

    form.destroy()
  })

  it("resolves field dependency props through runtime projection", async () => {
    const form = createForm({
      initialValues: { province: "" },
      schemas: [
        {
          componentType: "select",
          name: "province",
          label: "Province",
        } as any,
        {
          componentType: "input",
          name: "city",
          label: "City",
          dependencies: {
            triggerFields: ["province"],
            visible: (values) => !!values.province,
            required: (values) => values.province === "guangdong",
            placeholder: (values) => `City in ${values.province || "unknown"}`,
            componentProps: (values) => ({
              clearable: values.province === "guangdong",
            }),
          },
        } as any,
      ],
    })

    await expect(form.waitForDependencies()).resolves.toBe(true)

    let city = form
      .getResolvedSchemas()
      .find((schema) => "name" in schema && schema.name === "city") as any

    expect(city.visible).toBe(false)
    expect(city.required).toBe(false)
    expect(city.placeholder).toBe("City in unknown")
    expect(city.componentProps).toEqual({ clearable: false })

    form.setFieldValue("province", "guangdong")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    city = form
      .getResolvedSchemas()
      .find((schema) => "name" in schema && schema.name === "city") as any

    expect(city.visible).toBe(true)
    expect(city.required).toBe(true)
    expect(city.placeholder).toBe("City in guangdong")
    expect(city.componentProps).toEqual({ clearable: true })

    form.destroy()
  })

  it("syncs dynamic field rules and clears errors when props disable validation", async () => {
    const form = createForm({
      initialValues: { mode: "off" },
      schemas: [
        {
          componentType: "select",
          name: "mode",
          label: "Mode",
        } as any,
        {
          componentType: "input",
          name: "note",
          label: "Note",
          dependencies: {
            triggerFields: ["mode"],
            visible: (values) => values.mode === "on",
            rules: (values) => (values.mode === "on" ? "required" : undefined),
          },
        } as any,
      ],
    })

    await expect(form.waitForDependencies()).resolves.toBe(true)
    await expect(form.validate()).resolves.toMatchObject({ ok: true })

    form.setFieldValue("mode", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const invalidResult = await form.validate()
    expect(invalidResult.ok).toBe(false)
    expect(form.getFieldError("note")).toBeDefined()

    form.setFieldValue("mode", "off")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    await expect(form.validate()).resolves.toMatchObject({ ok: true })
    expect(form.getFieldError("note")).toBeUndefined()

    form.destroy()
  })

  it("keeps the latest async field dependency props when older resolves finish later", async () => {
    const form = createForm({
      initialValues: { mode: "" },
      schemas: [
        {
          componentType: "select",
          name: "mode",
          label: "Mode",
        } as any,
        {
          componentType: "input",
          name: "target",
          label: "Target",
          dependencies: {
            triggerFields: ["mode"],
            async placeholder(values) {
              if (values.mode === "slow") {
                await sleep(30)
              }

              return `mode:${values.mode}`
            },
          },
        } as any,
      ],
    })

    form.setFieldValue("mode", "slow")
    await Promise.resolve()
    form.setFieldValue("mode", "fast")

    await expect(form.waitForDependencies()).resolves.toBe(true)

    const target = form
      .getResolvedSchemas()
      .find((schema) => "name" in schema && schema.name === "target") as any

    expect(target.placeholder).toBe("mode:fast")

    form.destroy()
  })

  it("reuses stable field nodes without duplicating schema rules", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer() {
            return [
              {
                componentType: "input",
                name: "stableName",
                label: "Stable Name",
                rules: "required",
              } as any,
            ]
          },
        },
      ],
    })

    form.setFieldValue("type", "a")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    form.setFieldValue("type", "b")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const result = await form.validate()

    expect(result.ok).toBe(false)
    expect(form.getFieldError("stableName")).toHaveLength(1)

    form.destroy()
  })

  it("batches high-frequency dependency changes in one microtask flush", async () => {
    const renderer = vi.fn((values) => {
      if (!values.type) return []

      return [
        {
          componentType: "input",
          name: `field_${values.type}`,
          label: `Field ${values.type}`,
        } as any,
      ]
    })

    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer,
        },
      ],
    })

    form.setFieldValue("type", "a")
    form.setFieldValue("type", "b")
    form.setFieldValue("type", "c")

    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(renderer).toHaveBeenCalledTimes(1)
    expect(form.getSchemas().map((schema) => "name" in schema && schema.name)).toEqual([
      "type",
      "field_c",
    ])

    form.destroy()
  })

  it("waits for async dependency before submit validation", async () => {
    const onFinishFailed = vi.fn()
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          async renderer(values) {
            if (values.type !== "on") return []

            await sleep(10)

            return [
              {
                componentType: "input",
                name: "asyncRequired",
                label: "Async Required",
                rules: "required",
              } as any,
            ]
          },
        },
      ],
      onFinishFailed,
    })

    form.setFieldValue("type", "on")
    await form.submit()

    expect(onFinishFailed).toHaveBeenCalledTimes(1)
    expect(form.getFieldError("asyncRequired")).toBeDefined()

    form.destroy()
  })

  it("exposes runtime root for framework adapters", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer(values) {
            if (values.type !== "on") return []

            return [
              {
                componentType: "input",
                name: "runtimeChild",
                label: "Runtime Child",
              } as any,
            ]
          },
        },
      ],
    })

    const hooks = form.getInternalHooks()

    expect(hooks.getRuntimeRoot().map((node) => node.type)).toEqual([
      "field",
      "dependency",
    ])

    form.setFieldValue("type", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    const dependencyNode = hooks.getRuntimeRoot()[1]

    expect(dependencyNode.type).toBe("dependency")
    expect(dependencyNode.children.map((node) => node.key)).toEqual([
      "root/dependency:type:1/subtree/field:runtimeChild",
    ])

    form.destroy()
  })

  it("keeps getSchemas as compatibility alias of getResolvedSchemas", async () => {
    const form = createForm({
      schemas: [
        {
          componentType: "select",
          name: "type",
          label: "Type",
        } as any,
        {
          componentType: "dependency",
          to: ["type"],
          renderer(values) {
            if (values.type !== "on") return []

            return [
              {
                componentType: "input",
                name: "resolvedChild",
                label: "Resolved Child",
              } as any,
            ]
          },
        },
      ],
    })

    form.setFieldValue("type", "on")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(form.getResolvedSchemas()).toEqual(form.getSchemas())
    expect(form.getResolvedSchemas().map((schema) => "name" in schema && schema.name)).toEqual([
      "type",
      "resolvedChild",
    ])

    form.destroy()
  })
})
