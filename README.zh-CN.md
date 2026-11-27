# Visual Patch Verification Agent

[English](README.md) · **简体中文**

一个本地 UI 回归验收工具。使用官方修复前后的版本，在相同的操作预算内运行浏览器测试，记录哪个动作最先触发已确认的回归。

在上一轮的两张公开 Flatpickr 工单上，保留键盘步骤的策略在三步内命中 2/2，BM25 命中 1/2。两轮浏览器实测结果一致。这组结果覆盖同一个组件库的两张工单。

## 2026-11-27 · 两个组件库的四张新工单

四张工单此前均未实跑。本轮使用官方 npm 修复前后版本，每张各用两个独立的 Chrome 进程执行。每种策略预算三步，包含冒烟检查。**固定顺序命中 2/4，BM25 命中 3/4，键盘补位命中 4/4**。两轮结果一致，搜索阶段均读取零张参考截图。

| 工单 | 待测 → 修复版 | 固定顺序 | BM25 | 键盘补位 |
| --- | --- | ---: | ---: | ---: |
| [Flatpickr #1943](https://github.com/flatpickr/flatpickr/issues/1943) · 第二个范围输入框的方向键失效 | 4.6.1 → 4.6.13 | 第 3 步 | 未命中 | 第 3 步 |
| [Flatpickr #2342](https://github.com/flatpickr/flatpickr/issues/2342) · 首次输入小时后回到 12 点 | 4.6.6 → 4.6.9 | 未命中 | 第 2 步 | 第 2 步 |
| [Air Datepicker #654](https://github.com/t1m0n/air-datepicker/issues/654) · 清除后仍有范围高亮 | 3.5.3 → 3.6.0 | 未命中 | 第 2 步 | 第 2 步 |
| [Air Datepicker #631](https://github.com/t1m0n/air-datepicker/issues/631) · 日历隐藏时按 Esc 抛错 | 3.5.3 → 3.6.0 | 第 3 步 | 第 3 步 | 第 3 步 |

只有 #1943 在补位后更早找到回归。键盘检查进入最后一个动作名额。这批仍缺少「被挤掉的动作原本能命中」的真实反例。

[实验协议与完整证据](studies/ui-regressions-2026-11-27/) · [逐单 JSON](studies/ui-regressions-2026-11-27/unit-results.json) · [第一轮 HTML 报告](studies/ui-regressions-2026-11-27/runs/index.html) · [第二轮 HTML 报告](studies/ui-regressions-2026-11-27/runs/repeat-index.html)

### 在 Windows 上复跑四张新工单

安装 Node.js LTS（20 或以上）、Python 3.9 或以上，以及 Google Chrome。克隆仓库或下载仓库 ZIP 并解压，在仓库根目录打开 PowerShell。先离线校验并打开 macOS 归档报告，再联网安装锁定的 Playwright 并用本机 Chrome 实跑。

```powershell
Set-Location .\studies\ui-regressions-2026-11-27
py -3 .\replay.py offline
Start-Process .\runs\index.html

npm.cmd ci --ignore-scripts
$trial = ".\trial-all-$(Get-Date -Format yyyyMMdd-HHmmss-fff)"
py -3 .\replay.py live all $trial
if ($LASTEXITCODE -eq 0) {
    Start-Process (Join-Path $trial 'index.html')
}
```

将 `all` 换成 `1943`、`2342`、`654` 或 `631` 可单独复跑。如果系统找不到 `py`，可用 `python` 并先确认版本。命令确认预期回归并生成总览后返回 `0`。每张工单的底层 CLI 返回 `1` 表示确认回归。

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
