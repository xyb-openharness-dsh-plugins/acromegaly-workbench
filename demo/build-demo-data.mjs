#!/usr/bin/env node
/**
 * 把 prototypes/v0.2/demo-data.js（唯一数据源）落成两个产物：
 *   demo/demo-data.json    —— 播种用的纯 JSON（装机后 dsh/demo.js 读它，不依赖 prototypes/）
 *   demo/demo-data.sqlite  —— 演示库（读模型/前端联调用，dsh/server.js 可直接打开）
 *
 * 为什么不复制一份数据进本文件：原型才是唯一源。这里只做"求值 + 拆表"，
 * 数值一旦在这里多出一条，原型与开发版就会各说一套（demo-parity 测试拦的就是这个）。
 *
 * 用法：node demo/build-demo-data.mjs [--check]
 *   --check 只校验产物与源同步（json 逐字节、sqlite 重播种后 bootstrap 等价），不同步退出码 1。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'prototypes', 'v0.2', 'demo-data.js')
const JSON_OUT = join(root, 'demo', 'demo-data.json')
const DB_OUT = join(root, 'demo', 'demo-data.sqlite')
const checkOnly = process.argv.includes('--check')

/** 求值原型脚本：文件尾有 module.exports 兜底，给一个 module 对象即可取出 DEMO_DATA。 */
export function loadDemoData(src = readFileSync(SRC, 'utf8')) {
  const module_ = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', src)(module_, module_.exports)
  const data = module_.exports.DEMO_DATA
  if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {
    throw new Error('prototypes/v0.2/demo-data.js 里没有可用的 DEMO_DATA.profiles')
  }
  return data
}

/** 读 demo/demo-data.json（装机播种用；dsh/demo.js 与这里保持同一入口）。 */
export function readDemoJson() {
  return JSON.parse(readFileSync(JSON_OUT, 'utf8'))
}

function build() {
  const data = loadDemoData()
  const json = `${JSON.stringify(data, null, 2)}\n`
  mkdirSync(join(root, 'demo'), { recursive: true })
  writeFileSync(JSON_OUT, json, 'utf8')
  rmSync(DB_OUT, { force: true })
  return { json }
}

if (checkOnly) {
  const problems = []
  if (!existsSync(JSON_OUT)) problems.push('缺 demo/demo-data.json')
  if (!existsSync(DB_OUT)) problems.push('缺 demo/demo-data.sqlite')
  if (!problems.length) {
    const data = loadDemoData()
    const want = `${JSON.stringify(data, null, 2)}\n`
    if (readFileSync(JSON_OUT, 'utf8') !== want) problems.push('demo/demo-data.json 与 prototypes/v0.2/demo-data.js 不同步')
  }
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`)
    process.exit(1)
  }
  console.log('✓ demo 产物与唯一数据源同步（demo-data.json + demo-data.sqlite）')
  process.exit(0)
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) runMain()

function runMain() {
const { json } = build()
const db = openDatabase(DB_OUT)
try {
  migrate(db)
  seedDemo(db, loadDemoData())
} finally {
  close(db)
}
console.log(`✓ 已生成 demo/demo-data.json（${json.length} 字节）与 demo/demo-data.sqlite`)
}
