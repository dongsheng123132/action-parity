# 影核接入指南：从「读」到「调用起来」

> 面向：用 AI 协作开发软件的人（U-King、本象、本境，以及每一个新项目）。
> 原则来自 2026-08 三方战略审查：**先拿走 20 分钟的 drivability 闭环，
> parity 门禁等触发条件出现再上。**

## 0. 一张表决定你怎么接

| 你的项目 | 接法 |
| --- | --- |
| U-King（已有 89 动作 Registry） | 已接入，见 §1；日常只用三条命令 |
| 新 Node/Electron 项目 | 走 §2 的四步闭环，**不要**一开始上 manifest/verify |
| 任何想让 AI「读得懂、调得起」的存量项目 | 先跑 §3 的 doctor，AI 自己会发现入口 |
| Rust/Tauri 新项目 | 用 §2 同构的 Rust SDK（action-parity-core），模式一致 |

## 1. U-King：已经接好，日常只有三条命令

U-King 的真相源是 Rust Action Core（`src-tauri/src/actions.rs` +
`lib.rs::action_table()`）。仓库根的 `action-parity.config.json` 告诉所有 AI 工具：
真相源在哪、什么不能手改、怎么算做完。

```powershell
# 改了 Rust 动作之后 —— 重新生成投影（manifest + TS client）
pnpm run action-parity:generate

# 提交前 —— 检查生成物有没有被手改/漂移（CI 里也跑）
pnpm run action-parity:check

# 完成判定 —— 产物漂移 + GUI 绑定 + 全动作核心一致性
pnpm run action-parity:verify
```

给 AI 编程工具的最短工作流（Codex / Claude Code / Hermes 通吃）：

```powershell
# AI 进项目第一步：拿结构化动作地图，不读长文档
pnpm exec action-parity context . --json
```

`context` 返回：有哪些动作、风险等级、真相源文件、生成文件清单、完成命令。
AI 之后只改 `actions.rs` / `lib.rs`，跑 generate + verify 收工。

**铁律：`src/generated/` 下的一切禁止手改。** 手改了 `--check` 当场红，
这就是它挡住 GUI 绑定漂移的方式。

## 2. 新项目：20 分钟拿到「AI 能调用的 CLI」

这是审查定的最小闭环。四个文件，没有 manifest、没有 verify——
那些等第二个界面出现再说。

```powershell
# 一条命令生成骨架（0.8.x 起；发布前可 git 钉版本）
npx action-parity init . --flavor electron
```

生成的结构：

```
app/actions.mjs     # 唯一有业务行为的文件：defineAction × N
app/cli.mjs         # 整个 CLI Shadow，两行
app/electron-main.mjs  # GUI 接线：attachElectronIpc(registry)
```

每个动作约 8 行，业务逻辑写在 handler 里：

```js
registry.add(defineAction({
  id: "note.create",
  title: "Create note",
  effects: { class: "write", risk: "low", reversible: true,
             confirmation: "never", audit_required: false },
  input_schema: s.object({ title: s.string() }),
  output_schema: s.object({ note_id: s.string() }),
  run: async ({ title }) => ({ note_id: await save(title) })
}));
```

装依赖后验证：

```powershell
npm i action-parity-sdk        # 发布前：file: 指向仓库 sdk/node
node app/cli.mjs note.list --json
```

## 3. AI 怎么「读能调用起来」（调试带 GUI 的软件的正确姿势）

核心一句话：**GUI 应用 = headless core + 薄壳；调试永远打 core 的 CLI 入口，
GUI 只留给人做最终验收。「AI 调试 GUI」的真正解法是让 AI 不看 GUI。**

AI（Claude Code / Codex / Hermes）面对一个影核项目的标准动作序列：

```
1. action-parity doctor . --json        # 只读盘点，发现这是个什么项目
2. action-parity context . --json       # 动作目录 + 真相源 + 完成命令
3. <app-cli> <action.id> --input-file x.json --json   # 真调用
4. 读 stdout JSON 断言结果 —— 不截图、不点按钮、不猜 DOM
```

调试三层定位法（哪层坏了一眼看出）：

| 现象 | 结论 |
| --- | --- |
| CLI 调用就失败 | 核心/状态/环境问题 —— 修业务层 |
| CLI 成功，GUI Binding 测试失败 | 按钮/IPC 接错 —— 修接线层 |
| 都成功但界面仍不对 | 纯呈现问题 —— 这才轮到截图/UIA |

高风险动作（`confirmation: "always"`）在 CLI 上会被拒并返回 `retry_with`
提示——确认门禁收在核心一处，任何 Surface 都绕不过去。这是特性不是故障。

## 4. 什么时候升级到完整 parity

出现以下任一条，再引入 manifest / bindings / verify：

- 第二个真实界面要接（前端 typed client：`action-parity generate … --typescript`）
- 项目要交给别人维护，或多个 AI 代理同时操作
- 已经被绑定漂移咬过一次

那时的工作流回到 §1 的三条命令，成本已经被第一个界面摊薄。

## 5. 已知边界（诚实声明）

- npm 包 `action-parity` / `action-parity-sdk` 尚未正式发布；
  当前用 git 钉版本或 `file:` 引用（README §Publication 有说明）。
- Windows 上 spawn `.cmd` 垫片的启动 bug 已在 0.8.x 修复
  （此前 verify 在部分 Windows 机器上根本起不来——如果你的旧项目
  verify 从没绿过，先升级工具链再下结论）。
- `verify --changed` 只缩小验证范围，产出 scoped-check，不冒充完整证据。
