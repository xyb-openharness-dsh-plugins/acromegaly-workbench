#!/usr/bin/env node
/**
 * 医学红线判读词扫描（小肢宝 ACM）。
 *
 * ACM 的红线比通用版更窄：本台不出现任何"生化控制状态/正常与否/剂量调整建议/停药建议"
 * 类判定词（DEV-REQUIREMENTS T1/T4，prototypes/v0.2/demo-data.js 头部声明"零判读词汇"）。
 * 命中即失败，不靠人记。
 *
 * 扫描范围：会被用户读到的实现代码——dsh/ lib/ public/ src/ demo/ prototypes/ 下的
 * .js/.mjs/.cjs/.html/.css。不扫 docs/（讨论稿另有评审）。
 *
 * 放行方式：
 * 1. 否定语境：命中词前 12 个字符内出现「不 / 勿 / 禁止 / 别 / 无 / 未」，判为免责表述；
 * 2. 显式标注：该行含 wording-allow 注释（需写清为什么）。
 *
 * 用法：node scripts/check-wording.mjs   退出码：0 零命中；1 有命中。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['dsh', 'lib', 'public', 'src', 'demo', 'prototypes']
const EXTS = new Set(['.js', '.mjs', '.cjs', '.html', '.css'])

/** ACM 判定词表（DEV-REQUIREMENTS 医学红线）：替医生下"控制状态/正常与否/剂量处置"结论。 */
const RULES = [
  { id: 'control-status', re: /生化\s*控制|控制\s*状态|得到控制|控制良好|控制不佳|未获控制/g },
  { id: 'normal-verdict', re: /结果\s*(正常|异常)|指标\s*(正常|异常)|数值\s*(正常|异常)/g },
  { id: 'dose-advice', re: /建议\s*(调整|增加|减少|加大|减小|更改?|换)\s*(剂量|药量|用药)/g },
  { id: 'stop-medication', re: /(可以|可|建议|不妨|自行)\s*停\s*(药|用|服)/g },
  { id: 'treatment-advice', re: /建议\s*(进行|做|用|接受|采用|考虑)?\s*(手术|化疗|放疗|用药|服药|加药|减药|靶向)/g },
  { id: 'recommend-drug', re: /推荐\s*(进行|使用|服用|用)?\s*(用药|服药|治疗|手术|剂量|药物)/g },
  { id: 'skip-care', re: /(不用|无需|不必|没必要)\s*(就医|复查|去医院|看医生)/g },
  { id: 'diagnose-claim', re: /(确诊|诊断)\s*为\s*(癌|肿瘤|恶性)/g },
  { id: 'due-verdict', re: /(该|应该|需要)\s*(复查|检查|打针|注射|化验)了/g },
]

const NEGATION = /[不勿禁别无未零]$|不推算|不出现|不写|不含|不构成|不代表|不做|不提供|不作为|不可|不是|零判读|判读词|文案；$|零"/

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (st.isFile() && EXTS.has(extname(entry))) out.push(full)
  }
  return out
}

const files = DIRS.flatMap((d) => walk(join(root, d)))
const hits = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('wording-allow')) return
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      let m
      while ((m = rule.re.exec(line)) !== null) {
        const before = line.slice(Math.max(0, m.index - 12), m.index)
        if (NEGATION.test(before)) continue
        hits.push({ file: relative(root, file), line: i + 1, rule: rule.id, text: m[0].trim() })
      }
    }
  })
}

if (!files.length) {
  console.log('= 没有可扫描的实现文件，本次跳过')
  process.exit(0)
}

if (hits.length) {
  console.error(`✗ 判读词命中 ${hits.length} 处（ACM 红线：无控制状态/正常与否/剂量处置判定）：\n`)
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.rule}]  「${h.text}」`)
  console.error('\n改法：改成"记录/整理/照抄报告原文/听主治医生"的表述；确属免责语句请写在否定语境或加 wording-allow。')
  process.exit(1)
}

console.log(`✓ 医学红线词检查通过（${files.length} 个实现文件，0 处判定词）`)
