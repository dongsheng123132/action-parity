# ActionParity ShadowCore Profile (影核协议)

**Status:** non-normative ActionParity Shadow & Sync Profile 0.1
**Wire identifier:** `action-parity/sync@0.1`
**Scope:** Windows, macOS, iOS, Android, HarmonyOS, Linux, web, CLI/TUI, and remote agents
**中文版:** [影核协议（中文版）](SHADOW-SYNC.zh-CN.md)

**Principle:** One Core, Many Shadows / 一核多影

> A product has exactly one authoritative Action Core. Every interface — a
> Windows window, a phone screen, a terminal, an MCP tool, a test harness — is a
> native shadow that projects the same Actions, State, Events, and Policy.
> Devices exchange actions, state, and events. They do not exchange screens.

Three consequences follow, and they are the reason to adopt the profile.

1. **Native on every platform without forking behavior.** Each platform draws
   its own controls; none of them re-implements a business rule.
2. **Remote control without pixel streaming.** A shadow resumes from an opaque
   cursor and receives a small ordered delta instead of a framebuffer.
3. **Verifiable by a machine.** Every meaningful action is invocable and
   assertable without a UI, so an AI agent can test the product end to end —
   including its remote and multi-device paths — without screenshots, mouse
   coordinates, or a vision model. See
   [§10 Machine verification](#10-machine-verification).

What ShadowCore is **not**: not one binary for every platform, not a shared
widget toolkit, and not remote desktop.

## 1. The important distinction

“The GUI is a shadow” is a useful architectural statement when **shadow**
means a native projection of canonical semantics. It is misleading when it
means that every platform must share pixels, widgets, or one executable.

iOS sandboxing, Windows services, macOS entitlements, HarmonyOS abilities,
device sensors, and background-execution rules differ. A conforming product
therefore shares, in descending order of preference:

1. one authoritative Action Core, reached through local or remote IPC;
2. one portable core library compiled for several platforms; or
3. independently compiled implementations generated from the same contracts
   and proven equivalent by conformance tests.

The shared invariant is semantic, not binary:

```text
                  versioned Action contracts
                           │
                  canonical State model
                           │
                append-only Event stream
                           │
                 Policy / authority gate
                           │
        ┌──────────────┬───┴────────┬──────────────┐
        │              │            │              │
   Windows GUI     macOS GUI     iOS GUI     HarmonyOS GUI
        │              │            │              │
        └──────────── native shadows ──────────────┘
                           │
                   CLI / TUI / MCP / AI
```

## 2. The four shared layers

### 2.1 Actions

Every meaningful operation has a stable Action ID, typed input and output,
effect class, timeout, authority requirement, and idempotency behavior.
Surfaces collect input differently, but they invoke the same action identity.

### 2.2 State

State is canonical domain data, not a serialized screen tree. Each surface
projects only the fields it needs. A phone can show a compact task card while a
Windows desktop shows a multi-pane inspector; both are views of the same task
state and version.

### 2.3 Events

Every accepted action and committed state change produces an ordered event.
Events make replay, audit, offline recovery, debugging, and incremental sync
possible. Events should contain references to large blobs rather than embedding
them.

### 2.4 Policy

Authority is enforced below every shadow. A remote phone, CLI, or AI agent must
not gain more power merely because it bypasses a desktop button. Destructive,
financial, privileged, or externally visible actions retain confirmation,
audit, cancellation, and redaction requirements at the Action Core.

## 3. Delta sync instead of screen sync

A remote shadow SHOULD exchange structured commands and deltas:

```text
Phone shadow                 Relay                 Owner node
     │ sync.hello(cursor=41)    │                        │
     ├─────────────────────────>│                        │
     │                          ├── request after 41 ───>│
     │<──── sync.delta(42..47) ─┤                        │
     │ render native cards      │                        │
     │                          │                        │
     │ sync.command(task.pause, idempotency=k9)          │
     ├─────────────────────────>├───────────────────────>│
     │                          │       execute + policy │
     │<──── result + event 48 ──┤<───────────────────────┤
```

This normally transfers a command envelope, small event payloads, and optional
content-addressed blob references. It does not continually transmit:

- screenshots;
- a remote framebuffer;
- complete databases;
- full state snapshots after every change; or
- platform-specific view trees.

For forms, task lists, logs, progress, settings, and agent work, this can reduce
bandwidth by orders of magnitude and keeps every platform native. Pixel
streaming remains appropriate for video, games, arbitrary legacy applications,
or canvases whose semantics have not been extracted.

## 4. Transport-neutral sync envelope

The draft schema is
[`schema/action-parity-sync.schema.json`](../schema/action-parity-sync.schema.json).
It can be carried over WebSocket, SSE plus HTTP, QUIC, local IPC, a message
queue, or an existing product relay.

Required envelope concepts:

| Concept | Purpose |
|---|---|
| `stream_id` | Stable logical state/event stream |
| `message_id` | Deduplication and tracing |
| `cursor` | Opaque resume position acknowledged by a shadow |
| `state_version` | Optimistic concurrency and stale-write detection |
| `execution_id` | Correlates command, lifecycle, result, and audit |
| `idempotency_key` | Makes command retry safe across reconnects |
| `actor` | Identifies the device, user, service, or agent |
| `events` | Ordered state deltas after a cursor |

The [ClawMe task-delta example](../examples/sync/clawme-task-delta.json)
demonstrates the smallest useful event batch.

The confirmed-write fixtures show both successful and stale-device outcomes:

- [`sync.command`](../examples/sync/clawme-attention-decision-command.json);
- [`sync.result`](../examples/sync/clawme-attention-decision-result.json);
- [`sync.conflict`](../examples/sync/clawme-attention-decision-conflict.json).

## 5. Message roles

The initial profile uses eight roles:

| Type | Direction | Meaning |
|---|---|---|
| `sync.hello` | shadow → owner/relay | Negotiate profile, capabilities, and resume cursor |
| `sync.snapshot` | owner/relay → shadow | Baseline state when no compatible cursor exists |
| `sync.delta` | owner/relay → shadow | Ordered events after the acknowledged cursor |
| `sync.challenge` | owner → shadow | Bind confirmation to actor, action, input digest, and state version |
| `sync.command` | shadow → owner | Invoke one Action with authority and idempotency metadata |
| `sync.result` | owner → shadow | Structured Action result correlated by execution ID |
| `sync.ack` | shadow → owner/relay | Confirm a durable cursor |
| `sync.conflict` | owner → shadow | Reject a stale or incompatible state assumption |

Transports MAY add heartbeat and compression frames. They MUST NOT change Action
semantics or make transport-specific data the new source of truth.

## 6. Ordering, retry, and offline behavior

- A stream MUST have a total event order or a declared partitioning strategy.
- Cursors MUST be opaque to shadows.
- Duplicate commands with the same idempotency key MUST return the original
  committed result or a stable in-progress response.
- A shadow MUST acknowledge only state durably applied to its local projection.
- A command that depends on a state version SHOULD carry
  `expected_state_version`.
- The owner MUST reject or explicitly merge stale writes; last-write-wins MUST
  NOT be an undocumented default.
- A reconnecting shadow SHOULD request deltas from its last durable cursor.
- An unchanged stream MAY return an empty delta with the same cursor, allowing
  cheap polling without inventing a state change.
- If history has been compacted, the owner sends a snapshot and a new cursor.
- A shadow MAY render optimistic presentation state, but MUST reconcile it with
  the committed result and event stream.

### 6.1 Reliable remote writes

A remote write is not “send JSON and hope.” A conforming owner applies this
gate before invoking the Action Core:

1. authenticate the device and authorize the Action and resource;
2. issue a short-lived `sync.challenge` bound to actor, Action ID, canonical
   input digest, and current state version;
3. look up the idempotency key before checking expiry;
4. if the key already committed the same request, return the original result;
5. if the same key names different input or execution identity, reject it;
6. reject an expired command and compare `expected_state_version` with
   authoritative state;
7. return `sync.conflict` without consuming the challenge or executing when the
   state is stale;
8. verify and consume the matching confirmation challenge once;
9. commit the effect, result, event, and idempotency record atomically where the
   storage model permits it.

The envelope's `confirmation` records the mode, challenge identity, and time.
It MUST NOT contain a biometric template, device secret, or reusable proof.
The owner validates confirmation through its trusted platform channel.

Distributed transports normally provide at-least-once delivery, not magic
exactly-once execution. Observable exactly-once behavior therefore depends on
the idempotency ledger and the business effect sharing an atomic boundary. When
that is impossible, the Action MUST itself be idempotent or have an explicit
reconciliation/compensation design.

## 7. Capability negotiation

Platforms have different capabilities. `sync.hello` therefore advertises what a
shadow can render or invoke, for example:

```json
{
  "surface": "ios",
  "actions": ["task.status", "task.pause", "approval.respond"],
  "features": ["push", "biometric_confirmation", "offline_projection"],
  "schema_versions": ["task@2", "approval@1"]
}
```

Unsupported behavior is an explicit parity exception or delegated execution,
not a silent fake. For example, an iPhone shadow can request a Windows owner
node to execute `workspace.build`; it does not pretend to run the Windows tool
locally.

## 8. Security and privacy

A sync implementation:

- MUST authenticate devices and bind every command to an actor;
- MUST authorize at Action ID and resource scope;
- MUST enforce confirmation at the authoritative core;
- MUST redact secrets before events enter a relay;
- MUST encrypt transport and protect durable cursors/tokens;
- MUST support device revocation;
- MUST separate content blobs from control-plane events;
- SHOULD keep sensitive files and model context on the owner node;
- SHOULD publish an auditable chain from command to result and state event.

A relay SHOULD be able to route encrypted or redacted deltas without holding
the user's full workspace. “Only sync the bottom layer” should mean syncing the
minimum semantic state needed by a shadow, not uploading the entire machine.

## 9. Reference-product mapping

### 9.1 ClawMe

ClawMe already has the right boundary: a local owner agent, a persistent relay,
tasks, commands, events, and a native iOS client. It should evolve rather than
be rewritten:

1. name existing commands with stable Action IDs;
2. version task/attention/event schemas;
3. add opaque cursors and idempotency keys to the relay;
4. make the iOS screen a projector of task and attention state;
5. add macOS, Windows, Android, and HarmonyOS shadows against the same profile;
6. keep files, tool execution, and sensitive context on the owner node.

The first vertical slice should be one remote task:
`task.status` → `task.events` → `task.pause/resume` → `approval.respond`.

### 9.2 UURescue

UURescue already has a task state machine, append-only event log, checkpoints,
and recoverable takeover. It is a strong candidate for the canonical continuity
runtime:

1. expose `task.status` and `task.events` as read-only Actions;
2. assign every event a stable sequence/cursor;
3. export deltas without copying the complete task directory;
4. add confirmed `checkpoint.create` and `takeover.start` Actions;
5. let phone/desktop shadows project the same recovery state;
6. use ClawMe's relay only as transport, not as a second source of truth.

```text
UURescue continuity state ── events/deltas ── ClawMe relay
          │                                      │
     owner execution                    native shadows
```

## 10. Machine verification

The hardest part of shipping GUI software is proving it still works. Driving a
real window is slow, flaky, and resolution-, language-, theme-, focus-, and
animation-dependent; driving several devices at once is worse. Teams therefore
under-test exactly the paths that break in the field: reconnects, stale writes,
duplicate commands, and cross-device state.

A ShadowCore product does not need a vision model to answer *did the software do
the right thing*. It needs four test layers with different costs.

| Layer | Question it answers | Driver | Typical cost |
|---|---|---|---|
| Action Core contract | Did the action do the right thing? | direct call or `action run --json` | milliseconds, deterministic |
| Binding parity | Does each surface invoke the same Action ID? | manifest + surface introspection | milliseconds, no window needed |
| Sync conformance | Is the remote path correct under retry, reorder, and staleness? | recorded envelope fixtures | milliseconds, no second device needed |
| Real GUI journey | Can a person see, reach, and understand it? | UI automation / accessibility | seconds, few cases |

Only the last layer needs a real window, and it shrinks to what genuinely
requires one: reachability, focus order, contrast, DPI, and labels.

### 10.1 What an implementation MUST expose to be machine-verifiable

- a manifest listing Action IDs, input/output schemas, effects, and surface
  bindings;
- headless invocation of every declared action, with a stable machine envelope
  on stdout, diagnostics on stderr, and meaningful exit codes;
- stable, non-visual binding identifiers on each GUI surface (automation ID,
  `data-action-id`, accessibility ID) so a binding can be checked without
  pixels;
- an event stream with opaque cursors, so an effect can be asserted as an event
  rather than as a screenshot diff;
- a sandbox or seeded state root, so tests never touch real user data;
- a fixture corpus of `sync.*` envelopes covering resume, empty delta, duplicate
  idempotency key, expired challenge, and stale `expected_state_version`.

### 10.2 The loop an agent can run unattended

```text
action list --json                 → discover what exists
action describe <id> --json        → read the contract, not the docs
action run <id> --json             → execute in a sandbox
task.events --after <cursor>       → assert the committed effect
binding check <id>                 → assert each surface maps to that Action ID
replay fixtures/sync/*.json        → assert reconnect, retry, and conflict rules
```

Every step is text in, text out. An agent can run it in CI, on a bare machine,
over SSH, or inside another agent's tool loop — no display, no driver, no
screenshot budget.

### 10.3 What this does not prove

Passing the first three layers does not prove that a human can use the product.
It does not prove that the button is visible, reachable by keyboard, correctly
labelled for a screen reader, or legible at 200% scaling. Those remain real-GUI
assertions, and a conforming implementation still publishes them. The profile's
claim is narrower and more useful: *behavioral* regressions stop hiding behind
UI automation flakiness.

### 10.4 Replay as the debugging primitive

Because state changes are ordered events, a field failure can be shipped back as
a cursor range rather than a video. Replaying that range against the Action Core
reproduces the defect on a developer machine with no device, account, or
screen-recording involved. This is also how a shadow proves it is not inventing
state: given the same delta, it MUST reach the same projection.

## 11. Development-speed effect

This architecture can materially accelerate development because:

- domain behavior is implemented and fixed once;
- AI can test the Action Core without vision and still test each real GUI
  journey separately;
- mobile and desktop teams can work in parallel against versioned fixtures;
- native UI redesigns do not rewrite business rules;
- event replay reproduces field failures;
- thin remote clients transfer less data;
- accessibility, CLI, MCP, automation, and support tooling reuse the same
  semantics;
- a new platform often becomes a projector plus a small capability adapter.

The cost is real: contracts require governance, event migrations need care,
offline conflicts must be designed, and complex media may still need separate
transfer. The profile pays back first in products with multiple surfaces,
remote control, long-running tasks, audit requirements, or AI automation.

## 12. Adoption sequence

Do not begin by rewriting the whole product.

1. Select three to six read-only or reversible Actions.
2. Publish their input/output and State schemas.
3. Add stable GUI bindings and direct Action tests.
4. Append events for those Actions.
5. Sync only those events using opaque cursors.
6. Publish a fixture corpus so any agent can verify the sync rules offline.
7. Build a second native shadow.
8. Add one confirmed write Action.
9. Measure duplicated code, test duration, bytes transferred, reconnect
   correctness, and defect reproduction time.

Only after two independent products complete this loop should the Shadow & Sync
profile become normative ActionParity text.
