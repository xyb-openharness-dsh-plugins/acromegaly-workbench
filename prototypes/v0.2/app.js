'use strict';
/* 小肢宝 LimbPal v0.2.0 — 肢端肥大症（ACM）患者工作台交互原型。
   数据唯一来源 demo-data.js（合成演示）；不读写真实文件、不调用模型或宿主 API。
   一级导航 10 线 key 与 docs/INTERACTION-DESIGN.md §五逐字一致（IP3）：
   dashboard / biochemistry / treatment / replacement / records / imaging / comorbidity / calendar / oneshow / visit。
   看板入口文案逐字用 INTERACTION-DESIGN §二入口列：「记一次化验」「记一次用药」「记一次服药」
   「记一条合并症」「准备下次复诊」「存一份报告」。
   红线（DEV-REQUIREMENTS T1–T7 + IP1–IP10）：
   T1 无判读列——指标只显示 值+单位+报告原句引用，零 控制/未控制/正常/异常/建议 判定词；
   T2 GH（随机）与 OGTT 谷值分列；GH 单位 ng/mL 与 μg/L 混现随报告原文；IGF-1 参考区间语境栏随附；
   T3 治疗线 32 号折叠卡（默认收起，五块固定顺序，打印全展开）+ 28 天注射周期档案；
   T4 替代档案多药并列，漏服只记事实，零"建议调整剂量"文案；
   T5 合并症 4 节分类数据不进生化趋势；
   T6 随访日历只登记医嘱原文与日期，不推算"该查了"；
   T7 recorder 标识本人/家属代记；visibility 三出口（看板/导出/一图秀）统一过滤 private。
   AI 协助入口为 acromegaly:agent-draft 协议链接（携带预写提示词+当前病情上下文）；只填不发，不代替患者发言。 */

const APP_INFO = {
  version: '0.2.0', build: '2026-10-25',
  channelLabel: '交互原型 · 未接入 DSH / AI',
  brand: '小肢宝 LimbPal', en: 'acromegaly'
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uidSeq = 0;
const uid = (p) => p + (++uidSeq);
const DAY = 86400000;

/* ---------------- 导航（10 一级 / key 逐字 = INTERACTION-DESIGN §五） ---------------- */
const icons = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  lab: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8',
  syringe: 'M4 20l3-3m0 0 3 3m-3-3 7-7m0 0 3 3m-3-3 4-4m0 0 2 2-2 2M14 4l6 6',
  pill: 'M6 18a4 4 0 0 1 0-6l6-6a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0ZM9 9l6 6',
  folder: 'M4 6h6l2 2h8v11H4ZM4 6v13',
  mri: 'M4 5h16v14H4ZM12 8a4 4 0 0 0-4 4c0 2 4 4 4 4s4-2 4-4a4 4 0 0 0-4-4Zm0 0v8',
  organs: 'M12 21c-5-4-8-7.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 3.5-3 7-8 11Z',
  calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2m4 0h2',
  chart: 'M4 20V5m0 15h16M8 16l3-5 3 3 4-7',
  visit: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16M9 15l2 2 4-4'
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[k]}"/></svg>`;

const PAGES = [
  ['dashboard', '看板', 'home'],
  ['biochemistry', '生化时间线', 'lab'],
  ['treatment', '治疗与注射', 'syringe'],
  ['replacement', '激素替代档案', 'pill'],
  ['records', '病情整理', 'folder'],
  ['imaging', '影像与视野', 'mri'],
  ['comorbidity', '合并症分节', 'organs'],
  ['calendar', '随访日历', 'calendar'],
  ['oneshow', '病情一图秀', 'chart'],
  ['visit', '复诊与资料', 'visit']
];
/* 二级页（(view,sub) 全集，IP2 双向覆盖见交付报告） */
const SUBPAGES = {
  biochemistry: [['trend', 'GH 与 IGF-1 趋势'], ['records', '化验记录'], ['ogtt', '随机 GH 与 OGTT 谷值']],
  treatment: [['pathway', '治疗线折叠卡'], ['injection', '注射记录（28 天）'], ['sideeffects', '副作用日记']],
  replacement: [['meds', '替代方案并列'], ['diary', '服药与漏服']],
  records: [['timeline', '病程时间线'], ['reports', '报告原文']],
  imaging: [['mri', 'MRI 报告'], ['visual', '视野检查']],
  comorbidity: [['glucose', '糖代谢'], ['cardio', '心血管'], ['sleep', '睡眠呼吸暂停'], ['bone', '骨关节']],
  visit: [['prepare', '复诊准备与摘要'], ['library', '资料库与核对'], ['research', '临床研究']]
};
const SUBTITLES = {
  dashboard: '把今天能做的一件事放在最前面；只整理不判定——判读归医生。',
  biochemistry: 'GH 与 IGF-1 双指标并列：随机 GH 与 OGTT 谷值分列、单位随报告原文、IGF-1 参考区间语境栏随附。',
  treatment: '治疗线按阶段折叠（默认概要，按需展开五块细节）；长效针按 28 天周期核对注射记录。',
  replacement: '多激素替代并列：现在补什么、怎么服、漏服记事实；剂量调整只发生在医生诊室。',
  records: '从鞋码增大到今天的每一步：事件时间线 + 逐份报告原文。',
  imaging: 'MRI 与视野报告只照抄原文；「相仿/缩小」是报告用词，含义请医生解释。',
  comorbidity: '血压、血糖、打鼾、关节痛分四节归置；分类数据不进生化趋势。',
  calendar: '复查间隔以医嘱原文为准；本页只登记与提醒，不推算"该查了"。',
  oneshow: 'GH 与 IGF-1 放回同一段时间给医生看；private 记录不出现在本页。',
  visit: '复诊摘要 + 问题清单 + 临床研究线索；试验线索不是推荐。'
};

/* 场景直达（INTERACTION-DESIGN §二 S01–S06+代记，走查锚点） */
const SCENES = [
  ['S01', '记化验', 'biochemistry', 'records'],
  ['S02', '记用药', 'treatment', 'injection'],
  ['S03', '记服药', 'replacement', 'diary'],
  ['S04', '记合并症', 'comorbidity', 'glucose'],
  ['S05', '备复诊', 'visit', 'prepare'],
  ['S06', '存报告', 'imaging', 'mri'],
  ['代记', '替家人记', 'dashboard', '']
];

/* ---------------- 生化序列目录（T5：只有 GH/IGF-1 三条序列可进趋势） ---------------- */
const SERIES = {
  GHR: { name: '随机 GH', unitCtx: 'ng/mL 与 μg/L 混现（1 ng/mL = 1 μg/L，数值相等；单位随报告原文展示）', color: '#5C4B7A', dec: 1 },
  GHOG: { name: 'OGTT GH 谷值', unitCtx: 'ng/mL 与 μg/L 混现（数值相等，单位随报告原文）', color: '#84719F', dec: 1 },
  IGF1: { name: 'IGF-1', unitCtx: 'ng/mL · 各次化验单自带年龄/性别参考区间随附', color: '#D97B29', dec: 0 }
};
const seriesAll = (code) => {
  const p = profile();
  const src = { GHR: p.biochem.ghRandom, GHOG: p.biochem.ghOgtt, IGF1: p.biochem.igf1 }[code] || [];
  return src.map((x) => ({ ...x }));
};

/* ---------------- state ---------------- */
const DATA = typeof DEMO_DATA !== 'undefined' ? DEMO_DATA : {};
const TODAY = DATA.meta?.today || '2026-10-25';
const profile = () => DATA.profiles[0];
const state = {
  page: 'dashboard', sub: {},
  chartSel: ['GHR', 'IGF1'],        /* 生化趋势默认 GH 与 IGF-1 并列 */
  range: 'all', zoom: 100,
  pin: null,
  agent: { open: false, w: 35, prompt: null },
  actor: 'PATIENT',                  /* 主体切换：本人 / 家属代记（T6 双主体） */
  cfg: { root: '/Users/demo/Documents/LimbPal（演示）', storeState: '就绪', backupAt: '2026-10-24 22:10', defaultVisibility: 'private' },
  mem: { questions: null, additions: {}, materials: {}, diary: [], injections: [], comorb: [], biochem: [], reports: [], mri: [], visual: [], events: [], sideeffects: [] }
};
const mem = () => state.mem;
const added = (k) => { if (!mem().additions[k]) mem().additions[k] = []; return mem().additions[k]; };
const questions = () => { if (!mem().questions) mem().questions = (profile().visit.questions || []).map((q) => ({ ...q })); return mem().questions; };
/* private 三出口统一过滤（看板摘要 / 导出 / 一图秀）——全台唯一一份 */
const sharedOnly = (p) => (p.viewpoints || []).filter((v) => v.visibility !== 'private');
const privateCount = (p) => (p.viewpoints || []).filter((v) => v.visibility === 'private').length;

/* ---------------- 通用 UI ---------------- */
const btn = (text, action, cls = '', attr = '') => `<button class="${cls}" data-action="${action}" ${attr}>${text}</button>`;
const go = (text, page, sub = '', cls = '', attr = '') => btn(text, 'go', cls, `data-page="${page}" data-sub="${esc(sub)}"${attr ? ' ' + attr : ''}`);
const pill = (text, cls = '') => `<span class="pill ${cls}">${esc(text)}</span>`;
const shortDate = (d) => String(d).slice(5).replace('-', '.');
const longDate = (d) => String(d).replace(/-/g, '.');
const fmtNum = (v, dec) => Number(v).toFixed(dec ?? 1);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const recorderTag = (r) => r === 'FAMILY' ? pill('家属代记 · ' + profile().caregiverLabel.split(' ')[0], 'mist') : pill('本人自记', 'blue');

function toast(t, opts = {}) {
  clearTimeout(state.toastTimer);
  const el = $('#toast');
  el.innerHTML = esc(t) + (opts.back ? ` <button class="toast-back" data-action="go" data-page="dashboard">回到看板</button>` : '');
  el.classList.add('visible');
  state.toastTimer = setTimeout(() => el.classList.remove('visible'), 4200);
}
function openModal(title, body, foot = '', eyebrow = '小肢宝 · 交互演示') {
  $('#dialog-title').textContent = title;
  $('#dialog-eyebrow').textContent = eyebrow;
  $('#dialog-body').innerHTML = body;
  $('#dialog-foot').innerHTML = foot;
  if (!$('#dialog').open) $('#dialog').showModal();
  document.body.style.overflow = 'hidden';
}
const closeModal = () => { if ($('#dialog').open) $('#dialog').close(); };
$('#dialog').addEventListener('close', () => { document.body.style.overflow = ''; });

function navigate(page, sub) {
  state.page = page;
  if (sub) state.sub[page] = sub;
  try { history.replaceState(null, '', '#' + page + (sub ? '/' + sub : '')); } catch (e) { /* file:// 下忽略 */ }
  render();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
const section = (title, desc = '', action = '') => `<div class="section-title"><div><h2>${title}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>${action}</div>`;
const backRow = () => state.page === 'dashboard' ? '' : `<div class="back-row"><button class="text-button" data-action="go" data-page="dashboard">← 回到看板</button></div>`;
const head = (title, desc, action = '') => `<div class="page-head"><div><span class="eyebrow">LIMBPAL / ACROMEGALY WORKBENCH</span><h1>${title}</h1><p>${desc}</p></div><div class="actions">${action}</div></div>`;

/* ---------------- AI 协助（acromegaly:agent-draft 协议链接；只填不发） ---------------- */
/* 每个视图的预写提示词 + 当前病情上下文（当前视图 key + 相关数据摘要） */
function aiPromptFor(viewKey) {
  const p = profile();
  const base = {
    dashboard: '帮我把最近的化验、注射和复诊安排排成一段话，复诊时照着说。',
    biochemistry: '我拍了张化验单，帮我把 GH 和 IGF-1 读出来登记（随机 GH 与 OGTT 谷值分列，单位照抄）。',
    treatment: '我今天打了长效针，帮我记一条注射记录（药名/剂量/日期/部位/反应）。',
    replacement: '帮我记一条激素替代服药记录（先选药，再记按时服还是漏服）。',
    records: '帮我把这几份报告按日期排成病程时间线（只引用报告原句）。',
    imaging: '我拍了 MRI/视野报告，帮我把日期和结论原句登记进来。',
    comorbidity: '我拍了份报告，帮我看它该归到糖代谢/心血管/睡眠呼吸暂停/骨关节哪一节（归好待我核对）。',
    calendar: '帮我把医生交代的复查安排登记到日历（只登记医嘱原文和日期）。',
    oneshow: '把术后到现在 GH 与 IGF-1 的变化讲一段给我听（只照抄数值）。',
    visit: '帮我把复诊要问的几条整理成问题清单，并生成摘要候选（逐条给我核对）。'
  }[viewKey] || '请基于我的本机记录协助整理（只整理，不判定）。';
  const ctx = [`档案：${p.name}，${p.age} 岁，${p.diagnosisShort}`, `当前阶段：${p.stageLine}`];
  try {
    const ghr = seriesAll('GHR'), igf = seriesAll('IGF1'), ogtt = seriesAll('GHOG');
    if (ghr.length) { const l = ghr[ghr.length - 1]; ctx.push(`最近随机 GH：${l.v} ${l.unit}（${l.d}）`); }
    if (ogtt.length) { const l = ogtt[ogtt.length - 1]; ctx.push(`最近 OGTT 谷值：${l.v} ${l.unit}（${l.d}）`); }
    if (igf.length) { const l = igf[igf.length - 1]; ctx.push(`最近 IGF-1：${l.v} ng/mL（${l.d}，化验单参考区间随附）`); }
    const inj = p.injections;
    if (inj.length) ctx.push(`长效针：${p.medPlan.dose} 每 ${p.medPlan.cycleDays} 天，最近一针 ${inj[inj.length - 1].d}，按周期下一针 ${p.nextInjectionDue}（展示推算，以医嘱为准）`);
    ctx.push(`替代：${p.replacement.meds.map((m) => m.name + ' ' + m.dose).join('；')}`);
    const nextCal = (p.calendar.entries || []).find((r) => !r.done);
    if (nextCal) ctx.push(`下一项随访：${nextCal.d} ${nextCal.item}`);
  } catch (e) { /* 上下文取不到就只发提示词 */ }
  ctx.push(`当前视图：${viewKey}`);
  ctx.push('以上来自本机记录（演示数据）；你只做整理候选，逐项给我核对，判断由我和治疗团队做。');
  return `${base}\n\n${ctx.join('\n')}`;
}
/* 协议链接：href="acromegaly:agent-draft?prompt=..."（点击拦截：填入 AI 面板，不自动发送、不代替发言） */
const aiLink = (label = 'AI 协助', viewKey = state.page) =>
  `<a class="button soft ai-link" href="acromegaly:agent-draft?prompt=${encodeURIComponent(aiPromptFor(viewKey))}" data-ai-view="${viewKey}" title="把预写提示词与当前病情上下文带给 AI（待你核对发送）">${esc(label)} ↗</a>`;

const subnav = () => {
  const items = SUBPAGES[state.page]; if (!items) return '';
  const sel = state.sub[state.page] || items[0][0];
  return `<nav class="subnav" role="tablist" aria-label="${PAGES.find((p) => p[0] === state.page)[1]}二级页面">${items.map(([k, s]) => `<button role="tab" aria-selected="${sel === k}" data-action="sub" data-sub="${k}">${esc(s)}</button>`).join('')}</nav>`;
};
const subLabel = (page) => {
  const items = SUBPAGES[page]; if (!items) return '';
  const k = state.sub[page] || items[0][0];
  return items.find((x) => x[0] === k)[1];
};
const pageHeadFor = (desc, action = '') => head(subLabel(state.page), desc, (action ? action + ' ' : '') + aiLink()) + subnav();
/* 「⋯ 更多」手工通道收口（表单 ≤6 字段） */
const moreMenu = (items) => `<details class="more-menu"><summary aria-label="更多操作">⋯</summary><div class="menu">${items.map(([t, a, attr]) => `<button data-action="${a}" ${attr || ''}>${esc(t)}</button>`).join('')}</div></details>`;

/* ---------------- 趋势图（SVG，根元素 class="chart"） ----------------
   smoothPath：Fritsch–Carlson 单调保形插值（非简单贝塞尔）：
   ① 按点距算分段斜率；② 端点取邻段斜率、内部取加权调和平均，局部极值处置 0；
   ③ 按 Fritsch–Carlson 判据 (m_i/Δ)²+(m_{i+1}/Δ)² ≤ 9 限幅防过冲；
   ④ 用三次 Hermite 切线生成 Bezier 控制点。复查间隔 3 周到 6 个月混杂，Catmull-Rom 会过冲。 */
function smoothPath(coords) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  const n = coords.length, dx = [], sl = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = coords[i + 1].x - coords[i].x;
    sl[i] = dx[i] === 0 ? 0 : (coords[i + 1].y - coords[i].y) / dx[i];
  }
  m[0] = sl[0]; m[n - 1] = sl[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (sl[i - 1] * sl[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
    m[i] = (w1 + w2) / (w1 / sl[i - 1] + w2 / sl[i]);
  }
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / sl[i], b = m[i + 1] / sl[i], q = a * a + b * b;
    if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * sl[i]; m[i + 1] = t * b * sl[i]; }
  }
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${(coords[i].x + h).toFixed(1)} ${(coords[i].y + m[i] * h).toFixed(1)}, ${(coords[i + 1].x - h).toFixed(1)} ${(coords[i + 1].y - m[i + 1] * h).toFixed(1)}, ${coords[i + 1].x.toFixed(1)} ${coords[i + 1].y.toFixed(1)}`;
  }
  return d;
}

const CW = 960, CH = 400, CX0 = 58, CX1 = 930, CY0 = 56, CY1 = 330;
function chartDomain() {
  const all = ['GHR', 'GHOG', 'IGF1'].flatMap(seriesAll);
  const t1 = Date.parse(TODAY);
  const t0all = Math.min(...all.map((x) => Date.parse(x.d)));
  const months = { '6m': 6, '12m': 12 }[state.range];
  const start = months ? new Date(new Date(t1).setMonth(new Date(t1).getMonth() - months)).getTime() : t0all;
  const span = t1 - start;
  return [t1 - span * state.zoom / 100, t1];
}
const inDomain = (d, t0, t1) => { const t = Date.parse(d); return t >= t0 && t <= t1; };
const xOf = (t, t0, t1) => CX0 + (t - t0) / Math.max(1, t1 - t0) * (CX1 - CX0);
function monthTicks(t0, t1) {
  const out = []; let cur = new Date(new Date(t0).getFullYear(), new Date(t0).getMonth(), 1);
  if (cur.getTime() < t0) cur.setMonth(cur.getMonth() + 1);
  while (cur.getTime() <= t1) {
    const x = xOf(cur.getTime(), t0, t1);
    if (x > CX0 + 6 && x < CX1 - 6) out.push({ x, label: `${String(cur.getFullYear()).slice(2)}-${String(cur.getMonth() + 1).padStart(2, '0')}` });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  const step = out.length > 16 ? 3 : out.length > 8 ? 2 : 1;
  return step === 1 ? out : out.filter((_, i) => i % step === 0);
}
/* 生化趋势 / 一图秀共用渲染器（T5：只接受 SERIES 白名单，合并症分类数据无入口） */
function chartSVG(t0, t1, opts = {}) {
  const sel = (opts.sel || state.chartSel);
  const series = sel.map((c) => {
    const all = seriesAll(c);
    const pts = all.filter((x) => inDomain(x.d, t0, t1));
    const vals = all.map((x) => x.v);
    const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
    return { code: c, m: SERIES[c], lo, hi, span: (hi - lo) || Math.max(Math.abs(hi) * 0.08, 1), pts, all };
  }).filter((s) => s.pts.length);
  if (!series.length) return `<div class="empty"><h3>这个时间窗里没有所选序列</h3><p>扩大时间范围，或切换上方的序列开关。</p></div>`;
  const yOf = (s, v) => CY1 - (v - s.lo) / s.span * (CY1 - CY0);
  const grid = [0, 1, 2, 3, 4].map((i) => { const y = CY0 + i * (CY1 - CY0) / 4; return `<line class="grid" x1="${CX0}" x2="${CX1}" y1="${y}" y2="${y}"/>`; }).join('');
  const lines = series.map((s) => {
    const coords = s.pts.map((p) => ({ x: xOf(Date.parse(p.d), t0, t1), y: yOf(s, p.v) }));
    const path = coords.length > 1 ? `<path class="line" d="${smoothPath(coords)}" stroke="${s.m.color}" pathLength="1"/>` : '';
    const dots = coords.map((c, i) => {
      const pt = s.pts[i];
      const active = state.pin && state.pin.code === s.code && state.pin.date === pt.d;
      const tip = `${s.m.name} ${fmtNum(pt.v, s.m.dec)} ${pt.unit} · ${pt.d}（报告原句：${pt.quote}）`;
      return `<circle class="pt${active ? ' active' : ''}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${i === s.pts.length - 1 ? 5 : 3.8}" fill="${s.m.color}" data-action="pin" data-code="${s.code}" data-date="${pt.d}"><title>${esc(tip)}</title></circle>`;
    }).join('');
    const last = coords[coords.length - 1];
    const lx = last.x > CX1 - 50 ? last.x - 8 : last.x + 8;
    const label = `<text class="delta-tag" x="${lx.toFixed(1)}" y="${(last.y - 8).toFixed(1)}" text-anchor="${last.x > CX1 - 50 ? 'end' : 'start'}" fill="${s.m.color}">${fmtNum(s.pts[s.pts.length - 1].v, s.m.dec)} ${esc(s.pts[s.pts.length - 1].unit)}</text>`;
    return `<g>${path}${dots}${label}</g>`;
  }).join('');
  const ticks = monthTicks(t0, t1).map((t) => `<line class="axis" x1="${t.x.toFixed(1)}" x2="${t.x.toFixed(1)}" y1="${CY1}" y2="${CY1 + 5}"/><text class="tick" x="${t.x.toFixed(1)}" y="${CY1 + 18}" text-anchor="middle">${t.label}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="生化趋势：${series.map((s) => s.m.name).join('、')}">
    ${grid}${lines}${ticks}
    <text x="${CX0}" y="${CH - 8}" font-size="9.5" fill="#9a92ab">每条线按该序列全部记录范围缩放，不同序列数值不互比；GH 单位 ng/mL 与 μg/L 数值相等（随报告原文）。</text>
  </svg>`;
}
const chartControls = (selArr, onChangeAction = 'chart-sel') => `
  <div class="chips" role="group" aria-label="趋势序列切换（GH 与 IGF-1 双指标并列可切换）">
    ${Object.entries(SERIES).map(([code, m]) => `<button class="chip" aria-pressed="${selArr.includes(code)}" data-action="${onChangeAction}" data-code="${code}"><i style="background:${m.color}"></i>${esc(m.name)}</button>`).join('')}
  </div>
  <div class="chips" style="margin-top:8px">${[['all', '全期'], ['12m', '近 12 月'], ['6m', '近 6 月']].map(([k, n]) => `<button class="chip" aria-pressed="${state.range === k}" data-action="range" data-range="${k}">${n}</button>`).join('')}
    <span class="zoom"><input type="range" min="40" max="100" value="${state.zoom}" data-action="zoom" aria-label="缩放时间窗"><span>${state.zoom}%</span></span>
  </div>`;

/* 指标卡（值 + 单位 + 报告原句引用；零判读列 T1） */
function metricCard(code) {
  const m = SERIES[code];
  const all = seriesAll(code);
  const last = all[all.length - 1], prev = all[all.length - 2];
  return `<div class="ccard" aria-label="${esc(m.name)}：最新 ${fmtNum(last.v, m.dec)} ${esc(last.unit)}，报告原句已随附">
    <span class="cat"><i style="background:${m.color}"></i>生化序列 · ${all.length} 次记录</span>
    <span class="name">${esc(m.name)}</span>
    <span class="val">${fmtNum(last.v, m.dec)}<small>${esc(last.unit)}</small></span>
    <span class="delta">${prev ? `前次 ${fmtNum(prev.v, m.dec)} ${esc(prev.unit)}（${shortDate(prev.d)}）` : ''}</span>
    <span class="rec">报告原句：「${esc(last.quote)}」</span>
    ${code === 'IGF1' ? `<span class="ref">语境栏：${esc(last.ref)}</span>` : `<span class="ref">语境栏：${esc(m.unitCtx)}</span>`}
  </div>`;
}

/* ================= dashboard（看板：入口文案逐字 = INTERACTION-DESIGN §二） ================= */
function pageDashboard() {
  const p = profile();
  const ghr = seriesAll('GHR'), igf = seriesAll('IGF1'), ogtt = seriesAll('GHOG');
  const lastG = ghr[ghr.length - 1], lastI = igf[igf.length - 1], lastO = ogtt[ogtt.length - 1];
  const lastInj = p.injections[p.injections.length - 1];
  const nextCal = p.calendar.entries.find((r) => !r.done);
  const injectionsDue = daysBetween(TODAY, p.nextInjectionDue);
  const qOpen = questions().filter((q) => !q.asked).length;
  /* 看板卡入口：文案逐字（IP3）——「记一次化验」等六条来自 INTERACTION-DESIGN §二 */
  const cards = [
    { icon: 'lab', title: '生化时间线', entry: '记一次化验', desc: `最近随机 GH ${lastG.v} ${lastG.unit} · IGF-1 ${lastI.v} ng/mL（${shortDate(lastG.d)}）`, page: 'biochemistry', sub: 'records', scene: 'S01' },
    { icon: 'syringe', title: '治疗与注射', entry: '记一次用药', desc: `最近一针 ${shortDate(lastInj.d)} · 下一针按周期 ${p.nextInjectionDue}（还有 ${injectionsDue} 天，以医嘱为准）`, page: 'treatment', sub: 'injection', scene: 'S02' },
    { icon: 'pill', title: '激素替代档案', entry: '记一次服药', desc: `${p.replacement.meds.length} 种替代并列 · 漏服记事实`, page: 'replacement', sub: 'diary', scene: 'S03' },
    { icon: 'organs', title: '合并症分节', entry: '记一条合并症', desc: '糖代谢 / 心血管 / 睡眠呼吸暂停 / 骨关节 四节', page: 'comorbidity', sub: 'glucose', scene: 'S04' },
    { icon: 'visit', title: '复诊与资料', entry: '准备下次复诊', desc: `${qOpen} 条想问的事 · ${nextCal ? nextCal.d + ' ' + nextCal.item : '待登记'}`, page: 'visit', sub: 'prepare', scene: 'S05' },
    { icon: 'mri', title: '影像与视野', entry: '存一份报告', desc: `最近 MRI ${shortDate(p.imaging.mri[p.imaging.mri.length - 1].d)} · 报告原文照抄`, page: 'imaging', sub: 'mri', scene: 'S06' },
    { icon: 'calendar', title: '随访日历', entry: '看看接下来的安排', desc: nextCal ? `下一项：${nextCal.item}（${nextCal.d}）` : '待登记', page: 'calendar', sub: '', scene: '' },
    { icon: 'chart', title: '病情一图秀', entry: '给医生看一张图', desc: 'GH 与 IGF-1 放回同一段时间', page: 'oneshow', sub: '', scene: '' }
  ];
  return `${head('看板', SUBTITLES.dashboard, aiLink('AI 协助', 'dashboard'))}
    <div class="stage-strip"><span class="eyebrow">当前阶段 · 引用医嘱语境</span><b>${esc(p.stageLine)}</b><small>${esc(p.diagnosis)} · ${p.age} 岁 · ${esc(p.shoeNote)} · 演示数据</small></div>
    <div class="task-grid" data-product="看板卡入口（文案逐字 = INTERACTION-DESIGN §二）">
      ${cards.map((c) => `<div class="task-entry-wrap">
        <button class="task-entry" data-action="go" data-page="${c.page}" data-sub="${c.sub}" data-scene="${c.scene}">
          <span class="entry-icon">${icon(c.icon)}</span><b>${esc(c.title)} · ${esc(c.entry)}</b><span>${esc(c.desc)}</span><span class="arrow">→</span>
        </button>
      </div>`).join('')}
    </div>
    <div class="scene-strip" aria-label="场景直达（演示导航）"><span class="lab">场景直达：</span>${SCENES.map(([k, n]) => `<button class="scene-chip" data-action="scene" data-scene="${k}">${k} ${n}</button>`).join('')}</div>
    <div class="change-strip">
      <div class="chg"><span>最近随机 GH</span><b>${lastG.v} ${esc(lastG.unit)} · ${shortDate(lastG.d)}</b><p>报告原句：「${esc(lastG.quote)}」</p></div>
      <div class="chg"><span>最近 OGTT 谷值（分列）</span><b>${lastO.v} ${esc(lastO.unit)} · ${shortDate(lastO.d)}</b><p>报告原句：「${esc(lastO.quote)}」</p></div>
      <div class="chg"><span>最近 IGF-1</span><b>${lastI.v} ng/mL · ${shortDate(lastI.d)}</b><p>当次化验单参考区间：${esc(lastI.ref)}</p></div>
      <div class="actions">${go('看生化趋势', 'biochemistry', 'trend', 'soft')}</div>
    </div>
    <div class="dash-cols">
      <div class="stack">
        <div class="card accent">
          <div class="card-head"><div><h3>双主体与私密说明</h3><p>当前记录主体：${state.actor === 'PATIENT' ? '本人自记' : '家属代记（' + esc(p.caregiverLabel) + '，条目带 recorder 标识）'}，可在「设置」切换「替家人记」。private 记录 ${privateCount(p)} 条已隐藏：看板摘要 / 导出 / 一图秀三出口统一过滤。</p></div>${btn('设置', 'settings', 'soft')}</div>
          <p class="small-note" style="margin:0">${esc(DATA.meta.disclaimer)}</p>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>想问的事</h3><p>${qOpen} 条待问 · ${questions().length} 条累计</p></div>${go('去复诊准备', 'visit', 'prepare')}</div>
          ${questions().slice(0, 2).map((q) => `<div class="row"><div class="row-main"><div><b>${esc(q.text)}</b><p>${esc(q.src)}</p></div></div>${pill(q.asked ? '已问' : '待问', q.asked ? 'green' : 'grey')}</div>`).join('')}
        </div>
      </div>
      <div class="metric-grid">${metricCard('GHR')}${metricCard('IGF1')}</div>
    </div>`;
}

/* ================= biochemistry（生化时间线） ================= */
function pageBioTrend() {
  const [t0, t1] = chartDomain();
  return `${pageHeadFor('GH 与 IGF-1 双指标并列可切换（随机 GH / OGTT 谷值 / IGF-1）；曲线为 Fritsch–Carlson 单调保形插值。合并症分类数据不进本趋势（T5）。')}
    <div class="chart-panel">
      <div class="chart-top"><div class="legend">${state.chartSel.map((c) => `<span><i style="background:${SERIES[c].color}"></i><b>${esc(SERIES[c].name)}</b><span class="range">${esc(SERIES[c].unitCtx)}</span></span>`).join('')}</div></div>
      ${chartControls(state.chartSel)}
      <div class="chart-wrap"><div class="scroll-hint">曲线过宽时可横向滚动（有意为之）→</div>${chartSVG(t0, t1)}</div>
      ${state.pin ? (() => {
    const pt = seriesAll(state.pin.code).find((x) => x.d === state.pin.date);
    if (!pt) return '';
    return `<div class="pin"><div><b>${esc(SERIES[state.pin.code].name)} ${pt.v} ${esc(pt.unit)} · ${longDate(pt.d)}</b><p>报告原句：「${esc(pt.quote)}」</p><p>来源：${esc(pt.src)}${pt.ref ? ' · ' + esc(pt.ref) : ''}</p></div>${btn('收起', 'unpin', 'soft')}</div>`;
  })() : ''}
    </div>
    <p class="small-note" style="margin-top:10px">${esc(profile().biochem.note)}</p>
    <div class="actions" style="margin-top:10px">${go('看化验记录', 'biochemistry', 'records', 'soft')}${go('看随机 GH 与 OGTT 分列', 'biochemistry', 'ogtt', 'soft')}</div>`;
}
function bioRows(list, unitColTitle) {
  return list.slice().reverse().map((x) => `<tr><td class="num">${esc(x.d)}</td><td class="num"><b>${fmtNum(x.v, x.v >= 100 ? 0 : 1)}</b> ${esc(x.unit)}</td><td style="min-width:200px">「${esc(x.quote)}」</td><td>${x.ref ? esc(x.ref) : esc(x.src)}</td></tr>`).join('');
}
function pageBioRecords() {
  const p = profile();
  const list = [...p.biochem.ghRandom, ...p.biochem.igf1, ...added('biochem')];
  return `${pageHeadFor('每次化验一条记录：值 + 单位 + 报告原句引用；IGF-1 每条随附当次化验单参考区间语境栏。无判读列（T1）。', moreMenu([['⋯ 手工补一条化验', 'bio-add']]))}
    <div class="notice blue"><b>登记口径：</b>GH 单位照抄报告原文（本档案 ng/mL 与 μg/L 混现，两者数值相等）；随机 GH 与 OGTT 谷值分开登记，不混算（T2）。</div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>日期</th><th>数值</th><th>报告原句（引用）</th><th>语境栏（参考区间 / 来源）</th></tr></thead><tbody>
      ${bioRows(list)}
    </tbody></table></div>
    <p class="small-note">更正 = 新增一条新记录，旧记录保留；判读与下一步安排归内分泌医生。</p></div>
    <div class="actions" style="margin-top:10px">${go('看趋势图', 'biochemistry', 'trend', 'soft')}${aiLink('拍化验单给 AI 抄录（候选待核对）', 'biochemistry')}</div>`;
}
function pageBioOgtt() {
  const p = profile();
  const rand = p.biochem.ghRandom, ogtt = p.biochem.ghOgtt;
  return `${pageHeadFor('随机 GH 与 OGTT-GH 谷值是两个口径：分列展示、各带单位与报告原句，不做换算合并（T2）。')}
    <div class="grid two">
      <div class="card"><div class="card-head"><div><h3>随机 GH</h3><p>${rand.length} 次记录 · 单位随报告原文</p></div></div>
        ${rand.slice().reverse().map((x) => `<div class="row"><div class="row-main"><div><b>${x.v} ${esc(x.unit)}</b><p>${longDate(x.d)} · 「${esc(x.quote)}」</p></div></div></div>`).join('')}
      </div>
      <div class="card"><div class="card-head"><div><h3>OGTT GH 谷值（75g）</h3><p>${ogtt.length} 次记录 · 单位随报告原文</p></div></div>
        ${ogtt.slice().reverse().map((x) => `<div class="row"><div class="row-main"><div><b>${x.v} ${esc(x.unit)}</b><p>${longDate(x.d)} · 「${esc(x.quote)}」</p></div></div></div>`).join('')}
      </div>
    </div>
    <div class="help-box">两列各自成序列（趋势页可分别切换显示）；「谷值」是报告用词，含义请医生解释。</div>`;
}

/* ================= treatment（治疗与注射：32 号折叠卡 + 28 天周期） ================= */
/* 折叠卡（32-TREATMENT-PATHWAY-FOLDOUT 契约）：
   ① 原生 details/summary，默认收起（[open]=0）；② summary 概要行「● 阶段 · 日期 · 一句话概要 · 展开细节 ▸」；
   ③ 展开区五块固定顺序（方案/指标和趋势/影像发现/副作用总结/心理营养措施），grid 两列、≤900px 单列；
   ④ 打印全展开（style.css @media print）。 */
const pdBlock = (title, block) => `<section class="pd-block"><details open><summary>${esc(title)}</summary>
  <div class="pd-items">${block.items.map(([k, v]) => `<div class="pd-item"><span>${esc(k)}</span><p>${esc(v)}</p></div>`).join('') || '<p class="small-note">无</p>'}</div>
  <p class="pd-sum">${esc(block.summary)}</p></details></section>`;

function pageTreatPathway() {
  const p = profile();
  return `${pageHeadFor('治疗线按阶段折叠：默认只看「走到哪一步、下一步是什么」，点开见五块结构化细节；打印时自动全展开。', moreMenu([['⋯ 手工补一条治疗记录', 'med-add']]))}
    ${p.pathway.map((ph) => `<details class="phase-fold">
      <summary><span class="ph-dot" aria-hidden="true"></span><b>${esc(ph.phase)}</b><span class="ph-date">${esc(ph.d)}</span><span class="ph-text">${esc(ph.text)}</span><span class="ph-hint">展开细节 ▸</span></summary>
      <div class="phase-detail">
        ${pdBlock('方案', ph.detail.regimen)}
        ${pdBlock('指标和趋势', ph.detail.metrics)}
        ${pdBlock('影像发现', ph.detail.imaging)}
        ${pdBlock('副作用总结', ph.detail.ae)}
        ${pdBlock('心理/营养措施和效果', ph.detail.support)}
      </div>
    </details>`).join('')}
    <p class="small-note" style="margin-top:10px">影像与副作用块只引原文、不判读不归因；「效果」只含引号内患者原话。方案变更 = 新增阶段卡，旧卡保留。</p>
    <div class="actions" style="margin-top:10px">${go('看注射记录', 'treatment', 'injection', 'soft')}${go('看副作用日记', 'treatment', 'sideeffects', 'soft')}</div>`;
}
function pageInjection() {
  const p = profile();
  const plan = p.medPlan;
  const list = [...p.injections, ...added('injections')];
  const lastD = list[list.length - 1].d;
  const dueDate = p.nextInjectionDue;
  const cyc = Math.round(daysBetween(plan.start, TODAY) / plan.cycleDays) + 1;
  return `${pageHeadFor('SSA 长效针 28 天周期档案：剂量/周期/注射记录逐针对照（T3）；「记一次用药」入口在看板。', moreMenu([['⋯ 手工补一条注射记录', 'inj-add']]))}
    <div class="stage-strip" data-product="当前方案"><span class="eyebrow">SSA 长效针（处方原文照抄）</span><b>${esc(plan.drug)} ${esc(plan.dose)} · 每 ${plan.cycleDays} 天</b><small>${esc(plan.prescriber)} · 首针 ${plan.start} · 已完成 ${list.length} 针（约第 ${cyc} 个周期）</small></div>
    <div class="card" data-product="周期核对">
      <div class="card-head"><div><h3>最近一针与下一针（周期展示用，以医嘱与注射安排为准）</h3><p>按 28 天周期推算下一针：${dueDate}（距今天 ${daysBetween(TODAY, dueDate)} 天）</p></div>${pill('周期推算 · 展示用', 'grey')}</div>
      <div class="table-wrap"><table class="cycle-table"><thead><tr><th>日期</th><th>药物 / 剂量</th><th>部位</th><th>记录人</th><th>反应记录</th></tr></thead><tbody>
        ${list.slice(-8).reverse().map((x) => `<tr${x.d === lastD ? ' class="today"' : ''}><td class="num">${esc(x.d)}</td><td><b>${esc(x.drug.split('（')[0])} ${esc(x.dose)}</b></td><td>${esc(x.site)}</td><td>${x.recorder === 'FAMILY' ? '家属代记' : '本人'}</td><td style="min-width:180px">${esc(x.reaction)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small-note">展示最近 8 针（全部 ${list.length} 针在资料库）；超期与否的判断不做——注射安排以医嘱与注射点预约为准。</p>
    </div>
    <div class="actions" style="margin-top:10px">${aiLink('说一句话让 AI 记注射（候选待核对）', 'treatment')}${go('看治疗线折叠卡', 'treatment', 'pathway', 'soft')}</div>`;
}
function pageSideEffects() {
  const p = profile();
  const list = [...p.sideEffects, ...added('sideeffects')];
  return `${pageHeadFor('副作用日记：发生了就记一条（时间 + 表现 + 当时处理，均为原文/原话）；不做分级、不归因。', moreMenu([['⋯ 手工记一条副作用', 'se-add']]))}
    <div class="card">${list.slice().reverse().map((x) => `<div class="row"><div class="row-main"><div><b>${esc(x.text)}</b><p>${longDate(x.d)}</p></div></div>${recorderTag(x.recorder)}</div>`).join('') || '<p class="small-note" style="margin:0">还没有记录。</p>'}</div>
    <div class="help-box">恶心、便稀、注射部位反应都是 SSA 常被提及的反应类型（名词解释，不是判断）；持续或加重的反应请医生评估。</div>`;
}

/* ================= replacement（激素替代档案 T4） ================= */
function pageReplMeds() {
  const p = profile();
  return `${pageHeadFor('多激素替代并列：每种药一行（药名/剂量/原因原文/起始/医嘱原句）；剂量调整只发生在医生诊室（T4 零剂量调整文案）。', moreMenu([['⋯ 手工补一条替代记录', 'repl-add']]))}
    <div class="notice blue"><b>${esc(p.replacement.missedRiskNote)}</b></div>
    <div class="card">
      ${p.replacement.meds.map((m) => `<div class="row"><div class="row-main"><div><b>${esc(m.name)} · ${esc(m.dose)}</b><p>起始 ${longDate(m.start)} · ${esc(m.reason)}</p><blockquote class="reaction-quote">${esc(m.quote)}</blockquote></div></div>${pill('医嘱原文', 'blue')}</div>`).join('')}
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>替代相关化验（照抄 + 原句引用）</h3><p>皮质醇 / FT4 / 渗透压按医嘱节奏复查。</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>日期</th><th>项目</th><th>数值</th><th>报告原句</th></tr></thead><tbody>
        ${p.replacement.followupLabs.map((x) => `<tr><td class="num">${esc(x.d)}</td><td>${esc(x.item)}</td><td class="num"><b>${esc(x.v)}</b></td><td>「${esc(x.quote)}」</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="actions" style="margin-top:10px">${go('看服药与漏服日记', 'replacement', 'diary', 'soft')}</div>`;
}
function pageReplDiary() {
  const p = profile();
  const list = [...p.replacement.diary, ...added('diary')];
  return `${pageHeadFor('「记一次服药」入口在看板；先选药再记按时/漏服——漏服只记事实，不生成补救类文案（T4/IP 红线）。', moreMenu([['⋯ 手工记一条服药', 'dose-log-add']]))}
    <div class="card">
      ${list.slice().reverse().map((x) => `<div class="row"><div class="row-main"><div><b>${esc(x.med)} · ${esc(x.event)}</b><p>${longDate(x.d)}</p></div></div>${recorderTag(x.recorder)}</div>`).join('') || '<p class="small-note" style="margin:0">还没有记录。</p>'}
    </div>
    <div class="help-box">记漏服是为了复诊时把真实服药情况给医生看；发热/应激时氢化可的松怎么处理，按医嘱原话执行（见「替代方案并列」医嘱原文），有疑问问医生。</div>`;
}

/* ================= records（病情整理） ================= */
function pageTimeline() {
  const p = profile();
  const list = [...p.events, ...added('events')];
  return `${pageHeadFor('从鞋码增大到今天的每一步：事件时间线（自述与报告原文并列，recorder 标识）。', moreMenu([['⋯ 手工补一条事件', 'event-add']]))}
    <div class="card"><div class="detour-line">
      ${list.map((e, i) => `<div class="detour-card${i === list.length - 1 ? ' end' : ''}"><span class="tl-dot"></span>
        <div class="detour-body"><div class="det-head"><b>${esc(e.text)}</b><span class="place">${esc(e.d)}</span></div><div class="kv"><span>${recorderTag(e.recorder)}</span></div></div>
      </div>`).join('')}
    </div></div>
    <div class="help-box">「确诊延误」的每一步都在这里留给医生看；本页不做病因推断。SCENARIOS S01 原话（改写）：「手指僵、鞋码从 37 穿到 40——直到老朋友说我和以前完全是两个人。」</div>`;
}
function pageReports() {
  const p = profile();
  const list = [...p.reports, ...added('reports')];
  return `${pageHeadFor('逐份报告原文：日期 / 类型 / 标题 / 摘录（照抄不缩写）；原件留在你的资料目录。', moreMenu([['⋯ 手工补一份报告', 'report-add']]))}
    <div class="card"><div class="table-wrap"><table><thead><tr><th>日期</th><th>类型</th><th>标题</th><th>摘录（原文）</th></tr></thead><tbody>
      ${list.map((r) => `<tr><td class="num">${esc(r.d)}</td><td>${pill(r.kind, 'grey')}</td><td><b>${esc(r.title)}</b></td><td style="min-width:220px">${esc(r.excerpt)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small-note">「考虑」「相仿」等都是报告原文用词；含义请医生解释。报告有新版本时新增一行，不覆盖。</p></div>`;
}

/* ================= imaging（影像与视野，T1 同口径） ================= */
function pageMri() {
  const p = profile();
  const list = [...p.imaging.mri, ...added('mri')];
  return `${pageHeadFor('MRI 报告按次存档：日期 + 结论原文 + 下次安排（医嘱原文）；「存一份报告」入口在看板（S06）。', moreMenu([['⋯ 手工存一份 MRI', 'mri-add']]))}
    <div class="notice blue"><b>${esc(p.imaging.note)}</b></div>
    ${list.map((x) => `<div class="card" style="margin-bottom:12px"><div class="card-head"><div><span class="eyebrow">${longDate(x.d)} · ${esc(x.title)}</span></div>${pill('报告原文', 'blue')}</div>
      <blockquote class="reaction-quote">「${esc(x.quote)}」</blockquote><p class="small-note">下一步：${esc(x.next)}</p></div>`).join('')}
    <div class="actions">${aiLink('拍报告让 AI 登记日期与结论原句（候选待核对）', 'imaging')}${go('看视野检查', 'imaging', 'visual', 'soft')}</div>`;
}
function pageVisual() {
  const p = profile();
  const list = [...p.imaging.visual, ...added('visual')];
  return `${pageHeadFor('视野检查按次存档：结论原文照抄；「缩小/缺损」是报告用词，请眼科医生解释。', moreMenu([['⋯ 手工存一份视野报告', 'visual-add']]))}
    ${list.map((x) => `<div class="card" style="margin-bottom:12px"><div class="card-head"><div><span class="eyebrow">${longDate(x.d)} · ${esc(x.title)}</span></div>${pill('报告原文', 'blue')}</div>
      <blockquote class="reaction-quote">「${esc(x.quote)}」</blockquote><p class="small-note">下一步：${esc(x.next)}</p></div>`).join('')}`;
}

/* ================= comorbidity（合并症 4 节，T5：不进生化趋势） ================= */
const COMO_TABS = [['glucose', '糖代谢'], ['cardio', '心血管'], ['sleep', '睡眠呼吸暂停'], ['bone', '骨关节']];
function comorbidityPage(key) {
  const p = profile();
  const sec = p.comorbidity[key];
  const list = [...sec.items, ...added('comorbidity').filter((x) => x.section === key)];
  return `${pageHeadFor(`${sec.title}节：数值照抄 + 报告原句引用；分类数据不进生化趋势（T5）。`, moreMenu([['⋯ 手工记一条本节记录', 'como-add', `data-section="${key}"`]]))}
    <div class="card"><div class="table-wrap"><table><thead><tr><th>日期</th><th>项目</th><th>数值</th><th>报告原句 / 来源</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td class="num">${esc(x.d)}</td><td>${esc(x.item)}</td><td class="num"><b>${esc(x.v)}</b></td><td style="min-width:200px">「${esc(x.quote)}」（${esc(x.src)}）</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small-note">${esc(sec.note)}</p></div>
    <div class="actions" style="margin-top:10px">${aiLink('拍报告让 AI 归节（候选待核对）', 'comorbidity')}${go('看生化趋势（不含合并症）', 'biochemistry', 'trend', 'soft')}</div>`;
}

/* ================= calendar（随访日历 T6） ================= */
function pageCalendar() {
  const p = profile();
  const next = p.calendar.entries.find((r) => !r.done);
  return `${pageHeadFor('复查节奏按医嘱原文登记（AI 不推算"该查了/无需复查"，红线）；本页只展示与提醒（T6）。', moreMenu([['⋯ 手工登记一条随访', 'cal-add']]))}
    <div class="stage-strip"><span class="eyebrow">最近一项 · 轻提醒</span><b>${next ? `${next.d} · ${next.item}` : '待登记'}</b><small>${next ? esc(next.note) : ''}</small></div>
    <div class="card"><div class="card-head"><div><h3>随访节奏（医嘱原文登记）</h3><p>间隔以医嘱原文为准，本台不做依从性判定。</p></div></div>
      ${p.calendar.rhythm.map((r) => `<div class="row"><div class="row-main"><div><b>${esc(r.item)} · ${esc(r.freq)}</b><p>依据：${esc(r.quote)}</p></div></div>${pill('医嘱原文', 'blue')}</div>`).join('')}
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>日程</h3><p>${p.calendar.entries.length} 项待办与既往</p></div></div>
      ${p.calendar.entries.map((r) => `<div class="row"><div class="row-main"><div><b>${esc(r.item)}</b><p>${esc(r.d)} · ${esc(r.note)}</p></div></div>${pill(r.kind === 'injection' ? '注射' : r.kind === 'lab' ? '化验' : '复诊', r.done ? 'green' : 'yellow')}</div>`).join('')}
    </div>
    <div class="actions" style="margin-top:10px">${go('去复诊准备', 'visit', 'prepare', 'soft')}</div>`;
}

/* ================= oneshow（病情一图秀） ================= */
function pageOneShow() {
  const [t0, t1] = chartDomain();
  const p = profile();
  const lastG = seriesAll('GHR').slice(-1)[0], lastI = seriesAll('IGF1').slice(-1)[0];
  return `${head('病情一图秀', SUBTITLES.oneshow, aiLink('让 AI 讲一段时段变化（候选待核对）', 'oneshow'))}
    <div class="notice plain">private 感受记录（${privateCount(p)} 条）不出现在本页——三出口（看板/导出/一图秀）统一过滤；图上只有生化序列与治疗节点。</div>
    <div class="chart-panel">
      <div class="chart-top"><div class="legend">${state.chartSel.map((c) => `<span><i style="background:${SERIES[c].color}"></i><b>${esc(SERIES[c].name)}</b></span>`).join('')}</div></div>
      ${chartControls(state.chartSel)}
      <div class="chart-wrap"><div class="scroll-hint">曲线过宽时可横向滚动（有意为之）→</div>${chartSVG(t0, t1, { sel: state.chartSel })}</div>
    </div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><div class="card-head"><div><h3>给医生的一句话摘要（照抄事实）</h3></div></div>
        <div class="flag-list"><div>最近随机 GH：${lastG.v} ${esc(lastG.unit)}（${lastG.d}，「${esc(lastG.quote)}」）</div><div>最近 IGF-1：${lastI.v} ng/mL（${lastI.d}，化验单参考区间随附）</div><div>治疗节点：2025-03-18 手术 · 2025-06-18 起 SSA 长效针每 28 天</div></div>
      </div>
      <div class="card"><div class="card-head"><div><h3>口径说明</h3></div></div>
        <div class="flag-list"><div>每条线按自身范围缩放，不同序列数值不互比</div><div>GH 单位 ng/mL 与 μg/L 数值相等，随报告原文</div><div>合并症四节数据不进本图（T5）</div></div>
        <div class="actions" style="margin-top:12px">${go('看生化时间线', 'biochemistry', 'trend', 'soft')}${go('去复诊准备', 'visit', 'prepare', 'soft')}</div>
      </div>
    </div>`;
}

/* ================= visit（复诊与资料，含临床研究二级） ================= */
function pageVisitPrepare() {
  const p = profile();
  const ready = p.visit.materials.filter((x) => (mem().materials[x.id] || x.state) === 'ready').length;
  return `${pageHeadFor('复诊摘要 + 问题清单：AI 按时间范围汇总候选、逐条核对勾选；手工加条目（「准备下次复诊」入口在看板）。', moreMenu([['⋯ 手工添加一条想问的事', 'q-add']]))}
    <div class="grid two">
      <div class="card"><div class="card-head"><div><h3>问题清单</h3><p>${questions().filter((q) => !q.asked).length} 条待问 · ${questions().length} 条累计；勾选 = 已问。</p></div></div>
        ${questions().map((q) => `<div class="row"><div class="row-main"><div><b>${esc(q.text)}</b><p>${esc(q.src)}</p></div></div><label class="chk"><input type="checkbox" data-action="q-asked" data-id="${q.id}" ${q.asked ? 'checked' : ''} aria-label="标记已问">已问</label></div>`).join('')}
        <div class="actions" style="margin-top:10px">${aiLink('让 AI 汇总问题候选（候选待核对）', 'visit')}</div>
      </div>
      <div class="card"><div class="card-head"><div><h3>复诊摘要（两区导出）</h3><p>事实区（已核对记录）+ 看法区（shared）；private ${privateCount(p)} 条已过滤。材料 ${ready}/${p.visit.materials.length}。</p></div></div>
        <div class="flag-list"><div>事实区：GH/IGF-1 序列、注射周期、替代方案、合并症四节</div><div>看法区：shared 感受（标注"不是医生结论"）</div><div>三出口同一过滤：看板 / 导出 / 一图秀</div></div>
        <div class="actions" style="margin-top:12px">${btn('预览导出（两区）', 'export', 'primary')}</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>复诊材料清单</h3><p>${ready} / ${p.visit.materials.length} 项已备齐 · 只整理复诊材料</p></div></div>
      <div class="mat-list">${p.visit.materials.map((x) => {
    const st = mem().materials[x.id] || x.state;
    return `<div class="mat-row${st === 'ready' ? ' done' : ''}"><input type="checkbox" ${st === 'ready' ? 'checked' : ''} data-action="mat-check" data-id="${x.id}" aria-label="${esc(x.name)}"><div class="mat-main"><b>${esc(x.name)}</b><p>${esc(x.why)}</p></div>${pill(st === 'ready' ? '已备齐' : st === 'partial' ? '部分备齐' : '未备齐', st === 'ready' ? 'green' : st === 'partial' ? 'yellow' : 'grey')}</div>`;
  }).join('')}</div>
    </div>`;
}
function pageLibrary() {
  const p = profile();
  const docs = p.visit.documents;
  const cands = p.visit.candidates;
  return `${pageHeadFor('资料库与候选核对：导入 → 解析 → 候选 → 逐项核对 → 入事实层；接受之前都只是候选，拒收零副作用（IP5）。', moreMenu([['⋯ 手工导入一份文件', 'doc-add']]))}
    <div class="flow-steps"><span class="on">选文件</span><span>解析</span><span>候选字段</span><span>逐项核对</span><span>入库</span></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>文件</th><th>类型</th><th>大小</th><th>状态</th></tr></thead><tbody>
      ${docs.map((d) => `<tr><td><b>${esc(d.name)}</b></td><td>${pill(d.kind, 'grey')}</td><td class="num">${esc(d.size)}</td><td>${pill(d.status, d.status === '已核对' ? 'green' : 'yellow')}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small-note">原件存放在你选择的资料目录（见「设置」）；主目录/根目录/桌面根会被拒绝。</p></div>
    <div class="card" style="margin-top:14px"><div class="card-head"><div><h3>解析候选（逐项核对）</h3><p>候选不是记录：确认后才入事实层。</p></div></div>
      ${cands.map((c) => `<div class="row"><div class="row-main"><div><b>${esc(c.field)}：${esc(c.value)}</b><p>${esc(c.src)}</p></div></div>
        <div class="actions">${pill(c.state, c.state === '已入库' ? 'green' : c.state === '已拒收' ? 'grey' : 'yellow')}${c.state === '待核对' ? btn('确认入库', 'cand-ok', 'soft', `data-id="${c.id}"`) + btn('拒收', 'cand-reject', 'soft', `data-id="${c.id}"`) : ''}</div></div>`).join('')}
    </div>`;
}
function pageResearch() {
  const p = profile();
  return `${pageHeadFor('临床研究线索：只列不荐，不做匹配判定（SPEC §五 G1-6：临床研究挂复诊与资料线）。')}
    <div class="notice plain">${esc(p.visit.research.note)}</div>
    <div class="card">${p.visit.research.trials.map((t) => `<div class="row"><div class="row-main"><div><b>${esc(t.title)}</b><p>${esc(t.phase)} · 来源 ${esc(t.source)} · ${esc(t.status)}</p></div></div><button class="soft" data-action="trial-note" data-key="${esc(t.key)}">记到问题清单</button></div>`).join('')}</div>
    <div class="help-box">想参加研究先记到问题清单，复诊时问医生；是否适合由研究团队评估。</div>`;
}

/* ---------------- 渲染分派 ---------------- */
const RENDERERS = {
  dashboard: pageDashboard,
  biochemistry: () => ({ trend: pageBioTrend, records: pageBioRecords, ogtt: pageBioOgtt })[state.sub.biochemistry || 'trend'](),
  treatment: () => ({ pathway: pageTreatPathway, injection: pageInjection, sideeffects: pageSideEffects })[state.sub.treatment || 'pathway'](),
  replacement: () => ({ meds: pageReplMeds, diary: pageReplDiary })[state.sub.replacement || 'meds'](),
  records: () => ({ timeline: pageTimeline, reports: pageReports })[state.sub.records || 'timeline'](),
  imaging: () => ({ mri: pageMri, visual: pageVisual })[state.sub.imaging || 'mri'](),
  comorbidity: () => comorbidityPage(state.sub.comorbidity || 'glucose'),
  calendar: pageCalendar,
  oneshow: pageOneShow,
  visit: () => ({ prepare: pageVisitPrepare, library: pageLibrary, research: pageResearch })[state.sub.visit || 'prepare']()
};
function render() {
  const page = RENDERERS[state.page] || pageDashboard;
  const p = profile();
  const subs = SUBPAGES[state.page];
  $('#nav').innerHTML = PAGES.map(([id, label, ic]) => `<button class="nav-button" aria-current="${state.page === id ? 'page' : 'false'}" data-action="go" data-page="${id}">${icon(ic)}<span>${label}</span></button>`).join('');
  $('#breadcrumb').textContent = '小肢宝工作台 / ' + (PAGES.find((x) => x[0] === state.page)[1] + (subs ? ' · ' + subLabel(state.page) : ''));
  $('#profile-name').textContent = p.name.replace('（演示）', '') + '的资料';
  $('#profile-meta').textContent = `${p.age} 岁 · ${p.diagnosisShort} · 当前记录主体：${state.actor === 'PATIENT' ? '本人' : '家属代记'}`;
  $('#profile-avatar').textContent = p.name[0];
  $('#main').innerHTML = `<div class="page-enter">${backRow()}${page()}</div>`;
  $('#app-version').textContent = 'v' + APP_INFO.version;
  $('#ver-chip').textContent = 'v' + APP_INFO.version;
  renderAgent();
}

/* ---------------- AI 面板（30 号窄宽规则：右侧面板 25–45% 可拖拽可收起） ---------------- */
function clampAgentW(w) { return Math.min(45, Math.max(25, w)); }
function renderAgent() {
  const a = state.agent;
  $('#agent-splitter').hidden = !a.open;
  $('#agent-pane').hidden = !a.open;
  $('#agent-toggle').setAttribute('aria-expanded', String(a.open));
  $('#agent-toggle').textContent = a.open ? '收起 AI' : 'AI 协助';
  document.documentElement.style.setProperty('--agent-w', a.w + '%');
  $('#agent-splitter').setAttribute('aria-valuenow', String(Math.round(a.w)));
  if (!a.open) return;
  const body = $('.agent-body');
  const promptBox = a.prompt
    ? `<div class="agent-msg user"><b>草稿（待你发送 · 不会自动发出）</b><p>${esc(a.prompt)}</p></div>
       <div class="agent-msg bot"><b>演示回复（未接通）</b><p>真实版本会基于已核对记录生成候选；本原型不生成内容、不代替你发言。</p></div>`
    : `<div class="notice plain">这是<b>演示面板</b>：原型未接入真实 AI。点任意「AI 协助」协议链接（acromegaly:agent-draft）会把预写提示词 + 当前病情上下文填到这里，等你核对发送。</div>`;
  body.innerHTML = promptBox + `<p class="small-note">private 记录默认不进入 AI 上下文（三出口统一过滤）；候选需逐项核对才入事实层，拒收零副作用。</p>`;
}
function setAgent(open) { state.agent.open = open; renderAgent(); }
(function agentSplitterInit() {
  const sp = $('#agent-splitter');
  let dragging = false;
  sp.addEventListener('pointerdown', (e) => { dragging = true; sp.setPointerCapture(e.pointerId); e.preventDefault(); });
  sp.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = $('.stage').getBoundingClientRect(); /* 按容器 rect 夹取（不用 window 宽，30 号 §0） */
    state.agent.w = clampAgentW(((rect.right - e.clientX) / rect.width) * 100);
    renderAgent();
  });
  const end = () => { dragging = false; };
  sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end);
  sp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { state.agent.w = clampAgentW(state.agent.w + 2); renderAgent(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { state.agent.w = clampAgentW(state.agent.w - 2); renderAgent(); e.preventDefault(); }
    else if (e.key === 'Home') { state.agent.w = 45; renderAgent(); e.preventDefault(); }
    else if (e.key === 'End') { state.agent.w = 25; renderAgent(); e.preventDefault(); }
  });
})();

/* ---------------- 设置（SETTINGS-DESIGN：目录 / 主体切换 / 私密分级） ---------------- */
function openSettings(tabIn) {
  const c = state.cfg;
  const tab = tabIn || 'dir';
  openModal('设置', `<div class="cfg-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === 'dir'}" data-action="cfg-tab" data-tab="dir">本机数据目录</button>
      <button role="tab" aria-selected="${tab === 'actor'}" data-action="cfg-tab" data-tab="actor">记录主体</button>
      <button role="tab" aria-selected="${tab === 'privacy'}" data-action="cfg-tab" data-tab="privacy">私密分级</button>
    </div>
    <div class="cfg-block" data-tab="dir" ${tab !== 'dir' ? 'hidden' : ''} style="margin-top:14px">
      <h3 style="font-size:12.5px">本机数据目录（真实判定源：路径存在 ≠ 初始化成功）</h3>
      <p class="small-note">患者资料与本台配置分开存储；目录更换不重置数据，取消无副作用。主目录 / 根目录 / 桌面根会被拒绝。</p>
      <div class="path-row"><code>${esc(c.root)}</code><button class="soft" data-action="pick-root">选择目录</button></div>
      <div class="grid three" style="margin-top:12px">
        <div class="cfg-stat"><b>${esc(c.storeState)}</b><span>当前状态</span></div>
        <div class="cfg-stat"><b>1.8 GB</b><span>原件与扫描件（估算）</span></div>
        <div class="cfg-stat"><b>${esc(c.backupAt)}</b><span>上次备份（演示）</span></div>
      </div>
    </div>
    <div class="cfg-block" data-tab="actor" ${tab !== 'actor' ? 'hidden' : ''} style="margin-top:14px">
      <h3 style="font-size:12.5px">记录主体切换（双主体 · T7）</h3>
      <p class="small-note">切到「替家人记」后，新增记录带 recorder=家属 标识；查看权限不变，只是代记留痕。</p>
      <button class="profile-row ${state.actor === 'PATIENT' ? 'on' : ''}" data-action="set-actor" data-actor="PATIENT"><div><b>本人自记</b><p>记录人 = 患者本人</p></div><span class="profile-caret">${state.actor === 'PATIENT' ? '当前' : '切换'}</span></button>
      <button class="profile-row ${state.actor === 'FAMILY' ? 'on' : ''}" data-action="set-actor" data-actor="FAMILY"><div><b>替家人记（${esc(profile().caregiverLabel)}）</b><p>新记录带「家属代记」徽章</p></div><span class="profile-caret">${state.actor === 'FAMILY' ? '当前' : '切换'}</span></button>
    </div>
    <div class="cfg-block" data-tab="privacy" ${tab !== 'privacy' ? 'hidden' : ''} style="margin-top:14px">
      <h3 style="font-size:12.5px">私密内容 visibility 分级</h3>
      <p class="small-note">每条感受记录可标 public（shared）/ private。private 的记录在三个出口统一过滤：<b>看板摘要、导出、一图秀</b>都不出现（当前已隐藏 ${privateCount(profile())} 条）。</p>
      <label class="switch-row"><input type="radio" name="vis" data-action="set-vis" value="private" ${c.defaultVisibility === 'private' ? 'checked' : ''}><span>新记录默认 private（推荐：先私密，想带出时逐条改）</span></label>
      <label class="switch-row"><input type="radio" name="vis" data-action="set-vis" value="shared" ${c.defaultVisibility === 'shared' ? 'checked' : ''}><span>新记录默认 shared（进导出看法区）</span></label>
    </div>`,
    '<button data-action="close">关闭</button>', '小肢宝 · 设置');
}

/* ---------------- 导出（两区 + private 过滤） ---------------- */
function exportMarkdown() {
  const p = profile();
  const ghr = seriesAll('GHR'), ogtt = seriesAll('GHOG'), igf = seriesAll('IGF1');
  const L = ['# 复诊摘要（演示）· ' + TODAY, '', '> 由本人与家属整理，不是医生结论；private 记录已过滤。', ''];
  L.push('## 一、问题清单（待问）', '');
  questions().filter((q) => !q.asked).forEach((q, i) => L.push(`${i + 1}. ${q.text}`));
  L.push('', '## 二、事实区（已核对记录）', '');
  const g = ghr.slice(-1)[0], o = ogtt.slice(-1)[0], i1 = igf.slice(-1)[0];
  if (g) L.push(`- 最近随机 GH：${g.v} ${g.unit}（${g.d}）·「${g.quote}」`);
  if (o) L.push(`- 最近 OGTT 谷值：${o.v} ${o.unit}（${o.d}）·「${o.quote}」`);
  if (i1) L.push(`- 最近 IGF-1：${i1.v} ng/mL（${i1.d}，化验单参考区间 ${i1.ref}）`);
  L.push(`- 长效针：${p.medPlan.drug} ${p.medPlan.dose} / ${p.medPlan.cycleDays} 天，共 ${p.injections.length} 针，最近 ${p.injections[p.injections.length - 1].d}`);
  L.push(`- 替代：${p.replacement.meds.map((m) => `${m.name} ${m.dose}`).join('；')}`);
  const mri = p.imaging.mri.slice(-1)[0];
  if (mri) L.push(`- 最近 MRI（${mri.d}）：「${mri.quote}」`);
  const vis = p.imaging.visual.slice(-1)[0];
  if (vis) L.push(`- 最近视野（${vis.d}）：「${vis.quote}」`);
  L.push('', '## 三、看法区（shared · 不是医生结论）', '');
  sharedOnly(p).forEach((v) => L.push(`- ${v.date} · ${v.role === 'PATIENT' ? '本人' : '家属'}：${v.content}`));
  L.push('', `> private 记录 ${privateCount(p)} 条未进入本摘要（三出口同一过滤）。`, '');
  return L.join('\n');
}
function openExport() {
  openModal('复诊摘要（两区导出 · 演示）', `<div class="notice plain">事实区 + 看法区；private ${privateCount(profile())} 条已过滤（看板/导出/一图秀三出口同一过滤）。</div><pre class="md-preview">${esc(exportMarkdown())}</pre>`,
    `<button class="soft" data-action="copy-md">复制 Markdown</button><button data-action="close">关闭</button>`, '导出预览');
}

/* ---------------- 手工表单（「⋯ 更多」收敛口，每个 ≤6 字段；IP6） ---------------- */
const actorNow = () => state.actor;
function openBioForm() {
  openModal('手工补一条化验（6 字段）', `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-k">指标</label><select id="f-k"><option>随机 GH</option><option>OGTT GH 谷值</option><option>IGF-1</option></select></div>
    <div><label class="form-label" for="f-v">数值（键盘输入）</label><input id="f-v" inputmode="decimal" placeholder="照化验单抄"></div>
    <div><label class="form-label" for="f-u">单位</label><select id="f-u"><option>ng/mL</option><option>μg/L</option></select></div>
    <div><label class="form-label" for="f-q">报告原句</label><input id="f-q" placeholder="照抄，不缩写"></div>
    <div><label class="form-label" for="f-n">备注</label><input id="f-n" placeholder="可选"></div>
  </div><p class="small-note">值照抄原文；本表单无判读项。记录人：${actorNow() === 'PATIENT' ? '本人' : '家属代记'}。</p>`,
    `<button class="primary" data-action="save-bio">保存（照抄）</button><button data-action="close">取消</button>`);
}
function openInjForm() {
  openModal('手工补一条注射记录（5 字段）', `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-s">部位</label><select id="f-s"><option>左臀部</option><option>右臀部</option><option>其他</option></select></div>
    <div><label class="form-label" for="f-n">备注</label><input id="f-n" placeholder="如：社区医院代注射"></div>
    <div><label class="form-label" for="f-r">反应</label><input id="f-r" placeholder="如：无特别反应"></div>
    <div><label class="form-label" for="f-drug">药物 / 剂量（默认当前方案）</label><input id="f-drug" value="${esc(profile().medPlan.drug + ' ' + profile().medPlan.dose)}"></div>
  </div><p class="small-note">周期 28 天自动沿用；超期与否不做判定。记录人：${actorNow() === 'PATIENT' ? '本人' : '家属代记'}。</p>`,
    `<button class="primary" data-action="save-inj">保存</button><button data-action="close">取消</button>`);
}
function openComoForm(section) {
  openModal(`手工记一条合并症记录（5 字段 · ${section}）`, `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-i">项目</label><input id="f-i" placeholder="如 HbA1c / 血压"></div>
    <div><label class="form-label" for="f-v">数值</label><input id="f-v" placeholder="照报告抄"></div>
    <div><label class="form-label" for="f-q">报告原句</label><input id="f-q" placeholder="照抄"></div>
    <div><label class="form-label" for="f-s">分节</label><select id="f-s">${['glucose', 'cardio', 'sleep', 'bone'].map((k) => `<option value="${k}" ${k === section ? 'selected' : ''}>${{ glucose: '糖代谢', cardio: '心血管', sleep: '睡眠呼吸暂停', bone: '骨关节' }[k]}</option>`).join('')}</select></div>
  </div><p class="small-note">合并症分类数据不进生化趋势（T5）。</p>`,
    `<button class="primary" data-action="save-como">保存（照抄）</button><button data-action="close">取消</button>`);
}
function openDoseLogForm() {
  const p = profile();
  openModal('手工记一条服药（4 字段）', `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-m">药（先选药）</label><select id="f-m">${p.replacement.meds.map((m) => `<option>${esc(m.name)}</option>`).join('')}</select></div>
    <div><label class="form-label" for="f-e">情况</label><select id="f-e"><option>按时服</option><option>漏服（记事实）</option></select></div>
    <div><label class="form-label" for="f-n">备注</label><input id="f-n" placeholder="可选"></div>
  </div><p class="small-note">漏服只记事实，不生成补救类文案（T4）。</p>`,
    `<button class="primary" data-action="save-dose">保存</button><button data-action="close">取消</button>`);
}
function openQForm() {
  openModal('添加一条想问的事（1 字段）', `<div class="form-grid"><div><label class="form-label" for="f-q">想问什么</label><input id="f-q" placeholder="原话记下来"></div></div>`,
    `<button class="primary" data-action="save-q">存入清单</button><button data-action="close">取消</button>`);
}
function openMriForm(kind) {
  openModal(`手工存一份${kind === 'mri' ? ' MRI' : '视野'}报告（4 字段）`, `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-t">标题</label><input id="f-t" placeholder="如：年度复查 MRI"></div>
    <div><label class="form-label" for="f-q">结论原文</label><input id="f-q" placeholder="照抄，不缩写"></div>
    <div><label class="form-label" for="f-n">下次安排（医嘱原文）</label><input id="f-n" placeholder="可选"></div>
  </div>`,
    `<button class="primary" data-action="save-mri" data-kind="${kind}">保存（照抄）</button><button data-action="close">取消</button>`);
}
function openEventForm() {
  openModal('手工补一条事件（3 字段）', `<div class="form-grid">
    <div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div>
    <div><label class="form-label" for="f-t">内容</label><input id="f-t" placeholder="如：眼科视野检查"></div>
    <div><label class="form-label" for="f-n">备注</label><input id="f-n" placeholder="可选"></div>
  </div>`,
    `<button class="primary" data-action="save-event">保存</button><button data-action="close">取消</button>`);
}

/* ---------------- 动作分派 ---------------- */
const ACTIONS = {
  go(el) { navigate(el.dataset.page, el.dataset.sub || ''); },
  sub(el) { navigate(state.page, el.dataset.sub); },
  scene(el) {
    const s = SCENES.find((x) => x[0] === el.dataset.scene);
    if (s) navigate(s[2], s[3]);
  },
  'chart-sel'(el) {
    const c = el.dataset.code;
    const arr = state.chartSel;
    if (arr.includes(c)) { if (arr.length > 1) state.chartSel = arr.filter((x) => x !== c); else { toast('至少保留一条序列。'); return; } }
    else state.chartSel = [...arr, c];
    render();
  },
  range(el) { state.range = el.dataset.range; render(); },
  zoom() { /* change 事件处理 */ },
  pin(el) { state.pin = { code: el.dataset.code, date: el.dataset.date }; render(); },
  unpin() { state.pin = null; render(); },
  'agent-toggle'() { setAgent(!state.agent.open); },
  'agent-hide'() { setAgent(false); toast('已收起面板（草稿保留）'); },
  settings(el) { openSettings(el && el.dataset.tab); },
  close() { closeModal(); },
  export() { openExport(); },
  'font-toggle'() { document.body.classList.toggle('large'); $('#font-toggle').setAttribute('aria-pressed', document.body.classList.contains('large')); },
  about() {
    openModal('关于小肢宝', `<p><b>小肢宝 LimbPal</b> · 肢端肥大症患者工作台 · 交互原型 v${APP_INFO.version}（构建 ${APP_INFO.build}）</p>
      <p class="small-note">本页为交互原型：未接入 DSH / AI，不读写真实文件；全部数据为合成演示。只整理不判定——判读归医生。</p>`,
      '<button data-action="close">关闭</button>', '关于');
  },
  help() {
    openModal('原型操作说明', `<p class="small-note">左侧导航 10 条一级线（共 ${Object.keys(SUBPAGES).reduce((n, k) => n + SUBPAGES[k].length, 0)} 个二级页签）；看板入口文案与导航 key 与 docs/INTERACTION-DESIGN.md 逐字一致。</p>
      <p class="small-note">「AI 协助」是 acromegaly:agent-draft 协议链接：点击把预写提示词 + 当前病情上下文填入右侧面板，待你核对发送；不自动发送、不代替发言。</p>
      <p class="small-note">手工通道收在「⋯ 更多」（每表单 ≤6 字段）；更正 = 新增版本。右侧 AI 面板可拖宽 25–45%、可收起。</p>`,
      '<button data-action="close">关闭</button>', '帮助');
  },
  'pick-root'() {
    const v = prompt('输入资料目录绝对路径（演示：/ 或 /Users/demo 或桌面根会被拒绝）', state.cfg.root);
    if (v === null) return; /* 取消无副作用 */
    if (['/', '/Users/demo', '/Users/demo/Desktop'].includes(v.trim())) { toast('已拒绝：不能选主目录、根目录或桌面根'); return; }
    state.cfg.root = v.trim(); state.cfg.storeState = '就绪';
    toast('资料目录已更新（原型仅内存）'); openSettings('dir');
  },
  'set-actor'(el) {
    state.actor = el.dataset.actor;
    toast(state.actor === 'FAMILY' ? '已切换为「替家人记」：新记录带家属代记标识' : '已切换为本人自记');
    openSettings('actor');
    render();
  },
  'set-vis'(el) {
    state.cfg.defaultVisibility = el.value;
    toast(el.value === 'private' ? '新感受记录默认 private：三出口统一过滤' : '新感受记录默认 shared：进导出看法区');
  },
  'copy-md'() {
    navigator.clipboard?.writeText(exportMarkdown()).then(() => toast('已复制 Markdown')).catch(() => toast('复制失败：浏览器未授权剪贴板'));
  },
  'q-asked'(el) {
    const q = questions().find((x) => x.id === el.dataset.id);
    if (q) { q.asked = el.checked; toast(q.asked ? '已标记"已问"' : '恢复为待问'); }
  },
  'mat-check'(el) {
    const id = el.dataset.id;
    const base = profile().visit.materials.find((x) => x.id === id);
    const cur = mem().materials[id] || base.state;
    mem().materials[id] = cur === 'ready' ? (base.state === 'partial' ? 'partial' : 'todo') : 'ready';
    toast(mem().materials[id] === 'ready' ? '已标记"备齐"' : '已恢复'); render();
  },
  'cand-ok'(el) {
    const c = profile().visit.candidates.find((x) => x.id === el.dataset.id);
    if (c) c.state = '已入库';
    toast('已入库（候选经你确认才成为记录）', { back: true }); render();
  },
  'cand-reject'(el) {
    const c = profile().visit.candidates.find((x) => x.id === el.dataset.id);
    if (c) c.state = '已拒收';
    toast('已拒收（零副作用，候选不入事实层）'); render();
  },
  'trial-note'(el) {
    const t = profile().visit.research.trials.find((x) => x.key === el.dataset.key);
    if (t) questions().push({ id: uid('q'), text: `${t.title} 这个研究我适合参加吗？`, asked: false, src: '临床研究 · ' + TODAY });
    toast('已记到问题清单', { back: true }); render();
  },
  /* 「⋯ 更多」手工通道入口 */
  'bio-add'() { openBioForm(); },
  'inj-add'() { openInjForm(); },
  'como-add'(el) { openComoForm(el.dataset.section || 'glucose'); },
  'dose-log-add'() { openDoseLogForm(); },
  'q-add'() { openQForm(); },
  'mri-add'() { openMriForm('mri'); },
  'visual-add'() { openMriForm('visual'); },
  'event-add'() { openEventForm(); },
  'med-add'() { toast('演示：治疗线变更 = 在折叠卡下新增一张阶段卡（新版本，旧卡保留）'); },
  'repl-add'() { openDoseLogForm(); },
  'se-add'() {
    openModal('手工记一条副作用（2 字段）', `<div class="form-grid"><div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div><div><label class="form-label" for="f-t">表现</label><input id="f-t" placeholder="原话记下来"></div></div>`,
      `<button class="primary" data-action="save-se">保存</button><button data-action="close">取消</button>`);
  },
  'report-add'() {
    openModal('手工补一份报告（4 字段）', `<div class="form-grid"><div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date" value="${TODAY}"></div><div><label class="form-label" for="f-k">类型</label><input id="f-k" placeholder="如 MRI 报告"></div><div><label class="form-label" for="f-t">标题</label><input id="f-t"></div><div><label class="form-label" for="f-e">摘录（原文）</label><input id="f-e" placeholder="照抄"></div></div>`,
      `<button class="primary" data-action="save-report">保存（照抄）</button><button data-action="close">取消</button>`);
  },
  'cal-add'() {
    openModal('手工登记一条随访（3 字段）', `<div class="form-grid"><div><label class="form-label" for="f-d">日期</label><input id="f-d" type="date"></div><div><label class="form-label" for="f-i">项目</label><input id="f-i" placeholder="如 GH/IGF-1 化验"></div><div><label class="form-label" for="f-q">医嘱原文</label><input id="f-q" placeholder="照抄医嘱原话"></div></div><p class="small-note">只登记医嘱原文与日期；AI 不推算复查判定（红线）。</p>`,
      `<button class="primary" data-action="save-cal">保存</button><button data-action="close">取消</button>`);
  },
  'doc-add'() {
    openModal('手工导入一份文件（演示）', `<div class="form-grid"><div><label class="form-label" for="f-n">文件名</label><input id="f-n" placeholder="如 化验单 2026-10-13.jpg"></div></div><p class="small-note">原型不读写真实文件；真实版本走导入→解析→候选→核对管线。</p>`,
      `<button class="primary" data-action="save-doc">加入解析队列</button><button data-action="close">取消</button>`);
  }
};

/* ---------------- 保存类动作 ---------------- */
const SAVE = {
  'save-bio'() {
    const d = $('#f-d')?.value, k = $('#f-k')?.value, v = parseFloat($('#f-v')?.value), u = $('#f-u')?.value, q = $('#f-q')?.value?.trim();
    if (!d || !Number.isFinite(v) || !q) { toast('日期、数值与报告原句必填'); return; }
    const rec = { d, v, unit: u, quote: q, src: `手工登记（${actorNow() === 'PATIENT' ? '本人' : '家属代记'}，演示）`, recorder: actorNow() };
    const target = k === 'IGF-1' ? profile().biochem.igf1 : k === 'OGTT GH 谷值' ? profile().biochem.ghOgtt : profile().biochem.ghRandom;
    target.push(rec);
    closeModal(); render(); toast('已照抄登记（无判读列；时间线新点 +1）', { back: true });
  },
  'save-inj'() {
    const d = $('#f-d')?.value, s = $('#f-s')?.value, r = $('#f-r')?.value?.trim() || '无特别记录';
    if (!d) { toast('日期必填'); return; }
    added('injections').push({ id: uid('inj'), d, drug: $('#f-drug')?.value || '', dose: profile().medPlan.dose, cycle: '每 28 天 1 次', site: s, recorder: actorNow(), note: $('#f-n')?.value || '', reaction: r });
    closeModal(); render(); toast('已记录注射（周期卡新格 +1）', { back: true });
  },
  'save-como'() {
    const d = $('#f-d')?.value, i = $('#f-i')?.value?.trim(), v = $('#f-v')?.value?.trim(), q = $('#f-q')?.value?.trim(), s = $('#f-s')?.value;
    if (!d || !i || !q) { toast('日期、项目与报告原句必填'); return; }
    added('comorbidity').push({ d, item: i, v: v || '—', quote: q, src: `手工登记（演示）`, section: s });
    closeModal(); render(); toast('已记录（归入所选分节，不进生化趋势）', { back: true });
  },
  'save-dose'() {
    const d = $('#f-d')?.value, m = $('#f-m')?.value, e = $('#f-e')?.value;
    if (!d || !m) { toast('日期与药必填'); return; }
    added('diary').push({ d, med: m, event: e + ($('#f-n')?.value ? '（' + $('#f-n').value + '）' : ''), recorder: actorNow() });
    closeModal(); render(); toast('已记服药（漏服只记事实）', { back: true });
  },
  'save-q'() {
    const q = $('#f-q')?.value?.trim();
    if (!q) { toast('先写想问什么'); return; }
    questions().push({ id: uid('q'), text: q, asked: false, src: `手工添加 · ${TODAY}` });
    closeModal(); render(); toast('已存入问题清单', { back: true });
  },
  'save-mri'(el) {
    const d = $('#f-d')?.value, t = $('#f-t')?.value?.trim(), q = $('#f-q')?.value?.trim(), n = $('#f-n')?.value?.trim();
    if (!d || !q) { toast('日期与结论原文必填'); return; }
    const rec = { d, title: t || '本人登记', quote: q, next: n || '以医嘱为准' };
    added(el.dataset.kind === 'mri' ? 'mri' : 'visual').push(rec);
    added('reports').push({ d, kind: el.dataset.kind === 'mri' ? 'MRI 报告' : '视野检查', title: t || '本人登记', excerpt: q });
    closeModal(); render(); toast('已存档（报告原文照抄 +1）', { back: true });
  },
  'save-event'() {
    const d = $('#f-d')?.value, t = $('#f-t')?.value?.trim();
    if (!d || !t) { toast('日期与内容必填'); return; }
    added('events').push({ d, text: t + ($('#f-n')?.value ? ' · ' + $('#f-n').value : ''), recorder: actorNow() });
    closeModal(); render(); toast('已补入时间线', { back: true });
  },
  'save-se'() {
    const d = $('#f-d')?.value, t = $('#f-t')?.value?.trim();
    if (!d || !t) { toast('日期与表现必填'); return; }
    added('sideeffects').push({ d, text: t, recorder: actorNow() });
    closeModal(); render(); toast('已记入副作用日记（不归因）', { back: true });
  },
  'save-report'() {
    const d = $('#f-d')?.value, k = $('#f-k')?.value?.trim(), t = $('#f-t')?.value?.trim(), e = $('#f-e')?.value?.trim();
    if (!d || !e) { toast('日期与摘录必填'); return; }
    added('reports').push({ d, kind: k || '报告', title: t || '本人登记', excerpt: e });
    closeModal(); render(); toast('已登记报告原文', { back: true });
  },
  'save-cal'() {
    const d = $('#f-d')?.value, i = $('#f-i')?.value?.trim(), q = $('#f-q')?.value?.trim();
    if (!d || !i) { toast('日期与项目必填'); return; }
    profile().calendar.entries.push({ d, item: i, note: q ? '医嘱原文：' + q : '医嘱原文待补录', done: false, kind: 'lab' });
    closeModal(); render(); toast('已登记随访（按医嘱原文）', { back: true });
  },
  'save-doc'() {
    const n = $('#f-n')?.value?.trim();
    if (!n) { toast('先填文件名'); return; }
    profile().visit.documents.push({ id: uid('d'), name: n, kind: n.endsWith('.pdf') ? 'PDF' : '图片', size: '0.9 MB', status: '待核对' });
    closeModal(); render(); toast('已加入解析队列：到「资料库与核对」看候选', { back: true });
  }
};

/* ---------------- 事件 ---------------- */
document.addEventListener('click', (e) => {
  /* AI 协助协议链接：acromegaly:agent-draft —— 拦截导航，只填不发（IP8/IP9：示例按钮只填不发） */
  const link = e.target.closest('a[href^="acromegaly:agent-draft"]');
  if (link) {
    e.preventDefault();
    try {
      const u = new URL(link.getAttribute('href'));
      const prompt = u.searchParams.get('prompt') || '';
      state.agent.prompt = prompt;
      setAgent(true);
      toast('已填入提示词与当前病情上下文（待你发送，不会自动发出）');
    } catch { toast('协议链接解析失败（演示）'); }
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'cfg-tab') {
    $$('.cfg-tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b === el)));
    $$('.cfg-block[data-tab]').forEach((b) => { b.hidden = b.dataset.tab !== el.dataset.tab; });
    return;
  }
  if (el.dataset.action.startsWith('save-')) { const fn = SAVE[el.dataset.action]; if (fn) { fn(el); return; } }
  const fn = ACTIONS[a];
  if (fn) fn(el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'zoom') { state.zoom = Number(el.value); render(); }
  else if (['q-asked', 'mat-check', 'set-vis'].includes(el.dataset.action)) ACTIONS[el.dataset.action](el);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#dialog').open) closeModal();
});

/* 直达 hash：#page 或 #page/sub */
function applyHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!hash) return false;
  const [p, s] = hash.split('/');
  if (!RENDERERS[p]) return false;
  state.page = p;
  if (s && SUBPAGES[p] && SUBPAGES[p].some(([k]) => k === s)) state.sub[p] = s;
  return true;
}
(function boot() {
  $('#font-toggle').addEventListener('click', () => ACTIONS['font-toggle']());
  applyHash();
  render();
  document.body.setAttribute('data-booted', '1');
})();
window.addEventListener('hashchange', () => {
  if (!applyHash()) return;
  render();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
});
