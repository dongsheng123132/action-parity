# Reference Pilot Selection

**Assessment date:** 2026-07-25
**Decision:** T-King first, U-Model second, U-King production stage 1 complete, UU-Switch deferred.

The first reference implementation should prove ActionParity with the smallest
credible change, not start with the most commercially important application.

## Evidence from the three projects

The figures below exclude dependency, build, and distribution directories. They
are comparison aids rather than audited software metrics.

| Candidate | Observed source size | Existing machine path | Test isolation | Product/change risk | Decision |
|---|---:|---|---|---|---|
| T-King | 54 files / about 13,253 lines | `--selfcheck`, `--engine-test`, and `--station-test` already call pipeline modules | `TKING_TEST_HOME` | Medium; active development | First pilot |
| U-Model | Small stdlib Python service and build-free Web Components UI | `--recommend` already calls hardware detection and model scoring | Read-only first slice; 53 tests | Low; offline and portable | Second pilot |
| UU-Switch | 660 files / about 254,879 lines | Extensive Tauri command surface; no product CLI entry found in the inspection | Existing tests, but broad configuration state | Medium-high; large upstream-derived surface | Defer until adapters are packaged |
| U-King | 173 files / about 52,877 lines | `--selfcheck`, `--term-test`, and `--launch-test` cover only a small part of a very large GUI command surface | `UKING_TEST_HOME` | Highest; production users and release chain | Flagship after the pattern is proven |

The working trees also mattered. T-King's active development was committed first,
then the pilot was isolated on `codex/action-parity-pilot`. U-Model was also
isolated on its own branch, and its unrelated untracked `AGENTS.md` was preserved.
UU-Switch was clean, but its upstream-derived surface was too large for a fast
second experiment.

## Why T-King wins

T-King already has the architecture ActionParity wants:

- React/Tauri GUI commands are thin wrappers;
- domain work lives in Rust pipeline and engine modules;
- headless flags invoke those same modules;
- long-running operations already emit progress;
- outputs are structured JSON in test modes;
- test state can be redirected away from real user data.

It is not fully conforming yet. The GUI and CLI wrappers independently parse
inputs and format outputs, some CLI paths combine multiple actions, and some CLI
paths hard-code values that the GUI accepts from users. That is exactly the right
size of real problem for a reference implementation.

## First vertical slice

Start with three actions that already have the strongest shared-core evidence:

| Action ID | Current GUI binding | Current legacy CLI binding | Shared implementation |
|---|---|---|---|
| `engine.install` | Tauri `install_engine` | `--engine-test <id>` | `engines::installer::install_engine` |
| `project.decompose` | Tauri `decompose_run` | `--station-test decompose <project_id>` | `pipeline::station2_decompose::decompose` |
| `project.render` | Tauri `render_run` | `--station-test render <project_id> ...` | `pipeline::station4_render::render` |

The implemented reference manifest is
[examples/t-king/action-parity.json](../examples/t-king/action-parity.json).

## Code change shape

The implemented change shape was:

1. Add a small `actions` module with a registry, typed requests/results, and one
   executor per pilot Action ID.
2. Make both Tauri wrappers and CLI dispatch call that registry.
3. Add non-breaking generic commands:

   ```text
   t-king.exe action list --json
   t-king.exe action describe project.render --json
   t-king.exe action run project.render --input <file> --json --no-input
   t-king.exe action manifest --json
   ```

4. Keep `--engine-test` and `--station-test` as compatibility aliases.
5. Add stable GUI selectors that name the corresponding Action IDs.
6. Run every write path under `TKING_TEST_HOME` in conformance tests.

The legacy commands must not be removed just to make the architecture cleaner.
They become adapters to the new canonical registry.

## Acceptance evidence

The first pilot is complete when:

- the three Actions pass contract tests against their JSON Schemas;
- legacy CLI, generic CLI, and Tauri bindings resolve to the same Action IDs;
- at least one CLI invocation changes sandbox state that the open GUI observes;
- at least one GUI invocation produces the same structured result as CLI;
- the critical GUI controls have stable semantic selectors;
- a clean Windows machine reproduces the report;
- no test reads or writes real `~/.tking` state.

The current pilot completes the action registry, generic CLI, legacy adapters,
semantic selectors, unit tests, build checks, and manifest validation. Real GUI
journey automation and live external render/decompose equivalence remain AP-4
work and are not claimed as complete. See
[PILOT-RESULTS.md](PILOT-RESULTS.md).

## Current rollout

1. **U-Model (implemented):** proved the same pattern in a stdlib Python service
   and browser GUI with `hardware.inspect` and `model.recommend`.
2. **UU-Switch:** package a reusable Tauri adapter before attempting a
   high-value configuration slice such as
   `provider.list`, `provider.switch`, and `provider.test`.
3. **U-King (stage 1 implemented):** three production read actions now share
   one Rust action layer across GUI and generic CLI. Next add a redacted
   catalogue, one sandboxed write action, and Windows real-GUI verification.
4. **External application:** recruit one unrelated project. A standard validated
   only on related in-house Tauri applications is still a house convention, not
   an ecosystem standard.

T-King is the laboratory. U-King should become the flagship only after the
laboratory has removed the architectural uncertainty.
