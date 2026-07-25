# Compatibility with Existing Standards

**Status:** non-normative design note for the next ActionParity draft  
**Principle:** adopt, map, and verify — do not replace.

ActionParity is not a new wire protocol. It is a conformance layer above existing
interfaces. Its job is to prove that a button, command, tool, RPC method, or test
adapter resolves to the same canonical application action.

```text
                    ActionParity manifest + evidence
                                  │
       ┌──────────────┬───────────┼───────────┬──────────────┐
       │              │           │           │              │
  existing GUI   existing CLI  MCP tool   OpenAPI/RPC   test driver
       │              │           │           │              │
       └──────────────┴───────────┴───────────┴──────────────┘
                                  │
                         canonical Action Core
```

An application does not have to discard its current API, CLI flags, Tauri
commands, accessibility tree, or automation tests. It declares how each of those
existing identifiers binds to a stable Action ID.

## Reuse matrix

| Existing mechanism | Identifier ActionParity should bind | Role |
|---|---|---|
| CLI | command/subcommand path | Machine surface |
| MCP | tool name | Agent discovery and invocation |
| OpenAPI | `operationId` | HTTP API surface |
| OpenRPC | method name | JSON-RPC/IPC surface |
| Tauri | command name | Desktop GUI-to-core adapter |
| VS Code | command ID | Mature command-registry pattern |
| Blender | operator `bl_idname` | Mature UI/script parity pattern |
| Apple App Intents | intent identifier | Apple system/agent surface |
| D-Bus / GAction | action name | Linux desktop surface |
| Qt | `QAction::objectName` or application command ID | Desktop UI binding |
| Windows UI Automation | AutomationId + control pattern | GUI test binding |
| WAI-ARIA | role, accessible name, state | Web/WebView test binding |
| WebDriver / Appium / WinApp CLI | stable selector | Real-interface evidence |

Windows UI Automation, ARIA, WebDriver, and Appium prove that the real GUI can be
found and operated. They do not replace the machine surface or prove that GUI and
CLI implementations are the same.

## Namespaced binding targets

The current manifest keeps `binding.target` as an open string on purpose. New
implementations SHOULD use a namespaced target so existing ecosystem identifiers
remain intact:

```text
tauri:command/render_run
cli:command/t-king/action/run
cli:always-json/--station-test render
mcp:tool/project_render
openapi:operation/projectRender
openrpc:method/project.render
vscode:command/example.project.render
blender:operator/render.render
uia:automation-id/render-run-button
aria:test-id/render-run-button
```

These names do not create new transports. The part after the namespace is the
native identifier of the existing technology.

The exact URI grammar is intentionally not normative in v0.1.0. It should be
stabilized only after at least three independent adapters have implemented it.

## Backward-compatible adoption

Existing software should adopt ActionParity in four steps:

1. **Inventory** — list meaningful GUI actions and the existing CLI/API/RPC
   entry points.
2. **Map** — assign stable Action IDs and publish bindings without changing
   user-facing commands.
3. **Converge** — move duplicate behavior behind one Action Core and turn old
   entry points into thin aliases.
4. **Verify** — add contract, binding, cross-surface, and real-GUI tests.

Compatibility requirements:

- Existing CLI flags SHOULD remain supported as aliases through a documented
  deprecation window.
- A legacy CLI that always writes structured JSON may declare
  `cli:always-json/...` instead of pretending it accepts a `--json` flag.
- Existing configuration, state directories, and file formats MUST NOT be
  silently migrated merely to claim conformance.
- A GUI is not required to spawn a CLI process. GUI and CLI may import the same
  library or call the same local runtime.
- Adding MCP is optional. When MCP exists, its tool should be generated from or
  mapped to the same Action contract.
- An adapter MUST preserve action semantics, not merely call a function with a
  similar name.
- Input defaults that change business behavior MUST be declared. A CLI that
  hard-codes values different from the GUI is not strict parity.
- Legacy aliases and canonical targets SHOULD be present together in migration
  reports.

## What ActionParity adds

Existing standards already solve discovery, transport, schema description, and
GUI automation. ActionParity adds five cross-surface assertions:

1. one stable semantic Action ID;
2. one canonical implementation path;
3. equivalent typed inputs, outputs, effects, and errors;
4. declared mappings to every supported surface;
5. portable evidence that the mappings and real interfaces work.

This is the narrow gap ActionParity should own. Expanding into another general
agent protocol would weaken interoperability and compete with stronger existing
ecosystems.

## Architectural precedents

- [VS Code Commands](https://code.visualstudio.com/api/extension-guides/command)
  bind one command handler to UI, keybindings, extensions, and programmatic calls.
- [Blender Operators](https://docs.blender.org/api/current/bpy.ops.html) expose
  many button and keyboard operations to Python through stable operator IDs.
- [MCP](https://github.com/modelcontextprotocol/modelcontextprotocol) provides
  agent tool discovery and invocation.
- [OpenRPC](https://spec.open-rpc.org/) and
  [OpenAPI](https://spec.openapis.org/oas/latest.html) describe existing service
  methods and operations.
- [Microsoft UI Automation](https://learn.microsoft.com/windows/win32/winauto/uiauto-usefortesting)
  and [W3C WebDriver](https://www.w3.org/TR/webdriver2/) provide real-interface
  inspection and automation.

These are references and adapter targets, not competitors to replace.
