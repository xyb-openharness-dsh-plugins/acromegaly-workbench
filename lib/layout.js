/* 面板布局参数（小肢宝 LimbPal · 肢端肥大症工作台）。
 *
 * DSH 分栏合同的唯一入参来源：客户端 register（src/client.js 经 scripts/build-client.mjs
 * 注入）、宿主契约自查（scripts/check-host-contract.mjs）与包级检查都读它。
 * 别处不许再写一份 0.65（也别写它的补数 0.35）。
 *
 * 形态：customFrame=true。标准分栏下宿主不提供 AI 按钮位与拖宽接口（家族 2026-10-21
 * 实机反馈，见 cervical-workbench lib/layout.js 顶部记录），customFrame 下宿主把原生
 * 会话节点作为 conversation prop 交给我们排版：顶栏 AI 按钮、splitter 拖动/键盘调整、
 * 收起重开、宽度记忆都由工作台自绘的 iframe 外壳实现。
 *
 * 取值理由：
 * 1. businessSide=left：业务区在左、原生会话在右，与 prototypes/v0.2 的信息层级一致；
 * 2. businessWidth=0.65：v0.2 原型的 10 线 22 页签是在 1440×65% ≈ 936px 的宽度下
 *    排版的（docs/30-RESPONSIVE-RULES.md 的窄/宽断点也按这个标定）；
 * 3. AI 会话宽度区间 25%–45%：同 docs/30 的「30 号窄宽」档位（narrowBelow 以下改覆盖式抽屉）。
 */

/** 宿主面板参数（register 时逐字使用；宿主强校验 businessWidth ∈ 0.25–0.7）。 */
export const PANEL = Object.freeze({
  businessSide: 'left',
  businessWidth: 0.65,
  customFrame: true,
});

/** 宿主允许的 businessWidth 区间（宿主 client.js 强校验，越界直接抛错）。 */
export const HOST_LIMITS = Object.freeze({ min: 0.25, max: 0.7 });

/** AI 会话面板宽度档位（比例）。step 是给人看的像素档位说明，ratioStep 才参与计算。 */
export const AGENT_PANE = Object.freeze({
  def: 0.35,
  default: 0.35,
  min: 0.25,
  max: 0.45,
  step: 24,
  ratioStep: 0.02,
  narrowBelowPx: 760,
  drawerMaxPx: 420,
  presets: Object.freeze({ narrow: 0.25, std: 0.35, wide: 0.45 }),
});

/** 把比例夹到 AGENT_PANE 区间；非数字一律回默认值。 */
export function clampAgentRatio(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r)) return AGENT_PANE.def;
  return Math.min(AGENT_PANE.max, Math.max(AGENT_PANE.min, r));
}

/** 业务区像素宽度：宿主给的比例 × 窗口宽度。1440 → 936。 */
export function businessPanePx(windowWidth, width = PANEL.businessWidth) {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) throw new TypeError('windowWidth 必须是正数');
  const ratio = width === undefined ? PANEL.businessWidth : width;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new TypeError('width 必须是正数');
  return Math.round(windowWidth * ratio);
}

/** 自检：返回问题清单，空数组表示合法。只查宿主真正会校验的那几项。 */
export function assertPanelConfig(config = PANEL, agent = AGENT_PANE) {
  const problems = [];
  if (!config || typeof config !== 'object') return ['面板配置必须是对象'];

  if (!['left', 'right'].includes(config.businessSide)) {
    problems.push(`businessSide 只能是 left/right，当前 ${config.businessSide}`);
  }
  if (typeof config.customFrame !== 'boolean') {
    problems.push(`customFrame 必须是布尔值，当前 ${config.customFrame}`);
  }

  const w = config.businessWidth;
  if (!(typeof w === 'number' && Number.isFinite(w) && w >= HOST_LIMITS.min && w <= HOST_LIMITS.max)) {
    problems.push(`businessWidth 必须在 ${HOST_LIMITS.min}–${HOST_LIMITS.max} 之间，当前 ${w}`);
  } else if (w === HOST_LIMITS.max) {
    problems.push('businessWidth 不得取上限 0.7：贴到上限会把会话区压到 0.3 以下，本项目不这么做');
  }

  if (agent && typeof agent === 'object') {
    const { def, min, max, ratioStep } = agent;
    for (const [name, value] of Object.entries({ def, min, max, ratioStep })) {
      if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
        problems.push(`AGENT_PANE.${name} 必须是正数，当前 ${value}`);
      }
    }
    if (typeof min === 'number' && typeof max === 'number' && min >= max) {
      problems.push(`AGENT_PANE.min(${min}) 必须小于 max(${max})`);
    }
    if (typeof def === 'number' && typeof min === 'number' && typeof max === 'number' && (def < min || def > max)) {
      problems.push(`AGENT_PANE.def(${def}) 必须落在 ${min}–${max} 区间内`);
    }
    if (typeof max === 'number' && max > HOST_LIMITS.max) {
      problems.push(`AGENT_PANE.max(${max}) 不得大于宿主上限 ${HOST_LIMITS.max}`);
    }
  }
  return problems;
}
