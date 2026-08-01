# U-King ActionParity Pilot

> Status update, 2026-08-01: this document began as a pre-implementation plan. U-King is a Tauri application, not Electron, and it now has 46 host Actions shared by GUI, generic CLI, and MCP. The measured current baseline and revised priorities are in [REAL-PROJECT-BASELINE.zh-CN.md](REAL-PROJECT-BASELINE.zh-CN.md). The phases below remain as the historical safety and evidence checklist.

U-King is the first reference implementation for ActionParity.

The pilot must improve real release confidence; it is not only a documentation example.

## Objectives

1. Make the existing Tauri GUI inspectable and operable through Windows UI Automation.
2. Extract a small set of business actions from GUI event handlers.
3. Expose those actions through GUI, CLI, MCP, and tests.
4. Prove cross-surface state synchronization.
5. Publish a reproducible ActionParity report.

## Safety boundary

The pilot MUST run against isolated U-King data and configuration.

It MUST NOT:

- alter a customer's real OpenClaw configuration;
- stop or replace a real production gateway;
- perform an actual upgrade;
- delete real logs or credentials;
- silently disable security controls.

Use a dedicated test home, deterministic fixture data, mock providers where practical, and an explicit test gateway port.

## Phase A — GUI automation baseline

Before refactoring, launch U-King and inspect it with Microsoft WinApp CLI:

```powershell
winapp ui status -a U-King --json
winapp ui inspect -a U-King --interactive
winapp ui screenshot -a U-King --output artifacts/uking-home.png
```

Record:

- number of visible meaningful controls;
- number with stable accessible names;
- number with unique stable automation identifiers;
- controls exposed only as anonymous containers;
- controls requiring coordinate clicks;
- critical workflows currently testable.

For Electron markup:

- use semantic HTML controls;
- give icon-only controls accessible names;
- maintain correct roles and focus behavior;
- avoid click-only `div` elements;
- expose enabled, selected, expanded, and value state;
- assign stable test identifiers without coupling tests to layout.

## Phase B — Action inventory

Create an inventory with:

```text
Action ID
User intent
Current GUI control
Current implementation location
Inputs
Outputs
Side effects
Risk
Rollback
Required surfaces
Tests
```

Classify presentation-only interactions separately.

## Phase C — First vertical slice

Implement these lower-risk actions first:

```text
environment.diagnose
gateway.status
gateway.start
gateway.stop
provider.test
logs.export
```

Each Action must:

- run without the GUI;
- return structured results;
- use isolated test state;
- emit an execution ID;
- declare timeout and cancellation behavior;
- produce testable state transitions;
- have GUI and CLI bindings;
- gain an MCP binding after the core behavior stabilizes.

## Phase D — Adapter shape

Recommended conceptual layout:

```text
packages/
  action-core/
    registry
    actions
    state
    events
    policy
  action-cli/
  action-mcp/
  action-electron/
  action-tests/
```

The exact folders may differ. The invariant is that the Electron handlers, CLI commands, and MCP tools remain thin adapters.

## Phase E — Tests

### Core test

Invoke `environment.diagnose` directly with fixture state and validate its schema and findings.

### Binding test

Invoke the GUI diagnosis control and prove that `environment.diagnose` is recorded with the resulting execution ID.

### Cross-surface test

Start the test gateway through CLI and observe running state in the open GUI.

### Real-GUI test

Use WinApp CLI or Appium to:

- launch U-King;
- reach the diagnosis page;
- invoke diagnosis;
- inspect progress and final result;
- capture screenshot evidence;
- verify accessible state.

### Failure test

Inject a known invalid provider configuration and prove GUI, CLI, and MCP receive the same stable error code and remediation data.

## Metrics

Publish before-and-after:

- strict ActionParity score;
- headless action coverage;
- stable GUI selector coverage;
- test duration;
- flake rate across repeated runs;
- number of screenshot-only steps;
- mean time to locate a failed layer;
- number of duplicated implementations removed.

## Exit criteria

The first pilot milestone is complete when:

- at least six actions satisfy AP-2;
- at least three satisfy AP-3;
- critical GUI bindings have stable semantic selectors;
- one cross-surface state synchronization test passes repeatedly;
- one clean Windows machine reproduces the report;
- no test touches real user state;
- the report and lessons are published.

