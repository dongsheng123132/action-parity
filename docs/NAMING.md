# Naming Decision

## The decision

One project, one name per language. Not an umbrella name plus a sub-brand.

| Scope | Name |
|---|---|
| Chinese name of the standard | **影核** |
| English name of the standard | **ActionParity** |
| English search alias | **ShadowCore protocol** |
| Chinese descriptor | 动作同源开放标准 |
| English descriptor | open standard for action parity |
| Tagline | 一个动作，所有界面 / One action. Every interface. |
| Repository, package, CLI, wire identifier | `action-parity` |

Write `影核（ActionParity）` on first mention in a Chinese document, and
`ActionParity (影核)` on first mention in an English document. After that, use
the single name that matches the language of the text. The two are the same
standard, not two layers of one.

Architecture vocabulary is translated, not re-branded:

| English | 中文 |
|---|---|
| Action Core | 动作核心 |
| Native shadow | 原生影子 |
| One core, many shadows | 一核多影 |

## Why 影核 is the Chinese name

The image carries the whole architecture in two characters: one authoritative
semantic core, casting native shadows on Windows, macOS, iOS, Android,
HarmonyOS, Linux, web, CLI, TUI, and agent surfaces. Devices exchange actions,
state, and events — not screens.

An earlier draft made 影核 the name of a *cross-device profile* underneath
ActionParity. That was dropped. A two-tier name forces every Chinese sentence
to choose between two brands, which is exactly the inconsistency this document
exists to remove.

## ShadowCore is an alias, not a layer

`ShadowCore` is the literal English reading of 影核, and people will search for
it. Keep it discoverable, and keep it out of the brand hierarchy:

- **Do** write “ActionParity (影核), also known as the ShadowCore protocol” once
  near the top of a README, repository description, or launch post, so all
  three terms are indexed together;
- **Do not** treat `ShadowCore` as a separate specification layer, profile
  name, repository, organization, package scope, or certification brand.

The reason for the split is a translation trap. 影核 *is* “shadow core.” If 影核
named the whole standard while `ShadowCore` named only a sub-profile, the
Chinese and English names would stop being translations of each other, and the
same reader would see one term meaning two different scopes. One name per
language, plus an alias for search, avoids that entirely.

The cross-device sync specification is therefore the **ActionParity Sync
Profile / 影核同步规范** — named by what it does, not by a second brand.

## Why ShadowCore is not the brand itself

`ShadowCore` is a crowded English compound, which is fine for an alias and bad
for a mark. Read-only checks on 2026-07-25:

| Check | Result |
|---|---|
| GitHub repositories named `shadowcore` | 70, including the org `ShadowCore/ShadowCore` and an Android virtualization engine |
| `github.com/shadowcore` | Taken by an existing account — the org handle is unavailable |
| npm `shadow-core` | Taken |
| npm `shadowcore` | Unregistered |
| `github.com/actionparity` | Available |
| npm `actionparity`, npm `action-parity` | Both unregistered |
| `actionparity.org`, `actionparity.cn` | Reported available (Alibaba Cloud `CheckDomain`) |
| `actionparity.com` | No registration record returned (Verisign RDAP 404) |

Availability can change at any time, and none of this is a trademark clearance
opinion. Recheck before any paid registration.

A standard is found by search and by namespace. A name that returns seventy
unrelated projects, and whose organization handle already belongs to somebody
else, is a weak carrier for a conformance claim — the badge has to be
unambiguous or it certifies nothing. `ShadowCore` is therefore not the
repository, organization, package scope, or certification brand.

The alias works precisely because the standalone word does not. `ShadowCore`
alone returns seventy strangers; `ActionParity ShadowCore 影核` returns this
project and nothing else. Publish the three terms together and the crowded word
becomes an extra way in rather than a competitor.

## Compatibility rule

A naming decision must not become a protocol break. The stable wire identifiers
remain:

```text
action-parity
action-parity/sync@0.1
```

An implementation may display 影核 to users while continuing to exchange the
`action-parity` identifier. Changing a wire identifier requires a normal
versioned compatibility proposal, not a marketing rename.

## Public wording

Chinese:

> 影核（ActionParity，亦称 ShadowCore 协议）是面向 AI 时代的软件开放标准：一个
> 产品只有一个权威的动作核心，所有平台界面都是它的原生影子。设备之间同步动作、
> 状态和事件，而不是同步屏幕。因为动作核心可以无界面调用和断言，AI 不用截图猜
> 按钮就能把软件测一遍。

English:

> ActionParity (影核), also known as the ShadowCore protocol, gives a product
> one authoritative Action Core and makes every platform interface a native
> shadow of it. Devices exchange actions, state, and events, not screens — and
> because the core is invocable and assertable without a UI, an agent can
> verify the product without screenshots or a vision model.

Do not write “影核已经是行业标准” or “ShadowCore is already an industry
standard.” This is a working draft and an implementation effort.

Brand ownership, trademark clearance, and namespace reservation are a separate
decision from this one and are not settled here. Nothing above is a trademark
clearance opinion; a professional search is required before any filing.
