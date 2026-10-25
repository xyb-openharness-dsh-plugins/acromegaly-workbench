/**
 * 导出：把档案整理成一份「复诊准备」markdown（给用户带去门诊，不是病历）。
 *
 * 三条硬约束（ACM 红线）：
 * 1. **private 记录不进导出**：viewpoints 里 visibility='private' 的三条（看板/导出/一图秀
 *    三出口统一过滤）一律剔除，并写明"有意排除"，否则用户以为数据丢了；
 * 2. **看法不是结论**：看法段必须带「本人/家属记录，不是医生结论」的抬头；
 * 3. **只抄不解释**：数值、单位、报告原句照抄；判读词一概不写（scripts/check-wording.mjs 拦）。
 */

const LINE = '\n'

function table(headers, rowsData) {
  if (!rowsData.length) return ''
  const out = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`]
  for (const r of rowsData) out.push(`| ${r.map((c) => (c === null || c === undefined || c === '' ? '—' : String(c))).join(' | ')} |`)
  return out.join(LINE)
}

function section(title, body) {
  return body ? `${LINE}## ${title}${LINE}${LINE}${body}${LINE}` : ''
}

const fmtV = (pt) => `${pt.v}${pt.unit ? ` ${pt.unit}` : ''}`

/**
 * 渲染复诊准备 markdown。
 * @param {object} profile getProfile(includePrivate: true) 的完整档案
 * @param {object} opts { generatedAt, version, excludedPrivate }
 */
export function renderPrepMarkdown(profile, { generatedAt = null, version = null, excludedPrivate = false } = {}) {
  const p = profile
  const out = []

  out.push(`# 复诊准备 · ${p.name}`)
  out.push('')
  out.push(`> 由本人与家属整理的本机记录，不是医生结论；判读归内分泌及各专科医生。${version ? `（小肢宝 v${version}）` : ''}`)
  if (excludedPrivate) out.push('> 私密感受记录（private）已按设置有意排除，不出现在本摘要。')
  out.push('')

  /* 生化时间线：三条序列并排照抄（随机 GH 与 OGTT 谷值分列，单位随报告原文）。 */
  const seriesBlocks = [
    ['随机 GH', p.biochem?.ghRandom ?? []],
    ['OGTT GH 谷值', p.biochem?.ghOgtt ?? []],
    ['IGF-1', p.biochem?.igf1 ?? []],
  ].map(([name, list]) => section(name, table(['日期', '数值', '报告原句'],
    list.map((x) => [x.d, fmtV(x), x.quote ?? '—']))))
  out.push(section('生化时间线（数值照抄）', seriesBlocks.join(LINE).trim()))

  /* 治疗与注射：方案 + 最近注射记录。 */
  out.push(section('治疗与注射', [
    p.medPlan ? `- 当前方案：${p.medPlan.drug} ${p.medPlan.dose}，${p.medPlan.cycleDays ? `每 ${p.medPlan.cycleDays} 天 1 次` : ''}（${p.medPlan.start} 起；处方原文照抄）` : '',
    p.injections?.length ? `- 最近一次注射：${p.injections.at(-1).d}（${p.injections.at(-1).dose ?? ''}，${p.injections.length} 针按记录在册）` : '',
    p.nextInjectionDue ? `- 下一针按周期推算：${p.nextInjectionDue}（展示用，以医嘱与注射安排为准）` : '',
  ].filter(Boolean).join(LINE)))

  /* 激素替代：多药并列 + 漏服事实。 */
  out.push(section('激素替代（医嘱原文）', table(['激素', '剂量', '起始'],
    (p.replacement?.meds ?? []).map((m) => [m.name, m.dose, m.start ?? '—']))))
  const missed = (p.replacement?.diary ?? []).filter((d) => /漏服/.test(d.event ?? ''))
  if (missed.length) {
    out.push(section('漏服事实记录', table(['日期', '药物', '记录'],
      missed.map((d) => [d.d, d.med ?? '—', d.event]))))
  }

  /* 合并症四节：数值照抄。 */
  const comorbBlocks = ['glucose', 'cardio', 'sleep', 'bone'].map((k) => {
    const s = p.comorbidity?.[k]
    if (!s || !s.items?.length) return ''
    return section(s.title ?? k, table(['日期', '项目', '数值', '报告原句'],
      s.items.map((it) => [it.d, it.item, it.v ?? '—', it.quote ?? '—'])))
  }).filter(Boolean)
  out.push(section('合并症分节（分类数据，不进生化趋势）', comorbBlocks.join(LINE).trim()))

  /* 随访节奏：只登记医嘱原文。 */
  out.push(section('随访节奏（医嘱原文）', table(['项目', '频次', '医嘱原文'],
    (p.calendar?.rhythm ?? []).map((r) => [r.item, r.freq ?? '—', r.quote ?? '—']))))
  if (p.calendar?.entries?.length) {
    out.push(section('已登记的随访安排', table(['日期', '项目', '备注'],
      p.calendar.entries.map((e) => [e.d, e.item, e.note ?? '—']))))
  }

  /* 问题清单：带去看的，不是结论。 */
  out.push(section('问题清单', (p.visit?.questions ?? []).map((q) => `- ${q.asked ? '（已问过）' : ''}${q.text}`).join(LINE)))

  /* 看法：只带 shared，且必须带否定语境抬头（口径 D + 医学红线）。 */
  const shared = (p.viewpoints ?? []).filter((v) => v.visibility !== 'private')
  out.push(section('本人与家属的看法（本人记录，不是医生结论）', shared.length
    ? table(['日期', '主题', '原话', '记录人'], shared.map((v) => [v.date, v.topic ?? '—', v.content ?? '—', v.role === 'FAMILY' ? '家属代记' : '本人']))
    : '（无可分享的看法记录）'))

  out.push(`${LINE}---${LINE}本摘要由小肢宝 LimbPal 在本机生成${generatedAt ? `（${generatedAt}）` : ''}；只整理不判定。`)
  return out.filter((x) => x !== '').join(LINE).replace(/\n{3,}/g, LINE + LINE) + LINE
}

/** 导出文件名：复诊准备-姓名-日期.md */
export function exportFilename(profile) {
  const d = new Date().toISOString().slice(0, 10)
  return `复诊准备-${profile.name}-${d}.md`
}
