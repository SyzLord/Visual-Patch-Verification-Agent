# Visual Patch Agent · 本地配置式回归验收

把工单、发布版本、页面、动作和行为判据写进一个 JSON。CLI 校验输入，在本机 Chrome 执行修复版与待测版，再用相同预算分别执行固定顺序、BM25 和带键盘步骤的策略。每次运行输出一份可脱机打开的 HTML 和可独立校验的证据。此版本随附 Flatpickr 适配器和两张实际迁移的历史工单。

[Windows 测试手册](README.md#windows-powershell) · [已完成的验收总览](runs/index.html)

## Windows PowerShell

### 1. 准备环境

1. 安装 Windows 版 Node.js LTS（项目要求 20+），并安装 Google Chrome 稳定版。安装完成后重新打开 **PowerShell**。 [Node.js 下载](https://nodejs.org/en/download) · [Google Chrome 下载](https://www.google.com/chrome/)
2. 下载并解压整个工程 ZIP。进入同时包含 `cli.cjs`、`package.json` 和 `examples` 的目录。如果你从 GitHub 获取了整个仓库，在仓库根目录执行 `Set-Location .\work\vpa-config-cli-2026-11-25`。
3. 执行下面的命令。首次安装 Playwright 需要联网。运行使用本机 Chrome，两个样例的历史库文件已随工程提供。 [Playwright 关于本机 Chrome 的说明](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)

```powershell
Get-Location
Test-Path .\cli.cjs
node --version
npm.cmd --version
npm.cmd ci --ignore-scripts
npm.cmd test
```

`Test-Path` 应返回 `True`，项目测试应显示 7 项通过。这里显式使用 `npm.cmd`，可直接在 Windows PowerShell 中调用 npm。

### 2. 重新跑第一张工单

把下面这段粘贴到同一个 PowerShell 窗口。每次使用带时间戳的新目录，方便对比多次结果。

```powershell
node .\cli.cjs validate .\examples\2376.json
$out2376 = ".\trial-2376-$(Get-Date -Format yyyyMMdd-HHmmss-fff)"
node .\cli.cjs run .\examples\2376.json $out2376
$code2376 = $LASTEXITCODE
"Run exit code = $code2376"
node .\cli.cjs verify $out2376
if ($LASTEXITCODE -eq 0) {
    Start-Process -FilePath (Join-Path $out2376 'report.html')
}
```

`run` 的退出码 0 表示待测版通过验收，**1 表示确认了回归，两个内置样例预期返回 1**，2 表示配置错误或本轮无结论。`verify` 返回 0 表示报告和证据文件通过完整性校验。直接在终端运行时，请在下一条命令覆盖它之前读 `$LASTEXITCODE`。 [PowerShell 自动变量说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_automatic_variables#lastexitcode)

### 3. 跑第二张工单并打开总览

```powershell
$out1661 = ".\trial-1661-$(Get-Date -Format yyyyMMdd-HHmmss-fff)"
node .\cli.cjs run .\examples\1661.json $out1661
$code1661 = $LASTEXITCODE
"Run exit code = $code1661"
node .\cli.cjs verify $out1661
$index = ".\trial-index-$(Get-Date -Format yyyyMMdd-HHmmss-fff).html"
node .\cli.cjs index $index $out2376 $out1661
if ($LASTEXITCODE -eq 0) {
    Start-Process -FilePath $index
}
```

总览按工单列出首次命中步数。点击工单可展开参考版、待测版和失败复核的断言与截图。下面是已在 macOS 上复验的预期读数，Windows 的实际结果以你新生成的报告为准。

| 工单 | 固定顺序 | BM25 | 保留键盘步骤 |
| --- | ---: | ---: | ---: |
| #2376 | 第 3 步 | 三步未命中 | 第 3 步 |
| #1661 | 第 3 步 | 第 2 步 | 第 2 步 |

### Windows 常见问题

| 提示或现象 | 处理方式 |
| --- | --- |
| 找不到 `node` 或 `npm.cmd` | 安装 Node.js 后重新打开 PowerShell，再检查版本 |
| `Test-Path .\cli.cjs` 返回 `False` | 当前不在工程目录。进入含 `cli.cjs` 的解压目录，或者从仓库根进入 `work\vpa-config-cli-2026-11-25` |
| 找不到 `playwright` | 在工程目录执行 `npm.cmd ci --ignore-scripts`，确认安装过程成功结束 |
| 找不到 Chrome 或 Chrome 无法启动 | 从开始菜单确认 Google Chrome 能正常打开。CLI 使用 Chrome 通道。浏览器启动错误会写到该次运行的报告 |
| 提示 `SHA-256 不匹配` | 重新完整解压工程，或从 GitHub 获取原始文件。用例校验资源的原始字节，修改文件内容或换行会改变摘要 |
| 提示 `EEXIST` | 输出目录已经存在。换一个输出目录，或者重新执行生成时间戳的那一行 |
| 退出码为 2 | 打开本次目录的 `report.html` 查看失败项。如配置在浏览器启动前就被拒绝，查看终端中的错误 |

只想看现有结果时，可直接在资源管理器双击 `runs\index.html`。把 HTML 和同目录的 JSON、PNG 一起保留，报告才能显示完整证据。

## 复用上一轮工单的结果

Chrome 158.0.8127.37、Playwright 1.62.1。每单完整运行 6 项双版本检查，已知失败用新浏览器上下文复核一次。再独立运行三种搜索，每种最多三个场景，包含第一步冒烟。一次场景可包含多个手势。同预算对照中所有策略都运行了 0 个参考动作、读取 0 对参考截图。

| 工单与版本 | 固定顺序 | BM25 | 保留键盘步骤 | 触发读数 |
| --- | ---: | ---: | ---: | --- |
| #2376，4.6.9 → 4.6.10 | 第 3 步 | 未中 | 第 3 步 | 旧版光标 6 → 6 → 6，修复版 6 → 5 → 6 |
| #1661，4.5.4 → 4.5.5 | 第 3 步 | 第 2 步 | 第 2 步 | 两版都选中 16 日，修复版 Tab 到下一输入框，旧版回到前一输入框 |

三种策略在 #2376 都执行了 5 个手势。#1661 固定顺序执行 9 个，BM25 与键盘策略各执行 7 个。每张工单另有参考版、待测版和复核的前后两张截图供审计。#1661 在 JSON 中显式检查第五个手势后修复版焦点到下一输入框，以及旧版先落到页面 body、再回到前一输入框。这是对上一轮已归档路径的声明式表达。此轮验证的是两个已知工单的工程迁移和复验。

## 启动和校验

需要 Node.js 20 以上。本地浏览器运行还需要 Chrome 和 Playwright 1.62.1。使用 `npm ci --ignore-scripts` 按锁文件安装工程依赖，或以 `PLAYWRIGHT_PATH` 指向已有的 Playwright 模块。查看报告、校验归档或规划动作可直接使用随包提供的文件。

```sh
node cli.cjs validate examples/2376.json
node cli.cjs plan examples/2376.json
npm test

node cli.cjs run examples/2376.json ./trial-2376
node cli.cjs run examples/1661.json ./trial-1661
node cli.cjs verify ./trial-2376
node cli.cjs verify ./trial-1661
node cli.cjs index ./trial-index.html ./trial-2376 ./trial-1661
```

每次运行使用新输出目录。退出码 0 表示验收通过，1 表示已确认回归，2 表示输入无效、完整验收无结论或策略轨迹不一致。复跑这两个样例预期返回 1。索引链接到各工单的报告，移动报告时请保留截图与 JSON 的相对路径。HTML 的工单和修复链接仅用于人工查阅。

## 配置新工单

从 [#2376 配置](examples/2376.json) 或 [#1661 配置](examples/1661.json) 复制。配置资源路径相对于该 JSON 所在目录，所有 HTML、CSS 和两版 JS/CSS 必须是有 SHA-256 的本地文件。例子带有固定时间、相同窗口和两个输入观察目标。浏览器每次检查使用新的上下文，页面加载本地资源。

| 字段 | 用法 |
| --- | --- |
| `ticket` | 公共工单标题、上游链接及修复链接。排序读取原标题 |
| `builds` | `candidate` 为待测版，`reference` 为修复版。各给版本标签、JS 路径/摘要、CSS 路径/摘要 |
| `fixture` | 选择 `flatpickr` 适配器，提供本地 HTML、CSS、日期输入和一个用于观察焦点/文本光标的输入选择器以及 UTC 时钟 |
| `actions` | 第一个 ID 为 `ordinary`。每项有描述、场景初始化、步骤、必填的通过条件和可选的已知失败条件 |
| `scenario` | 指定允许的 Flatpickr 参数、开始是否打开、初始化动作。带选区的光标设置只用于初始化 |
| `steps` | 支持 `click`、`focus`、`fill`、`press`。点击可带精确文本，按键可指定目标或交给当前焦点 |
| `expect` 和 `failure` | 都以 `at`、`field`、`equals` 表达。0 为初始状态，正整数为动作中的手势编号，也可用 `last`。严格比较值，读数缺失属于执行异常 |
| `budget` 与 `keyboardAction` | 预算含冒烟。键盘动作是一个菜单 ID 或空值。预算至少三项、标题匹配键盘用语且该动作在预算之外时，键盘策略占用最后一步，前面的选择保持一致 |

完整验收要求修复版全部通过，待测版失败满足声明的签名，并在新页面再次出现。同版执行错误、共享失败或复现不稳定会给出无结论，搜索阶段出现意外轨迹也会显式标记。在搜索前写入原始配置与各策略的动作计划。每次搜索均实跑，搜索命中以完整验收和失败复核为依据。已确认回归和该策略是否在预算内找到它是两条独立记录。

## 文件清单

| 文件 | 职责 |
| --- | --- |
| [cli.cjs](cli.cjs) | 校验、规划、运行、证据复核与多工单报告入口 |
| [config.cjs](lib/config.cjs) | JSON 参数检查、文件范围和 SHA-256 校验 |
| [browser.cjs](lib/browser.cjs) | 本地 Playwright 驱动、有限的操作与 Flatpickr 状态读取 |
| [ranking.cjs](lib/ranking.cjs)、[bm25.cjs](lib/bm25.cjs) | 固定顺序和文本排序，键盘策略保留最后一步。BM25 沿用主工程公式 |
| [acceptance.cjs](lib/acceptance.cjs) | 断言、确认、状态判断、同预算的实际执行对照 |
| [evidence.cjs](lib/evidence.cjs)、[report.cjs](lib/report.cjs) | 保存并核对原配置、轨迹及截图，生成 HTML 总览和报告 |
| [2376.json](examples/2376.json)、[1661.json](examples/1661.json) | 两份可直接运行的迁移配置，分别测试光标与 Tab 焦点 |
| [container.html](examples/container.html)、[container.css](examples/container.css) | 两份配置共用的本地页面 |
| [release-lock.json](migration/source/release-lock.json) | 原版本来源与文件校验值。随包提供四个版本提取的 JS、CSS 和许可证 |
| [migrate.py](migration/migrate.py)、[2376 原输入](migration/source/2376-inputs.json)、[1661 原输入](migration/source/1661-inputs.json) | 可重新生成两份 JSON 的迁移入口和上轮存档 |
| [contract.test.cjs](test/contract.test.cjs)、[browser-report.cjs](test/browser-report.cjs) | 7 项回归测试和可选的本地浏览器报告验证 |
| [runs/index.html](runs/index.html) | 两个正式运行的统一报告入口 |

Node 回归测试覆盖迁移保真、预算不变、首选保留、无效配置、失败复核、执行偏差、证据损坏和报告转义。复算时也可脱机核对已有运行。

```sh
node cli.cjs verify runs/2376
node cli.cjs verify runs/1661
node test/browser-report.cjs runs ./new-report-check
```
