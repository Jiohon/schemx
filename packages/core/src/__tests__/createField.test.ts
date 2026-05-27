import { describe, expect, expectTypeOf, it } from "vitest"

import { createField } from "../createField"
import { createForm } from "../createForm"

interface TypedForm {
  name: string
  age: number
  user: {
    city: string
  }
}

describe("createField", () => {
  it("根据字段路径推导字段值类型", () => {
    const form = createForm<TypedForm>({
      initialValues: {
        name: "John",
        age: 20,
        user: {
          city: "Beijing",
        },
      },
    })

    const nameField = createField(form, "name")
    const ageField = createField(form, "age")
    const cityField = createField(form, "user.city")

    expectTypeOf(nameField.getValue()).toEqualTypeOf<string | undefined>()
    expectTypeOf(ageField.getValue()).toEqualTypeOf<number | undefined>()
    expectTypeOf(cityField.getValue()).toEqualTypeOf<string | undefined>()

    nameField.setValue("Jane")
    ageField.setValue(30)
    cityField.setValue("Shanghai")

    expect(form.getFieldValue("name")).toBe("Jane")
    expect(form.getFieldValue("age")).toBe(30)
    expect(form.getFieldValue("user.city")).toBe("Shanghai")

    const assertTypeOnly = (): void => {
      // @ts-expect-error name 字段只接受 string 或 undefined。
      nameField.setValue(123)
      // @ts-expect-error age 字段只接受 number 或 undefined。
      ageField.setValue("30")
    }

    void assertTypeOnly
  })
})
