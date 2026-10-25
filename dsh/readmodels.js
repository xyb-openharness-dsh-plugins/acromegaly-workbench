/**
 * 读模型（小肢宝 ACM）：把 0001 冻结 schema 的行还原成前端要的形状——
 * 即 prototypes/v0.2/demo-data.js 里 profiles[0] 的结构（demo-parity 测试逐字段比对）。
 *
 * 每条线一个读法（10 线对应）：
 * - biochemistry：三条序列 GHR/GHOG/IGF1 只取 metric_def.category='biochemistry'
 *   （T5：糖代谢/心血管/骨关节等分类数据与替代激素化验（category='hormone'）不进趋势）；
 *   metric_point 只读 in_use=1（更正链把旧行置 0）；随机 GH 与 OGTT 谷值靠 code 分列不混（T2）；
 * - treatment：medPlan ← medication_regimen；injections ← medication_event(INJECTED)
 *   （部位/备注/反应从 reaction_note JSON 还原）；sideEffects ← medication_event(REACTION)；
 *   32 号折叠卡 pathway 的五块细节是叙述层，来自 workspace.dataset_state 的 presentation JSON；
 * - replacement：meds ← hormone_replacement（id/reason/quote 由 presentation 按 hormone 补）；
 *   diary ← hormone_intake_log（日期/按时服或漏服/记录主体），事件原文叙述随 presentation；
 *   followupLabs ← metric_point(category='hormone')；
 * - comorbidity：按 section 分节（标题来自 comorbidity_section_title 的 *_title）；
 * - imaging / calendar / visit / viewpoints：各自表的规范化读法。
 *
 * 排序纪律：所有列表显式 ORDER BY（ord 或 rowid），不依赖 SQLite 的默认返回序；
 * 显式 null：原型里没有的字段读出来就是 null，不猜默认值。
 */

import { AGENT_PANE } from '../lib/layout.js'

const jp = (s, fallback = null) => {
  if (s === null || s === undefined) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}
/* node:sqlite 返回 null-prototype 行对象，deepStrictEqual 会因原型不同失败。统一摊平。 */
const rows = (db, sql, ...args) => db.prepare(sql).all(...args).map((r) => ({ ...r }))
const roleOut = (r) => (r === 'CAREGIVER' ? 'FAMILY' : 'PATIENT')

/** 合并症分节 key（与 schema comorbidity_section_title.section 一致，ord 决定顺序）。 */
export const COMORBIDITY_SECTIONS = ['GLYCEMIC', 'CARDIO', 'SLEEP', 'BONE']

/** 读 workspace.dataset_state：{ meta, presentation }。空库返回空壳。 */
export function readWorkspaceState(db) {
  const r = db.prepare('SELECT dataset_state FROM workspace WHERE id = 1').get()
  const state = jp(r?.dataset_state, null)
  return state && typeof state === 'object'
    ? { meta: state.meta ?? {}, presentation: state.presentation ?? {} }
    : { meta: {}, presentation: {} }
}

/* ---------------- 生化（T1/T2/T5） ---------------- */

function readBiochemSeries(db, key, code) {
  return rows(db, `SELECT measured_at, value_num, value_text, unit, ref_range_text, source_note
      FROM metric_point
      WHERE profile_id = ? AND code = ? AND in_use = 1 ORDER BY rowid`, key, code)
    .map((p) => {
      const sn = jp(p.source_note, {}) || {}
      const out = {
        d: p.measured_at,
        v: p.value_num === null ? p.value_text : p.value_num,
        unit: p.unit ?? null,
        ...(p.ref_range_text === null ? {} : { ref: p.ref_range_text }),
        quote: sn.quote ?? null,
        src: sn.src ?? null,
      }
      return out
    })
}

function readFollowupLabs(db, key) {
  return rows(db, `SELECT m.code, m.label, p.measured_at, p.value_text, p.source_note
      FROM metric_point p JOIN metric_def m ON m.code = p.code
      WHERE p.profile_id = ? AND m.category = 'hormone' AND p.in_use = 1 ORDER BY p.rowid`, key)
    .map((p) => {
      const sn = jp(p.source_note, {}) || {}
      return { d: p.measured_at, item: p.label, v: p.value_text ?? null, quote: sn.quote ?? null, src: sn.src ?? null }
    })
}

/* ---------------- 治疗线（T3） ---------------- */

function readTreatment(db, key, pres) {
  const regimen = db.prepare(`SELECT * FROM medication_regimen WHERE profile_id = ? ORDER BY ord, rowid`).get(key) ?? null
  const medPlan = regimen
    ? {
        drug: regimen.drug_name,
        dose: regimen.dose_text,
        cycleDays: regimen.cycle_days ?? null,
        route: pres.medPlanRoute ?? null,
        prescriber: regimen.prescriber_note ?? null,
        start: regimen.start_date,
      }
    : null

  const cycleText = regimen?.cycle_days ? `每 ${regimen.cycle_days} 天 1 次` : null
  const injections = rows(db, `SELECT * FROM medication_event
      WHERE profile_id = ? AND kind = 'INJECTED' ORDER BY ord, rowid`, key)
    .map((e, i) => {
      const rn = jp(e.reaction_note, {}) || {}
      return {
        id: `inj${i + 1}`,
        d: e.event_date,
        drug: regimen?.drug_name ?? null,
        dose: e.dose_text ?? regimen?.dose_text ?? null,
        cycle: cycleText,
        site: rn.site ?? null,
        recorder: roleOut(e.author_role),
        note: rn.note ?? null,
        reaction: rn.reaction ?? null,
      }
    })
  const sideEffects = rows(db, `SELECT * FROM medication_event
      WHERE profile_id = ? AND kind = 'REACTION' ORDER BY ord, rowid`, key)
    .map((e) => ({ d: e.event_date, text: e.reaction_note ?? null, recorder: roleOut(e.author_role) }))

  return {
    medPlan,
    injections,
    nextInjectionDue: pres.nextInjectionDue ?? null,
    sideEffects,
    pathway: pres.pathway ?? [],
  }
}

/* ---------------- 激素替代（T4） ---------------- */

function readReplacement(db, key, pres) {
  const meta = new Map((pres.replacementMedMeta ?? []).map((m) => [m.hormone, m]))
  const meds = rows(db, `SELECT * FROM hormone_replacement WHERE profile_id = ? ORDER BY ord, rowid`, key)
    .map((r, i) => {
      const m = meta.get(r.hormone) ?? {}
      return {
        id: m.id ?? `hr${i + 1}`,
        name: r.hormone,
        dose: r.dose_text,
        reason: m.reason ?? null,
        start: r.start_date,
        quote: m.quote ?? null,
      }
    })
  const byId = new Map(rows(db, 'SELECT id, hormone FROM hormone_replacement WHERE profile_id = ?', key).map((r) => [r.id, r.hormone]))
  const diary = rows(db, `SELECT * FROM hormone_intake_log WHERE profile_id = ? ORDER BY ord, rowid`, key)
    .map((l) => ({
      d: l.log_date,
      med: byId.get(l.replacement_id) ?? null,
      event: l.kind === 'MISSED' ? '漏服（事实记录）' : '按时服',
      recorder: roleOut(l.author_role),
    }))
  return {
    note: pres.replacementNote ?? null,
    missedRiskNote: pres.missedRiskNote ?? null,
    meds,
    diary,
    followupLabs: readFollowupLabs(db, key),
  }
}

/* ---------------- 影像 / 合并症 / 随访 / 复诊 ---------------- */

function readImaging(db, key, pres) {
  const unpack = (r) => {
    const f = jp(r.findings_text, {}) || {}
    return { d: r.exam_date, title: f.title ?? null, quote: f.quote ?? null, next: f.next ?? null }
  }
  return {
    mri: rows(db, `SELECT * FROM imaging_report WHERE profile_id = ? AND modality = 'MRI' ORDER BY ord, rowid`, key).map(unpack),
    visual: rows(db, `SELECT * FROM imaging_report WHERE profile_id = ? AND modality = 'VISUAL_FIELD' ORDER BY ord, rowid`, key).map(unpack),
    note: pres.imagingNote ?? null,
  }
}

function readComorbidity(db, key, pres) {
  const titles = new Map(rows(db, 'SELECT section, title FROM comorbidity_section_title ORDER BY ord').map((r) => [r.section, r.title]))
  const out = { note: pres.comorbidityNote ?? null }
  for (const section of COMORBIDITY_SECTIONS) {
    const items = rows(db, `SELECT * FROM comorbidity_event WHERE profile_id = ? AND section = ? ORDER BY ord, rowid`, key, section)
      .map((e) => {
        const n = jp(e.note, {}) || {}
        return { d: e.event_date, item: e.title, v: n.v ?? null, quote: n.quote ?? null, src: n.src ?? null }
      })
    out[section.toLowerCase() === 'glycemic' ? 'glucose'
      : section.toLowerCase() === 'cardio' ? 'cardio'
        : section.toLowerCase() === 'sleep' ? 'sleep' : 'bone'] = {
      title: titles.get(section) ?? section,
      items,
      note: (pres.comorbiditySectionNotes ?? {})[section] ?? null,
    }
  }
  return out
}

function readCalendar(db, key, pres) {
  const all = rows(db, `SELECT * FROM followup_plan WHERE profile_id = ? ORDER BY ord, rowid`, key)
  const rhythm = all.filter((r) => r.planned_on === null).map((r) => ({
    item: r.item, freq: r.source_note ?? null, quote: r.order_text ?? null, next: null,
  }))
  const entries = all.filter((r) => r.planned_on !== null).map((r) => {
    const sn = jp(r.source_note, null)
    return {
      d: r.planned_on, item: r.item,
      note: (sn && typeof sn === 'object' ? sn.note : null) ?? null,
      done: !!r.done,
      kind: sn && typeof sn === 'object' ? sn.kind ?? null : null,
    }
  })
  return { note: pres.calendarNote ?? null, rhythm, entries }
}

function readVisit(db, key, pres) {
  const questions = rows(db, `SELECT * FROM question WHERE profile_id = ? ORDER BY ord, rowid`, key)
    .map((q, i) => ({ id: `q${i + 1}`, text: q.content, asked: q.asked_on !== null, src: q.from_scenario ?? null }))
  const documents = rows(db, `SELECT * FROM document WHERE profile_id = ? ORDER BY ord, rowid`, key)
    .map((d) => ({
      id: `d${d.id}`,
      name: d.file_name,
      kind: /\.pdf$/i.test(d.file_name) ? 'PDF' : '图片',
      size: null,
      status: d.status === 'parsed' ? '已核对' : d.status === 'parse_failed' ? '解析失败' : '待核对',
    }))
  const saved = new Set(rows(db, 'SELECT trial_key FROM saved_trial WHERE profile_id = ?', key).map((r) => r.trial_key))
  const trials = (pres.researchTrials ?? []).filter((t) => saved.has(t.key))
  return {
    questions,
    summaryNote: pres.summaryNote ?? null,
    materials: pres.materials ?? [],
    documents,
    candidates: [],
    research: { note: pres.researchNote ?? null, trials },
  }
}

/* ---------------- 档案整体 ---------------- */

/**
 * 读一个档案（默认私密过滤：viewpoints 只留 visibility != 'private'，
 * 并附 privateCount 让前端显示"还有 N 条本人确认后可见"）。
 */
export function getProfile(db, key, { includePrivate = false } = {}) {
  const found = db.prepare('SELECT * FROM profile WHERE id = ?').get(key)
  if (!found) return null
  const { presentation: pres } = readWorkspaceState(db)

  const treatment = readTreatment(db, key, pres)
  const replacement = readReplacement(db, key, pres)
  const imaging = readImaging(db, key, pres)
  const comorbidity = readComorbidity(db, key, pres)
  const calendar = readCalendar(db, key, pres)
  const visit = readVisit(db, key, pres)
  const viewpointsAll = rows(db, `SELECT * FROM symptom_log WHERE profile_id = ? ORDER BY ord, rowid`, key)
    .map((s) => ({
      date: s.logged_at, role: roleOut(s.author_role), topic: s.symptom ?? null,
      content: s.severity_text ?? null,
      visibility: s.visibility === 'private' ? 'private' : 'shared',
    }))

  const p = {
    id: found.id,
    name: found.name,
    age: pres.age ?? null,
    gender: found.gender ?? null,
    shoeNote: pres.shoeNote ?? null,
    diagnosis: pres.diagnosis ?? null,
    diagnosisShort: pres.diagnosisShort ?? null,
    stageLine: pres.stageLine ?? null,
    hospital: pres.hospital ?? null,
    caregiverLabel: pres.caregiverLabel ?? null,
    primaryRole: found.primary_role === 'CAREGIVER' ? 'CAREGIVER' : 'PATIENT',
    biochem: {
      ghRandom: readBiochemSeries(db, key, 'GHR'),
      ghOgtt: readBiochemSeries(db, key, 'GHOG'),
      igf1: readBiochemSeries(db, key, 'IGF1'),
      note: pres.biochemNote ?? null,
    },
    pathway: treatment.pathway,
    injections: treatment.injections,
    nextInjectionDue: treatment.nextInjectionDue,
    medPlan: treatment.medPlan,
    sideEffects: treatment.sideEffects,
    replacement,
    events: pres.events ?? [],
    reports: pres.reports ?? [],
    imaging,
    comorbidity,
    calendar,
    visit,
    viewpoints: includePrivate ? viewpointsAll : viewpointsAll.filter((v) => v.visibility !== 'private'),
    privateCount: viewpointsAll.filter((v) => v.visibility === 'private').length,
  }
  return p
}

export function listProfiles(db) {
  return rows(db, 'SELECT id, name FROM profile ORDER BY rowid')
}

/** `/api/bootstrap` 的 payload：与原型 DEMO_DATA 同形（meta + profiles 数组），外加版本与布局。 */
export function bootstrap(db, { version, build } = {}) {
  const { meta } = readWorkspaceState(db)
  const profiles = listProfiles(db).map((s) => getProfile(db, s.id))
  return {
    version: version ?? null,
    build: build ?? null,
    meta,
    profiles,
    agent: { available: true, mode: 'dev-mount' },
    layout: { agentPane: AGENT_PANE },
  }
}
