# 影核的 Agent 原生开发路线

## 成功定义

影核不是为了让 AI 阅读并背诵一份新规范。它的成功标准是：

> 一个没有读过影核规范的 AI 编程工具，进入项目后仍能发现动作核心、只在正确的位置实现业务、自动生成各机器入口，并用可执行证据证明 GUI、CLI、MCP 没有漂移。

未接入仓库先运行 `action-parity doctor . --json` 获得只读结构盘点；存在 Agent Profile 后再运行 `action-parity context . --json` 获取唯一真相源和完成命令。Doctor 的真实项目数据见 [Redline、照做与 U-King 基准](REAL-PROJECT-BASELINE.zh-CN.md)。

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
action-parity verify --changed --json
action-parity compat --base origin/main --json
```

其中 `--changed` 必须真的选择受影响 Action；未实现前不能在 Profile 中虚假声明。

### P1：框架适配与分发

- Redline 成为第一个真实 Tauri/Rust 实现报告；
- Electron/TypeScript 使用 `defineAction` + Zod 派生 Schema；
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
