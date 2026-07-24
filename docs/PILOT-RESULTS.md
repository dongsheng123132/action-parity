# Pilot Results: T-King, U-Model, and U-King

**Date:** 2026-07-25
**Scope:** AP-1/AP-2 implementation evidence, not AP-4 certification.

## Executive answer

ActionParity clearly improves testability and AI operability. It can also
improve development speed after an application has more than one interface or a
frequently changing action. It does not make the first implementation smaller:
both pilots added manifests, adapters, and contract tests. The payoff is that
future validation, defaults, safety checks, and business behavior have one edit
site instead of one per interface.

```text
Before: business behavior × GUI/CLI/API/agent implementations
After:  one action core + thin GUI/CLI/API/agent adapters
```

That distinction matters. "More CLI" is not the advantage. **One canonical
action, discoverable through every declared surface, is the advantage.**

## What was implemented

| Pilot | Stack | Actions | Declared bindings | Implementation commit |
|---|---|---:|---:|---|
| T-King 0.2.1 | Tauri + React + Rust | 3 | 9/9 | `78efde0` |
| U-Model 1.0.0 | stdlib Python + Web Components | 2 | 6/6 | `653c5f5` |
| U-King 0.9.67 | Tauri + React + Rust | 3 | 6/6 | `28d901f` |

T-King actions:

- `engine.install`
- `project.decompose`
- `project.render`

U-Model actions:

- `hardware.inspect`
- `model.recommend`

U-King actions:

- `environment.inspect`
- `tool.list`
- `driver.status`

Both keep their existing GUI and legacy CLI. Both add `action
list/describe/manifest/run`, stable JSON envelopes, validation before side
effects, stable GUI `data-action-id` selectors, and executable manifests.

U-King keeps its existing GUI and `--selfcheck` path while adding the same
generic action CLI and selectors. Its first production slice is deliberately
read-only.

## Measured evidence

### T-King

- Existing active development was committed before the pilot.
- Pilot change: 9 files, 1,011 insertions, 12 deletions.
- Rust tests: 10 passed.
- React/TypeScript production build: passed.
- Debug executable smoke tests:
  - action discovery returned all three actions;
  - `project.render` returned its complete input/effect contract;
  - missing `project_id` failed before pipeline execution;
  - an external action without `--yes` was rejected before execution.
- Manifest report:
  - headless actions: 3/3;
  - required bindings: 9/9;
  - strict parity across desktop, generic CLI, and legacy CLI: 100%;
  - six honest warnings remain: long timeouts and no cancellation.

Live paid/external decompose and render runs were intentionally not triggered.
The implementation does not claim cancellation support that the pipeline lacks.

### U-Model

- Pilot change: 8 files, 587 insertions, 12 deletions.
- Full test suite: 53 passed in 22.64 seconds.
- New-file lint: passed.
- Manifest report:
  - headless actions: 2/2;
  - required bindings: 6/6;
  - strict parity across Web GUI, generic CLI, and legacy CLI: 100%;
  - warnings: zero.
- A real read-only invocation completed in 12,078 ms and returned:
  - Intel Core i9-12900H;
  - 63.8 GB RAM;
  - NVIDIA RTX 3060 Laptop GPU;
  - two structured model recommendations from a 52-model catalogue.
- An unknown input field was rejected in 0 ms, before hardware detection.

These numbers are evidence of behavior, not a cross-project productivity
benchmark.

### U-King

- Work was isolated from the dirty production worktree on
  `codex/action-parity-production-pilot`.
- Pilot change: 9 files, 863 insertions, 17 deletions.
- Rust tests: 21 passed.
- Rust compile check and React/TypeScript production build: passed.
- Manifest report:
  - headless actions: 3/3;
  - required bindings: 6/6;
  - strict parity across desktop and generic CLI: 100%;
  - errors and warnings: zero.
- Real debug executable timings:
  - `environment.inspect`: 987 ms;
  - `driver.status`: 38 ms;
  - `tool.list`: 6,629 ms.
- Real release executable validation:
  - action discovery returned parseable JSON with exit code 0;
  - environment inspection returned parseable JSON in 816 ms;
  - unknown input failed in 0 ms with `invalid_input` and exit code 2;
  - stdout contained results only and stderr was empty.
- The planned provider-list action was rejected during implementation because
  custom records may contain stored API keys. `driver.status` provides the
  useful state without exposing credentials.

No version was bumped and no executable was packaged, signed, deployed, or
served to customers.

## Advantages demonstrated

1. **Fast functional testing without pixels.** Contract and error-path tests run
   without opening a window, locating controls, or waiting for animations.
2. **Reliable AI operation.** Agents discover action IDs, schemas, effects, and
   timeouts instead of guessing from screenshots or documentation prose.
3. **Compatibility without rewrite.** Existing GUI calls, HTTP endpoints, and
   legacy flags remain; they become adapters to the shared action.
4. **Earlier and safer failure.** Unknown fields, missing values, and missing
   confirmation fail before downloads, AI calls, writes, or hardware probes.
5. **Less behavioral drift.** Defaults and validation move out of per-interface
   wrappers into one typed action entry.
6. **Better bug localization.** A failing core test means business behavior; a
   passing core test plus failing GUI journey means binding, accessibility, or
   presentation.
7. **Accessibility and automation reinforce each other.** Stable semantic
   selectors and accessible labels help both assistive technology and UI tests.
8. **Cheaper future surfaces.** MCP, REST, scheduled automation, or remote
   support can adapt the action registry instead of reimplementing the product.
9. **Machine-auditable gaps.** The T-King validator exposed missing cancellation
   and risky long timeouts instead of allowing optimistic documentation.
10. **A safer disclosure boundary.** U-King inspection caught a credential leak
    that a mechanical “make every GUI call a CLI” conversion would have created.

## Does development become faster?

**Usually after the second surface or the first important behavior change.**

The initial retrofit has a real cost. The two pilots increased net lines because
they added machine-readable contracts, CLI boundaries, documentation, and tests.
ActionParity pays back when:

- the same action exists in GUI plus CLI/API/MCP;
- validation/default/error behavior changes;
- regressions are frequent or GUI tests are slow;
- remote support or CI needs reliable headless control;
- multiple teams own different interfaces.

It may not pay back for a tiny single-interface utility with stable behavior.
The standard should therefore be adopted action-by-action, starting with
high-value domain actions, not applied to every button.

The U-Model pilot also shows an important nuance: a project that already has
shared domain functions needs little business refactoring. Its primary gain is
discovery, structured output, contract validation, and compatibility. T-King
needed more adapter consolidation because defaults and result formatting had
already begun to drift.

## What is not proved yet

- no long-term cycle-time or defect-rate benchmark;
- no AP-4 real GUI journey report;
- no U-King customer release or clean-machine UI journey;
- no live paid T-King render/decompose equivalence run;
- no cross-vendor implementation;
- no reusable installer-quality adapter packages yet;
- no evidence that the name or certification mark has market recognition.

The next useful work is not to retrofit the largest application immediately.
It is to extract small Python and Tauri adapter kits, add CI conformance fixtures,
then run one external project and one AP-4 Windows GUI journey.
