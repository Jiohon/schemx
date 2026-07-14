#!/usr/bin/env node

import { printSection } from "./lib/terminal.mjs"

const [command, ...args] = process.argv.slice(2)

if (command !== "section" || args.length === 0) {
  process.stderr.write("用法：node scripts/terminal.mjs section <标题>\n")
  process.exit(1)
}

printSection(args.join(" "), { output: process.stdout })
