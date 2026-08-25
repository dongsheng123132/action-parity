# 提案：把「不许沉默」从声明层延伸到观测层 —— 观测记账（Observation Accounting）

> 日期：2026-08-08 · 针对 0.5.0 规范 / 0.7.0 工具链
> 状态：**提案，未采纳。** 参考实现已在 U-King 试点落地（见 §6），规范正文未改。
> 提出者：从 U-King 试点的一次真实实现中反推出来，不是设计推演。

## 0. 一句话

**一个只读动作返回空，现在有两种完全不同的意思——「这台机器上确实没有」和「我没看到」——
而规范让它们长得一模一样。**

## 1. 问题：同一个 bug 在两个层次上各咬了一次

2026-08-08 在 U-King 试点实现 `runtime.ai_tasks.inspect`（读本机各家 AI 的会话记录，
汇总成一块任务看板）。同一天，同一个失败模式出现了两次：

**第一次，动作层。** 这个动作聚合五个来源（Claude Code / Codex CLI / Hermes /
OpenClaw / 本地看板）。若客户机上五个目录一个都读不到，它返回：

```json
{ "days": 7, "tasks": [], "counts": { "total": 0 }, "sources": [], "notes": [] }
```

形状完全合法，`output_schema.required` 全齐，`action conformance` **全绿**。
可这台机器上到底是「没装过任何 AI」，还是「装了但我们路径写错了 / 没权限 / 对方换了格式」？
**报告是对的，世界是空的，而两者在协议层没有任何区别。**

这不是假想。同一天真撞上三个会让它静默变空的原因：Claude Code 的子代理记录藏在
多一层目录里、Codex 的标题字段不在我们以为的那个位置、Hermes 目录里混着
`request_dump_*.json`（出错转储，不是会话）。任何一个判断写错，结果都是
「少读到一批、动作照样绿」。

**第二次，验证层。** 同一天写的 Playwright 跑道里，有一条「关掉某个来源后卡片应该变少」
的断言。选择器因为图标 `<img alt>` 污染了无障碍名而**静默匹配到 0 个元素**，
而代码写的是「找不到就跳过这条断言」——于是**一条从未执行过的检查报告了通过**。

两次是同一件事：**零观测被当成成功**。一次发生在动作里，一次发生在验证器里。

## 2. 为什么这是 OS 级的问题，不是一个 bug

三协议的终点是 ShadowOS。影核在其中是**系统调用面**。

一个 OS 的 syscall 如果把「权限不足」和「目录本来是空的」都返回空列表，
建在它上面的每一个程序都会算错，而且**错得毫无征兆**。POSIX 早就解决了：
`opendir` 失败返回 `NULL` + `errno=EACCES`，不是返回一个空目录；
`read()` 返回 0 是 EOF 这个**明确语义**，不是「成功但没数据」这个含糊状态。

影核现在的只读动作，处在 POSIX 之前的状态：**只有「成功」和「异常」，
没有「成功，但我只看到了世界的一部分」。** 而 AI 恰恰是最容易被这个含糊状态骗到的调用方——
它拿到 `total: 0` 会如实转述「你这台机器上没有任何 AI 任务」，语气和真相一样笃定。

## 3. 规范里其实已经有正确的原则，只是没延伸到这一层

SPEC 0.5.0 已经把这条讲得很好，两处：

> §3：Partial adoption is a first-class outcome... **What conformance forbids is silence:**
> an Action omitted without a declared exception.

> §7：Demoting a Surface removes it from the parity denominator, which raises coverage
> without changing the product... **Exclusion remains permitted; concealing it does not.**

**「可以缺，不可以瞒」——这条原则是对的，但它今天只管到声明层**（有哪些动作、有哪些 Surface），
**管不到运行时**（这次调用实际看到了什么）。本提案不引入新概念，只把已有原则往下延伸一层。

对照本象 CORE 的五概念，这属于**校验**（「可核对即承诺；未钉死如实标注」）的直接展开，
不是第六个概念，因此不触发核心评审。

## 4. 市面上有没有现成答案：邻域有，agent 工具这层没有

**先查再造。** 结论是这一层确实空着：

| 生态 | 有没有 | 形状 |
|---|---|---|
| **MCP**（2025-06-18 规范） | ❌ **没有** | 只有二元 `isError`（协议错 / 执行错）。读五个来源只读到三个，标准里**无法表达** |
| POSIX | ✅ | `errno` 把「失败」和「空」彻底分开；`readdir` 出错不返回空目录 |
| Elasticsearch | ✅ | `_shards: {total, successful, skipped, failed}` 与结果同返，聚合是否完整可自行判断 |
| GraphQL | ✅ | `data` 与 `errors` **同时**返回，部分失败是一等结果 |
| OpenTelemetry OTLP | ✅ | 导出响应带 partial success（被拒条数 + 原因） |
| Kubernetes | ✅ | conditions 带 `reason` / `message`，不靠空值表达状态 |

MCP 这一条尤其要紧：**影核动作正是通过 MCP 暴露给 AI 的**。上游标准这层是空的，
意味着我们即便自己做对，也得自己定形状。这是可以吸收形状、但必须自己立约定的位置。

采用 Elasticsearch `_shards` 的记账思路 + GraphQL 的「部分结果是一等公民」，
落成影核自己的方言。

## 5. 提案

### 5.1 新增可选声明：`observes`

只读动作若其结果**由多个可独立失败的来源汇总而成**，其规格 SHOULD 声明来源清单：

```
observes: ["claude", "codex", "hermes", "openclaw", "board"]
```

单一来源、且来源不可用时必然抛错的简单读，**不需要**声明（不制造无谓负担）。

### 5.2 声明了 `observes` 的动作，返回值 MUST 带记账

结果 MUST 含 `sources` 数组，**每个已声明来源恰好一项**，每项至少：

| 字段 | 含义 | 为什么必须 |
|---|---|---|
| `present` | 这个来源在这台机器上存在吗 | 分开「没有」与「有但读不了」 |
| `readable` | 我们读得动吗 | 读不动是**我们的**限制，不是世界的事实 |
| `count` | 从它这儿得到几条 | 样本量。0 必须能被解释 |
| `note` | `count == 0` 时 MUST 非空，说明为什么 | 这就是「不许沉默」 |

以及顶层的 `truncated`（是否因上限截断）——**截断了就得说，不能装作全看过**。

### 5.3 零观测 MUST 是显式状态

**MUST NOT** 用空数组表达「什么都没有」。`total == 0` 时，`sources` 仍须逐项列出并各自解释。
一个来源 `present: true, readable: false` 的 0，与 `present: false` 的 0，
**在语义上是两个不同的结果**，调用方必须能区分。

### 5.4 验证器：零观测且无记账 = 违规

`conformance` MUST 对声明了 `observes` 的动作追加检查：

1. `sources` 覆盖全部已声明来源（少一个 = 违规）；
2. 任何 `count == 0` 的来源，`note` 非空（空 = 违规）；
3. 顶层 `truncated` 存在。

**注意这不是「读到 0 条就算失败」。** 客户机上没装 Ollama 是事实不是 bug ——
这和 §7 的 `not_ready` 一样，如实报出来即可。**违规的是没有记账，不是数字小。**

### 5.5 验证器自身也适用（第 1 节的第二次翻车）

同一条原则递归适用于验证器：**一条没有执行的断言 MUST NOT 计入通过。**
定位器匹配 0 个元素、依赖的前置条件不满足、用例被跳过 —— 一律记为
「未证明」而不是「通过」。这与 SPEC §14「验证器报告违规与**未证明**两张清单」
的既有设计一致，本提案只是明确它对**跑道自身**也成立。

## 6. 参考实现（U-King 试点，已跑通）

`runtime.ai_tasks.inspect` 已按 §5.2 实现，实测本机：

```
claude    present=true  readable=true  count=158
codex     present=true  readable=true  count=22
hermes    present=true  readable=true  count=0    note="只认 session_*.json；request_dump_* 是出错转储"
openclaw  present=true  readable=true  count=1
board     present=true  readable=true  count=23
```

以及一条**空机器**的实测（阿里云干净 Windows Server 2022）：五个来源全部
`present=false` 且各自带 note，`total=0`，不崩、不瞎报。
**这正是提案想保住的那个区别**：空机器的 0 和读不动的 0，长得不一样。

### 6.1 验证器上线第一次跑，就逮住了它自己的参考实现

把 §5.4 的检查加进 `conformance` 之后**第一次运行**，结果不是全绿：

```
runtime.ai_tasks.inspect  fail
  来源 `hermes` 是 0 条却没写 note —— 「没有」和「没读到」必须分得开
```

Hermes 的目录存在、读得动，但回看窗口内 0 条会话，而 `note` 只在「目录不存在」时才填。
界面上呈现出来就是一个光秃秃的 **「Hermes 0」** —— 用户和 AI 都无法判断这是
「它最近没干活」还是「我们没读到」。**写提案的人自己的实现，第一时间就违反了提案。**

这本身是这条规矩最有力的证据：它拦下的不是假想的错误，是**连作者都没意识到自己犯了的**那种。
补完解释后 conformance 恢复全绿；红→绿的这一次转换，同时也充当了这条检查的变异验证
（一条不会失败的检查等于没有检查）。

修完之后各来源如何交代自己的 0：

```
hermes    present=true readable=true count=0   "装了，但最近 7 天内没有新会话"
```

其中最值得留意的是这一条分支——**有文件、却一条都没解析出来**：

```
"窗口内有 N 个文件却一条都没解析出来 —— 多半是它换了记录格式，该查"
```

这正是本提案想让人看见的那类 0：**它长得像「没有」，其实是「我们的解析器过期了」。**

### 6.2 一个副产品：`readable` 逼着实现者去回答问题

顺带修正一条我自己犯过的错：最初我断言「OpenClaw 的会话在 SQLite 里，本版读不了」，
并据此写了 `readable: false`。后来实际去查，那个 sqlite 六十多张表几乎全空、只是索引，
真正的会话是 `<home>/agents/*/sessions/*.jsonl` 纯文本 —— **读得动**。
这件事本身就是本提案的论据：`readable` 这个字段逼着实现者去回答「到底读不读得动」，
而不是让一个含糊的空结果替他把话说了。

## 7. 建议不做的事

- **不改核心五概念。** 这是「校验」的展开，不是第六个概念。
- **不给所有只读动作加负担。** 只有多来源汇总才需要 `observes`。
- **不把「读到 0 条」判为失败。** 那会逼实现者去粉饰数字，正好和目的相反。
- **不等 MCP 上游。** 那层现在是空的，等不来；我们先立，若上游后来有了再对齐。

## 8. 待拍板

1. `observes` 进 0.6.0 规范正文，还是先留在提案 / 审计档？
2. 字段名：`count` 还是 `observed`？`note` 还是 `reason`（K8s 用 reason）？
3. §5.5（验证器自身）是写进 SPEC §13，还是只写进工具链文档？
