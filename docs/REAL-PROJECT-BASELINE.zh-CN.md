# 从 Redline、照做与 U-King 反推影核实践

> 快照日期：2026-08-01。本文不是合规宣传，而是从三个正在由 Codex / Claude Code 开发的真实项目，反推影核下一阶段应该交付什么工具。

## 结论先行

三个项目共同证明了两件事：

1. “一核多影”在真实产品里成立。U-King 已让 GUI、通用 CLI 与 MCP 共用 46 个宿主 Action，动态小程序再贡献 4 个 Action；安全确认、状态版本、进度和 readiness 都能在核心统一执行。
2. 当前采用成本仍然太高。开发者虽然不用再写三份业务实现，却仍在手写 Action 常量、登记表、前端绑定字符串、Schema 与协议版本映射。影核上游必须消灭这些胶水，否则它只是把重复劳动从适配器移到了注册处。

下一阶段的产品目标因此不是“多验证几个字段”，而是：

> 开发者只登记一次类型化 Action；Manifest、TypeScript 客户端、CLI、MCP、帮助、绑定检查与测试骨架全部生成。AI 编程工具进入陌生仓库后，用一条命令发现现状，再用一条命令获得唯一真相源和完成标准。

## 测量方法与边界

现在可以对任意仓库执行只读盘点：

```text
action-parity doctor . --json
```

Doctor 统计源码中可重复观察的结构：Tauri 命令、前端 `invoke`、Action ID 出现位置、Manifest、兼容动作档案、测试定义、机器入口和 AI 指令文件。它不会把每个 Tauri 命令都冒充业务 Action，也不会声称静态扫描等于可执行证据。

本次快照：

| 项目 | Git 快照 | 工作区 | 它代表的问题 |
|---|---|---:|---|
| Redline | `322548cadb09` | clean | 已有同源核心，如何低成本生成其余界面 |
| 照做 | `af89f63bc048` | clean | 无法改造的旧 GUI，如何给 AI 一条诚实的兼容路径 |
| U-King | `5fd248e4f579` | dirty | 大型 Tauri 产品全面接入后，真正的收益和胶水成本 |

U-King 的统计明确记录 `dirty`，扫描只读，没有把当时未提交的供应商列表改动算成可复现发布证据。

复现时把路径换成自己的检出目录；不要把真实用户目录交给写动作：

```powershell
action-parity doctor $env:REDLINE_ROOT --json
action-parity doctor $env:ZHAOZUO_ROOT --json
action-parity doctor $env:UKING_ROOT --json

Set-Location $env:ZHAOZUO_ROOT
python -m unittest discover -s tests -v

$env:UKING_TEST_HOME = Join-Path $env:TEMP "uking-action-parity-sandbox"
Set-Location $env:UKING_ROOT
& .\src-tauri\target\debug\u-king-mini.exe action manifest |
  Set-Content -Encoding utf8 (Join-Path $env:TEMP "uking-action-parity.json")
action-parity validate (Join-Path $env:TEMP "uking-action-parity.json") --json
```

最后一条在本快照中应返回失败，并准确指出版本与 confirmation 枚举漂移；它是发现上游缺口的回归用例，不是 U-King 的通过证明。

## 1. Redline：架构已经对，缺的是生成桥

观察值：

- 9 个稳定 Action ID；
- 41 个 Rust 核心测试；
- 6 个 Tauri 命令，其中业务调用集中到 `redline_call`，其余多为宿主能力；
- 5 个静态前端 `invoke` 调用点；
- Rust 与 TypeScript 各维护一份完整 Action ID 集合，9/9 全部重复；
- CLI 已调用同一个 `dispatch()`，MCP 尚未实现；
- Registry 目前主要提供 ID 与描述，没有类型化输入输出、风险、副作用和生成所需的完整元数据。

这不是“需要重构业务核心”的项目。它最需要的是一个能包住现有 `ACTIONS + dispatch()` 的 Tauri/Rust Adapter：

```text
现有 Redline Registry / dispatch
              │
              ├── 生成 TypeScript Action 常量与类型
              ├── 生成 Manifest
              ├── 生成 CLI help / 通用 call
              ├── 生成 MCP tools
              └── 生成 GUI 绑定漂移测试
```

如果要求 Redline 抛弃现有核心、改写成某个框架专用基类，采用就失败了。适配器必须支持“保留 handler，只补类型化描述”的渐进接入。

## 2. 照做：它是兼容层，不是目标架构

观察值：

- 3 份兼容动作档案；
- 5 个外部 GUI Action；
- 421 行档案，平均每个 Action 84.2 行；
- 22 个回放步骤、7 个业务成功证据；
- 23 个 Python 测试，本次运行 0.027 秒完成；
- 定位路线明确按原生接口、UIA、键盘、OCR/视觉、相对坐标、裸屏坐标逐级降级。

这里的 84.2 行/Action 不能简单理解成“JSON 太啰嗦”。旧 GUI 自动化确实需要记录应用版本、定位器、回退、隐私策略、危险效果和成功证据。真正该消灭的是手工录入，而不是证据本身。

影核对这类项目应提供 Compatibility Adapter：

- 录制与 Profile Builder 自动生成步骤；
- 每次回放记录目标应用版本、实际使用的定位层级、重试次数、耗时和业务证据；
- 默认 dry-run，在最终外部效果前停下并确认；
- 一旦发现官方 API、CLI 或 MCP，自动建议从视觉路线升级；
- 报告必须写明这是外部兼容调用，不能把它包装成目标软件已经“一核多影”。

照做的成功指标不是 Manifest 得分，而是同一应用版本连续回放的成功率、失败定位是否明确、视觉兜底占比是否下降。

## 3. U-King：影核已经产生价值，也暴露了上游缺口

观察值：

- 175 个 Tauri 命令、262 个静态前端 `invoke` 调用点、157 个唯一调用名；
- 46 个宿主 Action：23 个读、23 个写/破坏性 Action；
- 沙箱中由本机现有 0.9.84 调试二进制导出的动态 Manifest 共 50 个 Action，额外 4 个来自小程序；
- GUI 中检测到 22 个 `data-action-id` 标记，21 个 Action ID 同时出现在 Rust Registry 与前端文件；
- 115 个 Rust 测试；
- `actions.rs` 868 行；`lib.rs::action_table()` 772 行；
- 3 份小程序 Manifest 描述 4 个 Action，共 732 行；
- `AGENTS.md` 与 `CLAUDE.md` 合计 624 行，说明 AI 若只能靠读说明书理解动作，代价已经很高。

### 已经得到的真实收益

U-King 不是概念样例。当前实现已经做到：

- `U-King.exe action list|describe|manifest|run|bindings|conformance`；
- `U-King.exe mcp serve`；
- GUI 的旧 Tauri 命令可以逐步变成调用 Action 的薄壳，不要求一次性推倒 175 个命令；
- 写动作在核心强制 `confirm`，而不是只信前端弹窗；
- 写动作可带 `expected_state_version`，陈旧状态直接冲突；
- 长任务统一把进度写到 stderr，stdout 只留最终 JSON；
- readiness 使用 `ready + blockers` 回答“现在能不能用”，避免 `installed:true` 但实际不可用的假绿；
- 新增小程序 Action 后，CLI、MCP 与宿主 Manifest 自动看见，不必分别登记。

这已经回答了“为什么开发者会用”：远程排障和 AI 不再需要截图猜按钮；一个核心门禁同时保护 GUI、CLI 与 MCP；同一只读 Action 自动进入通用回归跑道。

### 仍然昂贵的地方

U-King 的 46 个 Action 仍有至少三类手工真相：

1. `actions.rs` 中的 Action ID 常量与读写清单；
2. `lib.rs::action_table()` 中的描述、Schema、风险与 handler；
3. 前端 `data-action-id` 与调用字符串。

业务实现已经同源，但“描述这个业务”的代码仍会漂移。21 个跨 Rust/前端重复的 Action ID 是直接证据。目标不应是再写一条“禁止漂移”的规范，而应生成前端类型和绑定。

### 上下游协议已经发生真实漂移

把 U-King 本机现有 0.9.84 调试二进制的 `action manifest` 直接交给本仓库 0.5 Schema，结果不通过：

- 动态 Manifest 声明 `spec_version: 0.1.0`，而三个静态小程序 Manifest 已是 0.5.0；
- 23 个写 Action 使用自然的内部策略名 `confirmation: "required"`，当前 wire schema 只接受 `never | conditional | always`。

这不是要求 U-King 再手改 24 个字段，而是证明 SDK 应拥有 wire contract：版本号由 SDK 常量提供，内部的 `Required` 策略在导出时稳定映射为协议的 `always`。开发者不该记忆不同规范版本的字符串枚举。

## AI 编程工具为什么会主动采用

Claude Code、Codex、Hermes 不会因为“标准正确”而主动增加代码。它们会在以下条件成立时采用：

1. **首次发现不需要读规范。** 未接入项目运行 `doctor --json`；已接入项目运行 `context --json`。
2. **修改位置唯一。** Agent Profile 明确 Registry 是真相源、生成文件不可编辑、完成命令是什么。
3. **生成物比手写物多。** 新增 Action 后，CLI、MCP、Manifest、TypeScript 类型和测试骨架自动出现。
4. **失败能定位层级。** Core、Schema、Binding、真实 GUI 分层报告，AI 不需要从截图猜业务错误。
5. **命令可组合。** 非 TTY 无 ANSI/spinner，stdout 是稳定 JSON，stderr 是日志/进度，支持 `--input-file`、`--no-input`、`--yes` 与明确退出码。
6. **测试默认不碰真实状态。** Profile 给出沙箱环境和精确命令；写动作的确认、冲突和权限在核心强制。
7. **旧项目能渐进接入。** 先迁一个垂直切片，原有 GUI 命令继续作为薄壳；不要求一次改完 175 个 Tauri 命令。

AI 的理想工作流应是：

```text
doctor --json        接入前盘点候选入口与重复
        ↓
init                 生成接入骨架（待实现）
        ↓
context --json       找到 Registry、生成物和完成命令
        ↓
只改 Registry + GUI 呈现
        ↓
generate --check     自动同步 CLI / MCP / Manifest / 类型
        ↓
verify --json        真跑证据并输出哈希报告
```

## 上游工具链的第一项实装结果

针对 Redline 的 9 份、U-King 的 21 份 Rust/TypeScript Action ID 重复，本仓库现已完成第一段生成桥：

- `action-parity generate <bundle> --out-dir <dir> --typescript` 从 Registry Manifest 生成 `action-client.ts`；
- 自动生成稳定 Action 常量、JSON Schema 对应的输入输出类型、成功/失败信封、通用 caller 与 Tauri caller；
- 生成文件不依赖 Tauri npm 包，Electron、测试和其他 IPC 也能复用通用 caller；
- Rust 参考样例的 2 个 Action 生成 112 行 TypeScript 合同，但这些行全部不可手改；可编辑 GUI 桥只有 15 行，原始 Action ID 副本为 0；
- 改动 Registry 登记顺序不会改变输出；手改生成 client 后，`generate_check` 会以 drift 失败；
- 生成文件已通过严格 TypeScript 类型检查，输入字段错误可以在运行前暴露。

这还没有冒充 Redline 或 U-King 已完成迁移。下一项实测应当把同一生成桥接入 Redline，比较迁移前后的 9 个前端常量、修改文件数和 CI 漂移捕获结果；随后再用 U-King 的一个垂直切片验证大仓库渐进接入。

Redline 的接入准备又发现一个上游问题：它的 CLI 暴露 9 个 Action，但 GUI 只调用其中一部分，MCP 尚未实现。旧版 Registry 会把每个 Action 与每个 Surface 做笛卡尔积，生成并不存在的 GUI/MCP Binding。现在每个 Action 可用 `.surface("cli")` 等方式选择真实 Surface；Manifest、CLI help、MCP tools 与运行时拒绝共用同一范围。影核不能为了显示“全覆盖”而生成假入口。

## 必须公开的采用指标

影核以后不应以“Manifest 写得多完整”作为主要成功指标。每次真实试点都记录：

| 指标 | 目标 |
|---|---:|
| 新增 Action 的手写真相源 | 1 个 Registry；另允许 1 个 GUI 呈现文件 |
| 手写 wire-format Manifest / MCP / CLI 行数 | 0 |
| 业务 handler 之外的 Action 登记胶水 | 不超过 20 行 |
| 第二个、第三个机器界面的新增适配代码 | 每 Action 0 行，由生成器承担 |
| 受影响 Action 的核心测试 | 10 秒内 |
| GUI/CLI/MCP 漂移 | 故意破坏一次绑定，CI 必须失败 |
| Agent 首次发现真相源 | 1 条命令，无人工指路 |
| Agent 完成任务的人类干预次数 | 记录原始次数，目标逐轮下降 |
| 外部 GUI 兼容回放 | 同版本至少连续 10 次，记录成功率、定位层级和重试 |
| 证据可复现性 | commit、dirty、命令、环境、退出码、耗时、哈希齐全 |

还要分别计时“直接测试 Action Core”和“完整 Tauri/Electron 构建”。本次 U-King 工作区的增量 Rust 构建在 124 秒超时，而照做的 23 个纯逻辑测试只需 0.027 秒。二者不是同一任务，不能拿来做速度排名；它们说明必须把快速动作回归从整套桌面构建中拆出来，供 AI 高频调用。

## 接下来真正该开发什么

按真实痛点排序：

### P0：Wire Contract Kit

- SDK 固定并导出规范版本；
- 内部类型到 wire enum 的版本化映射；
- 旧 Manifest 的读取与升级建议；
- 能力协商，避免 CLI/MCP 客户端猜字段；
- 错误码、取消、进度和 execution ID 的稳定类型。

### P0：Tauri/Rust 渐进 Adapter

- 可包装现有 `dispatch()`，不要求改写业务 handler；
- Rust 类型自动派生输入输出 Schema；
- 生成 TypeScript Action ID、输入输出类型与调用 client（参考实现已完成，待 Redline 实接）；
- 生成 Manifest、CLI help、MCP tools 与绑定测试；
- 允许从 U-King 当前 Action 表渐进迁移，而不是一次重写 46 个 Action。

### P0：Agent Bootstrap

- `doctor`：已实现零配置只读盘点；
- `init`：根据 Doctor 结果生成最小 Registry/Adapter/Profile；
- `context`：已实现接入后的机器项目地图；
- 统一 Skill：Codex、Claude Code、Hermes 共享同一工作流。

### P1：可执行证据与性能切片

- `verify` 只承认可执行测试，不再把测试路径字符串当证据；
- 支持 `verify --changed`，只跑受影响 Action；
- 报告 core、binding、GUI、整包构建各自耗时；
- 记录同一 execution ID 是否穿过 GUI、CLI、MCP。

### P1：照做 Compatibility Adapter

- 录制生成 Profile；
- 回放遥测与版本指纹；
- 自动选择最高可用定位层级；
- 成功证据与危险效果确认进入统一报告；
- 原生机器入口出现后给出迁移提示。

## 暂时不做

- 不扩充评分等级；
- 不同时支持六种语言；
- 不要求所有 Tauri 命令都变成 Action；
- 不把照做的屏幕兼容路径伪装成原生 Action Core；
- 不先做认证收费；
- 不在本地三影还没稳定前做复杂跨设备同步。

## 最终判断

Redline 证明“已有好核心的项目需要生成桥”；照做证明“旧 GUI 需要诚实且可测的兼容层”；U-King 证明“一核多影确实能把远程排障、安全门禁和 AI 调用统一起来”，也证明手写 Registry 胶水与协议版本字符串会成为下一轮瓶颈。

影核获得采用的理由应该非常具体：

> 我只实现一次，AI 就能发现、调用、测试和证明；新增第二个界面时，不再复制业务代码，也不再手写几百行协议对象。
