-- 0001_initial.sql · ACM（肢端肥大症）工作台初始迁移（G3 冻结候选 · 2026-10-25）
-- 来源：家族四契约骨架（原创 ACM 版）+ family-landscape §6 页面树 + T1–T7 红线。
-- 冻结规则：sha256 记入 schema/freeze-contract.md；结构变更只能新增 000N_*.sql。
-- ACM 红线：T1 无 control_status/diagnosis 类判读列（生化状态只引用原文）；T2 GH/IGF-1 走 metric_point，
--   随机 GH 与 OGTT 谷值用 specimen_kind 区分不混；T3 用药周期版本链；T4 激素替代多药并列+漏服事实；
--   T5 合并症分节（section 表+*_title），分类数据不进生化趋势（读模型约束）；T6 双主体 recorder 贯穿；
--   T7 随访节奏条目只存医嘱原文，无 interval 推算列。

-- ═══ 档案级（2）═══
CREATE TABLE workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data_root TEXT,
  schema_version TEXT NOT NULL,
  dataset_state TEXT
);
CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  primary_role TEXT CHECK (primary_role IN ('PATIENT','CAREGIVER')),
  cognitive_flag TEXT CHECK (cognitive_flag IN ('stable','changed')),
  created_at TEXT NOT NULL
);

-- ═══ 指标（3；GH/IGF-1/随机GH/OGTT谷值/糖代谢走 metric_def+metric_point）═══
CREATE TABLE metric_def (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  unit TEXT,
  category TEXT NOT NULL,                   -- 'biochemistry' | 'glycemic' | 'cardio' | 'bone'（趋势只取 biochemistry）
  color TEXT,
  is_numeric INTEGER NOT NULL DEFAULT 1,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE metric_point (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  code TEXT NOT NULL REFERENCES metric_def(code),
  measured_at TEXT NOT NULL,
  value_num REAL,
  value_text TEXT,
  unit TEXT,                                -- 单位随附（ng/mL 与 μg/L 混现语境）
  ref_range_text TEXT,                      -- 报告参考范围原文（含年龄性别语境）
  specimen_kind TEXT CHECK (specimen_kind IN ('RANDOM','OGTT_NADIR','FASTING','ROUTINE')),
  source_note TEXT,                         -- 报告原句引用
  author_role TEXT CHECK (author_role IN ('PATIENT','CAREGIVER')),
  in_use INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE lab_result (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  panel TEXT,
  ref_range TEXT,
  document_id INTEGER
);

-- ═══ 通用（6）═══
CREATE TABLE symptom_log (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  symptom TEXT NOT NULL,
  severity_text TEXT,
  author_role TEXT NOT NULL CHECK (author_role IN ('PATIENT','CAREGIVER')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE question (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact','view')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  asked_on TEXT,
  from_scenario TEXT,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE task (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_on TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE document (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parsed','parse_failed')),
  imported_at TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE saved_trial (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  trial_key TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
CREATE TABLE visit_summary (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  range_from TEXT, range_to TEXT,
  body TEXT NOT NULL,                       -- 已确认记录汇总（勾选产物）
  author_role TEXT CHECK (author_role IN ('PATIENT','CAREGIVER')),
  ord INTEGER NOT NULL DEFAULT 0
);

-- ═══ ACM 专属（11）═══
-- T1：生化状态只引用（无 control_status 列）；确诊/手术档案原文
CREATE TABLE diagnosis_record (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  confirmed_on TEXT,
  basis_text TEXT,                          -- 确诊依据原文（GH/IGF-1+影像，报告语言照抄）
  guideline_ref TEXT,                       -- 底本引用（指南名+版本号）
  report_doc_id INTEGER,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE pituitary_surgery (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  surgery_date TEXT NOT NULL,
  approach_text TEXT,                       -- 入路原文（经蝶窦等，照抄报告）
  scope_text TEXT,
  hospital TEXT,
  pathology_summary TEXT,
  report_doc_id INTEGER,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE radiotherapy_event (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  kind_text TEXT,                           -- 放疗方式原文
  plan_note TEXT,                           -- 医嘱/计划原文（随访间隔不抄录）
  report_doc_id INTEGER,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
-- T3：药物/注射周期（版本链）+ 实际用药事件（含副作用日记）
CREATE TABLE medication_regimen (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  drug_class TEXT CHECK (drug_class IN ('SSA','DA_AGONIST','GH_ANTAGONIST','OTHER')),
  route TEXT CHECK (route IN ('INJECTION','ORAL')),
  dose_text TEXT NOT NULL,                  -- 剂量照医嘱原文
  cycle_days INTEGER,                       -- 周期天数（仅登记事实，如 28）
  start_date TEXT NOT NULL,
  end_date TEXT,
  prescriber_note TEXT,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE medication_event (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  regimen_id INTEGER REFERENCES medication_regimen(id),
  event_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TAKEN','INJECTED','MISSED','REACTION')),
  dose_text TEXT,
  reaction_note TEXT,                       -- 副作用日记（患者语言）
  author_role TEXT NOT NULL CHECK (author_role IN ('PATIENT','CAREGIVER')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  ord INTEGER NOT NULL DEFAULT 0
);
-- T4：激素替代多药并列（剂量版本链 + 漏服事实；零调整建议）
CREATE TABLE hormone_replacement (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  hormone TEXT NOT NULL,                    -- 氢化可的松/左甲状腺素/去氨加压素/性激素…
  drug_name TEXT,
  dose_text TEXT NOT NULL,                  -- 医嘱原文
  schedule_text TEXT,                       -- 服药时点原文（早8点顿服等）
  start_date TEXT NOT NULL,
  end_date TEXT,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE hormone_intake_log (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  replacement_id INTEGER REFERENCES hormone_replacement(id),
  log_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TAKEN','MISSED')),
  author_role TEXT NOT NULL CHECK (author_role IN ('PATIENT','CAREGIVER')),
  ord INTEGER NOT NULL DEFAULT 0
);
-- 影像与视野（无判读列；术语原文）
CREATE TABLE imaging_report (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('MRI','VISUAL_FIELD','OTHER')),
  findings_text TEXT,                       -- 报告术语原文（"鞍区术后改变"等照抄）
  report_doc_id INTEGER,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
-- T5：合并症分节（事件/叙述记录；数值指标走 metric_point.category）
CREATE TABLE comorbidity_event (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('GLYCEMIC','CARDIO','SLEEP','BONE')),
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,                                -- 医生叙述/报告原文
  author_role TEXT CHECK (author_role IN ('PATIENT','CAREGIVER')),
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE comorbidity_section_title (
  section TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0
);
-- T7：随访节奏（只存医嘱原文+日期，无 interval 推算、无"该查了"判定）
CREATE TABLE followup_plan (
  id INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL,
  item TEXT NOT NULL,
  planned_on TEXT,
  order_text TEXT,                          -- 医嘱原文（"三个月后复查 GH/IGF-1"照抄）
  source_note TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1
);

-- ═══ 种子（分节标题；文案改动走 000N 迁移）═══
INSERT INTO comorbidity_section_title (section, title, ord) VALUES
  ('GLYCEMIC','糖代谢', 1),
  ('CARDIO','心血管', 2),
  ('SLEEP','睡眠呼吸暂停', 3),
  ('BONE','骨与关节', 4);
