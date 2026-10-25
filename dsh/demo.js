/**
 * 演示数据播种（小肢宝 ACM）。
 *
 * 唯一数据源是 prototypes/v0.2/demo-data.js（经 demo/build-demo-data.mjs 求值成
 * demo/demo-data.json 与 demo/demo-data.sqlite）。本文件把同一份纯数据按 0001 冻结
 * schema 的 22 张表拆开写入，读模型（dsh/readmodels.js）再把它拼回原型形状——
 * 拆与拼不一致就是 demo-parity 测试要抓的问题。
 *
 * 拆分口径（哪类数据落在哪张表）：
 * - GH/IGF-1/替代激素化验 → metric_def + metric_point（GHR=RANDOM、GHOG=OGTT_NADIR、
 *   IGF1=ROUTINE、CORT/FT4/OSMO=FASTING/ROUTINE 且 category='hormone'，不进生化趋势）；
 *   报告原句 quote 与出处 src 没有各自列，合并以 JSON 存进 source_note（读模型还原）；
 * - 32 号折叠卡（pathway 五块细节）、病程事件叙述、报告清单、替代服药日记的事件原文、
 *   各页 note/口径说明等"演示叙述层"没有对应的规范化列（schema 已冻结），
 *   统一存 workspace.dataset_state 的 presentation JSON；
 * - 注射记录 → medication_event(INJECTED)（部位/备注以 JSON 并入 reaction_note）；
 *   副作用日记 → medication_event(REACTION)；
 * - 替代方案 → hormone_replacement；服药/漏服 → hormone_intake_log（kind 只有 TAKEN/MISSED）；
 * - 合并症 → comorbidity_event（section 4 节）+ comorbidity_section_title（*_title）；
 * - 影像/视野 → imaging_report（title/quote/next 以 JSON 存 findings_text）；
 * - 随访节奏与日历条目 → followup_plan（节奏行 planned_on 为空、source_note 存频次文本；
 *   条目行 source_note 存 JSON {note, kind}）；
 * - 问题清单 → question；报告文件 → document；研究条目 → saved_trial；
 * - 看法/感受 → symptom_log（visibility: public=shared / private=private；
 *   author_role 按 schema 用 PATIENT/CAREGIVER，读模型映射回原型的 PATIENT/FAMILY）。
 *
 * 幂等：库里已有 profile 就整批跳过。事务：整批一个事务，失败整体回滚。
 */

import { createHash } from 'node:crypto'

const j = (v) => (v === undefined ? null : JSON.stringify(v))
const flag = (v) => (v ? 1 : 0)
/** 原型的 recorder 值（PATIENT/FAMILY）→ schema 的 author_role（PATIENT/CAREGIVER）。 */
const roleIn = (r) => (r === 'FAMILY' || r === 'CAREGIVER' ? 'CAREGIVER' : 'PATIENT')
const sha = (s) => createHash('sha256').update(String(s)).digest('hex')

/** 演示叙述层：把原型里"没有规范化列"的字段收进一个 JSON，存 workspace.dataset_state。 */
export function buildPresentation(p) {
  return {
    age: p.age ?? null,
    shoeNote: p.shoeNote ?? null,
    diagnosis: p.diagnosis ?? null,
    diagnosisShort: p.diagnosisShort ?? null,
    stageLine: p.stageLine ?? null,
    hospital: p.hospital ?? null,
    caregiverLabel: p.caregiverLabel ?? null,
    nextInjectionDue: p.nextInjectionDue ?? null,
    medPlanRoute: p.medPlan?.route ?? null,
    biochemNote: p.biochem?.note ?? null,
    pathway: p.pathway ?? [],
    events: p.events ?? [],
    reports: p.reports ?? [],
    imagingNote: p.imaging?.note ?? null,
    comorbidityNote: p.comorbidity?.note ?? null,
    comorbiditySectionNotes: {
      GLYCEMIC: p.comorbidity?.glucose?.note ?? null,
      CARDIO: p.comorbidity?.cardio?.note ?? null,
      SLEEP: p.comorbidity?.sleep?.note ?? null,
      BONE: p.comorbidity?.bone?.note ?? null,
    },
    replacementNote: p.replacement?.note ?? null,
    missedRiskNote: p.replacement?.missedRiskNote ?? null,
    replacementMedMeta: (p.replacement?.meds ?? []).map((m) => ({ hormone: m.name, id: m.id, reason: m.reason, quote: m.quote })),
    replacementDiary: p.replacement?.diary ?? [],
    calendarNote: p.calendar?.note ?? null,
    summaryNote: p.visit?.summaryNote ?? null,
    materials: p.visit?.materials ?? [],
    visitDocuments: p.visit?.documents ?? [],
    researchNote: p.visit?.research?.note ?? null,
    researchTrials: p.visit?.research?.trials ?? [],
  }
}

/** metric_def 种子：三条生化序列（category='biochemistry'，唯一可进趋势）+ 替代激素化验。 */
export const METRIC_DEFS = [
  { code: 'GHR', label: '随机 GH', unit: null, category: 'biochemistry', color: '#5C4B7A', ord: 1 },
  { code: 'GHOG', label: 'OGTT GH 谷值', unit: null, category: 'biochemistry', color: '#84719F', ord: 2 },
  { code: 'IGF1', label: 'IGF-1', unit: 'ng/mL', category: 'biochemistry', color: '#D97B29', ord: 3 },
  { code: 'CORT', label: '皮质醇（8am 服药前）', unit: null, category: 'hormone', color: null, ord: 4 },
  { code: 'FT4', label: '游离 T4', unit: null, category: 'hormone', color: null, ord: 5 },
  { code: 'OSMO', label: '血渗透压', unit: null, category: 'hormone', color: null, ord: 6 },
]

const SPECIMEN = { GHR: 'RANDOM', GHOG: 'OGTT_NADIR', IGF1: 'ROUTINE', CORT: 'FASTING', FT4: 'ROUTINE', OSMO: 'ROUTINE' }
const SECTION = { glucose: 'GLYCEMIC', cardio: 'CARDIO', sleep: 'SLEEP', bone: 'BONE' }

/** 把 buildDemoPayload() 的数据写进库。返回写入计数。data 形如 { meta, profiles: [profile] }。 */
export function seedDemo(db, input) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('seedDemo 需要一个已打开的数据库')
  const data = input
  if (!data || !Array.isArray(data.profiles) || !data.profiles.length) throw new TypeError('seedDemo 需要 { meta, profiles: [...] }')

  const already = db.prepare('SELECT COUNT(*) AS n FROM profile').get().n
  if (already > 0) return { skipped: true, profiles: 0, points: 0, events: 0 }

  const counts = { skipped: false, profiles: 0, points: 0, events: 0 }
  const today = data.meta?.today || '2026-10-25'

  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO workspace (id, data_root, schema_version, dataset_state)
      VALUES (1, NULL, '0001', ?)`).run(j({ meta: data.meta ?? {}, presentation: {} }))

    const insProfile = db.prepare(`INSERT INTO profile
      (id, name, birth_date, gender, primary_role, cognitive_flag, created_at) VALUES (?,?,?,?,?,?,?)`)
    const insMetricDef = db.prepare(`INSERT INTO metric_def (code, label, unit, category, color, is_numeric, ord)
      VALUES (?,?,?,?,?,?,?)`)
    const insPoint = db.prepare(`INSERT INTO metric_point
      (profile_id, code, measured_at, value_num, value_text, unit, ref_range_text, specimen_kind, source_note, author_role, in_use, revision)
      VALUES (?,?,?,?,?,?,?,?,?,?,1,1)`)
    const insDiagnosis = db.prepare(`INSERT INTO diagnosis_record
      (profile_id, confirmed_on, basis_text, guideline_ref, report_doc_id, ord, revision) VALUES (?,?,?,?,?,?,1)`)
    const insSurgery = db.prepare(`INSERT INTO pituitary_surgery
      (profile_id, surgery_date, approach_text, scope_text, hospital, pathology_summary, report_doc_id, ord, revision)
      VALUES (?,?,?,?,?,?,?,?,1)`)
    const insRegimen = db.prepare(`INSERT INTO medication_regimen
      (profile_id, drug_name, drug_class, route, dose_text, cycle_days, start_date, end_date, prescriber_note, ord, revision)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    const insMedEvent = db.prepare(`INSERT INTO medication_event
      (profile_id, regimen_id, event_date, kind, dose_text, reaction_note, author_role, visibility, ord) VALUES (?,?,?,?,?,?,?,?,?)`)
    const insReplacement = db.prepare(`INSERT INTO hormone_replacement
      (profile_id, hormone, drug_name, dose_text, schedule_text, start_date, end_date, ord, revision) VALUES (?,?,?,?,?,?,?,?,1)`)
    const insIntake = db.prepare(`INSERT INTO hormone_intake_log
      (profile_id, replacement_id, log_date, kind, author_role, ord) VALUES (?,?,?,?,?,?)`)
    const insImaging = db.prepare(`INSERT INTO imaging_report
      (profile_id, exam_date, modality, findings_text, report_doc_id, ord, revision) VALUES (?,?,?,?,?,?,1)`)
    const insComorb = db.prepare(`INSERT INTO comorbidity_event
      (profile_id, section, event_date, title, note, author_role, ord, revision) VALUES (?,?,?,?,?,?,?,1)`)
    const insFollowup = db.prepare(`INSERT INTO followup_plan
      (profile_id, item, planned_on, order_text, source_note, done, ord, revision) VALUES (?,?,?,?,?,?,?,1)`)
    const insQuestion = db.prepare(`INSERT INTO question (profile_id, kind, content, created_at, asked_on, from_scenario, ord) VALUES (?,?,?,?,?,?,?)`)
    const insDoc = db.prepare(`INSERT INTO document (profile_id, file_name, sha256, status, imported_at, ord) VALUES (?,?,?,?,?,?)`)
    const insTrial = db.prepare(`INSERT INTO saved_trial (profile_id, trial_key, saved_at) VALUES (?,?,?)`)
    const insSymptom = db.prepare(`INSERT INTO symptom_log
      (profile_id, logged_at, symptom, severity_text, author_role, visibility, ord) VALUES (?,?,?,?,?,?,?)`)

    for (const p of data.profiles) {
      const pres = buildPresentation(p)
      /* workspace.dataset_state 只写一次；演示叙述层随后回填。 */
      db.prepare('UPDATE workspace SET dataset_state = ? WHERE id = 1')
        .run(j({ meta: data.meta ?? {}, presentation: pres }))

      insProfile.run(p.id, p.name, null, p.gender ?? null, p.primaryRole === 'CAREGIVER' ? 'CAREGIVER' : 'PATIENT', 'stable', today)
      counts.profiles++

      for (const m of METRIC_DEFS) insMetricDef.run(m.code, m.label, m.unit, m.category, m.color, 1, m.ord)

      /* 生化三条序列：值+单位+参考区间原文+（quote/src 合并 JSON 进 source_note）。 */
      const series = [
        ['GHR', p.biochem?.ghRandom ?? []],
        ['GHOG', p.biochem?.ghOgtt ?? []],
        ['IGF1', p.biochem?.igf1 ?? []],
      ]
      for (const [code, list] of series) {
        for (const pt of list) {
          insPoint.run(p.id, code, pt.d, typeof pt.v === 'number' ? pt.v : null,
            typeof pt.v === 'number' ? null : String(pt.v ?? ''), pt.unit ?? null, pt.ref ?? null,
            SPECIMEN[code], j({ quote: pt.quote ?? null, src: pt.src ?? null }), 'PATIENT')
          counts.points++
        }
      }
      /* 替代激素化验（followupLabs）：数值是带单位文本，走 value_text。 */
      for (const lab of p.replacement?.followupLabs ?? []) {
        const code = METRIC_DEFS.find((m) => m.label === lab.item)?.code
        if (!code) continue
        insPoint.run(p.id, code, lab.d, null, lab.v ?? '', null, null,
          SPECIMEN[code], j({ quote: lab.quote ?? null, src: lab.src ?? null }), 'PATIENT')
        counts.points++
      }

      insDiagnosis.run(p.id, '2025-03-05', '门诊记录原句照抄：内分泌科确诊肢端肥大症', null, null, 0)
      insSurgery.run(p.id, '2025-03-18', '经鼻蝶窦垂体瘤切除术（手术记录原文）',
        '术中全切肿瘤主体，术后转监护 1 日（记录原文照抄）', p.hospital ?? null, null, null, 0)

      /* SSA 长效针方案 + 注射记录（T3）。 */
      const plan = p.medPlan ?? {}
      const regimenId = Number(insRegimen.run(p.id, plan.drug ?? '兰瑞肽缓释皮下凝胶（SSA 长效）', 'SSA', 'INJECTION',
        plan.dose ?? '120 mg', plan.cycleDays ?? 28, plan.start ?? '2025-06-18', null,
        plan.prescriber ?? null, 0).lastInsertRowid)
      for (const [i, inj] of (p.injections ?? []).entries()) {
        insMedEvent.run(p.id, regimenId, inj.d, 'INJECTED', inj.dose ?? null,
          j({ reaction: inj.reaction ?? null, site: inj.site ?? null, note: inj.note ?? null }),
          roleIn(inj.recorder), 'public', i)
        counts.events++
      }
      /* 副作用日记：REACTION 事件，reaction_note 存原文。 */
      for (const [i, se] of (p.sideEffects ?? []).entries()) {
        insMedEvent.run(p.id, regimenId, se.d, 'REACTION', null, se.text ?? null, roleIn(se.recorder), 'public', (p.injections ?? []).length + i)
        counts.events++
      }

      /* 激素替代多药并列（T4）+ 服药/漏服事实。 */
      const replacementIds = new Map()
      for (const [i, med] of (p.replacement?.meds ?? []).entries()) {
        const rid = Number(insReplacement.run(p.id, med.name, null, med.dose, null, med.start ?? null, null, i).lastInsertRowid)
        replacementIds.set(med.name, rid)
      }
      for (const [i, d] of (p.replacement?.diary ?? []).entries()) {
        const missed = /漏服/.test(d.event ?? '')
        insIntake.run(p.id, replacementIds.get(d.med) ?? null, d.d, missed ? 'MISSED' : 'TAKEN', roleIn(d.recorder), i)
        counts.events++
      }

      /* 影像与视野：findings_text 存 JSON {title, quote, next}（quote 即报告原文）。 */
      for (const [i, m] of (p.imaging?.mri ?? []).entries()) {
        insImaging.run(p.id, m.d, 'MRI', j({ title: m.title ?? null, quote: m.quote ?? null, next: m.next ?? null }), null, i)
      }
      for (const [i, v] of (p.imaging?.visual ?? []).entries()) {
        insImaging.run(p.id, v.d, 'VISUAL_FIELD', j({ title: v.title ?? null, quote: v.quote ?? null, next: v.next ?? null }), null, 10 + i)
      }

      /* 分节标题与原型对齐（0001 的种子是初值；标题属种子数据，随唯一数据源走）。 */
      for (const [key, section] of Object.entries(SECTION)) {
        const title = p.comorbidity?.[key]?.title
        if (title) db.prepare('UPDATE comorbidity_section_title SET title = ? WHERE section = ?').run(title, section)
      }

      /* 合并症 4 节（T5）：note 存 JSON {v, quote, src}。 */
      for (const [key, section] of Object.entries(SECTION)) {
        for (const [i, it] of (p.comorbidity?.[key]?.items ?? []).entries()) {
          insComorb.run(p.id, section, it.d, it.item, j({ v: it.v ?? null, quote: it.quote ?? null, src: it.src ?? null }), 'PATIENT', i)
          counts.events++
        }
      }

      /* 随访节奏（planned_on 空，source_note=频次）与日历条目（source_note=JSON{note,kind}）。 */
      for (const [i, r] of (p.calendar?.rhythm ?? []).entries()) {
        insFollowup.run(p.id, r.item, null, r.quote ?? null, r.freq ?? null, 0, i)
      }
      for (const [i, e] of (p.calendar?.entries ?? []).entries()) {
        insFollowup.run(p.id, e.item, e.d, null, j({ note: e.note ?? null, kind: e.kind ?? null }), flag(e.done), 100 + i)
      }

      /* 问题清单（asked → asked_on 有值）。 */
      for (const [i, q] of (p.visit?.questions ?? []).entries()) {
        insQuestion.run(p.id, 'fact', q.text, today, q.asked ? (q.src ?? today) : null, q.src ?? null, i)
      }
      /* 资料库文件：已核对 → parsed，待核对 → pending。 */
      for (const [i, d] of (p.visit?.documents ?? []).entries()) {
        insDoc.run(p.id, d.name, sha(d.name), /已核对/.test(d.status ?? '') ? 'parsed' : 'pending', today, i)
      }
      /* 临床研究条目（只列不荐）。 */
      for (const t of (p.visit?.research?.trials ?? [])) insTrial.run(p.id, t.key, today)

      /* 看法/感受：shared→public，private→private（三出口按 visibility 过滤）。 */
      for (const [i, v] of (p.viewpoints ?? []).entries()) {
        insSymptom.run(p.id, v.date, v.topic ?? null, v.content ?? null, roleIn(v.role), v.visibility === 'private' ? 'private' : 'public', i)
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* 回滚失败也要把原始错误抛出去 */ }
    throw new Error(`播种演示数据失败（已回滚）：${error.message}`)
  }
  return counts
}

/** 库的演示档案是否已播种过。启动流程用它决定要不要 seedDemo。 */
export function hasDemoData(db) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM profile').get().n > 0
  } catch {
    return false
  }
}
