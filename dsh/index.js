/**
 * 包的入口：DSH 插件的服务端侧。宿主加载的就是这个文件，需要
 * name / inject / Config / apply 四样（workbench-standard §3.4）。
 *
 * 这一层只做四件事：
 * 1. 打开数据：配了 root（cordis.patch.yml 已注入 config.root = dshHomePath('acromegaly-workbench')）
 *    就用那个资料目录；没配就退到内存演示库，保证装上去能看见东西；
 * 2. 过宿主鉴权（connection.requestRejection），不自己造登录；
 * 3. 把请求交给 dsh/routes.js 那张两条链路共用的路由表（dev-server 用同一份）；
 * 4. 卸载时按序关库。
 *
 * UI 走 iframe：业务界面（public/，由 scripts/build-public.mjs 从 prototypes/v0.2 产出）
 * 指向 /api/acromegaly/ui/，页面里的接口基址按自身路径推出来（public/app.js 的 apiBase()），
 * 所以「本地 dev-server 打开」与「装进 Desktop」用同一份前端。
 */
import Schema from '@deepseek-ai/schemastery'
import { readFileSync } from 'node:fs'
import { openDatabase, migrate, close } from './store.js'
import { seedDemo, hasDemoData } from './demo.js'
import { bootstrap, getProfile } from './readmodels.js'
import { servePublic } from './server.js'
import { createApiHandler, API_PREFIX, UI_PREFIX } from './routes.js'
import { version, build } from '../lib/version.js'

export const name = 'acromegaly-workbench-main'
export const inject = ['webServer', 'connection']

/** 接口前缀与 UI 前缀：真身在 routes.js；这里再导出一次给包检查与前端文档。 */
export { API_PREFIX, UI_PREFIX }

/** Config 必须是 Schemastery schema；root 可选——不给就用内存演示库（只读演示，不落盘）。 */
export const Config = Schema.object({
  root: Schema.string(),
})

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

/** 打开数据源。返回 { db, bootstrap(), profile(), close() }。 */
function openDataSource(root) {
  const file = root ? `${root.replace(/\/+$/, '')}/limbpal.sqlite` : ':memory:'
  const db = openDatabase(file)
  migrate(db)
  if (!hasDemoData(db)) seedDemo(db, JSON.parse(readFileSync(new URL('../demo/demo-data.json', import.meta.url), 'utf8')))
  return {
    db,
    bootstrap: () => bootstrap(db, { version, build }),
    profile: (key, opts) => getProfile(db, key, opts),
    close: () => close(db),
  }
}

export function apply(ctx, config = {}) {
  if (!ctx.webServer?.register) throw new Error('Desktop webServer.register is unavailable')

  let source = null
  let failure = null
  try {
    source = openDataSource(config.root)
  } catch (error) {
    failure = error.message
  }

  const api = createApiHandler({
    source: source ?? {
      db: null,
      bootstrap: () => { throw new Error(failure) },
      profile: () => null,
    },
    version,
    build,
    serveUi: (req, res, urlPath) => servePublic(req, res, urlPath),
    failure,
  })

  const handler = (req, res) => {
    /* 鉴权：宿主不给结论就不放行，不自建登录态。 */
    if (typeof ctx.connection?.requestRejection !== 'function') {
      return sendJson(res, 503, { error: 'connection authentication capability unavailable' })
    }
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { error: 'Authentication required' })

    /* 数据源打不开时只有 /health 能回（带错误原因），其余走各自分支的 503。 */
    return api(req, res)
  }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
    return () => {
      try { dispose && dispose() } catch { /* 宿主卸载时的清理失败不该盖住原错误 */ }
      if (source) { try { source.close() } catch { /* 同上 */ } }
    }
  }, 'acromegaly-workbench ui + api')
}
