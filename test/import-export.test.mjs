/* 解析候选→待核对→确认入事实层（FAILED 如实）+ 导出 private 过滤。
 *
 * MinerU 客户端注入假实现（不联网）；抽取层用真实 markdown 夹具。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { readDemoJson } from '../demo/build-demo-data.mjs'
import { extractLabCandidates, htmlTablesToPipes, normalizeUnit, guessReportDate } from '../dsh/acmparse.js'
import { parseAndRecord, listCandidates, acceptCandidate, rejectCandidate } from '../dsh/parse.js'
import { MineruError } from '../dsh/mineru.js'
import { renderPrepMarkdown } from '../dsh/export.js'
import { getProfile } from '../dsh/readmodels.js'

function openSeeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db, readDemoJson())
  return db
}

/* ---------------- 抽取层（六部件之一：dsh/acmparse.js） ---------------- */

const LAB_MD = `# 化验单
| 项目 | 结果 | 单位 | 参考范围 |
| --- | --- | --- | --- |
| 随机 GH | 1.2 | ng/mL | — |
| IGF-1 | 268 | ng/mL | 117–288 |
| 糖化血红蛋白 | 5.7 | % | 4.0–6.0 |
| 游离 T4 | 13.8 | pmol/L | 12.0–22.0 |`

test('① 管道表格按位置对齐：GH/IGF-1/HbA1c/FT4 各成候选，参考区间不充当结果', () => {
  const { candidates, skipped } = extractLabCandidates(LAB_MD)
  const fields = candidates.map((c) => c.field)
  assert.deepEqual(fields, ['随机 GH', 'IGF-1', 'HbA1c', '游离 T4'])
  assert.equal(candidates[0].value, 1.2)
  assert.equal(candidates[1].value, 268)
  assert.equal(candidates[2].unit, '%')
})

test('② HTML 表格先转管道再对齐（不转就会整表压成一行）', () => {
  const html = `<table><tr><td>项目</td><td>结果</td></tr><tr><td>IGF-1</td><td>301</td></tr></table>`
  const md = htmlTablesToPipes(html)
  assert.match(md, /\| IGF-1 \| 301 \|/)
  const { candidates } = extractLabCandidates(html)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].value, 301)
})

test('③ 单位先剥 LaTeX 外壳；<0.5 这类留原文；两数一格（参考区间）整行放弃', () => {
  assert.equal(normalizeUnit('$10^9/L$'), '10^9/L')
  const md = `| 项目 | 结果 | 单位 |\n| --- | --- | --- |\n| 随机 GH | <0.5 | ng/mL |\n| 游离 T4 | 12.0–22.0 | pmol/L |`
  const { candidates, skipped } = extractLabCandidates(md)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].value, '<0.5', '不等式留原文，不四舍五入成 0')
  assert.ok(skipped.some((s) => /参考范围/.test(s.reason)), '两数一格必须放弃并说明')
})

test('④ 报告日期从文件名/正文取，取不到不猜', () => {
  assert.equal(guessReportDate('化验单2026-10-13.pdf'), '2026-10-13')
  assert.equal(guessReportDate('化验单 2026年10月13日.png'), '2026-10-13')
  assert.equal(guessReportDate('无名文件.pdf'), null)
})

/* ---------------- 编排层（六部件之一：dsh/parse.js） ---------------- */

const fakeClient = (markdown) => ({ parse: async () => ({ markdown, pages: 2 }) })
const failingClient = { parse: async () => { throw new MineruError('TASK_FAILED', '云端解析失败：demo') } }

test('⑤ 解析成功：document=parsed、候选挂待核对、成功不碰事实表', async () => {
  const db = openSeeded()
  const before = db.prepare('SELECT COUNT(*) AS n FROM metric_point WHERE in_use=1').get().n
  const r = await parseAndRecord(db, { bytes: Buffer.from('fake'), filename: '化验单2026-10-13.pdf', profileId: 'demo1', client: fakeClient(LAB_MD) })
  assert.equal(r.status, 'parsed')
  assert.equal(r.candidates.length, 4)
  const pending = listCandidates(db, { documentId: r.documentId })
  assert.equal(pending.length, 4)
  assert.ok(pending.every((c) => c.state === 'pending'))
  const after = db.prepare('SELECT COUNT(*) AS n FROM metric_point WHERE in_use=1').get().n
  assert.equal(after, before, '确认之前候选不许进事实层')
  close(db)
})

test('⑥ FAILED 如实：解析失败 document=parse_failed、不产候选、异常抛回', async () => {
  const db = openSeeded()
  await assert.rejects(
    () => parseAndRecord(db, { bytes: Buffer.from('fake'), filename: 'bad.pdf', profileId: 'demo1', client: failingClient }),
    /云端解析失败/,
  )
  const doc = db.prepare("SELECT status FROM document WHERE file_name='bad.pdf' ORDER BY id DESC").get()
  assert.equal(doc.status, 'parse_failed', '失败状态必须如实落库（可重试）')
  const pending = listCandidates(db).filter((c) => c.src.startsWith('bad.pdf'))
  assert.equal(pending.length, 0, '解析失败不许产候选')
  close(db)
})

test('⑦ 白名单守卫：.html/.txt 不发请求，直接 4xx 语义错误', async () => {
  const db = openSeeded()
  await assert.rejects(() => parseAndRecord(db, { bytes: Buffer.from('x'), filename: 'a.html', profileId: 'demo1', client: fakeClient('') }), /不支持的文件类型/)
  await assert.rejects(() => parseAndRecord(db, { bytes: Buffer.from('x'), filename: 'a.txt', profileId: 'demo1', client: fakeClient('') }), /不支持的文件类型/)
  close(db)
})

test('⑧ 确认入事实层：IGF-1 候选落 metric_point（in_use=1）；HbA1c 归 glycemic 不进生化趋势；拒收零副作用', async () => {
  const db = openSeeded()
  const r = await parseAndRecord(db, { bytes: Buffer.from('fake'), filename: '化验单2026-10-13.pdf', profileId: 'demo1', client: fakeClient(LAB_MD) })
  const pending = listCandidates(db, { documentId: r.documentId })

  const igf = pending.find((c) => c.field === 'IGF-1')
  acceptCandidate(db, igf.id)
  const point = db.prepare("SELECT value_num, in_use, revision FROM metric_point WHERE code='IGF1' ORDER BY id DESC").get()
  assert.equal(point.value_num, 268)
  assert.equal(point.in_use, 1)
  assert.equal(point.revision, 1)
  /* IGF-1 序列从 7 条变 8 条（新点 2026-10-13 落在最后）。 */
  assert.equal(getProfile(db, 'demo1').biochem.igf1.length, 8)

  const hba1c = pending.find((c) => c.field === 'HbA1c')
  acceptCandidate(db, hba1c.id)
  const cat = db.prepare("SELECT category FROM metric_def WHERE code='HBA1C'").get()
  assert.equal(cat.category, 'glycemic', '分类数据不进生化趋势（T5）')
  assert.equal(/糖化/.test(JSON.stringify(getProfile(db, 'demo1').biochem)), false)

  rejectCandidate(db, pending.find((c) => c.field === '游离 T4').id)
  const rest = listCandidates(db, { documentId: r.documentId })
  assert.equal(rest.length, 3, '两条已确认 + 一条仍待核对；拒收的直接移除')
  assert.equal(rest.filter((c) => c.state === 'accepted').length, 2)
  assert.equal(rest.filter((c) => c.field === '游离 T4').length, 0)
  assert.throws(() => rejectCandidate(db, 'nope'), /没有这条候选/)
  close(db)
})

/* ---------------- 导出（dsh/export.js） ---------------- */

test('⑨ 导出 private 过滤：shared 看法带上否定语境抬头，private 原文绝不出现', () => {
  const db = openSeeded()
  const full = getProfile(db, 'demo1', { includePrivate: true })
  const md = renderPrepMarkdown(full, { version: '0.2.0', excludedPrivate: true })
  assert.match(md, /不是医生结论/)
  assert.match(md, /总算知道/)
  assert.equal(/不敢跟孩子说|腰酸/.test(md), false)
  assert.match(md, /有意排除/)
  close(db)
})

test('⑩ 导出无判读词：控制/正常/异常/建议调整类字样零命中（check-wording 兜底）', async () => {
  const db = openSeeded()
  const full = getProfile(db, 'demo1', { includePrivate: true })
  const md = renderPrepMarkdown(full, {})
  assert.doesNotMatch(md, /生化控制|建议调整|可以停药|结果正常|结果异常/)
  close(db)
  /* check-wording 脚本本体也跑一遍（作为测试内的第二道闸）。 */
  const { execFileSync } = await import('node:child_process')
  execFileSync('node', ['scripts/check-wording.mjs'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' })
})
