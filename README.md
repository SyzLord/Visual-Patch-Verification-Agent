# Visual-Patch-Verification-Agent
Detects UI regressions by testing official before-and-after releases within a fixed interaction budget.

The agent ranks candidate interactions and records the first action that exposes a confirmed functional regression. Its latest study compares BM25 with a keyboard-aware route on two published Flatpickr issues. Within the same three-step budget, the route found both regressions and BM25 found one. Both browser runs agreed. This result covers two issues in one library.

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
