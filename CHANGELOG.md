# Changelog

All notable project changes will be documented here.

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

