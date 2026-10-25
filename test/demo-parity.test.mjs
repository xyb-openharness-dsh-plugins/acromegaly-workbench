/* demo-parity：库里读出的档案必须与 prototypes/v0.2/demo-data.js（唯一数据源）同形。
 *
 * 前端是照着原型的形状写的，差一个字段就是"某个卡片空白"这种很难定位的 bug。
 * 拆表（dsh/demo.js）→ 拼（dsh/readmodels.js）→ 与原型逐字段 deepStrictEqual。
 * 叙述层（pathway 五块细节、病程事件、报告清单、服药日记事件原文等）在
 * workspace.dataset_state 的 presentation JSON 里往返，也必须逐字节还原。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDatabase, migrate, close } from '../dsh/store.js'
import { seedDemo } from '../dsh/demo.js'
import { bootstrap, getProfile } from '../dsh/readmodels.js'
import { loadDemoData, readDemoJson } from '../demo/build-demo-data.mjs'

const DEMO = loadDemoData()
const D = DEMO.profiles[0]

function openSeeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  seedDemo(db, readDemoJson())
  return db
}

test('① demo-data.json 与原型 demo-data.js 同源（唯一数据源纪律）', () => {
  assert.deepEqual(readDemoJson(), DEMO)
})

test('② 生化三条序列逐字段一致（T2：随机 GH 与 OGTT 谷值分列；T5：只有 biochemistry 进趋势）', () => {
  const db = openSeeded()
  const p = getProfile(db, 'demo1')
  assert.deepStrictEqual(p.biochem.ghRandom, D.biochem.ghRandom, 'ghRandom')
  assert.deepStrictEqual(p.biochem.ghOgtt, D.biochem.ghOgtt, 'ghOgtt')
  assert.deepStrictEqual(p.biochem.igf1, D.biochem.igf1, 'igf1（含参考区间语境栏）')
  assert.equal(p.biochem.note, D.biochem.note)
  close(db)
})

test('③ 治疗线（T3）：medPlan / 注射记录 / 副作用日记 / 32 号折叠卡数据形状对齐原型', () => {
  const db = openSeeded()
  const p = getProfile(db, 'demo1')
  assert.deepStrictEqual(p.medPlan, D.medPlan, 'medPlan')
  assert.deepStrictEqual(p.injections, D.injections, 'injections（18 针，recorder=本人/家属代记）')
  assert.deepStrictEqual(p.sideEffects, D.sideEffects, 'sideEffects')
  assert.deepStrictEqual(p.pathway, D.pathway, 'pathway（折叠卡五块细节）')
  assert.equal(p.nextInjectionDue, D.nextInjectionDue)
  close(db)
})

test('④ 激素替代（T4）：多药并列 + 漏服事实 + 替代激素化验', () => {
  const db = openSeeded()
  const p = getProfile(db, 'demo1')
  assert.deepStrictEqual(p.replacement.meds, D.replacement.meds, 'meds')
  assert.deepStrictEqual(p.replacement.followupLabs, D.replacement.followupLabs, 'followupLabs')
  assert.equal(p.replacement.meds.length, 3, '三种激素并列')
  assert.equal(p.replacement.diary.length, D.replacement.diary.length, '服药日记条数一致')
  assert.equal(p.replacement.diary.filter((x) => /漏服/.test(x.event)).length, 1, '漏服只记事实（MISSED）')
  close(db)
})

test('⑤ 合并症分节（T5）：4 节标题与条目逐字段一致，分类数据不进生化趋势', () => {
  const db = openSeeded()
  const p = getProfile(db, 'demo1')
  for (const key of ['glucose', 'cardio', 'sleep', 'bone']) {
    assert.deepStrictEqual(p.comorbidity[key].items, D.comorbidity[key].items, `comorbidity.${key}.items`)
    assert.equal(p.comorbidity[key].title, D.comorbidity[key].title, `comorbidity.${key}.title（*_title 表）`)
  }
  /* HbA1c 等糖代谢数值在库里（metric_point），但绝不出现在三条生化序列里。 */
  const inBiochem = JSON.stringify(p.biochem)
  assert.equal(/HbA1c|糖化/.test(inBiochem), false, '糖代谢分类数据不进生化趋势')
  close(db)
})

test('⑥ 影像 / 随访 / 复诊：报告原文照抄、节奏按医嘱原文、问题清单', () => {
  const db = openSeeded()
  const p = getProfile(db, 'demo1')
  assert.deepStrictEqual(p.imaging.mri, D.imaging.mri, 'mri')
  assert.deepStrictEqual(p.imaging.visual, D.imaging.visual, 'visual')
  assert.deepStrictEqual(p.calendar.rhythm, D.calendar.rhythm, 'rhythm（医嘱原文）')
  assert.deepStrictEqual(p.calendar.entries, D.calendar.entries, 'entries')
  assert.deepStrictEqual(p.visit.questions.map((q) => [q.text, q.asked, q.src]),
    D.visit.questions.map((q) => [q.text, q.asked, q.src]), 'questions')
  assert.deepStrictEqual(p.visit.research.trials, D.visit.research.trials, 'research.trials（只列不荐）')
  assert.deepStrictEqual(p.events, D.events, 'events（叙述层）')
  assert.deepStrictEqual(p.reports, D.reports, 'reports（叙述层）')
  close(db)
})

test('⑦ 看法/感受（三出口口径）：private 默认过滤、includePrivate 才给原文', () => {
  const db = openSeeded()
  const open = getProfile(db, 'demo1')
  const full = getProfile(db, 'demo1', { includePrivate: true })
  assert.deepStrictEqual(full.viewpoints, D.viewpoints, 'includePrivate 时与原型逐字段一致')
  assert.equal(open.viewpoints.length, D.viewpoints.filter((v) => v.visibility !== 'private').length)
  assert.equal(open.privateCount, 2)
  assert.equal(open.viewpoints.some((v) => v.visibility === 'private'), false, '默认不返回 private 原文')
  close(db)
})

test('⑧ bootstrap：meta 与原型一致、profiles 是数组、附带版本与布局常量', () => {
  const db = openSeeded()
  const payload = bootstrap(db, { version: '0.2.0', build: 'test' })
  assert.deepStrictEqual(payload.meta, DEMO.meta)
  assert.ok(Array.isArray(payload.profiles))
  assert.equal(payload.profiles.length, 1)
  assert.equal(payload.version, '0.2.0')
  assert.ok(payload.layout.agentPane, '布局常量随 bootstrap 下发')
  assert.ok(payload.agent.available, '开发版自带挂载位演示')
  close(db)
})
