# 家族对比（family-landscape）· 肢端肥大症 · M1 实测

> 对比对象（均只读实测）：移植样板 cervical-workbench（prototypes/v0.2/app.js）、成熟基准 breast-cancer-workbench 0.12.0（prototypes/v0.3/app.js）、最近邻 thyroid-workbench（prototypes/v0.2/app.js，同垂体轴）、attr-workbench（prototypes/v0.2/app.js，非肿瘤心/神经双线）。
> 实测时间：2026-10-25。所有清单均从各仓原型 `const PAGES` / `const SUBPAGES` 字面量逐条抄录，可按下列路径核对。

## §6.1 基准（breast）一级导航完整清单

出处：`/Users/qinxiaoqiang/Downloads/breast-cancer-workbench/prototypes/v0.3/app.js` 第 33–37 行 `const PAGES`。共 8 条：

| # | id | 一级名称 | 副标题（同文件 SUBTITLES，第 46–55 行） |
|---|----|---------|------|
| 1 | dashboard | 看板 | 把眼前的事情理清楚… |
| 2 | records | 病情整理 | 原始材料有出处… |
| 3 | timeline | 病情一图秀 | 治疗、检查、症状与上肢变化… |
| 4 | clinical | 临床 | 看懂自己的治疗资料… |
| 5 | nutrition | 营养支持 | 从今天吃得怎么样开始… |
| 6 | mind | 心理支持 | 这里可以放下感受… |
| 7 | care | 全程与康复 | 治疗之外，也照顾手臂… |
| 8 | review | 收藏与回顾 | 重要的问题和结果… |

旁证：`/Users/qinxiaoqiang/Downloads/breast-cancer-workbench/docs/PARITY.md`、`docs/SPEC.md`（breast 仓内）描述同一八线结构；本节以原型实测为准。

## §6.2 基准（breast）二级清单（实测）

出处同文件第 38–45 行 `const SUBPAGES`，共 23 个二级页：

- records 病情整理：资料库 / 整理草稿 / 核对 / 病情档案 / 指标检测 / 病情汇总（5）
- clinical 临床：治疗历程 / 病理 · 分子档案 / 试验线索 / 资料对照 / 我的关注 / 数据来源（6）
- nutrition 营养支持：当下困扰 / 进食与体重 / 建议与回顾（3）
- mind 心理支持：当下感受 / 我的记录 / 支持资源 / 身体与亲密（4）
- care 全程与康复：近期安排 / 术后恢复 / 上肢与淋巴水肿 / 不适记录 / 就诊准备 / 长期生活（6）
- review 收藏与回顾：问题清单 / 已保留结果 / 报告与任务（3）
- dashboard / timeline 无二级页。

### 对照家族实测（用于重名率与拆并参考）

- cervical（`/Users/qinxiaoqiang/Downloads/cervical-workbench/prototypes/v0.2/app.js` 第 54–74 行）：一级 12 条：看板 / 病情整理 / 我的分期 / 治疗历程 / 性与生育 / 放疗与长期影响 / 检查与指标 / 病情一图秀 / 营养支持 / 心理支持 / 复诊准备 / 临床研究；二级 38 个。
- thyroid（`/Users/qinxiaoqiang/Downloads/thyroid-workbench/prototypes/v0.2/app.js` 第 47–64 行）：一级 11 条：看板 / 我的瘤与分层 / 手术与并发症 / 碘131 档案 / 随访与调药 / 妊娠与生育 / 病情一图秀 / 营养与生活 / 心理与家庭 / 复诊与资料；二级 31 个（followup 线最重，含 Tg·TgAb 趋势、剂量时间线、TSH 目标与甲功等 6 个）。
- attr（`/Users/qinxiaoqiang/Downloads/attr-workbench/prototypes/v0.2/app.js` 第 47–73 行）：一级 12 条：看板 / 病情整理 / 我的分型 / 治疗历程 / 心脏受累 / 神经与自主神经 / 检查与指标 / 病情一图秀 / 家族与遗传 / 生活与照护 / 复诊准备 / 临床研究；二级 39 个。

## §6.3 肢端肥大症结构提案

### 一级线提案（10 条）

围绕任务书给定的八个主题域，参照 thyroid 同为垂体轴、attr 同为非肿瘤慢病的结构经验：

| # | 提案一级 | 对应主题域 | 家族中同类线（参考） |
|---|---------|-----------|--------------------|
| 1 | 看板 | 看板 | 四仓同名起点（breast PAGES[0]） |
| 2 | 病情整理 | 资料入口 | breast records / attr records |
| 3 | 生化时间线 | GH·IGF-1 生化主线（本仓独有核心） | thyroid followup 的 Tg 趋势线升格 |
| 4 | 治疗与注射 | 治疗与注射 | attr treatment + thyroid 随访调药中的剂量线 |
| 5 | 激素替代档案 | 垂体功能减退替代（本仓独有） | 无同族对应（thyroid 仅 TSH 子页） |
| 6 | 影像与视野 | 影像与视野 | 无同族一级对应（家族均为二级影像页） |
| 7 | 合并症分节 | 心血管/糖代谢/睡眠呼吸/骨关节 | attr 心脏受累+神经线的器官分节模式 |
| 8 | 病情一图秀 | 总览时间线 | breast/cervical/attr/thyroid 四仓同名 |
| 9 | 随访日历 | 随访日历 | thyroid followup 的日历子页升格 |
| 10 | 复诊与资料 | 复诊与资料 | thyroid docs 一级同名 |

### 二级提案（33 个）

- 病情整理（5）：资料库 / 整理草稿与核对 / 病情档案 / 指标检测 / 病情汇总
- 生化时间线（4）：GH·IGF-1 曲线 / OGTT 抑制节点 / 检测口径与实验室 / 控制状态标签（缓解·活动·不确定）
- 治疗与注射（4）：手术与病理 / 药物方案（SSA·DA·GHRA）/ 注射日历与提醒 / 治疗调整史
- 激素替代档案（4）：替代用药一览 / 甲功线（LT4）/ 皮质醇线（氢化可的松）/ 性腺与 GH 替代
- 影像与视野（3）：MRI 影像记录 / 视野检查 / 报告原文
- 合并症分节（4）：心血管 / 糖代谢 / 睡眠呼吸暂停 / 骨关节与面容
- 病情一图秀（3）：数值曲线 / 事件与节点 / 数据口径
- 随访日历（3）：随访节奏 / 近期安排 / 检查计划
- 复诊与资料（3）：就诊准备与导出 / 问题清单 / 报告与任务

（看板不设二级，与四仓惯例一致。）

### 一级重名率实测（判据 ≤70%）

计算口径：提案一级名称与对方仓一级名称**完全相同**的条数 ÷ 提案一级数（10）。

| 对照仓 | 同名条目 | 重名率 | 判定 |
|-------|---------|--------|------|
| breast-cancer-workbench | 看板、病情整理、病情一图秀（3） | **3/10 = 30%** | 通过（≤70%） |
| thyroid-workbench | 看板、病情一图秀、复诊与资料（3） | **3/10 = 30%** | 通过 |
| attr-workbench | 看板、病情整理、病情一图秀（3） | **3/10 = 30%** | 通过 |

同名项均为家族公共骨架（看板 / 病情整理 / 病情一图秀 / 复诊与资料），疾病特异性线（生化时间线、激素替代档案、影像与视野、合并症分节、随访日历、治疗与注射）对三仓零重名。

## §6.4 G1 决策点（6 条）

1. **「生化时间线」独立一级 vs 并入「治疗与注射」**
   选项 A：独立一级（4 个二级）；B：作为治疗线的子页（仿 thyroid 把 Tg 趋势放在「随访与调药」下）。
   推荐 A——GH·IGF-1 是本仓核心主数据，且需与注射/剂量变化叠加对照；并入治疗线会复现 thyroid「followup 线 6 个二级过重」的问题（thyroid app.js 第 59 行可证）。
2. **「激素替代档案」一级 vs 降为二级顶格**
   选项 A：一级（4 个二级：甲功/皮质醇/性腺/GH 替代）；B：并入「治疗与注射」作顶格二级；C：并入合并症分节。
   推荐 A——术后垂体功能减退是肢端肥大症长期管理第二大主线，替代药与 SSA 注射需分开提醒；attr 把器官线（心脏受累）放一级的成功先例支持。
3. **「影像与视野」一级 vs 降级**
   选项 A：一级（MRI/视野/报告原文 3 个二级）；B：并入生化时间线或复诊与资料。
   推荐 A（弱）——视野变化是疾病活动性与占位效应的独立证据链；若 M1 原型工期紧可先 B 后升格，视野检查保留顶格二级。
4. **「随访日历」与「复诊与资料」是否合并**
   选项 A：分立两条（当前提案）；B：合并为「随访与复诊」一条（参照 thyroid 双线分立，或 breast「全程与康复」内含就诊准备的合并式）。
   推荐 A——随访日历承载生化复查节奏（OGTT、IGF-1 复测周期），复诊与资料承载资料整理，数据模型不同；合并会混日历态与文档态。
5. **「合并症分节」二级粒度**
   选项 A：4 个二级（心血管/糖代谢/睡眠呼吸/骨关节与面容）；B：扩为 6 个（加口腔咬合、结肠息肉）。
   推荐 A 起步、B 作为 M2 演进——attr 心脏线 4 个二级（心衰/心超/心律/血压）证明单器官 4 子页已接近信息密度上限。
6. **是否设「临床研究」一级**
   选项 A：不设，复诊与资料下加「试验线索」二级；B：设一级（3 二级，仿 attr/cervical trials）。
   推荐 A——肢端肥大症药物试验线索量级低于肿瘤仓，不足以撑一级；先以二级存在，M2 内容量大再升格。

## 数据出处汇总

- breast 一级/二级/副标题：`/Users/qinxiaoqiang/Downloads/breast-cancer-workbench/prototypes/v0.3/app.js`（PAGES 33–37 行，SUBPAGES 38–45 行，SUBTITLES 46–55 行）；版本 0.12.0 见仓内 `pinkypal-dsh-breast-cancer-workbench-0.12.0.tgz` 文件名与 `VERSION`。
- cervical 一级/二级：`/Users/qinxiaoqiang/Downloads/cervical-workbench/prototypes/v0.2/app.js`（54–74 行）
- thyroid 一级/二级：`/Users/qinxiaoqiang/Downloads/thyroid-workbench/prototypes/v0.2/app.js`（47–64 行）
- attr 一级/二级：`/Users/qinxiaoqiang/Downloads/attr-workbench/prototypes/v0.2/app.js`（47–73 行）
