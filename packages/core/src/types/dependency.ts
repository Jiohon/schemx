import { NamePath } from "./form"

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never

type DeepSimplify<T> = T extends readonly (infer Item)[]
  ? DeepSimplify<Item>[]
  : T extends object
    ? {
        [K in keyof T]: DeepSimplify<T[K]>
      }
    : T

type DeepPartial<T> = T extends readonly (infer Item)[]
  ? DeepPartial<Item>[]
  : T extends object
    ? {
        [K in keyof T]?: DeepPartial<T[K]>
      }
    : T | undefined

type PathToObject<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof NonNullable<T>
    ? {
        [Key in K]: PathToObject<NonNullable<T>[K], Rest>
      }
    : K extends `${number}`
      ? NonNullable<T> extends readonly (infer Item)[]
        ? PathToObject<Item, Rest>[]
        : never
      : never
  : P extends keyof NonNullable<T>
    ? {
        [Key in P]: NonNullable<T>[P]
      }
    : P extends `${number}`
      ? NonNullable<T> extends readonly (infer Item)[]
        ? Item[]
        : never
      : never

export type DependencyValues<
  TValues,
  TTo extends readonly NamePath<TValues>[],
> = DeepPartial<
  DeepSimplify<
    UnionToIntersection<
      TTo[number] extends infer P
        ? P extends string
          ? PathToObject<TValues, P>
          : never
        : never
    >
  >
>
