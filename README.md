# Visual-Patch-Verification-Agent
Detects UI regressions by testing official before-and-after releases within a fixed interaction budget.

The agent ranks candidate interactions and records the first action that exposes a confirmed functional regression. Its latest study compares BM25 with a keyboard-aware route on two published Flatpickr issues. Within the same three-step budget, the route found both regressions and BM25 found one. Both browser runs agreed. This result covers two issues in one library.

## Replay

Run the offline verification from the repository root with Python 3 and Node.js.

```sh
python3 work/vpa-keyboard-2026-11-25/reproduce.py offline
```

[Results, browser setup, and live replay commands](work/vpa-keyboard-2026-11-25/进度表.md)
