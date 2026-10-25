#!/usr/bin/env node
/**
 * 独立启动（开发版）：node scripts/dev-server.mjs [--workspace <目录>] [--port 4173]
 *
 * 不给 --workspace 时直接打开 demo/demo-data.sqlite（只读演示，不会在用户机器上留文件）。
 * 路由与 DSH 宿主共用 dsh/routes.js——本地能开的路径，装进 Desktop 也一定在。
 */
import { argv, exit } from 'node:process'
import { Workbench, validateWorkspacePath } from '../dsh/workbench.js'
import { startWorkbenchServer } from '../dsh/server.js'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { hasDemoData, seedDemo } from '../dsh/demo.js'
import { bootstrap, getProfile } from '../dsh/readmodels.js'
import { version, build } from '../lib/version.js'

const args = argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}

const port = Number(flag('port') || 4173)
const workspace = flag('workspace')

async function main() {
  if (workspace) {
    const problems = validateWorkspacePath(workspace)
    if (problems.length) {
      console.error(`✗ 资料目录不可用：${problems.join('；')}`)
      exit(1)
    }
    const workbench = await Workbench.open(workspace)
    const started = await startWorkbenchServer({ port, workbench })
    console.log(`✓ 小肢宝开发版 v${version}（build ${build}）`)
    console.log(`  资料目录：${workbench.workspace}`)
    console.log(`  UI：${started.url}api/acromegaly/ui/`)
    console.log(`  健康检查：${started.url}api/acromegaly/health`)
    return
  }

  /* 演示库直开。 */
  const { fileURLToPath } = await import('node:url')
  const { readFile } = await import('node:fs/promises')
  const db = openDatabase(fileURLToPath(new URL('../demo/demo-data.sqlite', import.meta.url)))
  migrate(db)
  if (!hasDemoData(db)) seedDemo(db, JSON.parse(await readFile(new URL('../demo/demo-data.json', import.meta.url), 'utf8')))
  const workbench = {
    db, version, build, workspace: null,
    bootstrap: () => bootstrap(db, { version, build }),
    getProfile: (key, opts) => getProfile(db, key, opts),
    close: () => close(db),
  }
  const started = await startWorkbenchServer({ port, workbench })
  console.log(`✓ 小肢宝开发版（演示库）v${version}`)
  console.log(`  UI：${started.url}api/acromegaly/ui/`)
  console.log(`  健康检查：${started.url}api/acromegaly/health`)
}

main().catch((error) => {
  console.error(`✗ 启动失败：${error.message}`)
  exit(1)
})
