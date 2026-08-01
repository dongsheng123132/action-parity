# Changelog

All notable project changes will be documented here.

## 0.6.0 - Unreleased

This release starts the executable toolchain: registering an Action should be
less work than hand-maintaining its Shadows and Manifest.

- Add the Rust `action-parity-core` Registry with deterministic Manifest, CLI
  help, MCP tool, and Surface Binding generation from one Action descriptor.
- Add the thin `action-parity-tauri` adapter and a runnable notes registry
  example whose GUI, CLI, and MCP observations reach the same core execution
  envelope.
- Add `action-parity generate` for materializing registry bundles.
- Add `action-parity verify`, which reruns the generator, executes no-shell test
  commands with timeouts, requires per-Action/per-Surface execution
  observations, hashes artifacts and inputs, and emits a self-hashed report.
- Static validation now calls a test reference declared evidence. It no longer
  labels a non-empty string as proven or awards AP-2 without execution.
- Make the npm CLI packable by removing `private: true` and declaring the
  published file set. No registry publication is performed by this change.

## 0.5.0 - 2026-07-26

The standard had become a scoring system. `AP-1` through `AP-4` appeared 140
times in the repository; `shadow` appeared zero times in `SPEC.md`. The chapter
defining the architecture was 14 lines and the chapters defining the scoreboard
were 92, and three consecutive releases had been about scoring. This release
puts the architecture back in the middle and demotes the scoreboard to an
optional profile. See [docs/PROPOSAL-CORE-FIRST.zh-CN.md](docs/PROPOSAL-CORE-FIRST.zh-CN.md).

- **§2 states the two questions the standard exists to answer**, and both are
  binary: can a behavior be built once and have every interface follow from it,
  and can an agent discover, invoke, and assert it without pixels.
- **§5 is now the center of the specification.** It defines Core and Shadow,
  and states the four things a shadow must not contain: a second implementation,
  a policy decision that exists only there, an independent source of truth, or an
  action reachable only through it. Each is binary and each is located in code.
- **§5.3 covers generating shadows from the core** — the development half of the
  thesis, previously absent. Registering an Action once should produce its CLI,
  MCP tool, API route, manifest entry, and test scaffolding. Adding a behavior
  costs one implementation; adding a platform costs one shadow.
- **`Shadow` is a defined term** (§4.3.1) instead of a word that appeared only in
  the document about naming.
- **Levels and scores moved to [docs/AUDIT-PROFILE.md](docs/AUDIT-PROFILE.md)**,
  which opens by saying it is not the standard. Normative text no longer states
  requirements in terms of levels: headless execution and external reachability
  are required outright, not required "for AP-2".
- **The validator leads with violations.** `report.violations` and
  `report.unproven` are separate lists — a violation is fixed by moving code, an
  unproven claim by writing a test — and `report.shadows` names each shadow with
  its reachability and proof count. Percentages and levels moved under
  `report.audit` and print below a `-- audit profile (optional) --` divider.
  `report.conformance` is renamed to `report.audit`.
- The shadow list deliberately does **not** claim a shadow holds no behavior of
  its own. That is a property of code, and asserting it from a manifest would be
  the overclaim this validator exists to catch.
- `generated_from` may be declared and is reported, never verified: a validator
  cannot re-run a generator it does not have (case F2 remainder, closed as
  reported-not-scored).

## 0.4.0 - 2026-07-26

Closes case F5. §10.1 governed the Surfaces of one application, which is not
where drift happens: two products write the same configuration file and neither
manifest mentions the other.

- **`state.external_resources`** declares every truth source outside the
  application that its Actions read or write, with `access` and `exclusive`.
- **A shared written resource MUST declare `concurrency`** —
  `last-writer-wins`, `optimistic`, `advisory-lock`, or `exclusive-lock`.
  Omitting it is an error, because last-writer-wins is what silence already
  means and nobody chose it. Declaring it is permitted and warns, since the
  same policy is reasonable for scratch state and a data-loss defect for shared
  configuration.
- Reports list every shared resource, printing `NO CONCURRENCY POLICY` when
  absent.
- `docs/ADOPTION.md` states the measured cost structure: AP-1 is nearly pure
  addition, AP-2 spends its budget on the proving half, and proving reaches into
  code the team did not plan to reopen — twice over for a downstream fork.

## 0.3.0 - 2026-07-26

Closes case F1: the score now measures whether a machine can actually reach the
Action, not whether the manifest is filled in. Breaking for any manifest whose
only non-visual Surface is its own command bridge — which is the point.

- **Surfaces declare `reachability`** (`in-process` | `local-ipc` | `external`).
  Defaults are the honest reading of each kind and fail closed where it is
  ambiguous: `cli` and `api` default to external, `mcp` to local-ipc, and `ipc`
  and `test` to **in-process**. A webview command bridge must now claim external
  reachability explicitly, and that claim is a statement about the product.
- **AP-2 requires a machine Surface that is not in-process.** An application
  reachable only from its own front end has a private calling convention, not
  machine access.
- **`test` is no longer a machine Surface.** An adapter reachable only from the
  build system is headless evidence, not an interface. Declare it as
  `execution.headless_evidence`.
- **`headless: true` now needs evidence.** AP-1 requires
  `execution.headless_evidence`; a boolean anyone can set is not a demonstration.
- **`examples/gui-only/`** is the regression case: a GUI-only manifest that
  reached AP-2 under 0.2.0 and now reports `Achieved: none` with exit code 1.
- SPEC §3.1 states when *not* to adopt — a single-Surface tool with stable
  behavior does not repay the first conversion — and makes partial adoption a
  first-class outcome (case F6).
- SPEC §12.1 accepts a Surface's single call chokepoint as an AP-2 Binding
  target for rendered interfaces, keeping control-level identifiers at AP-4
  (case F4).

- **Excluding a machine Surface can no longer be silent.** Reported by the pilot
  once 0.2.0 landed: when a Surface sits at 0% evidence, demoting it out of the
  required set is the cheapest way to raise the score, and the Surface that
  resists proof is usually the one carrying §5 — if it cannot be tested next to
  the GUI, it cannot show they reach the same Action Core. A machine Surface
  with `required_for_parity: false` now requires `exclusion_reason`, and every
  exclusion appears in the report.

Still open: cross-application shared state has nowhere to be declared (case F5),
and manifest provenance is not distinguished from hand authoring (case F2
remainder).

## 0.2.0 - 2026-07-26

Credibility of the score, prompted by the cc-switch pilot: a pure GUI
application with no machine entry point passed AP-2 validation at 66.7% without
a line of new code. Breaking, because a report key was renamed rather than
aliased.

- **Two scores, never one.** `strict_parity_percent` is replaced by
  `declared_parity_percent` plus `evidenced_parity_percent`; a required Binding
  counts as evidence only when it names a re-runnable test.
- **AP-2 now requires binding evidence.** The previous wording claimed AP-2
  proved that Surfaces invoke the same Action Core, which no static check can
  demonstrate. §14.2 now states the requirement the validator can actually
  enforce.
- **Targets and achieved level are separated.** `conformance_targets` is
  self-declared and no longer reads as an outcome; reports state the achieved
  level and the blockers preventing the next one. AP-4 is never derived from a
  manifest.
- **Exceptions are visible in every report format.** They were present in JSON
  and missing from human output, so `0 errors, 0 warnings` could hide a backlog.
  An exception past its `review_by` date now warns.

Known and still open: `ipc` and `test` Surfaces have no reachability
requirement, so an in-process-only Surface still scores like an externally
reachable one (case F1). Tracked for 0.3.0.

## 0.1.0 - 2026-07-24

Initial working draft:

- ActionParity name and positioning;
- normative specification;
- JSON Schema;
- manifest validator and report command;
- minimal and U-King examples;
- adjacent-standards landscape;
- adoption and commercialization plans;
- open governance and contribution process.

