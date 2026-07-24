#!/usr/bin/env node

import { runTerminalBridge } from "./bridge.mjs"

process.exitCode = runTerminalBridge(process.argv.slice(2))
