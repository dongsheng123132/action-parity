# Naming Architecture

## Decision

Use a layered name instead of replacing the whole project:

| Scope | Name |
|---|---|
| umbrella standard | **ActionParity** |
| Chinese cross-device profile | **影核协议** |
| English technical name | **ActionParity ShadowCore Profile** |
| architecture principle | **一核多影 / One Core, Many Shadows** |
| a platform-native UI | **原生影子 / Native Shadow** |
| authoritative behavior layer | **动作核心 / Action Core** |

The short Chinese name has strong meaning: one authoritative semantic core
casts different native shadows on Windows, macOS, iOS, Android, HarmonyOS,
Linux, web, CLI, TUI, and agent surfaces.

## Why not rename everything to ShadowCore

`ShadowCore` is already crowded internationally. Preliminary public searches
found active AI products, Discord frameworks, Android virtualization projects,
packages, and many GitHub repositories using the same or nearly identical
name. That does not decide trademark rights, but it makes `ShadowCore` a weak
standalone international brand and increases search and namespace confusion.

Therefore:

- `影核协议` is the preferred Chinese architecture/profile name;
- `ActionParity ShadowCore Profile` is acceptable descriptive English;
- `ShadowCore` alone is not the repository, organization, package scope, or
  certification brand;
- ActionParity remains the mark considered for professional clearance.

## Compatibility rule

Naming must not create a needless protocol break. The current wire identifier
remains:

```text
action-parity/sync@0.1
```

Implementations may display “影核协议 0.1” to users while continuing to
exchange the stable ActionParity identifier. A future identifier change would
require a normal versioned compatibility proposal, not a marketing-only rename.

## Public wording

Recommended (Chinese):

> 影核协议是 ActionParity 的跨端子规范：一个产品只有一个权威动作核心，所有
> 平台界面都是它的原生影子；设备之间同步动作、状态和事件，而不是同步屏幕。
> 因为动作核心可以无界面调用和断言，AI 不用截图猜按钮就能自己把软件测一遍。

Recommended (English):

> The ActionParity ShadowCore Profile gives a product one authoritative Action
> Core and makes every platform interface a native shadow of it. Devices
> exchange actions, state, and events, not screens — and because the core is
> invocable and assertable without a UI, an agent can verify the product
> without screenshots or a vision model.

Both documents are normative-in-intent drafts and must stay in sync:
[English](SHADOW-SYNC.md) and [中文版](SHADOW-SYNC.zh-CN.md).

Avoid:

> ShadowCore is already an industry standard.

The project is still a working draft and implementation effort.
