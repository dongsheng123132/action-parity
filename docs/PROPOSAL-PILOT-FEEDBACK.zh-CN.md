# 提案：把三个试点真实踩过的坑反哺进规范 —— 试点反馈清单（2026-08）

> 日期：2026-08-26 · 针对 0.5.0 规范 / 0.8.0 工具链
> 状态：**提案，未采纳。** 其中工具链条目 K1 已在 `src/exec.mjs` 落地修复（PR #15），其余待拍板。
> 提出者：U-King、2origin（本象）、u-env（本境）三个下游项目的真实故障记录，
> 经外部模型聚类定级后逐条人工核实。每一条都先发生过，才被写在这里。

## 0. 一句话

**「没有观测」只能得出未知或受阻，绝不能得出通过；「声明了绑定」也不能替代运行时证据。**

这是 14 条坑收敛后的唯一原则。它们分别证明：零观测会被当成功（K11）、
未执行的闸门会被当已执行（K10）、未绑定的动作会被计入覆盖分母（K5）、
缺失的指纹维度会被当成齐平（K13）——四种伪装，同一个病。

## 1. 坑从哪里来

| 项目 | 角色 | 坑源 |
| --- | --- | --- |
| U-King | 影核第一个参考实现（Tauri/Rust 桌面，89 动作） | `docs/ACTION-PARITY-PILOT.zh-CN.md`、`docs/AI专家工作台-开发文档.md` §六、`docs/需求榜.md` |
| 2origin 本象协议 | 学历/证据协议，影核动作核心在其南桥落地 | `southbridge/benjing-core.mjs` 缺陷注释②④⑤、`shadowcore-core.mjs` 头注、RFC-0004 §6.3 |
| u-env 本境协议 | Windows 环境诊断（`uenv doctor`），与 U-King envfp 对账 | `tools/crosscheck-uking.mjs` 映射表标本注释、`docs/12-与-U-King-envfp-的口径对账.md` |

## 2. 清单总览

严重度：**P0** = 规范缺陷（不堵住，验证报告会说谎）；**P1** = 工具链增强；
**P2** = 文档。重合标记：〔M〕与《Manifest 扩展命名空间》提案相关；
〔O〕与《观测记账》提案相关；〔新〕两份提案都没覆盖。

### 第一优先：先堵假阳性 —— 未绑定、未执行、未观测、缺维度不能再伪装为通过

**K5〔P0〕〔M〕〔O〕 unbound 不等于坏绑定。**
46 个宿主动作只有 21 个有稳定 GUI 控件，试点如实标 unbound 不制造虚假覆盖。
但规范现在无法区分「声明了没做」和「做了但坏了」。建议：Binding 增加
`intent: bound | unbound`（声明层），验证结果另设
`binding_health: healthy | broken | not_observed`(观测层)；unbound 不进覆盖分母。

**K10〔P0〕〔O〕 import 了不等于执行了。**
`exam.mjs` 第 26 行 import 了校验函数，全文一次没调用；
`{status:'verified', exam:{runs:0}}` 一路绿灯落盘。一个纯装饰的闸门，
跟「没人加载的 schema」是同一个病。建议：验证声明增加
`verification_steps[] {id, required, min_successful_runs}`，每步必须产出运行时
`verification_receipt`，否则 `verified` 非法；验证器把「导入存在」视作零证明。

**K11〔P0〕〔O〕 某 Surface 全程零观测必须报警。**
MCP 通道被 harness 的工具审批闸门整体堵死（audit.log 零记录），无人察觉——
这正是《观测记账》提案的验证器侧案例的最强实例。建议：
`surface_observation_expectations[] {surface, required, min_attempts, min_receipts}`；
required 的 Surface 整轮 0 观测 ⇒ 结果必须是 `inconclusive` 或 `blocked`，不能 `pass`。

**K13〔P0〕〔M〕〔O〕 指纹缺维度不许假装齐平。**
U-King 指纹缺 WebView2 维度，而缺它时应用静默假死。对账表里 `uking: null`
= 「这个维度不存在」，必须显式列出而不是省略。建议：agent-profile 的
fingerprint 用固定键集合，`null` 表示「已探测、不可得」；缺必要维度 ⇒ 兼容性结论只能是 `unknown`。

### 第二优先：可追溯证据

**K6〔P0〕〔O〕 headless_evidence 需要正式证据包格式。**
建议 `$defs.evidenceBundle`：`spec_version`、`manifest_sha256`、`source_commit`、
`artifacts[] {path, sha256, size}`、`report_sha256`、`producer`、`created_at`。
区分「声明有效」与「本次构建已验证」（试点原话）。

**K7〔P0〕〔O〕〔新〕 append 不能用整文件哈希判定。**
本象曾拿整文件 sha256 判「我那次追加还在不在」——把快照当差分用
（RFC-0004 §6.3 实测缺陷）。正确做法已在本象落地：记录 offset+length 区间观察。
建议规范收编为 `$defs.byteRangeObservation {resource_id, offset, length, sha256}`；
append 类事实只接受区间观察或等价增量证据。

### 第三优先：状态正确性契约

**K8〔P0〕〔新〕 version 不得自证。**
本象的 version 曾是「开过几次会」的自证计数器；改由 content_hash 驱动后才诚实，
且 actor 必须排除在 hash 外——否则换 harness 原样存一次就通胀。
建议：状态语义规定 `state_version` MUST 派生自业务内容 hash（规范化序列化），
并显式声明 `hash_scope` 排除项。

**K9〔P0〕〔新〕 并发写需要乐观锁。**
两个 harness 并发写学历文件静默吃掉一条已验证事实。本象的修法是 putState 加
version CAS。建议：有状态写动作的契约补 `expected_state_version` 请求字段 +
冲突回 `status:"conflict"` 与 `actual_state_version`；SDK 层禁止静默 last-write-wins。

### 第四优先：Manifest 表达力

**K2〔P0〕〔M〕〔O〕 锁屏下 GUI 绑定不可执行不是绑定损坏。**
LogonUI 下截不了图点不了 UI，部分 COM 通道仍可用。GUI 可执行性依赖会话状态。
建议：binding 增加 `execution_requirements {interactive_desktop, screen_capture, ...}`；
观测里记 `availability: unavailable` 与 `unavailable_reason: session_locked`。

**K4〔P0〕〔M〕 动态动作需要位置安放。**
已安装小程序让运行时动作数变化（46→50），生成投影只能投影稳定宿主动作，
动态动作各自维护。建议：根 manifest 增加 `dynamic_action_sources[]`
（`discovery_action_id`、`namespace`、`manifest_ref`、`integrity`）；
Action 增加 `stability: host | dynamic`。

### 第五优先：执行环境可移植性

**K1〔P1〕〔新〕 .cmd 垫片启动 —— 已修复。**
Windows 上 npm/pnpm 是 .cmd 垫片，`spawn(shell:false)` 直接 ENOENT
（U-King 侧当年表现为 os error 193）。影核自己的 `src/exec.mjs` 也踩了同一颗雷，
实测复现后已在 PR #15 修复：PATH×PATHEXT 解析、`.cmd/.bat` 显式经
`cmd.exe /d /s /c`（verbatim 参数 + 元字符转义）、超时 taskkill 杀进程树。
Rust 侧 runner 应对齐同一行为；agent-profile 可选声明 `command_launch` 能力。

**K3〔P1〕〔M〕 执行环境假设不能写死。**
客户机可能没有 npm（纯 std 手搓 OOXML）；裸 `pip` 可能指向别的 venv，
必须 `python -m pip`。建议：Action 可声明 `runtime_requirements`（能力而非程序名），
profile 探测实际可用解释器并回报。

**K14〔P1〕〔O〕 环境敏感性要有观测位。**
便携版 Node 的 fs.cpSync 在非 ASCII 工作目录无声崩死（退出码 127、零输出），
官方 Node 无事。建议：执行证据增加 `environment_factors`
（workdir 字符集、copy 后端等）；验证器识别「exit 127 + 零输出」为 `silent_failure`；
测试矩阵加非 ASCII 路径 fixture——影核仓库本身就放在中文路径里。

### 最后：跨实现对账

**K12〔P1〕〔O〕〔新〕 rule 名字像 ≠ 口径相同。**
同一台机器 U-King 说 1 个问题、uenv 说 3 个；`path_nonascii` 一个量家目录、
一个量项目路径，硬对齐就是假一致。u-env 的对账表已给出答案的结构：
rule_id 命名真源 + 判据差异 note + `laxerSide` 声明 + 对不齐老实写 null。
建议规范收编为 `rules/registry.json` 与对账报告的 `comparison_basis` 字段。
依赖前面所有条目稳定后再动。

## 3. 实施顺序（聚类结论）

1. 堵假阳性：K5、K10、K11、K13
2. 可追溯证据：K6、K7
3. 状态正确性：K8、K9
4. Manifest 表达力：K2、K4
5. 执行环境可移植性：K1（已完成）、K3、K14
6. 跨实现对账：K12

## 4. 与现有提案的关系

- 〔O〕条目是《观测记账》提案的**新增实证**：K11 补上了它缺的「验证器自身也要记账」实弹案例，
  K7/K14 把「读到的世界不完整」扩展到「写入的证据不完整」「执行的环境不同」。
- 〔M〕条目依赖《Manifest 扩展命名空间》提案落地：`intent`、`stability`、
  `dynamic_action_sources`、`execution_requirements` 都是标准字段之外的表达需求，
  没有扩展命名空间之前，实现者又只剩「藏起来」和「分叉版本号」两条坏路。
- 〔新〕条目（K7 快照/差分、K8 自证版本、K9 并发丢写、K12 对账口径）
  是两份提案都没覆盖的新病，本文是它们的首次登记。

## 5. 待拍板

1. `binding.intent` 进 0.6.0 正文还是先走 x- 扩展？（依赖扩展命名空间拍板）
2. `surface_observation_expectations` 的最小强制值：min_attempts=1 是否 MUST？
3. K9 乐观锁进 SDK 核心语义还是仅规范建议？（影响 Rust/Node 双侧 API）
4. K12 的 rules registry 放本仓库还是独立仓？
