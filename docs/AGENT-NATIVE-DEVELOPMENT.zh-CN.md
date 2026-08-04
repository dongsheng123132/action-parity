# 影核的 Agent 原生开发路线

## 成功定义

影核不是为了让 AI 阅读并背诵一份新规范。它的成功标准是：

> 一个没有读过影核规范的 AI 编程工具，进入项目后仍能发现动作核心、只在正确的位置实现业务、自动生成各机器入口，并用可执行证据证明 GUI、CLI、MCP 没有漂移。

未接入仓库先运行 `action-parity doctor . --json` 获得只读结构盘点；存在 Agent Profile 后再运行 `action-parity context . --json` 获取唯一真相源和完成命令。Doctor 会继续观察 Profile `generated_paths` 中的 Action ID，但不会把生成文件误报成手写重复；Profile 缺失或无效时不应用豁免。Doctor 的真实项目数据见 [Redline、照做与 U-King 基准](REAL-PROJECT-BASELINE.zh-CN.md)。

开发者采用影核的理由也不应是“遵守标准”，而应是新增第二个界面时明显少写代码、少维护一份实现。

## 从本轮实现得到的结论

Rust Action Registry 已经能生成 Manifest、CLI Help 和 MCP Tools，也能执行证据测试。但两动作参考实现仍有较多描述符、JSON Schema、Surface 与测试计划胶水。

因此下一阶段不继续扩大规范正文，而按以下顺序降低采用成本：

1. 让 AI 无需读规范就能发现项目与正确命令；
2. 把每个 Action 的协议胶水压到业务实现之外不超过 20 行；
3. 让生成漂移与 Binding 漂移在几秒内失败；
4. 再包装成 Codex、Claude Code、Hermes 可安装的分发物；
5. 最后再扩展语言、框架和市场认证。

## 已落地的 Agent 入口

项目根目录新增一个很薄的 `action-parity.config.json`。它只回答五个问题：

- Registry 真相源在哪里；
- 当前 Manifest 在哪里；
- 哪些文件是生成物、禁止手改；
- 如何生成并检查漂移；
- 什么命令才算最终验证完成。

AI 首先执行：

```text
action-parity context . --json
```

返回内容包括 Action、Surface、风险、Registry 源文件、生成文件和完成命令。配置中的命令使用 `program + args` 数组，不接受 shell 字符串。

参考实现见：

- `examples/rust-registry/action-parity.config.json`
- `schema/action-parity.agent-profile.schema.json`
- `skills/action-parity/SKILL.md`

## 一份 Skill，三种工具

唯一源位于 `skills/action-parity/`，同步脚本生成仓库级副本：

```text
skills/action-parity/                 唯一源、Hermes/GitHub 分发源
  ├── .agents/skills/action-parity/   Codex 仓库级发现
  └── .claude/skills/action-parity/   Claude Code 仓库级发现
```

运行：

```text
npm run sync:agent-skills
npm run check:agent-skills
```

Hermes 可以从 GitHub 路径安装同一份 Skill，或把共享的 `.agents/skills` 加入 `skills.external_dirs`。不维护 Hermes 专属业务流程。

官方扩展依据：

- Codex 在仓库中扫描 `.agents/skills`，Skills 使用开放 Agent Skills 格式：https://developers.openai.com/plugins/build/skills
- Claude Code 项目 Skill 位于 `.claude/skills`：https://code.claude.com/docs/en/slash-commands
- Hermes 支持 GitHub/URL 安装和外部 Skill 目录：https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md

## 下一实现顺序

### P0：把 Action 变短

第一步已经落地：`Registry::register_typed` 直接从 Rust 输入输出类型派生 JSON Schema，统一在 Action Core 完成反序列化并返回稳定错误信封。参考样例已经删除手写输入输出 Schema；低层 `ActionDescriptor` 仅保留为特殊 Schema 的逃生口。

下一步再把已经稳定的 `ActionDefinition + register_typed` 收敛为属性宏，目标形态：

Rust 目标形态：

```rust
#[shadow_action(id = "note.create", risk = "low", effect = "write")]
async fn create_note(input: CreateNote) -> Result<CreatedNote, NoteError> {
    // 唯一业务实现
}
```

SDK 自动完成 Schema 派生、Action 收集、默认 Execution、统一错误信封、Manifest/CLI/MCP 生成与测试骨架。

### P0：补齐 Agent 快循环

计划增加：

```text
action-parity init --agent all
action-parity compat --base origin/main --json
```

**已落地：`verify --changed`。** 只重跑改动能触及的 Action：

```text
action-parity verify <manifest> --changed [--base <ref>] [--json]
```

难的不是「选出受影响的 Action」，而是**拒绝错误地选**——跳过太多的快速检查，就变成了对覆盖范围的虚假声明。

归属信息放在 **verify plan，不在 Manifest**。Manifest 描述调用方依赖的接口；哪些文件实现了某个 Action 属于本地构建布局。所以用 `plan.sources` 把 Action ID 映射到路径 glob，**已发布的 wire format 仍停在规范 `0.5.0`**：

```json
{
  "sources": {
    "task.create": ["src/actions/create.mjs"],
    "task.delete": ["src/actions/delete.mjs"]
  },
  "scope_ignore": ["docs/**", "*.md"]
}
```

**每一条收窄路径都必须是 plan 明确授权的**：

- `plan.sources` 把改动文件映射到它实现的 Action；
- 改了某个已声明的测试文件，选中绑定到它的 Action；
- 改了 Manifest，只选条目真正变化的 Action；但 surfaces、spec 版本、application 身份变化或删除 Action 会 widen 成全量，因为这些会重新丈量每一条 Binding；
- `plan.scope_ignore` 声明那些可证明不影响行为的路径。

**其余一律 widen。** 归属不明的文件、verify plan 自身被改、base 版本取不到、根本不在 git 仓库里——含义都一样：工具无法证明什么是不受影响的，于是全跑，并说明原因。

**scoped 运行的报告格式是 `action-parity.scoped-check/v1`，绝不是 `action-parity.evidence/v1`。** `verified` 恒为 `false`，audit 上限永远到不了 AP-2——部分执行的结果不能被归档成整份 Manifest 的证据。

### P1：框架适配与分发

**已落地：Node / Electron / TypeScript SDK。** `action-parity-sdk`（[说明](NODE-SDK.md)、[样例](../examples/node-registry)）提供 `defineAction` + `defineSurface` + `createRegistry`，并自带四个只做转发、不含业务的机器入口：

- `action-parity-sdk/cli`：从输入 Schema 生成参数、帮助、退出码的 CLI；内置 `list` / `describe` / `export` / `mcp` 子命令；
- `action-parity-sdk/mcp`：真正可跑的 MCP stdio 服务（Rust 预览版此前只生成 `mcp-tools.json`，不带传输层）；
- `action-parity-sdk/electron`：单通道 IPC 桥 + GUI 目录（带稳定 `data-action-id`）；
- `action-parity-sdk/http`：远程/影子端入口，HTTP 状态码由错误 class 推导。

确认、权限、`expected_state_version` 冲突、幂等键重放、超时与取消、输出 Schema 校验全部下沉到核心，四个界面共用同一份规则；Electron 桥默认不信任 renderer 声称的 `confirmed`，在主进程重新询问。Schema 用零依赖的 `s` 构造器，或 `fromStandardSchema(validator, jsonSchema)` 接 Zod/Valibot/ArkType——**JSON Schema 必须显式给出**，否则校验库升级会悄悄改写已发布的接口。

样例的 16 条 Binding 由四个真实传输的可执行证据验证通过：

```text
npm run generate:node-example
npm run verify:node-example
```

剩余项：

- Redline 成为第一个真实 Tauri/Rust 实现报告；
- 同一 Skill 包装为 Codex Plugin、Claude Plugin 和 Hermes 可安装 Skill；
- Hooks 只负责阻止手改生成文件和触发快速检查，不成为核心依赖。

### P2：开发期 MCP

在 CLI 工作流稳定后，再暴露少量结构化开发工具：

```text
project.inspect
action.list
action.scaffold
generate
verify
compat.check
```

MCP 是可选传输层；Skill + CLI 仍是 CI、人类和三种 Agent 的共同基础。

## 当前进度对照

| 阶段性硬目标 | 状态 |
| --- | --- |
| 业务实现之外的 Action 注册代码不超过 20 行 | 达成：Node 样例中每个 Action 的协议胶水约 10 行 |
| 第二个界面的新增业务代码为 0 | 达成：CLI 3 行、MCP 3 行、HTTP 8 行，加 Action 时都不改 |
| 生成文件手改次数为 0 | 由 `npm run check:generated` 强制 |
| 三个 Surface 到达相同 `execution_id` | 已扩展为四个（GUI/CLI/MCP/HTTP），16 条观测 |
| 受影响 Action 的快速验证约 10 秒内完成 | 部分达成：`verify --changed` 已实现并有测试，但耗时取决于项目自己声明的 `plan.sources` 粒度。本仓库的 Node 样例四个 Action 共用一个 `src/core.mjs`，改它仍然全跑——**只有按 Action 拆分实现文件的项目才拿得到这个数**，不能一概声称达标 |
| 三个 Agent 不读完整 SPEC 完成同一任务 | 未测：采用实验尚未跑 |

## 采用实验

给 Claude Code、Codex、Hermes 同一个任务：

> 为真实 Tauri 应用新增一个 Action，同时提供 GUI、CLI、MCP，并通过影核验证。

每次实验记录：

- Skill 自动命中率；
- 首次验证通过率；
- AI 阅读文件数、工具调用数、Token 与耗时；
- 新增 Action 的手写协议代码量；
- 是否错误修改生成文件；
- 第二个界面增加的业务代码量；
- 故意破坏 GUI Binding 后是否被 CI 捕获；
- 三个 Surface 是否到达相同 `execution_id`。

阶段性硬目标：

- 业务实现之外的 Action 注册代码不超过 20 行；
- 第二个界面的新增业务代码为 0；
- 生成文件手改次数为 0；
- 受影响 Action 的快速验证约 10 秒内完成；
- 三个 Agent 都能在不阅读完整 SPEC 的情况下完成同一任务。

这些可复现实验数据比徽章、评分和更多条款更能推动采用。
