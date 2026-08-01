# Changelog

All notable project changes will be documented here.

## 0.6.1 - 2026-08-02

- Separate the toolchain, Manifest specification, and adopter application
  version identities in the public documentation.
- Add `action-parity --version --json` so Codex, Claude Code, Hermes, and other
  agents can discover the toolchain and supported Manifest versions without
  guessing from a Git tag.
- Correct the repository status after the first GitHub toolchain release and
  distinguish the installable GitHub tarball from the still-pending npm and
  crates.io publication channels.
- Record why public toolchain tags jumped from `v0.1.0` to `v0.6.0` and commit
  to normal patch/minor sequencing from that point onward.
- Upgrade the validation workflow to the current Node 24-runtime GitHub
  Actions, removing the Node 20 action-runtime deprecation warning.

## 0.6.0 - 2026-08-02

This release starts the executable toolchain: registering an Action should be
less work than hand-maintaining its Shadows and Manifest.

- Add the Rust `action-parity-core` Registry with deterministic Manifest, CLI
  help, MCP tool, and Surface Binding generation from one Action descriptor.
- Allow each Action to select its real Surface subset. Manifest Bindings, CLI
  help, MCP tools, and runtime dispatch now share that scope, preventing gradual
  adopters from generating false GUI or MCP coverage.
- Reject scoped Actions that omit a globally required Surface. Gradual adopters
  must mark incomplete Surfaces optional with an explicit reason instead of
  weakening parity implicitly.
- Add the thin `action-parity-tauri` adapter and a runnable notes registry
  example whose GUI, CLI, and MCP observations reach the same core execution
  envelope.
- Add `action-parity generate` for materializing registry bundles.
- Add opt-in `action-parity generate ... --typescript` output with generated
  Action constants, JSON-Schema-derived input/output types, a typed generic
  client, and a framework-dependency-free Tauri invoke helper. Generated client
  drift is checked with the rest of the Registry artifacts.
- Add `action-parity verify`, which reruns the generator, executes no-shell test
  commands with timeouts, requires per-Action/per-Surface execution
  observations, hashes artifacts and inputs, and emits a self-hashed report.
- Add the read-only, zero-configuration `action-parity doctor` inventory for
  AI tools entering an unadopted Tauri, Rust, TypeScript, or Python repository.
  It reports observed command bridges, repeated Action IDs, manifests,
  compatibility profiles, test definitions, and machine entry points without
  pretending that static structure is executable evidence.
- Make `doctor` honor Agent Profile `generated_paths`: generated Action clients
  remain observable but no longer trigger false hand-maintained drift warnings.
- Let `generate` accept an existing 0.5 Manifest as a gradual-adoption source
  for `action-client.ts`. `generate --check` now performs a read-only drift
  check for both full Registry bundles and Manifest-only TypeScript clients,
  without inventing CLI or MCP artifacts the existing application already owns.
- Treat CRLF and LF as equivalent checkout representations during generated
  artifact checks while preserving substantive drift detection. The first
  full U-King Windows pilot exposed this false failure under `core.autocrlf`.
- Publish the full U-King generated-contract pilot: 46 host Actions, 46 CLI
  bindings, 21 verified GUI bindings, a standard Tauri envelope adapter, an
  Agent Profile, and a Linux clean-checkout drift gate derived from its
  existing Rust Action Core without rewriting the handlers.
- Publish a measured Redline, Zhaozuo, and U-King baseline. The data moves the
  next implementation priority to generated Tauri/TypeScript bindings and a
  version-owned wire contract rather than more handwritten specification text.
- Static validation now calls a test reference declared evidence. It no longer
  labels a non-empty string as proven or awards AP-2 without execution.
- Make the npm CLI packable by removing `private: true` and declaring the
  published file set. No registry publication is performed by this change.
- Make the two Rust crates packageable for downstream consumers and add a
  release gate that clean-installs the npm tarball, executes its CLI, generates
  all four artifact types, packages the core crate, and validates the Tauri
  crate's publish set before the required two-phase first release.

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

