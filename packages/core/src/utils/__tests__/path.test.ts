/**
 * path 路径工具单元测试
 *
 * 覆盖 getByPath、setByPath、isValidPath、hasPath、deleteByPath、
 * isChildPath、collectObjectPaths、collectObjectPathsByLeaf、pickByPaths。
 *
 * @module utils/__tests__/path
 */
import { describe, expect, it } from "vitest"

import {
  collectObjectPaths,
  collectObjectPathsByLeaf,
  deleteByPath,
  getByPath,
  hasPath,
  isChildPath,
  isValidPath,
  pickByPaths,
  setByPath,
} from "../path"

describe("getByPath", () => {
  it("有效嵌套路径返回对应值", () => {
    const obj = { user: { address: { city: "Beijing" } } }
    expect(getByPath(obj, "user.address.city")).toBe("Beijing")
  })

  it("空字符串路径返回整个对象", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, "")).toBe(obj)
  })

  it("空数组路径返回整个对象", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, [])).toBe(obj)
  })

  it("不存在的路径返回 undefined", () => {
    const obj = { a: 1 }
    expect(getByPath(obj, "b.c")).toBeUndefined()
  })
})

describe("setByPath", () => {
  it("有效路径设置嵌套值", () => {
    const obj: Record<string, any> = { user: {} }
    setByPath(obj, "user.name", "John")
    expect(obj.user.name).toBe("John")
  })

  it("null 对象不抛异常", () => {
    expect(() => setByPath(null as any, "a", 1)).not.toThrow()
  })

  it("undefined 对象不抛异常", () => {
    expect(() => setByPath(undefined as any, "a", 1)).not.toThrow()
  })
})

describe("isValidPath", () => {
  it("有效路径返回 true", () => {
    expect(isValidPath("user.name")).toBe(true)
    expect(isValidPath("name")).toBe(true)
    expect(isValidPath("a.b.c")).toBe(true)
  })

  it("空字符串返回 false", () => {
    expect(isValidPath("")).toBe(false)
  })

  it("单点号返回 false", () => {
    expect(isValidPath(".")).toBe(false)
  })

  it("连续点号返回 false", () => {
    expect(isValidPath("a..b")).toBe(false)
  })

  it("非字符串类型返回 false", () => {
    expect(isValidPath(123 as any)).toBe(false)
    expect(isValidPath(null as any)).toBe(false)
  })
})

describe("hasPath", () => {
  const obj = { user: { name: "John", address: null } }

  it("存在的路径返回 true", () => {
    expect(hasPath(obj, "user.name")).toBe(true)
    expect(hasPath(obj, "user.address")).toBe(true)
  })

  it("不存在的路径返回 false", () => {
    expect(hasPath(obj, "user.age")).toBe(false)
  })

  it("空字符串路径返回 true", () => {
    expect(hasPath(obj, "")).toBe(true)
  })
})

describe("deleteByPath", () => {
  it("存在的路径删除成功返回 true", () => {
    const obj = { user: { name: "John", age: 25 } }
    expect(deleteByPath(obj, "user.age")).toBe(true)
    expect(obj.user).toEqual({ name: "John" })
  })

  it("不存在的路径返回 false", () => {
    const obj = { a: 1 }
    expect(deleteByPath(obj, "b")).toBe(false)
  })

  it("空路径返回 false", () => {
    expect(deleteByPath({ a: 1 }, "")).toBe(false)
  })
})

describe("isChildPath", () => {
  it("正确判断父子路径关系", () => {
    expect(isChildPath("user", "user.name")).toBe(true)
    expect(isChildPath("user", "user.address.city")).toBe(true)
  })

  it("相同路径返回 false", () => {
    expect(isChildPath("user", "user")).toBe(false)
  })

  it("前缀匹配但非子路径返回 false", () => {
    expect(isChildPath("user", "username")).toBe(false)
  })
})

describe("collectObjectPaths", () => {
  it("嵌套对象返回包含中间节点的所有路径", () => {
    const obj = { name: "a", address: { city: "BJ", zip: "100000" } }
    const paths = collectObjectPaths(obj)
    expect(paths).toContain("name")
    expect(paths).toContain("address")
    expect(paths).toContain("address.city")
    expect(paths).toContain("address.zip")
  })

  it("数组返回索引路径", () => {
    const obj = { tags: [1, 2] }
    const paths = collectObjectPaths(obj)
    expect(paths).toContain("tags")
    expect(paths).toContain("tags[0]")
    expect(paths).toContain("tags[1]")
  })
})

describe("collectObjectPathsByLeaf", () => {
  it("仅返回叶子节点路径", () => {
    const obj = { name: "a", address: { city: "BJ", zip: "100000" } }
    const paths = collectObjectPathsByLeaf(obj)
    expect(paths).toContain("name")
    expect(paths).toContain("address.city")
    expect(paths).toContain("address.zip")
    expect(paths).not.toContain("address")
  })

  it("数组叶子节点", () => {
    const obj = { tags: [1, 2] }
    const paths = collectObjectPathsByLeaf(obj)
    expect(paths).toContain("tags[0]")
    expect(paths).toContain("tags[1]")
    expect(paths).not.toContain("tags")
  })
})

describe("pickByPaths", () => {
  it("按路径集合提取子集", () => {
    const obj = { name: "John", age: 25, city: "Beijing" }
    const result = pickByPaths(obj, new Set(["name", "age"]))
    expect(result).toEqual({ name: "John", age: 25 })
  })
})
