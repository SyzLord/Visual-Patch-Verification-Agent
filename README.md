# Visual-Patch-Verification-Agent
Detects UI regressions by testing official before-and-after releases within a fixed interaction budget.

The agent ranks candidate interactions and records the first action that exposes a confirmed functional regression. Its latest study compares BM25 with a keyboard-aware route on two published Flatpickr issues. Within the same three-step budget, the route found both regressions and BM25 found one. Both browser runs agreed. This result covers two issues in one library.

## 项目简介

Visual Patch Verification Agent 是一个本地 UI 回归验收工具。它在相同的操作预算内测试官方修复前后的版本，为操作排序，并记录首次触发已确认回归的步骤。你可以用 JSON 配置工单、本地构建、操作及断言，验收后在 HTML 报告里查看双版本的行为差异、截图和复核结果。

在两张 Flatpickr 工单上，保留键盘步骤的策略在三步内命中 2/2，BM25 命中 1/2。两轮浏览器实测结果一致。这组数据来自同一个组件库。

[Windows 中文运行指南](config-cli/README.md#windows-powershell)

## Windows quick start

Install Node.js LTS (20+) and Google Chrome. Open PowerShell at the repository root, change into `config-cli`, and install the pinned dependencies.

```powershell
Set-Location .\config-cli
npm.cmd ci --ignore-scripts
npm.cmd test
```

Follow the [Windows PowerShell guide](config-cli/README.md#windows-powershell) to run both cases and open the reports. Exit code `1` is expected for these samples because the CLI confirms a known regression.

## Configurable browser verification

The [config-driven CLI](config-cli/README.md) accepts pinned local builds, a fixture, a menu of interactions, and explicit assertions. Its report includes before-and-after screenshots, the exact observed state, and the step at which each routing policy found the regression.

```sh
cd config-cli
node cli.cjs validate examples/2376.json
node cli.cjs plan examples/2376.json
node cli.cjs verify runs/2376
npm test
```

Both migrated cases ran in Chrome. The current adapter covers Flatpickr. Adding another component requires a fixture and an adapter that exposes the relevant state, along with passing and failing release pairs.

[Example case configuration](config-cli/examples/2376.json) · [Saved results and screenshots](config-cli/runs/index.html)

## Replay

Run the offline verification from the repository root with Python 3 and Node.js.

```sh
python3 work/vpa-keyboard-2026-11-25/reproduce.py offline
```

[Results, browser setup, and live replay commands](work/vpa-keyboard-2026-11-25/进度表.md)
