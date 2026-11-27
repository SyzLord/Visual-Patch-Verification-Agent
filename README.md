# Visual-Patch-Verification-Agent

**English** · [简体中文](README.zh-CN.md)

Detects UI regressions by testing official before-and-after releases within a fixed interaction budget.

The agent ranks candidate interactions and records the first action that exposes a confirmed functional regression. Its latest study compares BM25 with a keyboard-aware route on two published Flatpickr issues. Within the same three-step budget, the route found both regressions and BM25 found one. Both browser runs agreed. This result covers two issues in one library.

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

## November 2026 sample expansion

The [four-ticket study](studies/ui-regressions-2026-11-27/) covers Flatpickr and Air Datepicker. The official before-and-after builds were verified in two independent browser rounds. Within three steps, fixed order found 2/4 regressions, BM25 found 3/4, and the keyboard-aware policy found 4/4. The study includes new fixtures, both browser runs, an [HTML index](studies/ui-regressions-2026-11-27/runs/index.html), and replay commands.
