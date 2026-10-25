/**
 * 小肢宝的指标抽取器（六部件之一：dsh/<topic>parse.js）。
 *
 * 输入是 MinerU 的 full.md；输出是**候选**（field/value/src 三元组），不是记录。
 *
 * ACM 字典只认肢端肥大症病程里会反复出现的项：
 * 随机 GH / OGTT GH 谷值 / IGF-1 / HbA1c / 空腹血糖 / 皮质醇 / FT4 / 血渗透压 /
 * 血压（文本值）。GH 单位 ng/mL 与 μg/L 混现——只照抄，不换算（T1/T2）。
 *
 * 两条家族纪律（docs/18 §8）：
 * 1. 表格先 htmlTablesToPipes() 再按位置对齐（第 i 个指标名配第 i 个数），
 *    数量不符整行放弃，不做模糊匹配；
 * 2. 单位先剥 LaTeX 外壳（$10^9/L$ → 10^9/L）再比对。
 * 只抄写不推测：参考区间两数一格的行整行放弃；<0.5 这类留原文。
 */

/** 指标字典：aliases → 候选 field 名（与原型的 SERIES / followupLabs 条目名一致）。 */
export const LAB_DICT = [
  { key: 'GHR', name: '随机 GH', aliases: ['随机GH', '随机 GH', '生长激素（随机）', 'GH（随机）'], unit: 'ng/mL' },
  { key: 'GHOG', name: 'OGTT GH 谷值', aliases: ['OGTT GH 谷值', 'OGTT谷值', 'GH谷值', '生长激素谷值'], unit: 'ng/mL' },
  { key: 'IGF1', name: 'IGF-1', aliases: ['IGF-1', 'IGF1', '胰岛素样生长因子-1', '胰岛素样生长因子'], unit: 'ng/mL' },
  { key: 'HBA1C', name: 'HbA1c', aliases: ['HbA1c', '糖化血红蛋白', 'HbA1c'], unit: '%' },
  { key: 'GLU', name: '空腹血糖', aliases: ['空腹血糖', '空腹葡萄糖'], unit: 'mmol/L' },
  { key: 'CORT', name: '皮质醇（8am 服药前）', aliases: ['皮质醇', '血皮质醇', 'COR'], unit: 'μg/dL' },
  { key: 'FT4', name: '游离 T4', aliases: ['游离T4', '游离 T4', 'FT4'], unit: 'pmol/L' },
  { key: 'OSMO', name: '血渗透压', aliases: ['血渗透压', '血浆渗透压', '渗透压'], unit: 'mOsm/kg' },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 词边界匹配：中文别名用前后断言（\b 对中文无效）。 */
function aliasHit(text, alias) {
  const re = new RegExp(`(?<![A-Za-z0-9-])${escapeRe(alias)}(?![A-Za-z0-9-])`, 'i')
  return re.test(text)
}

const decodeEntities = (text) => String(text)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

/** markdown 里的 HTML 表格 → `| a | b |` 管道行。colspan 不补位（宁可少抽不串位）。 */
export function htmlTablesToPipes(md) {
  if (!/<table/i.test(String(md ?? ''))) return String(md ?? '')
  return String(md).replace(/<table[\s\S]*?<\/table>/gi, (block) => {
    const out = []
    for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const tds = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
      if (tds.length) out.push(`| ${tds.join(' | ')} |`)
    }
    return out.join('\n')
  })
}

/** 单位先剥 LaTeX 外壳（$10^9/L$ → 10^9/L）再归一空白。 */
export function normalizeUnit(unit) {
  return String(unit ?? '').trim().replace(/^\$(.+)\$$/, '$1').replace(/\s+/g, '')
}

const UNIT_RE = /^(ng\/mL|μg\/L|ug\/L|ng\/L|mmol\/L|μmol\/L|umol\/L|pmol\/L|μg\/dL|ug\/dL|mOsm\/kg|mmHg|%)$/i

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}
const isTableLine = (line) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim())

const NUM_RE = /^(?:[<>≤≥]\s*)?-?\d+(?:\.\d+)?$/
/** 单一可抄写值：纯数字 / <0.5 这类带比较符的原文；参考区间（两数一格）一律不要。 */
function valueOf(cell) {
  const t = String(cell).replace(/\s/g, '')
  if (!t) return null
  if (/^[<>≤≥]/.test(t)) {
    const m = t.match(/^([<>≤≥])(-?\d+(?:\.\d+)?)$/)
    return m ? { raw: `${m[1]}${m[2]}`, num: null } : null
  }
  if (!NUM_RE.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? { raw: t, num: n } : null
}

/**
 * 从 markdown 抽候选。
 * @returns {{candidates: Array, skipped: Array}} candidates 每项 {key, field, value, unit, line}
 */
export function extractLabCandidates(markdown) {
  const md = htmlTablesToPipes(markdown)
  const candidates = []
  const skipped = []
  const seen = new Set()

  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    if (!isTableLine(lines[i])) { i += 1; continue }

    const start = i
    while (i < lines.length && isTableLine(lines[i])) i += 1
    const blockLines = lines.slice(start, i).filter((l) => !isSeparator(l))
    if (blockLines.length < 2) continue

    const header = cells(blockLines[0])
    const idxName = header.findIndex((h) => /项目|指标|名称|检验|item|test/i.test(h))
    const idxVal = header.findIndex((h) => /结果|数值|value|result/i.test(h))
    const idxUnit = header.findIndex((h) => /单位|unit/i.test(h))
    if (idxName === -1 || idxVal === -1) continue

    for (const line of blockLines.slice(1)) {
      const row = cells(line)
      const name = row[idxName] ?? ''
      const hit = LAB_DICT.find((d) => d.aliases.some((a) => aliasHit(name, a)))
      if (!hit) continue
      const val = valueOf(row[idxVal] ?? '')
      if (!val) { skipped.push({ name, cell: row[idxVal] ?? '', reason: '不是单一数值（参考范围/文字）' }); continue }
      const unitCell = idxUnit >= 0 ? normalizeUnit(row[idxUnit] ?? '') : ''
      if (unitCell && !UNIT_RE.test(unitCell)) { skipped.push({ name, cell: unitCell, reason: '单位不认识' }); continue }
      const dedupe = `${hit.key}:${val.raw}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      candidates.push({
        key: hit.key,
        field: hit.name,
        value: val.num === null ? val.raw : val.num,
        unit: unitCell || hit.unit,
        line: start + 1,
      })
    }
  }
  return { candidates, skipped }
}

/** 报告日期：文件名或正文里的 YYYY-MM-DD / YYYY年M月D日。取不到就是 null（不猜今天）。 */
export function guessReportDate(text, fallback = null) {
  const m = String(text ?? '').match(/(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/)
  if (!m) return fallback
  const [_, y, mo, d] = m
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
