# ActionParity Specification

**Version:** 0.3.0 Working Draft  
**Status:** Non-normative until 1.0.0  
**Tagline:** One action. Every interface.

## 1. Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in BCP 14 (RFC 2119 and RFC 8174) when, and only when, they appear in all capitals.

This working draft uses normative language to make proposals testable. A claim of conformance to a pre-1.0 draft MUST identify the exact draft version.

## 2. Purpose

ActionParity defines requirements for applications whose meaningful capabilities are:

- implemented once in a headless action layer;
- discoverable through a machine-readable manifest;
- reachable through declared human and machine interfaces;
- synchronized through a canonical state and event model;
- safe for automation and AI-agent execution;
- verifiable through portable conformance reports.

The standard applies to desktop, mobile, web, embedded, and service-backed applications. Its primary initial focus is native and desktop software where business behavior has historically been trapped inside GUI event handlers.

## 3. Non-goals

ActionParity does not:

- define a GUI toolkit;
- require a TUI;
- replace MCP, OpenAPI, OpenRPC, WebDriver, Appium, UI Automation, or platform accessibility APIs;
- require every visual control to become a command;
- require a GUI to spawn a CLI process;
- standardize visual design;
- grant an AI agent unrestricted authority;
- claim that headless tests replace real interface tests.

### 3.1 Applicability

A standard that only describes when to adopt it cannot be trusted about cost. Adoption is worthwhile when at least one of these is true:

- a second Surface exists or is planned;
- the product must be operable or testable by an agent;
- state or actions must synchronize across devices;
- business behavior must be verifiable without a display.

Adoption is **not** worthwhile for a single-Surface tool with stable behavior and no agent scenario. The first conversion is a net increase in code — an Action Core, a manifest, adapters, and tests replace a working click handler — and it repays only at the second Surface or the first significant behavior change. Converting such a tool to raise a conformance score is waste.

Partial adoption is a first-class outcome, not an incomplete one. An implementation MAY declare conformance for a core domain and place the rest explicitly out of scope; a large application whose upstream sync would break under full conversion SHOULD do exactly that. What conformance forbids is silence: an Action omitted without a declared exception (§8.3).

## 4. Terms

### 4.1 Action

A meaningful domain operation with a stable identifier, typed input, typed output, declared effects, and observable execution semantics.

Examples: `project.create`, `gateway.start`, `document.export`, and `account.delete`.

### 4.2 Action Core

The canonical implementation layer for Actions. It does not require a graphical session and does not contain interface-specific presentation logic.

### 4.3 Surface

An interface through which a human, program, test, or agent can invoke or observe application behavior. Surface kinds include `gui`, `tui`, `cli`, `mcp`, `api`, `ipc`, and `test`.

### 4.4 Binding

A declared mapping from a Surface target to an Action ID.

### 4.5 Presentation-only interaction

An interaction whose effect is limited to presentation and does not perform a domain operation. Examples include expanding a panel, changing a local tab, hovering, or resizing a window.

### 4.6 State

Canonical application data observable independently of a particular Surface.

### 4.7 Event

A structured record of an Action lifecycle or State change.

### 4.8 Parity exception

A temporary or permanent, machine-readable explanation for why an Action is intentionally unavailable on a declared Surface.

## 5. Architectural invariant

An application conforms to ActionParity only when:

> Every meaningful Action has one canonical semantic identity and one canonical implementation path, regardless of the Surface that invokes it.

Equivalent duplicated implementations do not satisfy this requirement. A GUI handler and CLI handler that independently implement the same behavior are two sources of truth and are non-conforming.

Permitted implementation patterns include:

- GUI, CLI, and MCP adapters importing the same Action Core library;
- all adapters calling the same local runtime through IPC;
- thin platform adapters calling a shared remote Action service;
- generated adapters derived from the Action manifest.

## 6. Action manifest

### 6.1 Discovery

A conforming implementation MUST expose an ActionParity manifest through at least one of:

- a bundled or repository-root `action-parity.json` file;
- a non-interactive CLI command that returns the manifest;
- a local IPC method;
- an MCP resource or tool;
- `/.well-known/action-parity` for network services.

The implementation SHOULD expose more than one mechanism when packaging permits.

### 6.2 Required top-level fields

The manifest MUST include:

- `spec_version`;
- `application`;
- `surfaces`;
- `actions`.

The manifest MUST validate against the schema associated with its declared draft version.

### 6.3 Application identity

`application.id` MUST remain stable across application releases. A reverse-domain identifier is RECOMMENDED.

`application.version` MUST identify the version whose implementation is described.

### 6.4 Surface declaration

Every Surface referenced by a Binding MUST be declared in `surfaces`.

A Surface with `required_for_parity: true` participates in the AP-2 coverage calculation.

A machine Surface declared with `required_for_parity: false` MUST state `exclusion_reason`, and a conformance report MUST list every excluded machine Surface. Demoting a Surface removes it from the parity denominator, which raises evidenced parity without changing the product. The Surface hardest to prove is frequently the one whose proof carries §5 — a Surface that cannot be tested alongside the GUI is precisely the Surface that cannot show they reach the same Action Core. Exclusion remains permitted; concealing it does not.

A GUI Surface SHOULD declare a `test_driver`, such as `windows-uia`, `appium`, `webdriver`, `xcuitest`, or a project-specific driver.

## 7. Action requirements

### 7.1 Identity

Every Action MUST have a unique, stable `id`.

Action IDs SHOULD use lower-case dotted namespaces:

```text
resource.verb
resource.subresource.verb
```

Renaming or changing the meaning of an Action ID is a breaking change.

### 7.2 Description and schemas

Every Action MUST declare:

- a human-readable title;
- a precise description;
- an input JSON Schema;
- an output JSON Schema.

Inputs MUST NOT depend on an interactive prompt. A Surface MAY collect input interactively, but it MUST convert the result into the declared Action input.

### 7.3 Headless execution

Every business Action claiming AP-1 or higher MUST execute without a visible interface.

An Action MAY depend on platform services, devices, or user sessions when those dependencies are declared. A dependency on a visible GUI solely because business logic resides in a click handler is non-conforming.

### 7.4 Execution semantics

Every Action MUST declare:

- whether it is idempotent;
- whether it is cancellable;
- a finite default timeout;
- effect class;
- risk level;
- reversibility;
- confirmation policy;
- audit requirement.

Long-running Actions SHOULD support progress events and cancellation.

### 7.5 Structured result

Machine Surfaces MUST return a structured result equivalent to:

```json
{
  "ok": true,
  "execution_id": "exec_01H...",
  "data": {},
  "error": null,
  "meta": {
    "duration_ms": 42
  }
}
```

Failures MUST include a stable error code and a human-readable message. Secrets and sensitive values MUST NOT appear in errors, logs, manifests, or command histories.

## 8. Surface parity

### 8.1 Meaningful GUI actions

Every meaningful Action reachable through a GUI Surface MUST have a Binding to its stable Action ID.

The GUI MUST invoke the canonical Action Core. It MUST NOT maintain an independent implementation of the same domain behavior.

### 8.2 Machine access

Every meaningful GUI Action MUST have at least one non-visual machine Surface unless a documented parity exception applies.

Machine Surface kinds are `cli`, `mcp`, `api`, and `ipc`. A `test` Surface is **not** a machine Surface: an adapter reachable only from the build system demonstrates headless execution, but it is not an interface another program or agent can use. Declare it as `headless_evidence` instead.

#### 8.2.1 Reachability

Every Surface has a reachability, declared as `reachability` or defaulted:

| Value | Meaning |
|---|---|
| `in-process` | Only the application's own process or webview can invoke it |
| `local-ipc` | Another process on the same machine can invoke it |
| `external` | Another host can invoke it |

Defaults when `reachability` is absent: `cli` and `api` are `external`, `mcp` is `local-ipc`, and `ipc` and `test` are **`in-process`**. The ambiguous case fails closed, because a webview command bridge — `#[tauri::command]`, `ipcRenderer`, and equivalents — is callable only from the application's own front end. Such an implementation MUST declare a higher reachability explicitly, and that declaration is a factual claim about the product.

An AP-2 implementation MUST provide, for every non-exempt Action, at least one machine Surface whose reachability is not `in-process`. An application whose only non-visual Surface is its own command bridge has not achieved machine access; it has a private calling convention.

### 8.3 Exceptions

A parity exception MUST include:

- affected Action;
- affected Surface;
- reason;
- owner;
- review or expiry date.

Exceptions MUST be included in conformance reports and MUST reduce the strict parity score. A project MUST NOT silently omit missing bindings.

### 8.4 Pure interface interactions

Presentation-only interactions do not require Action IDs. They MUST remain testable through an appropriate UI or accessibility driver when they affect usability.

## 9. CLI profile

An implementation claiming an ActionParity CLI Surface:

- MUST support a structured JSON mode;
- MUST support non-interactive execution;
- MUST keep result data on stdout;
- MUST keep logs, progress, and diagnostics on stderr;
- MUST suppress ANSI color, spinners, and dynamic progress when stdout is not a TTY;
- MUST use exit code `0` for success, `1` for runtime or conformance failure, and `2` for invalid usage;
- SHOULD support `--json`, `--quiet`, `--verbose`, `--no-input`, `--yes`, and `--version`;
- MUST NOT require secrets as command-line arguments when a safer channel is available.

For streams, JSON Lines is RECOMMENDED. Every line MUST be a complete JSON value.

## 10. State and events

### 10.1 Canonical state

Surfaces MUST observe the same canonical State after an Action completes.

A CLI or MCP invocation that changes State MUST become visible to an open GUI without requiring a separate duplicated write path. Refresh, subscription, or event-driven synchronization MAY be used.

### 10.2 Lifecycle events

Long-running Actions SHOULD emit:

```text
action.accepted
action.started
action.progress
action.completed
action.failed
action.cancelled
```

Events MUST carry an `execution_id`, `action_id`, timestamp, and relevant structured payload.

### 10.3 Correlation and audit

Every state-changing Action SHOULD be traceable from request through result, events, logs, and audit record using the same `execution_id`.

## 11. Safety and authority

### 11.1 Least privilege

Machine Surfaces MUST NOT silently grant more authority than the corresponding human Surface.

### 11.2 Confirmation

Confirmation policy MUST be enforced below the presentation layer. A prompt instruction alone is not an adequate safety boundary.

High-risk, destructive, financial, or externally visible Actions MUST use `conditional` or `always` confirmation unless a stronger, explicitly documented policy authorizes unattended execution.

### 11.3 Sandboxed tests

Conformance and integration tests MUST NOT silently operate on real user state.

Test harnesses SHOULD support:

- isolated configuration and data directories;
- deterministic fixtures;
- dry-run where meaningful;
- cleanup and rollback;
- network and filesystem boundaries;
- explicit destructive-test opt-in.

### 11.4 Credentials

Credentials MUST remain outside manifests and test fixtures. An Action implementation MUST redact secrets from structured results and diagnostics.

## 12. GUI testability and accessibility

An AP-4 GUI Surface:

- MUST expose a semantic accessibility or automation tree where the platform supports one;
- MUST provide stable automation identifiers for meaningful interactive controls;
- MUST provide accessible names, roles, values, enabled state, and focus behavior;
- SHOULD prefer semantic platform controls over coordinate-only or canvas-only controls;
- MUST include binding tests proving that representative GUI controls invoke the declared Action IDs;
- MUST include real-GUI journey tests for critical workflows;
- SHOULD include visual assertions for layout-sensitive states.

Coordinate injection and screenshot reasoning MAY be used as fallbacks, but MUST NOT be the only evidence when semantic automation is available.

### 12.1 Binding target for generated interfaces

Control-level automation identifiers are natural in native toolkits, where a control has a stable identity. In a rendered interface — React, Vue, or any other component tree — controls are produced by render functions and have no inherent identity, and adding identifiers to every control is pure overhead if nothing consumes them.

For such Surfaces, an AP-2 Binding MAY target the Surface's single call chokepoint instead of a control:

```text
src/lib/api/providers.ts#switchProvider
```

This is conforming when the chokepoint is the *only* path from that Surface to the Action, which is exactly the property §5 requires. Control-level identifiers remain an AP-4 requirement, because real-GUI journey tests need to reach the control a person actually clicks.

## 13. Testing model

ActionParity defines four complementary test classes.

### 13.1 Action contract tests

Validate schemas, success and failure behavior, idempotency claims, timeouts, cancellation, effects, and state transitions.

### 13.2 Binding tests

Prove that each declared Surface target resolves to and invokes the expected Action ID.

### 13.3 State synchronization tests

Invoke an Action through one Surface and observe the result through another.

### 13.4 Real-interface tests

Validate accessibility, focus, interaction, visual state, platform integration, and critical end-to-end journeys.

Passing only Action contract tests does not prove GUI conformance. Passing only real-interface tests does not prove semantic parity.

## 14. Conformance levels

### 14.1 AP-1 Core

An AP-1 implementation:

- publishes a valid manifest;
- exposes stable Action IDs;
- declares input and output schemas;
- executes all claimed business Actions headlessly;
- names `execution.headless_evidence` for every Action;
- passes Action contract tests.

`headless: true` is a boolean an implementer can set without running anything. The evidence field is what separates an Action proven to run without a display from one assumed to.

### 14.2 AP-2 Parity

An AP-2 implementation satisfies AP-1 and:

- declares required Surfaces;
- binds every non-exempt Action to every required Surface;
- provides every non-exempt Action with a machine Surface that is not `in-process` (§8.2.1);
- supplies a re-runnable test in `binding.test` for every required Binding;
- reports all exceptions.

A Binding without a test is a claim, not a demonstration. A manifest alone
cannot show that two Surfaces reach the same Action Core: an implementation can
declare one Action ID over two independent implementations and no static check
will notice. AP-2 therefore requires binding evidence, and a validator MUST
report evidenced coverage separately from declared coverage (§15).

### 14.3 AP-3 Agent

An AP-3 implementation satisfies AP-2 and:

- provides structured machine results;
- supports discovery without human documentation;
- enforces risk, confirmation, and authority below the interface layer;
- emits progress and supports cancellation where applicable;
- maintains correlated audit records for state-changing Actions.

### 14.4 AP-4 Verified

An AP-4 implementation satisfies AP-3 and:

- publishes a signed or reproducible conformance report;
- includes Action, Binding, State synchronization, accessibility, and critical real-interface tests;
- identifies application artifact version and test environment;
- contains no undisclosed parity exception.

## 15. Parity score

A conformance report MUST publish two scores, never one:

```text
declared parity  = present required bindings   / total required bindings × 100
evidenced parity = evidenced required bindings / total required bindings × 100
```

where a required Binding is *evidenced* only when it names a re-runnable test,
and:

```text
total required bindings =
  number of non-presentation Actions × number of required Surfaces
```

Publishing declared parity alone is non-conformant reporting. The two numbers
answer different questions — "is the manifest filled in?" and "can any of it be
re-run?" — and a single number lets the first masquerade as the second.

Exceptions remain in the denominator and MUST appear in every report format,
including human-readable output. An exception past its `review_by` date MUST be
reported as a warning.

Reports MAY also publish an adjusted score, but MUST NOT label it a parity score.

Scores measure coverage, not product quality. A high score does not replace
security, accessibility, correctness, or usability review.

### 15.1 Targets versus achieved level

`conformance_targets` states what an implementation is aiming for. It is
self-declared and MUST NOT be reported as an outcome. A report MUST state the
achieved level separately, derived only from what the manifest and its evidence
demonstrate, and MUST list the blockers preventing the next level.

AP-2 is the highest level derivable from a manifest and its declared evidence.
AP-3 describes runtime behaviour — structured results, policy enforced below the
interface layer, real audit records — and AP-4 requires a published conformance
report. A static validator MUST NOT award either. In particular
`audit_required: true` declares that an Action needs audit, not that audit
exists, and MUST NOT be read as an AP-3 grade.

## 16. Versioning

The specification follows semantic versioning.

- Patch versions clarify wording or fix schemas without changing conformance meaning.
- Minor versions may add backward-compatible fields and requirements before 1.0.
- Major versions may change normative requirements or compatibility.

Applications MUST declare the exact specification version used for a conformance claim.

## 17. Relationship to other standards

ActionParity SHOULD reuse:

- JSON Schema for Action contracts;
- MCP for agent tool discovery and invocation;
- OpenAPI or OpenRPC for service interfaces;
- platform accessibility and UI automation APIs for interface inspection;
- WebDriver or Appium where applicable;
- OpenTelemetry-compatible identifiers and traces where practical.

ActionParity defines the application parity invariant and conformance model that those technologies do not individually mandate.

## 18. Open issues before 1.0

The working group must resolve:

- canonical manifest discovery across packaged desktop and mobile applications;
- signature and provenance format for AP-4 reports;
- standard error taxonomy;
- standard effect and risk taxonomy;
- capability negotiation and partial Surface support;
- compatibility rules for generated adapters;
- certification mark and trademark governance;
- normative accessibility requirements per platform;
- test evidence format and reproducibility requirements.

