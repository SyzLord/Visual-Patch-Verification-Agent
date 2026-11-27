# Visual Patch Verification Agent

[English](README.md) · **简体中文**

一个本地 UI 回归验收工具。使用官方修复前后的版本，在相同的操作预算内运行浏览器测试，记录哪个动作最先触发已确认的回归。

在两张公开的 Flatpickr 工单上，保留键盘步骤的策略在三步内命中 2/2，BM25 命中 1/2。两轮浏览器实测结果一致。这组结果覆盖同一个组件库的两张工单。

## Windows 快速开始

安装 Node.js LTS（20 或以上）和 Google Chrome。打开 PowerShell，进入仓库根目录后执行以下命令。

```powershell
Set-Location .\config-cli
npm.cmd ci --ignore-scripts
npm.cmd test
```

要用本机 Chrome 实跑两张工单并打开报告，请按 PowerShell 手册操作。两个样例预期返回退出码 `1`，表示工具确认了已知回归。[Windows PowerShell 测试手册](config-cli/README.md#windows-powershell)

## 配置式浏览器验收

用 JSON 指定并锁定本地构建，配置页面、可执行操作和验收断言。报告包含修复前后的截图、逐步观测状态，以及各策略首次命中的步数。[CLI 与配置说明](config-cli/README.md)

```sh
cd config-cli
node cli.cjs validate examples/2376.json
node cli.cjs plan examples/2376.json
node cli.cjs verify runs/2376
npm test
```

两张迁移工单已在 Chrome 上实跑。目前的适配器支持 Flatpickr。添加新组件时，需要提供本地测试页面、能读取相关状态的适配器，以及可复现故障的修复前后版本。[配置样例](config-cli/examples/2376.json) · [已保存的报告与截图](config-cli/runs/index.html)

## 离线复算

在仓库根目录使用 Python 3 和 Node.js 运行以下命令。

```sh
python3 work/vpa-keyboard-2026-11-25/reproduce.py offline
```

[实测结果、浏览器设置与复跑命令](work/vpa-keyboard-2026-11-25/进度表.md)

## 2026 年 11 月独立工单扩展

[四张新工单的实验](studies/ui-regressions-2026-11-27/)覆盖 Flatpickr 和 Air Datepicker。两轮浏览器验收使用官方修复前后版本。三步内固定顺序命中 2/4，BM25 命中 3/4，键盘补位命中 4/4。新工单夹具、两轮实测、[HTML 报告](studies/ui-regressions-2026-11-27/runs/index.html)与复跑命令均已收录。
