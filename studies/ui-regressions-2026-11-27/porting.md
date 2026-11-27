# 最小移植清单

当前增量位于本地独立目录。下表路径中的目标均相对于公开仓库根目录。加入第二个适配器需要三个运行模块，排名器沿用原文件。现有两份配置使用同一输入格式。

| 本地文件 | 目标 | 用途 |
| --- | --- | --- |
| [参数校验](lib/config.cjs) | `config-cli/lib/config.cjs` | 增加 Air Datepicker 选项、可选范围插件和异常断言 |
| [浏览器适配器](lib/browser.cjs) | `config-cli/lib/browser.cjs` | 使用官方构建初始化控件，采集日期状态、范围格和页面错误 |
| [完整验收](lib/acceptance.cjs) | `config-cli/lib/acceptance.cjs` | 对声明且准确出现的单个异常执行失败复核，其他异常留作无结论 |
| [报告渲染](lib/report.cjs) | `config-cli/lib/report.cjs` | 将页面异常的名称、消息和堆栈显示在验收报告 |
| [#1943](examples/1943.json)、[#2342](examples/2342.json)、[#654](examples/654.json)、[#631](examples/631.json) | `config-cli/examples/` | 四张新工单。带入它们引用的六个发布版目录、对应 LICENSE 和链接的固定资源 |
| [测试](test/contract.test.cjs) | `config-cli/test/expanded.test.cjs` | 保留原测试，追加该批测试。档案校验用例随扩展证据包留存 |
| [工单与版本](cases.json)、[筛选](screening-ledger.json)、[协议](protocol.json) | 例如 `studies/2026-11-27/` | 保存公开出处、取样依据与版本锁 |

如果只移植代码和配置，扩展测试中读取档案的最后一个用例可随证据包一起使用。引用的片段来自未修改的官方发布包。Flatpickr 的 MIT 授权随 npm 归档提供。Air Datepicker 两个 npm 包标识为 MIT，相同的许可证取自各包的 `gitHead`。[3.5.3 许可证](https://github.com/t1m0n/air-datepicker/blob/d182c0a7e826b4e290f81e013ae808d6b49f81dc/LICENSE.md) · [3.6.0 许可证](https://github.com/t1m0n/air-datepicker/blob/7031158c6c89b8c95b229748d913aa82639e74e8/LICENSE.md)

移植时将快照与用例路径一并固定，并更新公开仓库中覆盖这些文件的 SHA-256 清单。用两个旧工单和四个新工单做回归验收，并分别验证 `npm test`、`node cli.cjs validate` 和证据校验入口。
