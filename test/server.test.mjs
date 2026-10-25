/* HTTP 层：健康检查 / bootstrap / private 闸门 / 导出（含落盘）/ 静态文件 / JSON 404 /
 * 路径穿越 / 资料目录校验 / 交界守卫（4xx 不裸 throw 500）/ 双形态（宿主鉴权形态模拟）。
 *
 * 起真实服务（port:0 系统分配），只用内置 fetch。测完必须关 server 与 db。
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { Workbench, validateWorkspacePath } from '../dsh/workbench.js'
import { startWorkbenchServer, servePublic } from '../dsh/server.js'
import { createApiHandler, API_PREFIX } from '../dsh/routes.js'

const tmp = mkdtempSync(join(homedir(), '.limbpal-server-test-'))
after(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ } })

async function withServer(fn) {
  const workbench = await Workbench.open(join(tmp, 'workspace'))
  const { server, port, url } = await startWorkbenchServer({ port: 0, host: '127.0.0.1', workbench })
  try {
    await fn({ url, port, workbench })
  } finally {
    await new Promise((r) => server.close(r))
    workbench.close()
  }
}

test('① /api/acromegaly/health 返回 ok 与版本、能力清单', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/health`)
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.equal(j.ok, true)
    assert.match(j.version, /^\d+\.\d+\.\d+/)
    assert.equal(j.ui, '/api/acromegaly/ui')
    assert.ok(j.capabilities.includes('import'), '能力清单要能看出装了哪些功能')
  })
})

test('② /api/acromegaly/bootstrap 返回演示档案，与原型同形（profiles 数组）', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/bootstrap`)
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.ok(Array.isArray(j.profiles) && j.profiles.length === 1)
    assert.equal(j.profiles[0].biochem.ghRandom.length, 7)
    assert.equal(j.profiles[0].injections.length, 18, 'SSA 28 天周期 18 针')
    assert.equal(j.agent.available, true, '开发版自带挂 mount 演示')
    assert.ok(j.layout.agentPane, '布局常量随 bootstrap 下发')
  })
})

test('③ private 闸门：bootstrap 不含 private 看法原文，?private=1 才给', async () => {
  await withServer(async ({ url }) => {
    const open = await (await fetch(`${url}api/acromegaly/bootstrap`)).json()
    assert.equal(open.profiles[0].viewpoints.some((v) => v.visibility === 'private'), false)
    assert.equal(open.profiles[0].privateCount, 2)

    const one = await (await fetch(`${url}api/acromegaly/profile/demo1`)).json()
    assert.equal(one.profile.viewpoints.length, 2)
    const privy = await (await fetch(`${url}api/acromegaly/profile/demo1?private=1`)).json()
    assert.equal(privy.profile.viewpoints.length, 4, '显式 private=1 才返回全部原文')
  })
})

test('④ 导出：markdown 可下载，private 原文不进导出，且写明有意排除', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/export/demo1.md`)
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type'), /text\/markdown/)
    assert.match(r.headers.get('content-disposition'), /attachment/)
    const md = await r.text()
    assert.match(md, /复诊准备/)
    assert.match(md, /不是医生结论/, '看法区必须带否定语境的抬头')
    assert.equal(/不敢跟孩子说|腰酸/.test(md), false, 'private 原文不许进导出')
    assert.match(md, /私密感受记录（private）已按设置有意排除/, '要说清"有意排除"')
    assert.match(md, /OGTT GH 谷值/, '随机 GH 与 OGTT 谷值分列呈现')
  })
})

test('④b 保存导出：写进 <资料目录>/exports/，同样不含 private 原文', async () => {
  await withServer(async ({ url, workbench }) => {
    const r = await fetch(`${url}api/acromegaly/export/demo1.md/save`, { method: 'POST' })
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.ok(j.file.includes(`${workbench.workspace}/exports/`), `导出要落进资料目录：${j.file}`)
    assert.ok(j.bytes > 500)
    const md = readFileSync(j.file, 'utf8')
    assert.equal(/不敢跟孩子说/.test(md), false, '落盘文件同样不许带 private 原文')
  })
})

test('⑤ 静态文件：UI 前缀能取到 index.html，路径穿越被拦', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/ui/index.html`)
    assert.equal(r.status, 200)
    assert.match(await r.text(), /小肢宝/)
    assert.match(await (await fetch(`${url}api/acromegaly/ui/app.js`)).text(), /loadBootstrap/, '开发版 app.js 带数据层')

    const evil = await fetch(`${url}api/acromegaly/ui/..%2f..%2fpackage.json`)
    const body = await evil.text()
    assert.equal(body.includes('"private": true'), false, '不许把仓库文件读出去')
  })
})

test('⑥ 未知接口回 JSON 404；错方法回 405（交界守卫：4xx JSON，不裸 throw 500）', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/nope`)
    assert.equal(r.status, 404)
    assert.match(r.headers.get('content-type'), /application\/json/)
    assert.equal((await r.json()).error, 'not_found')

    const post = await fetch(`${url}api/acromegaly/bootstrap`, { method: 'POST' })
    assert.equal(post.status, 405)
    assert.equal((await post.json()).error, 'method_not_allowed')

    const badProfile = await fetch(`${url}api/acromegaly/profile/不存在`)
    assert.equal(badProfile.status, 404)
    assert.equal((await badProfile.json()).error, 'profile_not_found')
  })
})

test('⑦ 双形态回归：同一路由在「无宿主鉴权」与「模拟宿主鉴权」两形态下行为一致', async () => {
  await withServer(async ({ url, workbench }) => {
    /* 形态 A：独立启动（无 connection）。 */
    const direct = await fetch(`${url}api/acromegaly/health`)
    assert.equal(direct.status, 200)
    assert.equal((await direct.json()).ok, true)

    /* 形态 B：宿主链路——dsh/index.js 的 handler 先过 requestRejection 再进同一张路由表。
       起一个模拟宿主：前缀注册 + 先鉴权后放行/拒答，两种结论都必须回 JSON。 */
    const api = createApiHandler({
      source: {
        db: workbench.db,
        bootstrap: () => workbench.bootstrap(),
        profile: (k, o) => workbench.getProfile(k, o),
      },
      version: workbench.version,
      build: workbench.build,
      serveUi: (req, res, p) => servePublic(req, res, p),
    })
    const host = createServer((req, res) => {
      const path = new URL(req.url, 'http://x').pathname
      if (!path.startsWith(`${API_PREFIX}/`)) { res.writeHead(404); res.end(); return }
      if (req.headers['x-test-auth'] === 'reject') {
        res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'Authentication required' }))
        return
      }
      void api(req, res)
    })
    await new Promise((r) => host.listen(0, '127.0.0.1', r))
    const hport = host.address().port
    try {
      const allowed = await fetch(`http://127.0.0.1:${hport}${API_PREFIX}/health`)
      assert.equal(allowed.status, 200, '放行形态与独立启动同一行为')
      assert.equal((await allowed.json()).ok, true)

      const rejected = await fetch(`http://127.0.0.1:${hport}${API_PREFIX}/health`, { headers: { 'x-test-auth': 'reject' } })
      assert.equal(rejected.status, 401)
      assert.match(rejected.headers.get('content-type'), /application\/json/, '拒答也必须是 JSON')
      assert.equal((await rejected.json()).error, 'Authentication required')
    } finally {
      await new Promise((r) => host.close(r))
    }
  })
})

test('⑧ 导入接口：无 Token 时如实报 NO_TOKEN（503），不产候选', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/import?name=test.pdf`, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from('%PDF-1.4 fake'),
    })
    const j = await r.json()
    /* 本机没配 Token 时是 NO_TOKEN/503；配了会是 401/503/502 一类。断言"失败要说清"，不要求成功。 */
    assert.ok([200, 502, 503].includes(r.status), `状态码不该是 ${r.status}`)
    if (r.status !== 200) {
      assert.ok(['NO_TOKEN', 'UNAUTHORIZED', 'NETWORK', 'TIMEOUT', 'API_ERROR', 'BAD_INPUT', 'TASK_FAILED', 'NO_MARKDOWN', 'BAD_ZIP']
        .includes(j.error), `失败原因不在已知枚举里：${j.error}`)
      assert.equal(Array.isArray(j.candidates), false, '解析失败不许返回候选')
    }
  })
})

test('⑨ 设置接口：GET 给三态状态且无 token 原文；坏 JSON 的 POST 回 400', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/acromegaly/settings/mineru`)
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.ok(['none', 'file', 'env'].includes(j.source))
    assert.equal('token' in j, false, '响应体不许出现 token 原文字段')

    const bad = await fetch(`${url}api/acromegaly/settings/mineru`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops',
    })
    assert.equal(bad.status, 400)
    assert.equal((await bad.json()).error, 'bad_json')

    const invalid = await fetch(`${url}api/acromegaly/settings/mineru`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'x' }),
    })
    assert.equal(invalid.status, 400, '太短的 Token 是用户输入问题，回 400 不回 500')
  })
})

test('⑩ 资料目录校验：主目录 / 桌面 / /tmp 一律拒绝', () => {
  assert.ok(validateWorkspacePath(homedir()).length > 0)
  assert.ok(validateWorkspacePath(join(homedir(), 'Desktop')).length > 0)
  assert.ok(validateWorkspacePath('/tmp/x').length > 0)
  assert.deepEqual(validateWorkspacePath(join(tmp, 'ok')), [], '自己新建的目录应当可用')
  assert.equal(API_PREFIX, '/api/acromegaly', 'apiBase 定稿契约')
})
