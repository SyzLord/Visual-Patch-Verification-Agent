# Visual-Patch-Verification-Agent

**English** · [简体中文](README.zh-CN.md)

Detects UI regressions by testing official before-and-after releases within a fixed interaction budget.

The agent ranks candidate interactions and records the first action that exposes a confirmed functional regression. An earlier study compares BM25 with a keyboard-aware route on two published Flatpickr issues. Within the same three-step budget, the route found both regressions and BM25 found one. Both browser runs agreed. This result covers two issues in one library.

## November 27, 2026 · Four new UI regressions

We verified four previously unrun issues across Flatpickr and Air Datepicker using official before-and-after npm builds. Each issue was run twice in separate Chrome processes. With a three-action budget, including the smoke check, **fixed order found 2/4, BM25 found 3/4, and keyboard-aware routing found 4/4**. The search policies used zero reference screenshots.

| Issue | Affected → fixed | Fixed order | BM25 | Keyboard-aware |
| --- | --- | ---: | ---: | ---: |
| [Flatpickr #1943](https://github.com/flatpickr/flatpickr/issues/1943) · arrow keys in the second range input | 4.6.1 → 4.6.13 | 3 | Miss | 3 |
| [Flatpickr #2342](https://github.com/flatpickr/flatpickr/issues/2342) · initial hour resets to 12 | 4.6.6 → 4.6.9 | Miss | 2 | 2 |
| [Air Datepicker #654](https://github.com/t1m0n/air-datepicker/issues/654) · Clear leaves range highlights | 3.5.3 → 3.6.0 | Miss | 2 | 2 |
| [Air Datepicker #631](https://github.com/t1m0n/air-datepicker/issues/631) · Escape throws with the picker hidden | 3.5.3 → 3.6.0 | 3 | 3 | 3 |

The numbers are first-hit steps. The policy improved only #1943, where it moved the keyboard check into the last available slot. This batch has no observed case where the displaced action would have caught the regression.

[Study protocol and evidence](studies/ui-regressions-2026-11-27/) · [Per-issue JSON](studies/ui-regressions-2026-11-27/unit-results.json) · [Round 1 HTML index](studies/ui-regressions-2026-11-27/runs/index.html) · [Round 2 HTML index](studies/ui-regressions-2026-11-27/runs/repeat-index.html)

### Replay the four issues on Windows

Install Node.js LTS (20+), Python 3.9+ with the Windows launcher, and Google Chrome. Clone or download the repository and open PowerShell at its root. The first two commands after entering the study folder verify and open the saved macOS browser evidence. Installing the pinned Playwright package needs an internet connection.

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

Replace `all` with `1943`, `2342`, `654`, or `631` to run a single issue. If `py` is unavailable, use `python` after checking its version. The replay wrapper returns `0` when it verifies the expected regressions and builds the index. The underlying CLI returns `1` for a confirmed regression.

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
