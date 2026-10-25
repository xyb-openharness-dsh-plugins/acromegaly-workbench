/* 数据层：迁移幂等 / 播种幂等 / 更正链 revision / in_use 过滤 / 文件库持久化。 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { openDatabase, migrate, close, correctMetricPoint, migrationFiles } from '../dsh/store.js'
import { seedDemo, hasDemoData } from '../dsh/demo.js'
import { readDemoJson } from '../demo/build-demo-data.mjs'

const tmp = mkdtempSync(join(homedir(), '.limbpal-store-test-'))
after(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不影响结果 */ } })

test('① migrate 幂等：第二次执行不重跑 0001，台账只有一条', () => {
  const db = openDatabase(':memory:')
  const first = migrate(db)
  const second = migrate(db)
  assert.deepEqual(first.executed, ['0001_initial.sql'])
  assert.deepEqual(second.executed, [], '第二次不应重跑')
  assert.equal(second.applied.length, 1)
  assert.equal(second.applied[0].version, '0001')
  close(db)
})

test('② 迁移文件命名纪律：schema/ 里不许出现不符合 NNNN_name.sql 的 SQL', () => {
  assert.deepEqual(migrationFiles().map((f) => f.slice(0, 4)), ['0001'])
})

test('③ seedDemo 幂等：调两次只写一份档案', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  const a = seedDemo(db, readDemoJson())
  const b = seedDemo(db, readDemoJson())
  assert.equal(a.skipped, false)
  assert.equal(a.profiles, 1)
  assert.equal(b.skipped, true, '第二次应整批跳过')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profile').get().n, 1)
  close(db)
})

test('④ 更正链：旧行 in_use=0、新行 revision+1，数值可回放', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db, readDemoJson())
  const target = db.prepare("SELECT id, value_num, revision FROM metric_point WHERE code = 'IGF1' AND in_use = 1 ORDER BY rowid").all()[0]
  const { id: newId, revision } = correctMetricPoint(db, target.id, { value_num: 269 })
  assert.equal(revision, target.revision + 1)
  const old = db.prepare('SELECT in_use, revision FROM metric_point WHERE id = ?').get(target.id)
  assert.equal(old.in_use, 0, '旧行必须置 in_use=0')
  const fresh = db.prepare('SELECT value_num FROM metric_point WHERE id = ?').get(newId)
  assert.equal(fresh.value_num, 269)
  /* 已失效的行不许再更正（要更正的是现行记录）。 */
  assert.throws(() => correctMetricPoint(db, target.id, { value_num: 1 }), /已被更正过|SUPERSEDED/)
  close(db)
})

test('⑤ 更正链守卫：不可变字段（code/measured_at）与不存在的 id 都要拒', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db, readDemoJson())
  const any = db.prepare('SELECT id FROM metric_point WHERE in_use = 1').get()
  assert.throws(() => correctMetricPoint(db, any.id, { code: 'GHR' }), /不能更正|IMMUTABLE_FIELD/)
  assert.throws(() => correctMetricPoint(db, 999999, {}), /没有这条指标记录|NOT_FOUND/)
  close(db)
})

test('⑥ 读模型只取 in_use=1：更正后趋势立刻反映新值、旧值不重复出现', async () => {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db, readDemoJson())
  const { getProfile } = await import('../dsh/readmodels.js')
  const before = getProfile(db, 'demo1').biochem.igf1
  const row = db.prepare("SELECT id FROM metric_point WHERE code='IGF1' AND in_use=1 ORDER BY rowid").get()
  correctMetricPoint(db, row.id, { value_num: 611 })
  const after = getProfile(db, 'demo1').biochem.igf1
  assert.equal(after.length, before.length, '更正不增减序列长度（旧行 in_use=0，新行补位）')
  assert.equal(after.at(-1).v, 611, '新行按插入序在序列末位，读出更正值')
  assert.equal(after.filter((x) => x.v === 612).length, 0, '旧值不该再出现')
  close(db)
})

test('⑦ 文件库：真实落盘 + 重开后资料仍在（播种只发生一次）', () => {
  mkdirSync(join(tmp, 'nested'), { recursive: true })
  const file = join(tmp, 'nested', 'limbpal.sqlite')
  const db1 = openDatabase(file)
  migrate(db1)
  seedDemo(db1, readDemoJson())
  close(db1)
  const db2 = openDatabase(file)
  migrate(db2)
  assert.equal(hasDemoData(db2), true, '重开后档案还在')
  assert.equal(seedDemo(db2, readDemoJson()).skipped, true, '重开后不应再播种一遍')
  close(db2)
})

test('⑧ 22 表齐备：0001 冻结 schema 建全了家族契约要求的表', () => {
  const db = openDatabase(':memory:')
  migrate(db)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name)
  for (const t of ['workspace', 'profile', 'metric_def', 'metric_point', 'lab_result', 'symptom_log',
    'question', 'task', 'document', 'saved_trial', 'visit_summary', 'diagnosis_record',
    'pituitary_surgery', 'radiotherapy_event', 'medication_regimen', 'medication_event',
    'hormone_replacement', 'hormone_intake_log', 'imaging_report', 'comorbidity_event',
    'comorbidity_section_title', 'followup_plan']) {
    assert.ok(tables.includes(t), `缺表 ${t}`)
  }
  assert.equal(tables.length, 23, '22 张业务表 + schema_migrations')
  close(db)
})
