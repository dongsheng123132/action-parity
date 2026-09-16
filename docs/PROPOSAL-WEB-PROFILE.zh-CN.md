# 影核 Web Profile 提案（草案）

## 决议

影核不替代 WebMCP、MCP、HTML、ARIA、Schema.org 或 `llms.txt`。它规定这些入口与人类界面必须调用同一个 Action Core，并能以可执行证据证明同一 Action ID 与同一 execution ID 到达核心。

```text
Human Web UI ──┐
WebMCP ────────┼──> canonical Action Core ──> canonical state + policy
Remote MCP ────┤
CLI / API ─────┘

Discovery (not an Action implementation):
semantic HTML + ARIA, sitemap.xml, llms.txt, Schema.org, optional AIMAP
```

`web` 是面向人和 Computer Use 可见的界面影子，不是结构化机器入口；`webmcp` 才是当前页面向 agent 注册的、可调用的机器入口。

## WebMCP 绑定

新增 `webmcp` Surface 的目的仅是描述和验证 WebMCP 适配器。它必须是 Action Core 的转发器，不能在浏览器端复制业务、权限、确认、并发或审计逻辑。

每一个 WebMCP Binding 应声明以下将来稳定的元数据（在 schema 进入正式版前保持草案）：

```json
{
  "surface": "webmcp",
  "target": "event.create-draft",
  "webmcp": {
    "mode": "declarative",
    "tool_name": "event.create-draft",
    "auto_submit": false,
    "visible_control": "[data-action-id='event.create-draft']"
  },
  "test": "node --test tests/webmcp-parity.test.mjs"
}
```

`mode` 为 `declarative` 时，适配器应优先使用标准 HTML form 的 `toolname`、`tooldescription` 和字段语义；复杂交互才使用 `imperative` 注册。`auto_submit: true` 只允许 Action 的核心 effects policy 明确允许自动提交时使用。它绝不能覆盖 `confirmation: "always"`，也不能绕过服务端权限、`expected_state_version`、幂等键或审计。

建议的默认矩阵：

| Action 类型 | WebMCP | 提交 |
| --- | --- | --- |
| read/search | 可自动执行 | 无提交 |
| draft/fill | 可填表 | 人工 review 后提交 |
| publish/send/pay/delete | 可准备草稿 | Action Core 与人工确认后提交 |

WebMCP 的浏览器能力仍在演进；协议不应承诺某个未稳定的 JavaScript API 字符串。适配器必须做 feature detection，并在不支持时退回语义 HTML/ARIA，使人类与 Computer Use 仍可完成同一 UI 动作。

## 发现层：职责分开，绝不复制 Registry

| 工件 | 回答的问题 | 真相源 |
| --- | --- | --- |
| `sitemap.xml` | 有哪些 URL | 网站路由/内容系统 |
| `llms.txt` | 哪些内容值得阅读 | 内容/文档目录 |
| Schema.org JSON-LD | 页面和实体是什么 | 页面领域数据 |
| WebMCP | 当前页面此刻可调用什么 | 浏览器内的注册 Binding |
| AIMAP（可选） | 先到哪个页面、哪里有哪类能力 | 显式 Web route/capability 声明 |

因此 `llms.txt` 不应从 Action title 自动合成；它是内容发现文件而不是动作目录。AIMAP 也不得从 `event.create` 这类 Action ID 猜出 `/event` 路由。若实现 AIMAP，应由应用显式声明 route、purpose 和 Action 引用，生成器只投影和校验这些引用均存在于 Registry。

最小 AIMAP 形状如下；它只保留跨页面发现需要的信息，输入/输出 schema 仍以页面上的 WebMCP tool 为准：

```json
{
  "format": "action-parity.aimap/v1",
  "routes": [{
    "path": "/events/new",
    "purpose": "Create an event draft for human review",
    "actions": ["event.create-draft", "event.publish"]
  }]
}
```

## 验收证据

一个 Web Action 不能因为 Manifest 里出现 `webmcp` 或 `data-action-id` 就被宣称已达成 parity。每个 required Binding 需由 `action-parity verify` 运行实际测试，至少观察：

1. WebMCP tool 或 Web 控件使用预期 Action ID；
2. 适配器把一个 execution ID 送入 Action Core；
3. Core 返回的同一 execution ID 出现在结果中；
4. 写操作遵守 confirmation / permission / state-version / idempotency；
5. Web 页面可观察到由该 Action 造成的状态更新或可 review 草稿。

## 分阶段交付

1. **0.6 草案**：增加 `web`、`webmcp` Surface 语义和可执行 Binding evidence；保留现有 Core effects 规则。
2. **参考适配器**：先实现一个真实网页示例（search、create-draft、publish），含浏览器级 evidence；不要先生成虚构的 `registerTool()` 代码。
3. **发现生成**：基于显式 route/capability declaration 生成 AIMAP；由内容系统单独维护或生成合规 `llms.txt`。
4. **上游贡献**：用参考实现和测试结果向 WebMCP 提交三个小而独立的建议：effects/risk annotation、human review/commit 语义、跨页面 capability discovery。

这样影核既追随并兼容大厂 Web 标准，又保留其真正独特的承诺：入口不同，动作、状态、策略和可审计结果仍然同源。
