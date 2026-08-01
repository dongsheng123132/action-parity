---
name: action-parity
description: Refactor GUI Actions for shared CLI, MCP, tests, and AI.
---

# ActionParity Development Skill

Use the project's executable Action Registry and verification commands to add or change business Actions without duplicating behavior across GUI, CLI, or MCP. This skill does not replace UI design or visual testing; it keeps every interface bound to the same headless Action Core.

## When to Use

Use this skill when the task includes any of these:

- add or change a business operation in an ActionParity or ShadowCore project;
- expose an existing GUI capability through CLI, MCP, API, IPC, or automation;
- refactor Tauri, Electron, desktop, or legacy GUI behavior into a headless core;
- fix Action ID, generated Manifest, Binding, or cross-interface drift;
- prove that GUI, CLI, and MCP reach the same execution.

Do not use it for purely visual layout, animation, tab switching, window movement, or other interface-only behavior.

## Prerequisites

- Work inside the target repository.
- An adopted repository should contain `action-parity.config.json`; an unadopted repository can still be scanned with Doctor.
- Use the host agent's terminal or shell tool to run the CLI.
- Preserve unrelated changes and inspect Git status before editing.

If the profile is missing, run `action-parity doctor . --json` first. Use its observations to classify existing machine surfaces and select one vertical slice. Then read [references/agent-profile.md](references/agent-profile.md) and create the smallest profile that points to real executable commands. Do not mechanically turn every Tauri/Electron command into an Action, and do not invent passing commands or evidence.

## How to Run

In an unadopted repository, start with:

```text
action-parity doctor . --json
```

Doctor is a read-only structural inventory, not conformance evidence. After an Agent Profile exists, start every Action task with:

```text
action-parity context . --json
```

The JSON envelope's `data` object is the project map. Treat these fields as authoritative:

- `registry.source_paths`: normal edit locations;
- `generated_paths`: never edit directly;
- `actions` and `surfaces`: current protocol inventory;
- `commands`: exact project commands;
- `agent_policy.completion_command`: required final proof.

Commands in the profile are argument arrays. Execute the program and arguments without rewriting them into a different shell pipeline.

## Procedure

1. Inspect `git status` and recent commits. Do not overwrite concurrent work.
2. Run `action-parity context . --json` and stop if the Manifest is invalid for reasons unrelated to the task.
3. Decide whether the requested behavior is a business Action. Pure presentation stays in the interface.
4. Reuse the existing stable Action ID when behavior is unchanged. For a new business capability, add one namespaced Action ID to the Registry.
5. Implement authorization, confirmation, state mutation, and side effects in the headless Action Core. A GUI dialog alone is never a security boundary.
6. Bind GUI, CLI, MCP, and other required surfaces to that Action. Keep interface code limited to input collection, invocation, and presentation.
   If the Action is not really exposed on every registered Surface, declare its explicit Surface subset in the Registry. Never generate a Binding for a UI or MCP tool that does not exist.
7. Give GUI controls a stable semantic identifier such as `data-action-id` or an automation/accessibility ID.
8. Run the profile's `generate` command. Use generated Action constants and input/output types in TypeScript; never repeat raw Action ID strings when the generated client exists. Do not hand-edit any path listed in `generated_paths`.
9. Run `generate_check`. A drifted or missing generated artifact is a failure.
10. Add or update executable Binding observations. Every required surface must show the request execution ID reaching the same core execution ID.
11. Run `verify_changed` when the profile provides it; otherwise run `verify`.
12. Run the project's normal focused tests, then broader tests in proportion to risk.

## Quick Reference

```text
Discover project     action-parity context . --json
Inventory unadopted  action-parity doctor . --json
Static declarations action-parity validate <manifest> --json
Executable evidence action-parity verify <manifest> --plan <plan> --json
Generated drift     run commands.generate_check from the project profile
```

## Pitfalls

- Never create separate GUI and CLI business implementations.
- Never copy Rust Action IDs into TypeScript when `action-client.ts` is generated; import `ACTION` and the typed client.
- Never treat a Tauri or Electron webview bridge as an externally reachable Agent interface.
- Never claim a named test is verified evidence until `verify` executes it.
- Never bypass core authorization or confirmation from a machine surface.
- Never hide a parity failure by demoting a required surface without a stated exception.
- Never put secrets in stdout, command arguments, evidence output, or generated examples.
- Do not read the full specification by default. Load only the relevant section when a validator code or architectural decision requires it.

## Verification

Work is complete only when all of these are true:

- the Registry is the only business implementation;
- generated files match the Registry;
- required surfaces bind the same Action ID;
- executable observations carry the same execution ID into the core;
- the profile's completion command exits successfully;
- the final report names the Action IDs changed, commands executed, and remaining unverified surfaces.
