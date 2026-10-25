# research/acromegaly · 肢端肥大症 2026 临床试验数据包

> 采集：unified-trial-mcp（MCP stdio 唯一入口）；脚本 `scripts/fetch-acromegaly-trials-2026.mjs`（--dry-run 支持）。

## 首轮终态（快照 2026-10-25）

| 来源 | 终态 |
| --- | --- |
| ctv（ClinicalTrials.gov 本地索引） | SUCCESS 10 条（英文词命中：acromegaly 3 + growth hormone excess 7） |
| chinadrugtrials（CDE） | DENIED（会话/风控拒绝，未查过） |
| chictr_online / ictrp | FAILED（未查过） |
| xyb_chinadrugtrials_archive | NO_RESULTS（离线档案无命中） |
| chictr_pancreatic_archive | NEEDS_SETUP（仅胰腺癌语料，不适用 ACM） |

**纪律**：FAILED/DENIED 不算"已查过"、不计覆盖；中文词 0 条（CDE/ChiCTR 通道未过，待下次重试）；登记状态一律"登记状态，未核实"。manifest=jsonl=sqlite（实测 10=10=10）。
