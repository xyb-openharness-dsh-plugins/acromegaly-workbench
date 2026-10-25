#!/usr/bin/env node
/**
 * 生成 public/（开发版前端，四件套）：从 prototypes/v0.2 产出。
 *
 * 对齐纪律：public 页面与原型逐字符对齐——style.css 与 demo-data.js 原样复制；
 * index.html 只改两处版本字符串（title / 顶部说明条）；app.js 只改"数据从哪来"
 * （先向 /api/acromegaly/bootstrap 要真数据，拿不到才回退 window.DEMO_DATA），
 * 不改任何视图函数。原型与开发版必须是同一份渲染代码（parity 要求）。
 *
 * 用法：
 *   node scripts/build-public.mjs           写入
 *   node scripts/build-public.mjs --check   只校验，不同步退出码 1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'prototypes', 'v0.2')
const OUT = join(root, 'public')
const checkOnly = process.argv.includes('--check')

const read = (name) => readFileSync(join(SRC, name), 'utf8')

function fail(messages) {
  for (const m of messages) console.error(`✗ ${m}`)
  process.exit(1)
}

/* ---------------- index.html：只改版本字符串 ---------------- */

function patchIndex(html, version) {
  const titleFrom = '<title>小肢宝 LimbPal · 肢端肥大症患者工作台原型 v0.2.0</title>'
  const titleTo = `<title>小肢宝 LimbPal · 肢端肥大症患者工作台 v${version}</title>`
  const barFrom = '<div class="prototype-bar"><span><b>交互原型 v0.2.0</b> · 全部为模拟资料</span><span>仅本页演示 · 刷新重置 · 未接入 DSH / AI</span></div>'
  const barTo = `<div class="prototype-bar"><span><b>开发版 v${version}</b> · 演示资料直到连接本机资料目录</span><span>本机数据 · 只整理不判定 · 判读归内分泌及各专科医生</span></div>`
  for (const needle of [titleFrom, barFrom]) {
    if (!html.includes(needle)) fail(`prototypes/v0.2/index.html 结构变了，找不到锚点：${needle.slice(0, 60)}…`)
  }
  return html.replace(titleFrom, titleTo).replace(barFrom, barTo)
}

/* ---------------- app.js：只改数据层 ---------------- */

const DATA_FROM = `const DATA = typeof DEMO_DATA !== 'undefined' ? DEMO_DATA : {};\nconst TODAY = DATA.meta?.today || '2026-10-25';\nconst profile = () => DATA.profiles[0];`
const DATA_TO = [
  "/* 数据层（开发版）：先向 /api/acromegaly/bootstrap 要真数据，拿不到才回退 window.DEMO_DATA。",
  "   原型与开发版是同一份渲染代码：这里只改\"数据从哪来\"，不改任何视图函数。",
  "   三态：api（本机库）/ demo（离线演示，横幅提醒）/ empty（库通了但为空，显示空态，",
  "   不拿演示档案把空工作区填满——否则用户会以为数据被写进来了）。 */",
  "let DATA = (typeof DEMO_DATA !== 'undefined') ? DEMO_DATA : { profiles: [], meta: null };",
  "let TODAY = DATA.meta?.today || new Date().toISOString().slice(0, 10);",
  "const profile = () => DATA.profiles[0];",
  "let DATA_SOURCE = 'pending';",
  'function apiBase() {',
  '  const m = location.pathname.match(/^(.*)\\/ui(?:\\/|$)/);',
  "  const base = m ? m[1] : '';",
  "  return base.replace(/\\/api\\/acromegaly$/, '');",
  '}',
  'async function loadBootstrap() {',
  "  const url = apiBase() + '/api/acromegaly/bootstrap';",
  '  try {',
  "    const res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });",
  "    if (!res.ok) return 'demo';",
  '    const data = await res.json();',
  '    if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {',
  '      DATA = { profiles: [], meta: data?.meta ?? null };',
  '      TODAY = DATA.meta?.today || TODAY;',
  "      return 'empty';",
  '    }',
  '    DATA = data;',
  '    TODAY = DATA.meta?.today || TODAY;',
  "    return 'api';",
  "  } catch { return 'demo'; }",
  '}',
].join('\n')

const BOOT_FROM = `(function boot() {\n  $('#font-toggle').addEventListener('click', () => ACTIONS['font-toggle']());\n  applyHash();\n  render();\n  document.body.setAttribute('data-booted', '1');\n})();`
const BOOT_TO = `(async function boot() {\n  $('#font-toggle').addEventListener('click', () => ACTIONS['font-toggle']());\n  DATA_SOURCE = await loadBootstrap();\n  if (DATA_SOURCE !== 'api') {\n    const bar = document.querySelector('.prototype-bar span:first-child');\n    if (bar) bar.innerHTML = DATA_SOURCE === 'empty'\n      ? '<b>本机资料目录为空</b> · 界面显示空态（不拿演示档案填充）'\n      : '<b>离线演示数据</b> · 未连上本机服务，以下内容不是你的资料';\n  }\n  applyHash();\n  render();\n  document.body.setAttribute('data-booted', '1');\n})();`

function patchApp(js) {
  for (const needle of [DATA_FROM, BOOT_FROM]) {
    if (!js.includes(needle)) fail(`prototypes/v0.2/app.js 结构变了，找不到锚点：${needle.slice(0, 60)}…`)
  }
  return js.replace(DATA_FROM, DATA_TO).replace(BOOT_FROM, BOOT_TO)
}

/* ---------------- 产出 ---------------- */

const version = readFileSync(join(root, 'VERSION'), 'utf8').trim()
const outputs = {
  'style.css': read('style.css'),
  'demo-data.js': read('demo-data.js'),
  'index.html': patchIndex(read('index.html'), version),
  'app.js': patchApp(read('app.js')),
}

if (checkOnly) {
  const problems = []
  for (const [name, content] of Object.entries(outputs)) {
    const file = join(OUT, name)
    if (!existsSync(file)) problems.push(`缺 public/${name}`)
    else if (readFileSync(file, 'utf8') !== content) problems.push(`public/${name} 与原型（含开发版数据层补丁）不同步`)
  }
  if (problems.length) fail(problems)
  console.log('✓ public/ 四件套与原型同步（style/demo-data 逐字符；index/app 仅版本与数据层补丁）')
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
for (const [name, content] of Object.entries(outputs)) writeFileSync(join(OUT, name), content, 'utf8')
console.log(`✓ 已生成 public/ 四件套（v${version}）：style.css / demo-data.js / index.html / app.js`)
