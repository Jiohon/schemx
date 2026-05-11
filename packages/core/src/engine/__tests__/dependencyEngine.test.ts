import { describe, expect, it } from "vitest"

import { createForm } from "../../createForm"

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("dependencyEngine", () => {
  it("新一轮 dependency renderer 开始时会 abort 上一轮异步 renderer", async () => {
    const signals: AbortSignal[] = []
    const form = createForm({
      initialValues: { mode: "" },
      schemas: [
        {
          componentType: "select",
          name: "mode",
          label: "Mode",
        } as any,
        {
          componentType: "dependency",
          to: ["mode"],
          async renderer(values, _form, context) {
            signals.push(context.signal)

            if (values.mode === "slow") {
              await sleep(30)
            }

            return [
              {
                componentType: "input",
                name: values.mode === "slow" ? "slowField" : "fastField",
                label: "Dynamic Field",
              } as any,
            ]
          },
        } as any,
      ],
    })

    await expect(form.waitForDependencies()).resolves.toBe(true)

    form.setFieldValue("mode", "slow")
    await Promise.resolve()

    const slowSignal = signals.at(-1)

    expect(slowSignal?.aborted).toBe(false)

    form.setFieldValue("mode", "fast")
    await expect(form.waitForDependencies()).resolves.toBe(true)

    expect(slowSignal?.aborted).toBe(true)
    expect(
      form.getResolvedSchemas().some((schema) => "name" in schema && schema.name === "fastField")
    ).toBe(true)
    expect(
      form.getResolvedSchemas().some((schema) => "name" in schema && schema.name === "slowField")
    ).toBe(false)

    form.destroy()
  })

  it("晚返回的旧 dependency renderer 不会覆盖后触发的新 subtree", async () => {
    const form = createForm({
      initialValues: { mode: "" },
      schemas: [
        {
          componentType: "select",
          name: "mode",
          label: "Mode",
        } as any,
        {
          componentType: "dependency",
          to: ["mode"],
          async renderer(values) {
            if (values.mode === "slow") {
              await sleep(40)

              return [
                {
                  componentType: "input",
                  name: "slowField",
                  label: "Slow Field",
                } as any,
              ]
            }

            return [
              {
                componentType: "input",
                name: "fastField",
                label: "Fast Field",
              } as any,
            ]
          },
        } as any,
      ],
    })

    await expect(form.waitForDependencies()).resolves.toBe(true)

    form.setFieldValue("mode", "slow")
    await Promise.resolve()
    form.setFieldValue("mode", "fast")

    await expect(form.waitForDependencies()).resolves.toBe(true)
    await sleep(50)

    expect(
      form.getResolvedSchemas().some((schema) => "name" in schema && schema.name === "fastField")
    ).toBe(true)
    expect(
      form.getResolvedSchemas().some((schema) => "name" in schema && schema.name === "slowField")
    ).toBe(false)

    form.destroy()
  })
})
