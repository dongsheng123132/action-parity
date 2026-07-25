# Launch Playbook

This document turns the specification into a public launch.

## Repository metadata

**Name**

```text
action-parity
```

**Description**

```text
Open standard for one canonical app action across GUI, CLI, MCP, automation, and AI.
```

**Topics**

```text
ai-native
agent
gui-testing
cli
mcp
desktop-automation
accessibility
software-architecture
open-standard
action-parity
```

## 15-second pitch

> ActionParity is an open standard for applications whose GUI, CLI, MCP tools, and tests all invoke the same canonical Action Core. It makes AI-native behavior measurable without pretending real GUI testing is unnecessary.

## 60-second demo

Show one U-King action:

1. click **Diagnose** in the GUI;
2. show the emitted `environment.diagnose` Action ID and execution ID;
3. run the same Action from CLI with JSON output;
4. invoke it as an MCP tool;
5. show the GUI updating from the CLI invocation;
6. break one binding;
7. run the validator and show the parity failure;
8. restore it and publish the AP report.

The demo should stay under 90 seconds and show evidence rather than architecture slides.

## Suggested launch titles

### Hacker News

```text
Show HN: ActionParity – one app action across GUI, CLI, MCP and AI
```

### Reddit / developer communities

```text
We are drafting an open standard for apps where GUI and agent tools share one Action Core
```

### Chinese developer communities

```text
我们开源了影核（ActionParity）：让 GUI、CLI、MCP 与 AI 共用同一个动作核心
```

## First public post

```text
AI can now write much of an application, but it still struggles to test and operate the GUI it created.

The usual workaround is Computer Use: screenshots, guessed buttons, injected clicks, and more screenshots. That remains useful for visual verification, but it is a fragile foundation for business behavior.

ActionParity (影核), also known as the ShadowCore protocol, proposes a stricter architecture:

- define each meaningful action once in a headless Action Core;
- bind GUI, CLI, MCP, API, and tests to the same Action ID;
- publish typed inputs, outputs, effects, and safety policy;
- prove parity with a machine-readable report;
- retain real UI Automation and visual tests for the interface itself.

MCP makes tools callable. UI Automation makes screens operable. ActionParity proves they perform the same action.

The v0.1 draft includes a specification, JSON Schema, validator, U-King pilot manifest, governance, adoption plan, and commercial-neutrality model.

This is an early working draft. We are looking for desktop app maintainers, QA engineers, accessibility experts, and agent-tool developers to challenge it with real implementations.
```

## 中文首发文案

```text
AI 已经可以写出大量 GUI 软件，但它往往无法可靠测试自己做出来的界面。

现在的办法通常是 Computer Use：截图、猜按钮、模拟鼠标、再截图。这适合视觉验收和兼容旧软件，却不适合成为业务功能测试的地基。

我们开源了影核（ActionParity，亦称 ShadowCore 协议）——一套动作同源开放标准：

- 每个有业务意义的动作，只在无界面的 Action Core 中实现一次；
- GUI、CLI、MCP、API 和测试全部绑定同一个 Action ID；
- 动作公开输入、输出、副作用、权限和风险；
- 构建时生成机器可验证的一致性报告；
- 真实 GUI 仍通过 UI Automation、无障碍树和截图进行验证。

MCP 让工具可以调用，UI Automation 让界面可以操作，影核证明它们做的是同一件事。

一个产品只有一个权威动作核心，所有平台界面都是它的原生影子——这就是“影核”。

v0.1 工作草案已经包含规范、JSON Schema、验证器、U-King 示例、治理方案、推广路线与商业中立原则。

这不是已经完成的行业共识，而是一次公开邀请：欢迎桌面应用开发者、测试工程师、无障碍专家和 Agent 工具开发者拿真实项目来挑战它。
```

## First 30 days

### Week 1

- Publish the repository and v0.1.0 draft release.
- Enable Discussions.
- Pin the manifesto, specification, and U-King pilot issues.
- Record the short concept demo.

### Week 2

- Run the UI Automation baseline against U-King.
- Publish control-tree findings and screenshots.
- Open the Electron adapter design RFC.

### Week 3

- Implement the first two U-King Actions.
- Publish CLI and GUI binding tests.
- Invite maintainers from Electron, Tauri, .NET, MCP, and QA communities.

### Week 4

- Publish the first implementation report.
- Measure test speed and flake reduction.
- Hold a public design review.
- Select issues for draft 0.2.

## Metrics that matter

- independent implementation reports;
- specification issues from non-founders;
- framework adapters;
- reproducible conformance runs;
- reduction in GUI-test time and flakiness;
- applications publishing a strict score;
- contributors from accessibility and security communities.

Stars and impressions are useful distribution signals, but they are not evidence of a standard.

