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

## 0.2.1 — 2026-10-25

用户授权变更（2026-10-25 原话："AI协助：改为把内容发到AI对话窗口去，开启AI互动"）：AI 协助按钮从"只填草稿"改为**直接发送到 AI 对话窗口、开启互动**。

- 修复连带缺陷：0.2.0 的 public/app.js 从未向壳层 postMessage——开发版 AI 按钮实际连不到原生会话（V3 走查本会暴露）。
- src/client.js：fillDraft 支持自动发送（仅 plain 相、草稿非空时 `input.submit()`；失败则草稿保留待手动回车）；pendingDraft 队列携带 send 标志，composer 未就绪时暂存、就绪后自动发送。
- prototypes/v0.2/app.js（唯一源，public 同步再生成）：嵌入式形态点击协议链接 → `postMessage(acromegaly:agent-draft, send:true)` 直接发送；file:// 独立形态进演示面板。
- IP8/IP9 修订：仍不代替患者发言、AI 回复是候选（核对采纳、拒收零副作用）——变化仅是"预写提示词+上下文从待发送变为直接发送"。
- 版本簿记：VERSION/package.json/lib/version.js/public ver-chip 四处 0.2.1 同源。

## 0.2.2 — 2026-10-25

- 接入脚手架 34 号「AI 协助一键发送契约」：新增 scripts/check-agent-draft-bridge.mjs 对穿断言器（页面 postMessage ↔ 壳层监听 ↔ 双守卫提交），进 npm run check 链（实测 ✓）。契约本体见 starter docs/34-AGENT-DRAFT-SEND.md。
