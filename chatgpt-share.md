# 设计AI友好网站

## 🧑 USER

Original custom instructions no longer available

## 🧑 USER

我问你一个问题：一个什么样的网站是对 AI 非常友好的？也就是必须要让 AI 来操作非常友好，能让 AI 的 Computer Use 功能在里面做得最流畅。

当然最好是因为 Web 网站可能还是要符合我们的影核协议。也就是说，AI 看到的和人看到的最终是同一个东西，方便 AI 去参与里面内容的提交，大概要符合这个规范。

它和人看到的也要保持一致：

1. 界面 UI 是给人看的，但 Web 的 UI 界面里面有 clean 的东西给到 AI 去操作，最好是这样。
2. 大概就是由 AI 去填写，但展示出来要由人去确认提交。

让这两者保持一致，也符合我们的影核协议，做成一种类似于 Web 方式、网页方式的影核协议。大概是这个样子的，是吧？好像google有webmcp

## 🤖 ASSISTANT

对，你这个方向是成立的，而且可以把它定义得比“给 AI 做个隐藏接口”更严格：**人和 AI 操作同一个状态、同一套动作、同一个结果，只是投影方式不同**。这其实非常符合你“影核协议”的思想。

我先把 Google 你提到的 WebMCP、现有浏览器自动化/Computer Use 的路线核一下，再给你收敛成一套“AI 友好 Web 规范”。

## 🤖 ASSISTANT

对。你描述的东西，和 Google 正在推进的 **WebMCP** 非常接近，但你的“影核协议”可以比 WebMCP 再往前走一步。

Google 对 WebMCP 的定位，本身就是让网站把能力以结构化工具暴露给浏览器里的 AI Agent，而不是让 Agent 每次靠截图、DOM 猜测“这个按钮是干什么的”。网页可以用 JavaScript 注册工具，也可以直接给标准 HTML 表单增加声明，让 AI 获得工具名、说明和 JSON Schema。citeturn288754search2turn919753search0

我会把你要做的东西概括成一句话：

> **UI 给人看，Action 给 AI 用；两者操作同一个状态、执行同一个动作、产生同一个结果。**

这就是很标准的 **Web 版 ActionParity / 影核协议**。

### 最理想的 AI 友好网站，不是“让 AI 更容易点按钮”

而是四层逐级降级：

**WebMCP → Accessibility Tree → Semantic DOM → Vision/Computer Use**

AI 优先看到：

```text
search_jobs(...)
create_draft(...)
update_profile(...)
upload_image(...)
validate(...)
request_submit(...)
```

而不是：

```text
点击坐标 (648, 372)
找到第三个蓝色按钮
输入文字
截图
再判断下一步
```

WebMCP 的价值就在这里：工具绑定的是**应用逻辑而不是 UI 布局**，所以网站换皮、按钮挪位置以后 Agent 仍然可以工作。Google 也明确把它和传统 mouse/keyboard “actuation” 区分开。citeturn288754search0turn288754search2

---

## 但你的影核协议应该比 WebMCP 多一个关键约束

我认为应该把它叫：

**Action Parity：Human UI 与 Agent Action 必须同源。**

例如发布活动。

人看到：

```text
┌──────────────────────────┐
│ 发布活动                  │
│                          │
│ 标题 [深圳 AI 创业者聚会] │
│ 时间 [9/13 14:30]        │
│ 地点 [大公坊]            │
│ 封面 [poster.jpg]         │
│                          │
│      [确认发布]           │
└──────────────────────────┘
```

AI 不应该操作另一套 `/api/agent/create-event`，偷偷把东西直接发出去。

AI 应该看到：

```text
create_event_draft
set_event_title
set_event_time
set_event_location
set_event_cover
validate_event
request_publish
```

然后：

```text
AI → set_event_title(...)
        ↓
同一个 EventDraft
        ↓
网页输入框马上显示变化
        ↓
人看到 AI 填了什么
        ↓
人点「确认发布」
        ↓
Commit
```

**不是两套系统。**

而是：

```text
               Event State
                    │
           ┌────────┴────────┐
           ↓                 ↓
       Human UI          Agent Tools
           │                 │
           └────────┬────────┘
                    ↓
              Action Core
                    ↓
                 Backend
```

这就是你的 **One Core, Many Shadows** 在 Web 上非常自然的实现。

---

## 我甚至建议影核协议明确规定 6 条

| 影核 Web 原则 | 含义 |
|---|---|
| **Same State** | AI 和人操作同一个状态 |
| **Same Action** | AI tool 与 UI action 对应同一个业务 Action |
| **Same Result** | AI 操作后的结果立刻在人 UI 可见 |
| **Visible Draft** | AI 默认修改 Draft，人能检查 |
| **Human Commit** | 支付、发布、删除等关键动作默认人确认 |
| **Audit Trail** | 记录 Human / Agent 谁改了什么 |

这样会解决一个特别重要的问题：

**AI 不能有一个“黑箱后台世界”。**

否则很容易出现：

> AI 说“我已经填好了”。

但人不知道填在哪里。

或者：

> AI 调了 API 发布成功。

但 UI 还是旧状态。

这就违反了影核。

---

### 所以 WebMCP 正好可以成为影核 Web 的一个底层实现

Google 现在已经提供两种路线。

Declarative WebMCP 可以直接把普通 HTML form 转换成 AI 可理解的 Tool，例如表单字段自然变成参数。citeturn288754search4

Imperative WebMCP 则可以定义复杂动作，例如：

```javascript
document.modelContext.registerTool({
  name: "fillEventDraft",
  description: "Fill the visible event publishing form",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      location: { type: "string" },
      time: { type: "string" }
    }
  },

  execute(input) {
    eventDraft.update(input);
  }
});
```

关键不是这段 API。

关键是：

```text
eventDraft.update()
```

既驱动：

```text
Human UI
```

也驱动：

```text
AI Action
```

这才是你的协议核心。

Google 自己也强调 WebMCP 和传统 MCP 不是替代关系：**MCP 更像后端长期能力，WebMCP 是用户正在浏览网页时、针对实时页面和 DOM 的 Agent 接口。** citeturn288754search0

---

## 所以我建议你的整个技术栈这样定

```text
                 AI
                  │
       ┌──────────┴───────────┐
       │                      │
   WebMCP / MCP        Computer Use
       │                      │
       └──────────┬───────────┘
                  │
          Shadow Action Layer
                  │
             Action Core
                  │
          Canonical State
                  │
      ┌───────────┴───────────┐
      ↓                       ↓
 Human Web UI             AI View
```

然后要求每一个重要 Action 都有：

```text
Action ID
Input Schema
Current State
Preview
Execute
Undo / Rollback
Permission
Human Confirmation Policy
Audit Record
```

这已经不只是“AI 友好网站规范”了。

它实际上可以成为一个：

# **ActionParity Web Profile**
### AI-Native Web / 影核 Web 协议

而 WebMCP 是你可以兼容的第一个浏览器标准。

甚至以后可以做到：

```html
<action-parity
  action="event.publish"
  ai="allowed"
  human-confirm="required"
  reversible="false">
</action-parity>
```

---

这里有一个很重要的判断：

**AI 时代最好的网站，不应该追求“Computer Use 点得特别准”。**

最高等级其实应该是：

> **能不用 Computer Use 就不用 Computer Use；但 Computer Use 随时可以接管，而且看到的状态与结构化工具完全一致。**

也就是：

**L0：纯视觉点击**  
↓  
**L1：Semantic HTML / Accessibility**  
↓  
**L2：DOM-aware Computer Use**  
↓  
**L3：WebMCP Structured Actions**  
↓  
**L4：ActionParity——Human/AI 同状态、同动作、同结果**

我觉得 **L4 就可以成为你的影核协议 Web 版真正区别于 Google WebMCP 的地方**。

而且现在时间点非常合适：截至 2026 年 9 月，WebMCP 仍属于 proposed web standard / Origin Trial 阶段，Google 还在快速完善工具、安全和 eval 指南。citeturn919753search1turn919753search3

所以你不需要“另造一个 WebMCP”。更合理的是：

> **影核协议兼容 WebMCP，把 WebMCP 当 AI ↔ Web 的适配层；影核负责定义更上层的“人机同源动作规范”。**

这个定位我认为很顺，而且能直接落到 **BossCLI、TaskPassport、U-King，以及以后你做的 AI 友好招聘/活动/电商网站** 上。memcite

## 🧑 USER

肯定是啊，肯定是啊，就是说要他接有吗？我肯定就要顺着谷歌的这个大佬，你找一下谷歌威远就是有没有有相关的方案，尽量我们就加用它，然后在他这个上面去去去升级，或者说去给他提意见，让他去接受这个就何必我们这个或者合并合并，我们这个这个协议大概是这个样子啊，我们这个科协议推出去和协议协议我们肯定尽量不要去动这个大的协议。尽量能兼容大厂的，看看微软、谷歌、Claude Code 或者 OpenAI 有没有相关的方案，有的话我们就兼容；最好是能让他们合并我们这个影核协议的方案。

你看这个影核协议要不要再升级一下？还是怎么处理？我们的代码要不要升级，你给提个意见，看看是不是要升级。

因为我接下来要开发网站，需要基于这个协议来做，方便我或者别人的 computer use 进行操作，让别人的 AI 能够操作和访问这个网站。

那么这个网站的要求：

1. 要有面向 AI 的地图（AIMAP）
2. 还要支持提交内容等操作lllms ts

## 🤖 ASSISTANT

对，我建议这次不要“另起炉灶造一个新 Web 协议”，而是把影核协议升级成一个**兼容层 + 约束层**：底下尽量吃掉 Google / Microsoft / OpenAI / Anthropic 已经在推的标准，上面只增加“人机同态、可见草稿、人工确认、可审计”这些他们暂时没统一定义的部分。

我现在重点核 5 类东西：**WebMCP、MCP、A2A/Agent2Agent、llms.txt/网站可发现性、浏览器 Computer Use 的语义/可访问性接口**，然后再判断你现有影核代码需要改到哪一层。

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

我已经发现一个很关键的点：**Google 的 WebMCP 已经把你影核思想的一大半写进目标里了**——它明确要求工具在当前页面执行、更新可见 UI，强调 human-in-the-loop、shared context、user control，甚至官方例子就是“AI 先产生 uncommitted changes，人再接受/修改/拒绝”。

所以现在不应该和它竞争；应该把影核协议收缩到 **WebMCP 目前缺失的那一层元数据/约束**，这反而更有机会作为 proposal/PR 往 WebMCP 合进去。

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

对，**要升级，但不是重写影核协议。**我看完现在 WebMCP、Microsoft NLWeb、MCP、OpenAI/Anthropic 的路线，再对照了你现在 `action-parity` 仓库，结论反而比较清晰：

> **ActionParity 不要去和 WebMCP 竞争。**
>
> 应该升级成：**Action Core + WebMCP Profile + Agent Discovery Profile。**
>
> WebMCP 负责“AI 怎么操作正在打开的网页”；  
> MCP 负责“AI 怎么从网页之外调用服务”；  
> llms.txt / Schema.org / NLWeb 负责“AI 怎么理解和发现网站”；  
> **ActionParity 负责保证这些入口和人类 UI 最终调用的是同一个 Action Core。**

你现在这个方向，其实卡的位置很好。

### 先说一个非常重要的新发现

WebMCP **已经不是单纯 Google 自己搞的东西**。

目前 WebMCP 仓库的最初作者/贡献者名单里同时有 Microsoft 和 Google 的工程师，包括 Microsoft 的 Brandon Walderman、Leo Lee、Andrew Nolan，以及 Google 的 David Bokan、Khushal Sagar、Hannah Van Opstal。citeturn861764view1

也就是说，你说“跟着谷歌、微软的大协议走”，现在最应该押的就是：

**WebMCP + MCP。**

而不是再独立发明一个类似协议。

---

# 1. 你的影核和 WebMCP 已经高度重合

Google 当前对 WebMCP 的核心描述已经是：

> 页面提供 Tool → Agent 调用 → 页面自己的代码执行 → **页面状态和可见 UI 更新**。

官方甚至明确写着：

> Site-owned code performs the action and keeps its UI in sync.

citeturn861764view0

这跟你的：

> One Core, Many Shadows  
> AI 和人看到同一个状态  
> AI 操作以后，人 UI 同步变化

已经非常接近。

而且 WebMCP 官方设计目标包括：

- human-in-the-loop
- 用户可以看到变化
- 用户保持控制
- UI 不被 AI API 绕开
- 复用现有 client-side application logic
- AI 失败的时候仍可 fallback 到 DOM / accessibility tree / screenshot Computer Use

citeturn882395view1

甚至官方设计案例已经出现：

> AI 先产生一批 **uncommitted changes**，用户 review / adjust，之后才最终提交。

这基本就是你刚才说的：

> **AI 填，人确认。**

所以这一部分 **不要再另外发明。**

---

# 2. Google 已经直接支持“AI 填，人点提交”

这个对你接下来做网站特别重要。

WebMCP Declarative API 本身就是拿普通 HTML `<form>`，加几个属性：

```html
<form
  toolname="create_event"
  tooldescription="Fill out a new event">
```

表单字段自动成为 AI Tool 的参数。

而且 WebMCP 明确有两种提交方式：

**默认：**

> AI 填好以后，用户手动点击 Submit。

**只有你主动添加：**

```html
toolautosubmit
```

AI 才能够自动提交。citeturn508204search1turn508204search2

所以你的网站我建议直接定一个规则：

```text
READ / SEARCH
    AI 可以自动执行

DRAFT / FILL
    AI 可以自动执行

PUBLISH / PAY / DELETE / SEND
    默认禁止 toolautosubmit
    ↓
    AI 填写
    ↓
    Human Review
    ↓
    Human Commit
```

这个根本不需要你重新设计浏览器协议。

**Google 已经替你铺路了。**

---

# 3. 真正值得影核继续做的，是 WebMCP 还没有解决好的东西

这部分才是你可以贡献给 WebMCP 的。

你现在 ActionParity 0.5 已经定义了：

```json
"effects": {
  "class": "write",
  "risk": "low",
  "reversible": true,
  "confirmation": "never",
  "audit_required": true,
  "rollback_action": "..."
}
```

而且现有协议已经规定：

> confirmation、permission、stale-state rejection、idempotent retry、timeouts 应该由 Action Core 执行，而不是每个 GUI/CLI/MCP 各自实现。fileciteturn8file0L2-L2

你的 Schema 现在也确实已经有：

- read / write / external / financial / destructive
- low / medium / high / critical
- reversible
- confirmation
- audit_required
- rollback_action
- idempotent
- cancellable

fileciteturn10file0L2-L2

**这个恰恰是 ActionParity 现在比 WebMCP 更成熟的一块。**

因为 WebMCP 社区现在正在讨论的正是这些。

例如现在仍有 open issue 在讨论：

- user consent 谁负责、怎么传达 citeturn703062search0
- ToolAnnotations 怎么表达属性 citeturn703062search8
- agent identity / scoped permissions / audit distinguishability citeturn703062search11
- 完成任务之后如何留下可 review 的 workflow document citeturn703062search7
- 当前 visible form value 如何让 AI 和人共享 citeturn703062search9

所以这里反而出现机会了。

**不要对 Google 说：**

> 我有另外一个协议，你们支持我吧。

而应该说：

> We implemented WebMCP over a canonical Action Core and found several reusable semantics around effect, risk, confirmation, reversibility and auditability. Here is implementation evidence and a compatibility proposal.

这样成功率高很多。

---

# 4. 所以我建议 ActionParity 做一个小升级：0.6，不动根

你现在 ActionParity 仓库的定位本身其实已经对：

> meaningful business action once in a headless Action Core，GUI / CLI / MCP / API / automation 都只是 bindings。fileciteturn8file0L2-L2

这个**不要改**。

我建议增加：

## `ActionParity Web Profile`

而不是改成另一个协议。

结构可以变成：

```text
ActionParity Core
│
├── Native Profile
│   ├── GUI
│   ├── CLI
│   ├── TUI
│   └── IPC
│
├── Agent Profile
│   ├── MCP
│   ├── OpenAPI
│   └── Automation
│
└── Web Profile              ← 新增
    ├── Human Web UI
    ├── WebMCP
    ├── Semantic HTML / ARIA
    ├── llms.txt
    ├── Schema.org
    ├── Remote MCP
    └── AI Map
```

注意：

**WebMCP 不是 ActionParity 的竞争协议。**

它是：

```text
ActionParity Action
        ↓
WebMCP Binding
```

就像：

```text
ActionParity Action
        ↓
MCP Binding
```

一样。

---

# 5. AIMAP 要做，但不要把它搞成另一个 WebMCP

这里我稍微调整一下我们之前的设计。

你原来的：

```text
/aimap.json
```

思想是正确的。

但我查了一下，现在 **AIMap** 这个名字已经有人在用，而且 Bishop Fox 的 AIMap 是一个 AI 基础设施安全扫描项目。citeturn577670search0turn577670search6

所以：

### 产品概念可以叫 AIMAP。

但是最好不要现在就宣传：

> 又一个 AIMAP 标准。

更好的定义：

> **AIMAP = ActionParity Web 的 derived discovery map。**

也就是：

**它不是 source of truth。**

它必须从 Action Registry 自动生成。

非常符合影核：

```text
                 Action Registry
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
     Human UI       WebMCP        MCP
        ↓             ↓             ↓
       Web           Agent        Agent
                      │
                      ↓
                    AIMAP
                （自动生成投影）
```

不能：

```text
action-parity.json
aimap.json
WebMCP tool
UI code
MCP server
```

五套各自维护。

这会重新掉进你一直反对的坑。

---

# 6. AIMAP 应该解决 WebMCP 一个真实缺陷：跨页面发现

WebMCP 官方现在有一个明显限制：

> Agent 必须先 visit 网站/页面，才能知道这个页面注册了什么 Tool。

Google 官方文档直接把 **Tool discoverability** 列为 limitation。citeturn158629view0

WebMCP 社区也已经有人专门提出：

> 需要 pre-flight / cross-origin discoverability，让 Agent 进页面前就知道网站能干什么。

citeturn703062search12

还有 open issue 在讨论：

> Tool discovery should not be limited to a single traversable navigable.

citeturn703062search1

**这个就是 AIMAP 最好的切入点。**

但我会把 AIMAP 定义得非常轻。

例如：

```json
{
  "site": "bosscli.cn",
  "profile": "action-parity-web/0.1",

  "content": {
    "llms": "/llms.txt",
    "sitemap": "/sitemap.xml"
  },

  "agent_interfaces": {
    "webmcp": true,
    "mcp": "https://bosscli.cn/mcp",
    "nlweb": "https://bosscli.cn/ask"
  },

  "routes": [
    {
      "path": "/jobs",
      "purpose": "Search jobs",
      "actions": [
        "job.search",
        "job.view",
        "application.draft"
      ]
    },

    {
      "path": "/application/new",
      "purpose": "Create job application",
      "actions": [
        "application.fill",
        "application.preview",
        "application.submit"
      ]
    }
  ]
}
```

它主要回答：

> **这个网站有哪些区域？**
>
> **哪里能做什么？**
>
> **有哪些机器接口？**
>
> **AI 应该先去哪个页面？**

不要把所有 Action JSON Schema 再抄进去。

Agent 到页面以后：

> **以 WebMCP runtime tools 为准。**

---

# 7. 所以 `llms.txt` 也一定要做，但它和 AIMAP不是一回事

你的感觉也是对的。

现在 `llms.txt` 已经发展到 v2，2026 年 8 月刚更新，而且已经有数千网站采用，OpenAI、Anthropic、Gemini 自己的开发者文档也在使用。v2 还增加了标准 `<link rel="describedby">` 和 Markdown alternate discovery。citeturn309226search0turn309226search1

我建议网站固定有四个地图：

```text
robots.txt
    ↓
谁可以访问

sitemap.xml
    ↓
网站有哪些 URL

llms.txt
    ↓
这些内容是什么、AI 应该读什么

AIMAP
    ↓
这个网站能做什么、在哪里做
```

然后还有：

```text
WebMCP
    ↓
当前这个页面现在可以做什么
```

这是非常清楚的职责分工。

所以：

> **llms.txt = Knowledge Map**
>
> **AIMAP = Capability/Navigation Map**
>
> **WebMCP = Live Action Interface**

我觉得这个定义非常好。

---

# 8. Microsoft 的 NLWeb 也值得兼容

Microsoft 的路线也不要漏掉。

Microsoft 推的 **NLWeb** 希望让网站直接成为自然语言接口，而且：

> 每个 NLWeb instance 同时也是一个 MCP server。

citeturn805622search0turn805622search3

NLWeb 还大量复用：

- Schema.org
- RSS
- 网站现有结构化数据
- `/ask`
- `/mcp`

所以如果你的网站内容很多，比如：

- 招聘职位
- 商品
- 活动
- 文章
- 项目
- 服务
- 供应商

我建议：

```text
Schema.org
   ↓
NLWeb
   ↓
MCP
```

也兼容。

不过我不会把 NLWeb 放到核心。

优先级是：

**WebMCP > MCP > llms.txt > Schema.org > NLWeb。**

---

# 9. OpenAI / Claude 怎么办？

更简单。

## Anthropic / Claude

MCP 本来就是 Anthropic 发起的，现在已经捐给 Linux Foundation 下的 Agentic AI Foundation，而且 Anthropic 官方称 MCP 已被：

- ChatGPT
- Gemini
- Microsoft Copilot
- VS Code
- Cursor

等采用。citeturn805622search9

所以：

> **你的服务端 Agent Interface 就押 MCP。**

不需要专门搞 Claude 协议。

---

## OpenAI

OpenAI 现在也明确支持 MCP，而且 ChatGPT 的 MCP 已经开始支持 **write / modify actions**；对于写入操作，ChatGPT 根据权限和上下文可以要求用户确认。citeturn704849search0

Computer Use 仍然应该作为 fallback：

```text
WebMCP
 ↓
DOM / semantic HTML
 ↓
Computer Use
```

而不是反过来。

OpenAI 的 Computer Use 当前依然本质上是：

> screenshot → reasoning → click/type → screenshot

citeturn879187search5turn704849search3

所以你的网站越能通过 WebMCP / semantic DOM 暴露明确动作，它需要瞎点的地方越少。

---

# 10. 我建议你接下来所有网站采用这一套模板

以后 BossCLI、TaskPassport、U-King Web、活动平台甚至你其它网站都按这一套来。

```text
                  Canonical State
                        │
                   Action Core
                        │
       ┌────────────────┼─────────────────┐
       ↓                ↓                 ↓
    Human UI          WebMCP           Remote MCP
       │                │                 │
       │                │                 ├── ChatGPT
       │                │                 ├── Claude
       │                │                 ├── Copilot
       │                │                 └── Gemini
       │                │
       └──────── SAME ACTION ──────────────┘

Discovery Layer
│
├── semantic HTML + ARIA
├── Schema.org
├── sitemap.xml
├── llms.txt
└── AIMAP

Fallback
│
└── Computer Use
```

这才是我认为真正的：

# **AI-Native Website**

---

# 11. 代码我建议升级，而且升级很小

不是大改。

你的 `action-parity` 当前 Schema 的 `surface.kind` 还是：

```text
gui
tui
cli
mcp
api
ipc
test
```

还没有 WebMCP / Web profile。fileciteturn10file0L2-L2

所以我建议下一版 **Manifest 0.6** 做三件核心事情：

1. **加 Web Profile / WebMCP adapter**
   - Action Registry 自动生成 `document.modelContext.registerTool()`
   - 普通 form 优先生成 Declarative WebMCP
   - 复杂动作才用 Imperative WebMCP

2. **加 AI Discovery generator**
   - `/llms.txt`
   - AIMAP
   - Markdown alternates
   - Schema.org
   - 可选 NLWeb

3. **增加 Web Binding verification**
   - `Action ID`
   - Human control
   - WebMCP tool
   - Core handler
   - visible state update
   - confirmation policy
   - 全部自动检查是否同源

而**你现在已有的这些不要动**：

```text
risk
confirmation
reversible
rollback
audit
idempotency
cancellable
```

它们反而是将来拿去给 WebMCP 社区提 proposal 的资本。

---

## 最值得去 WebMCP 提的不是“影核协议”，而是这 3 个小 proposal

我建议不要一次扔一个大协议过去。

先贡献三个非常具体的问题：

**① Standard Action Effects**

```text
readOnly
write
external
financial
destructive
reversible
```

**② Human Commit / Review Semantics**

```text
agent-can-fill
agent-can-draft
human-confirm-required
auto-submit-allowed
```

**③ Site-wide Capability Discovery**

也就是我们 AIMAP 最有价值的部分：

> Agent 在访问具体页面之前，怎样知道整个 site 提供哪些 WebMCP capabilities？

这三个目前 WebMCP 社区都有真实相关讨论，不是你凭空造需求。citeturn703062search0turn703062search8turn703062search12

---

**所以最终定位我建议现在正式改成一句：**

> **ActionParity does not replace WebMCP or MCP. It guarantees that WebMCP, MCP, GUI, CLI and Computer-Use-visible interfaces are projections of the same canonical actions, state and policy.**

中文：

> **影核不定义 AI 如何访问 Web；影核保证无论人通过 UI、AI 通过 WebMCP/MCP，还是 Computer Use 操作网页，最终操作的是同一个动作、同一个状态、同一套权限与确认规则。**

这个定位比我们之前“自己做一个 Web AI 协议”要强得多。

而且你接下来开发网站，我认为可以直接把 **`action-parity-web` / Web Profile** 作为第一优先级落代码。你现在的 `action-parity` 已经有 Action Registry、MCP、HTTP、risk/confirmation/rollback 基础，属于**加 WebMCP generator，而不是推翻重来**。fileciteturn8file0L2-L2

memcite
