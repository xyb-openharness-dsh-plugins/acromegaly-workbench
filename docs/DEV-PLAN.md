# DEV-PLAN · 小肢宝 LimbPal（肢端肥大症工作台）

按里程碑推进；每步完成前过 `npm run check`（含 host-contract 与单测）。需求与红线见 docs/DEV-REQUIREMENTS-2026-10-25.md，数据契约见 schema/0001_initial.sql（冻结）与 prototypes/v0.2/。

## M5 · 开发版移植（0.2.0 · 2026-10-25，已完成）

七步（全部实测）：

1. **数据层**：dsh/store.js（开库/迁移/更正链 revision）；demo/build-demo-data.mjs 把 prototypes/v0.2/demo-data.js（唯一数据源）落成 demo/demo-data.json + demo-data.sqlite。
2. **读模型**：dsh/readmodels.js（10 线各一读法；biochemistry 趋势只取 category='biochemistry'；comorbidity 按 section 分节；treatment 折叠卡对齐原型）+ dsh/demo.js 播种。
3. **路由与服务**：routes/server/index/settings/workbench/layout/export/parse/acmparse/mineru；apiBase 定稿 /api/acromegaly；4xx JSON 交界守卫；双形态回归；导出 private 过滤。
4. **客户端**：src/client.js → build-client → lib/client.js；public/ 由 build-public 从原型产出（逐字符对齐，仅版本串与数据层补丁）。
5. **MinerU 六部件**（docs/18-MINERU-PARSING.md v2）：mineru.js / settings.js / acmparse.js / parse.js / 设置接口 / 候选确认入事实层（FAILED 如实）。任务表 parse_job 因 0001 冻结未建，重试痕迹暂以 document 多行保留——偏离记录见 docs/LESSONS.md 待补。
6. **测试与红线**：test/ 六套 45 用例；scripts/check-wording.mjs 判定词零命中。
7. **宿主接线**：cordis.patch.yml config.root 已被 dsh/index.js 读取；package.json 0.2.0（files 含 dsh/lib/assets/public/demo/schema）；VERSION/CHANGELOG 同步。

## 待办（M6 候选）

- parse_job 任务表（需新增 0002 迁移，先过 schema 冻结流程）。
- 装机验证 V2（tgz 安装、Desktop 实机 UI 签认）与业务验证 V3。
- 界面三态（解析中/失败/成功）与重试入口接到 public/app.js 的资料库页。
