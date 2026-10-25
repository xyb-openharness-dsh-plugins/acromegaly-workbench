# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 (1541b8a) 初始化，仅有注册骨架与健康接口，无业务功能。

## 0.2.0 — 2026-10-25

包版本 0.2.0（M5 开发版，数据仅在本机）。从 cervical-workbench v0.1.1 家族骨架移植服务/客户端/测试结构，病种内容全部为原创 ACM 版；视觉与数据唯一基准是 prototypes/v0.2 四件套（10 线 22 页签）。

- 数据层（dsh/store.js、dsh/demo.js、demo/build-demo-data.mjs）：sqlite 打开/迁移（schema/0001_initial.sql 冻结 22 表）、演示数据从 prototypes/v0.2/demo-data.js 落成 demo/demo-data.json + demo-data.sqlite；metric_point 更正链（旧行 in_use=0 + 新行 revision+1）。
- 读模型（dsh/readmodels.js）：10 线各一读法；生化趋势只取 category='biochemistry'（随机 GH 与 OGTT 谷值分列）；合并症按 section 分节（标题随 *_title 表）；治疗线 32 号折叠卡数据形状对齐原型；private 看法默认过滤（三出口口径）。
- 路由与服务（dsh/routes.js / server.js / index.js / settings.js / workbench.js / layout.js / export.js / parse.js / acmparse.js / mineru.js）：统一 apiBase=/api/acromegaly；交界守卫 4xx JSON；双形态（独立启动与宿主鉴权）共用一张路由表；导出 private 过滤并写明有意排除；MinerU 六部件（Token 文件优先 ~/.limbpal/secrets/mineru.json，FAILED 如实不产候选）。
- 客户端：src/client.js → scripts/build-client.mjs → lib/client.js（customFrame 自绘顶栏 + iframe 业务区 + AI 会话 25%–45%）；public/ 四件套由 scripts/build-public.mjs 从原型产出（style/demo-data 逐字符一致，index/app 仅版本串与数据层补丁：先连 /api/acromegaly/bootstrap，拿不到回退演示并横幅提醒）。
- 测试六套（store / demo-parity / server / client / import-export / pack-contents）45 用例全过；scripts/check-wording.mjs 判定词表（生化控制/结果正常异常/建议调整剂量/可以停药/该复查了等）零命中。
- 宿主接线：cordis.patch.yml 的 config.root 由 dsh/index.js 实际读取；package.json 0.2.0 + files 增补 public/demo/schema；VERSION=0.2.0。
