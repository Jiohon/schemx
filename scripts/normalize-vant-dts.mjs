import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const distDir = resolve(rootDir, "packages/vant/dist")

function normalizeDeclaration(source) {
  return source
    .replaceAll("../../vue/src/index.ts", "@schemx/vue")
    .replaceAll("../../core/src/index.ts", "@schemx/core")
    .replace(/\n?\/\/# sourceMappingURL=.*\.d\.ts\.map\s*$/u, "")
    .trimStart()
}

const indexPath = resolve(distDir, "index.d.ts")
const standalonePath = resolve(distDir, "standalone.d.ts")
const normalizedIndex = normalizeDeclaration(readFileSync(indexPath, "utf8"))

writeFileSync(indexPath, `${normalizedIndex}\n`)
writeFileSync(standalonePath, `${normalizedIndex}\n`)
