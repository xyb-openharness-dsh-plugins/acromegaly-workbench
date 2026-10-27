# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.2.5 — 2026-10-27

36 号 v2 补齐（指南可点+状态卡）。数据层、读模型、服务端接口不变。

- 模式层：`primer.js` / `primer.css` 用 starter `assets/patterns/disease-primer.js/.css`（2026-10-27 版）覆盖同步；来源栏与「原件」列支持可点链接，缺链接时渲染红色「缺链接，违反 36 号 §2.5」。
- 指南原件可点（§2.5）：evidence 表 3 行「原件」列由纯文字改为 `{text, url}`；4 段共 9 处 `sources` 补齐 `secondaryUrl`。3 个链接均用真浏览器逐条验活：gov.cn 官方发布页、医脉通指南页、DOI 题录页（12/12 断言通过）。未取得原件的行照实写 note，未编 URL。
- 看板状态卡（§2.6）：首卡补齐四件——卡头「D+586 状态卡 · 距下次注射 10 天」（锚点 2025-03-18 经蝶手术，天数由锚点日派生、不手填）、大字「第 586 天」、现状行（阶段原文 + 状态 + 下次 2026-11-04 SSA 长效针）、出口按钮排（主按钮进「治疗与注射」；副按钮「疾病概要：肢端肥大症是什么？」打开浮窗）。无锚点时显示「待初始化」并指向设置。
- 验收：`probe-disease-primer` 9/9 PASS；`check-primer-links` 12/12；`npm run check` 退出码 0（45/45 用例）。链检查器已进 check 链末尾。
- 构建修复：`scripts/build-public.mjs` 产出清单纳入 `primer.css` / `primer-data.js` / `primer.js`（与 `public/index.html` 相对引用同名，`--check` 一并校验）。重构建后 `public/` 七文件齐全，真实开发版服务下三件套均 200，probe 对构建产物 9/9 PASS，顶栏「?」在开发版可打开浮窗。

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

## 0.2.3 — 2026-10-25

- 修复 0.2.2 打包时 lib/client.js 与 src/client.js 不同步（check "--check" 模式未拦住的旧产物）；重建后 check 全绿。断言器与契约无行为变化。

## 0.2.4 — 2026-10-25

用户真机反馈（截图）：右侧"AI 协助·演示"面板是原型演示残留，嵌入式形态不需要。
- 修订 34 号：**演示面板只存在于独立打开（file://）形态**；嵌入式（壳层 iframe）下业务页自有 AI 面板（toggle/splitter/pane）整体隐藏，原生会话是唯一 AI 面板，AI 按钮直接 postMessage 发送（0.2.1 行为不变）。
- prototypes/v0.2/app.js：EMBEDDED 探测 + renderAgent 早退 + agent-toggle 守卫；public 四件套同步再生成。
