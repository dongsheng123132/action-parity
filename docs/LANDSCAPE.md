# Standards and Projects Landscape

**Research date:** 2026-07-24

ActionParity is deliberately narrow: it standardizes the relationship between an application's meaningful actions and all declared human and machine interfaces.

It should reuse existing discovery, transport, schema, accessibility, and automation standards. It should not compete with them.

## The unfilled space

The ecosystem already contains strong answers to these questions:

- How does an agent discover and call a tool?
- How is an HTTP or RPC interface described?
- How can automation inspect and operate a GUI?
- How does an agent send state to a frontend?
- How should high-risk agent calls declare authority and effects?

The ecosystem does not yet have a widely adopted, cross-framework specification that asks:

> Does every meaningful GUI action, CLI command, MCP tool, API operation, and test adapter resolve to the same canonical application Action, and can the application prove it?

ActionParity is intended to fill that gap.

## Comparison

| Project or standard | Primary scope | Reuse in ActionParity | Gap left for ActionParity |
|---|---|---|---|
| [Model Context Protocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | Agent discovery and invocation of tools, resources, and prompts | MCP adapter and schema-derived tools | MCP does not require GUI controls and tools to share one implementation |
| [OpenAPI Specification](https://github.com/OAI/OpenAPI-Specification) | Language-neutral description of HTTP APIs | HTTP adapter and generated clients/tests | Does not define desktop/local App actions, GUI bindings, or parity reports |
| [OpenRPC](https://github.com/open-rpc/spec) | Machine-readable JSON-RPC interface description | IPC/RPC adapter | Does not define human-interface parity |
| [W3C WebDriver](https://github.com/w3c/webdriver) | Remote control of web user agents | Real-interface test driver | Operates interface elements rather than canonical domain actions |
| [Appium Windows Driver](https://github.com/appium/appium-windows-driver) | Windows desktop UI automation through WebDriver and UI Automation | Windows GUI journey tests | Does not define application business semantics |
| [Microsoft WinApp CLI](https://learn.microsoft.com/windows/apps/dev-tools/winapp-cli/ui-automation) | AI- and CLI-friendly inspection and operation of Windows GUI apps | Immediate test driver for WPF, WinForms, Win32, Electron, and WinUI | Tests the GUI surface; does not require a shared Action Core |
| [WAI-ARIA](https://github.com/w3c/aria) and platform accessibility APIs | Semantic interface exposure | Stable names, roles, states, and automation trees | Accessibility semantics do not define domain action contracts |
| [Tauri Commands](https://v2.tauri.app/develop/calling-rust/) | Typed calls from a webview frontend to Rust functions | One possible Action Core adapter | A framework mechanism, not cross-interface conformance |
| [Blender Operators](https://docs.blender.org/api/current/bpy.ops.html) | Reusable operations callable from UI and Python | Mature architectural precedent | Product-specific rather than a portable standard |
| [Apple App Intents](https://developer.apple.com/documentation/appintents) | Exposing application capabilities to system experiences | Apple machine/human adapter | Apple-specific and does not prove GUI parity |
| [AgentReady](https://github.com/agentready-org/standard) | Composed baseline for end-to-end agent usability on the agentic web | Discovery and product readiness ideas | Focuses web products and protocol composition, not native GUI-to-core equivalence |
| [ANIP](https://github.com/anip-protocol/anip) | Risk-aware, governed service capabilities for agents | Effect, cost, authority, rollback, and audit concepts | Focuses agent-facing services, not human GUI bindings or interface testability |
| [AG-UI](https://github.com/ag-ui-protocol/ag-ui) | Event protocol connecting agents and user-facing applications | Event and frontend integration | Connects an agent to a UI but does not define an existing App's action parity |
| [ggui](https://github.com/ggui-ai/ggui) | MCP-based generated graphical interfaces | Generated Surface experiments | Generates agent-driven UI rather than certifying existing app behavior |
| [Schema.org Action](https://schema.org/Action) | Vocabulary for describing actions | Terminology and semantic mapping | No execution, binding, testing, or conformance architecture |

## Important recent development: Windows is already moving

Microsoft's current WinApp CLI documentation explicitly describes `winapp ui` as a command-line interface for AI agents and developers to inspect and interact with running Windows applications.

It supports WPF, WinForms, Win32, Electron, and WinUI 3, and exposes commands for:

- inspecting the UI Automation tree;
- searching by accessible name or AutomationId;
- invoking controls through UI Automation patterns;
- setting values and reading properties;
- screenshots and recordings;
- mouse, keyboard, touch, and pen fallback injection.

This is strong evidence that semantic, command-driven GUI testing is becoming mainstream.

It also demonstrates why ActionParity needs two layers:

1. `winapp ui` can prove that a real button exists, is reachable, and changes visible state.
2. ActionParity can prove that the button invokes the same canonical Action as CLI, MCP, and tests.

## Existing "action parity" practice

The phrase *action parity* already appears in agent-native architecture guidance: whatever a user can do, an agent should be able to do through tools or APIs. Current examples are mostly design advice, audit checklists, or framework-specific practices.

ActionParity turns that useful principle into:

- a versioned manifest;
- normative architectural requirements;
- JSON Schema;
- a portable validator;
- strict coverage math;
- implementation reports;
- a certification path.

## Name research

Names considered included OpenAction, AgentReady, HAIL, ACTUA, OneAction, and ActionParity.

- **OpenAction** already has an active GitHub ecosystem and namespace.
- **AgentReady** is already an open draft standard for the agentic web.
- **HAIL** is already used for "Human-Agent Interface Layer" and several unrelated technical protocols.
- **ACTUA** is used by existing businesses and trademarks.
- **OneAction** expresses the implementation principle but has multiple unrelated product uses.
- **ActionParity** had no same-name specification or repository in the searches performed on 2026-07-24 and precisely names the conformance property.

The recommended public identity is:

```text
ActionParity
One action. Every interface.
```

Chinese:

```text
影核（ActionParity）动作同源标准
一个动作，所有界面。
```

This is a preliminary technical namespace search, not a legal trademark clearance. A professional multi-jurisdiction trademark search is recommended before using the name for paid certification or registering a commercial mark.

## Differentiation statement

When describing ActionParity publicly:

> MCP tells an agent how to call a tool. UI Automation tells a test how to operate a screen. ActionParity proves that the tool and the screen operate the same application action.

That sentence preserves compatibility with adjacent communities and makes the new contribution clear.

