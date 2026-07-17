import type {
  FieldRules,
  RequiredRule,
  SchemxBaseField,
  StandardSchemaV1,
  ValidationError,
  ValidationResult,
} from "../../index"

interface FormValues {
  email: string
  age: number
  files: File[]
}

declare const stringSchema: StandardSchemaV1<string, string>
declare const numberSchema: StandardSchemaV1<number, number>

const fields: SchemxBaseField<FormValues>[] = [
  {
    name: "email",
    label: "邮箱",
    componentType: "input",
    required: { isEmpty: (value) => value === undefined || value === "" },
    rules: [stringSchema],
  },
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    rules: [numberSchema],
  },
  // @ts-expect-error age 字段不能使用 string Schema。
  {
    name: "age",
    label: "年龄",
    componentType: "input",
    rules: [stringSchema],
  },
]

declare module "../../index" {
  interface ValidationRuleDefinition {
    emailRule: string
    positive: number
  }
}

const emailRules: FieldRules<FormValues, "email"> = ["emailRule"]
// @ts-expect-error email 字段不能使用 number 规则名。
const invalidEmailRules: FieldRules<FormValues, "email"> = ["positive"]

const required: RequiredRule<File[]> = {
  isEmpty: (files) => !files?.length,
}

declare const result: ValidationResult<FormValues, "email">
if (!result.valid) {
  const error: ValidationError<"email"> = result.errors[0]
  if (error.scope === "field") {
    const name: "email" = error.name
    void name
  }
}

void fields
void emailRules
void invalidEmailRules
void required
