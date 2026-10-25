# schema 冻结合同 · ACM（肢端肥大症）· G3 · 2026-10-25

- 文件：`0001_initial.sql`（22 表：档案级 2 + 指标 3 + 通用 6 + ACM 专属 11）
- sha256：`2770a97b283cf9ba424059d29c04a4940019e5807ac4be91132baa10bce98974`
- 结构变更只允许新增 `000N_*.sql`，本文件哈希不得变动；若变动即冻结破坏，须评审留痕。

## 冻结断言（实测 2026-10-25，node:sqlite 内存加载）

1. **判读列断言**：全表全列扫描 `/diagnosis|risk_level|control_status|normal_flag|verdict/i` → **0 命中**（生化控制状态只引用原文，无判定列）。
2. 语法：`DatabaseSync.exec` 全量执行通过。
3. T1–T7 落点：metric_point.specimen_kind 区分 RANDOM/OGTT_NADIR（T2）；medication_regimen 版本链 + medication_event（T3）；hormone_replacement/hormone_intake_log（T4）；comorbidity_event.section + comorbidity_section_title 分节（T5）；author_role 贯穿可写表（T6）；followup_plan.order_text 只存医嘱原文（T7）。

## G3 留痕

- G3 请求签认：2026-10-25（AskUserQuestion）；用户未答 → 按推荐冻结；**同日用户补签认 ✅，冻结正式生效**。
