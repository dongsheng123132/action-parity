# Adoption and Promotion Plan

ActionParity will not become a standard because the first specification sounds persuasive. It will become a standard only if real applications adopt it, tools make adoption cheap, and public evidence shows that it improves reliability.

## Adoption thesis

The initial market is not every software company. It is teams already experiencing one of these pains:

- AI agents cannot reliably test their desktop product;
- GUI automation is slow and flaky;
- GUI, CLI, and API behavior has drifted;
- enterprise customers need auditable agent access;
- the product has multiple shells over the same intended capability;
- accessibility and automation trees are incomplete;
- release testing requires expensive interactive machines.

## Phase 0 — Founding draft

**Goal:** establish a credible public surface.

Deliverables:

- English and Chinese project introductions;
- v0.1 normative draft;
- JSON Schema and validator;
- adjacent-standards analysis;
- governance and RFC process;
- U-King example manifest;
- public GitHub Discussions, issues, and implementation-report template.

Success is not measured by stars alone. It is measured by substantive issues, independent implementations, and evidence that the schema survives real applications.

## Phase 1 — Prove it on U-King

**Goal:** demonstrate a before-and-after result on a real Windows Electron application.

Publish:

- inventory of meaningful U-King actions;
- baseline GUI automation coverage;
- Action Core extraction for a small vertical slice;
- CLI, MCP, and GUI bindings for the same actions;
- Windows UI Automation test recordings;
- ActionParity report generated in CI;
- measured comparison of test duration, flake rate, and failure diagnosis.

The first vertical slice should include:

```text
environment.diagnose
gateway.status
gateway.start
gateway.stop
provider.test
logs.export
```

Avoid starting with upgrade installation or destructive repair because the safety and rollback requirements are higher.

## Phase 2 — Make adoption cheap

**Goal:** reduce implementation from an architecture project to a normal development task.

Build reference adapters in this order:

1. Electron / TypeScript;
2. Tauri / Rust;
3. .NET for WinUI, WPF, and WinForms;
4. Python;
5. Swift and App Intents;
6. Java/Kotlin desktop and Android.

Each adapter should generate or expose:

- Action registration;
- manifest generation;
- CLI commands;
- MCP tools;
- event streams;
- test hooks;
- parity reports.

Create starter repositories demonstrating a notes app or task manager with AP-4 evidence.

## Phase 3 — Build a community

### GitHub

- Use Discussions for architecture questions and use cases.
- Use issues for concrete specification proposals.
- Label first-time contributor issues.
- Publish a monthly implementation digest.
- Maintain an adopters file with links to public reports.
- Tag versioned drafts and publish release notes.

### Developer channels

Launch technical explanations tailored to each community:

- Electron: eliminate fragile desktop end-to-end tests;
- Tauri: turn Commands into a portable Action manifest;
- .NET: combine Action Core with WinApp CLI and UI Automation;
- Swift: connect App Intents, CLI, and SwiftUI to one semantic action;
- MCP: generate reliable tools from application-native capabilities;
- QA: move business assertions below the interface while retaining visual testing.

### Public demonstrations

A persuasive demo should show the same operation executed from:

1. a GUI button;
2. a CLI command;
3. an MCP tool;
4. a test;

and then show one shared `execution_id`, state transition, and audit record.

The audience should be able to break a GUI binding intentionally and watch the parity validator catch it.

## Phase 4 — Conformance ecosystem

Create a public registry of implementation reports:

```text
Application
Version
Specification version
Claimed level
Required surfaces
Strict parity score
Test artifact
Independent verifier
```

Self-attestation MUST remain free. Paid independent verification MAY use a controlled certification mark if:

- rules and test suites are public;
- failures are reproducible;
- certification cannot waive normative requirements;
- certified version and expiration are visible;
- competing verification labs can participate under fair terms.

## Phase 5 — Standards maturity

Before v1.0:

- collect at least three independent implementations;
- cover at least two operating systems;
- include at least three application frameworks;
- publish compatibility test vectors;
- resolve all open normative issues in the specification;
- establish a multi-company technical steering group;
- document intellectual-property and trademark policy;
- run a public review period.

After implementation maturity, consider submitting the work to an established standards body or neutral foundation. Do not transfer control before the project has enough active implementers to sustain the process.

## Messaging

### Primary sentence

> ActionParity is the open standard that makes every meaningful application action equally reachable from GUI, CLI, MCP, automation, and AI—without duplicating business logic.

### Memorable contrast

> MCP makes tools callable. UI Automation makes screens operable. ActionParity proves they perform the same action.

### Chinese

> 影核（ActionParity）是“动作同源”开放标准：GUI、CLI、MCP、AI 与测试共同调用同一个业务核心，并用机器报告证明没有漂移。

### Avoid

Do not claim:

- that GUI testing is obsolete;
- that every visual control needs a CLI command;
- that ActionParity replaces MCP or WebDriver;
- that an early self-published draft is already an industry consensus;
- that a high parity score proves security or usability.

## Initial launch checklist

- [x] Unique, descriptive project name
- [x] Bilingual README
- [x] Normative working draft
- [x] Machine-readable schema
- [x] Validator
- [x] Real application example
- [x] Landscape and differentiation
- [x] Open governance
- [ ] U-King baseline implementation report
- [ ] Recorded multi-surface demo
- [ ] First external adopter
- [ ] Framework adapters
- [ ] Public website
- [ ] Community steering group

