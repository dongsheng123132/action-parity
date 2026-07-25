# 影核（ActionParity）

> **一个动作，所有界面。**

影核是一套面向 AI 时代的软件开放标准，英文名 **ActionParity**，亦称 **ShadowCore 协议**：让同一个应用同时成为“人类原生”和“Agent 原生”的应用。

一个产品只有一个权威的动作核心，所有平台界面都是它的原生影子——这就是“影核”两个字的意思。命名规则见 [docs/NAMING.md](docs/NAMING.md)。

每个有业务意义的动作，只在无界面的 **Action Core（动作核心）** 中实现一次，再由 GUI、CLI、TUI、MCP、API、自动化测试等不同入口共同调用。

```text
人类 ── GUI / TUI ───────┐
                         ├── Action Core ── 状态 / 事件 / 权限
Agent ─ CLI / MCP / API ─┘
                                │
                         一致性验证与报告
```

GUI 不是软件本身，CLI 也不是软件本身。它们是同一套动作和状态模型的不同投影。

## 我们要解决的问题

传统桌面软件默认操作者是“坐在屏幕前、拿着鼠标的人”。AI 要测试或操作这类软件，只能：

```text
截图 → 猜按钮 → 移动鼠标 → 点击 → 等待 → 再截图 → 猜结果
```

这种方式适合兼容旧软件和验证最终视觉效果，但不应该成为 AI 调用业务功能的主要方式。它慢、贵、不稳定，容易被分辨率、语言、动画、遮挡、窗口焦点和版本变化影响。

影核把测试分成两条：

1. **软件有没有做对事情？** 直接测试 Action Core。
2. **用户能不能正确操作并看懂？** 使用无障碍树、UI 自动化和截图测试真实 GUI。

于是大多数业务测试可以无界面、快速、稳定地运行；少量真实 GUI 测试负责验证按钮绑定、焦点、布局、视觉和无障碍。

## 最核心的规则

> 每个有业务意义的用户动作，都必须有唯一、稳定的 Action ID，并且无论从哪个界面触发，都必须调用同一个规范实现。

这不等于“每一个按钮必须有一条 CLI 命令”。

以下内容通常属于业务动作：

- 创建、修改、删除；
- 导入、导出、同步；
- 启动、停止、重启；
- 检测、诊断、修复；
- 配置、验证、发布、升级；
- 购买、发送、授权等外部副作用。

以下内容通常属于界面动作：

- 切换标签页；
- 展开侧栏；
- 鼠标悬停；
- 拖动窗口；
- 播放动画；
- 调整纯视觉布局。

界面动作由 UI 自动化测试；业务动作必须进入 Action Core。

## 一句话架构

过去容易写成：

```text
点击按钮
  └── 在按钮事件里直接改文件、调用网络、启动进程
```

影核要求写成：

```text
GUI 按钮 ─┐
CLI 命令 ─┼── action.execute("gateway.start", input)
MCP 工具 ─┘
                  │
             唯一业务实现
                  │
          统一结果、状态、事件和审计
```

GUI 不需要每次启动 CLI 子进程。GUI、CLI 和 MCP 可以直接引用同一个库，也可以通过本地 IPC 调用同一个常驻 Action Runtime。

## 四级认证

| 等级 | 名称 | 要求 |
|---|---|---|
| AP-1 | Core | 动作可发现、有 Schema、可无界面执行和测试。 |
| AP-2 | Parity | 所有声明的界面都映射到同一个 Action Core。 |
| AP-3 | Agent | 具备结构化结果、权限、确认、审计、进度、取消等 Agent 安全能力。 |
| AP-4 | Verified | 发布可验证报告，证明核心、绑定、无障碍和真实 GUI 流程均通过测试。 |

级别逐级包含，不能只购买徽章而绕过测试。

## 为什么还需要真实 GUI 测试

CLI 或 MCP 测通，只能证明业务逻辑正确，不能证明：

- GUI 按钮绑定到了正确动作；
- 输入框可填写；
- 错误提示可见；
- 深色模式和高 DPI 正常；
- 窗口没有遮挡；
- 键盘焦点顺序合理；
- 屏幕阅读器和自动化工具可以理解控件。

因此影核不是要淘汰 Computer Use，而是让它回到正确位置：

> Action Core 是主测试层；UI Automation 是界面验证层；视觉 Computer Use 是最终兜底层。

## 与现有规范的关系

我们不重新发明已有协议：

- MCP 负责 Agent 工具发现和调用；
- OpenAPI / OpenRPC 负责机器可读接口描述；
- WebDriver、Appium、Windows UI Automation 负责操作真实界面；
- ANIP 关注 Agent 调用的权限、风险和可逆性；
- AgentReady 关注 Web 产品能否被 Agent 端到端使用；
- AG-UI、ggui 关注 Agent 与前端界面的通信和生成；
- Tauri Commands、Blender Operators、Apple App Intents 是很好的实现机制。

影核要补的空位是：

> **规定一个真实应用的 GUI、CLI、MCP、自动化入口必须共享同一个业务动作核心，并且能通过机器验证证明没有漂移。**

完整对比见 [docs/LANDSCAPE.md](docs/LANDSCAPE.md)。

## U-King 试点

U-King 将作为第一个参考应用，分两条路线推进：

1. 给现有 Electron GUI 补齐语义控件、ARIA、稳定标识和 Windows UI Automation 测试；
2. 逐步把检测、配置、网关控制、修复、升级、日志导出等功能抽成 Action Core，并生成 CLI、MCP 与一致性报告。

这样不需要推倒重写，就能逐步从“只能看屏幕测试”升级为“业务动作无界面测试 + 真实 GUI 验证”。

详细计划见 [docs/U-KING-PILOT.md](docs/U-KING-PILOT.md)。

## 试点回馈

真实应用改造中发现的规范问题会写成案例回馈，作为 v1.0 的输入：

- [docs/CASE-CC-SWITCH.zh-CN.md](docs/CASE-CC-SWITCH.zh-CN.md) —— cc-switch / uu-switch（Tauri + React，270 个命令、零机器入口）。
  暴露的核心问题：**一个零机器入口的纯 GUI 应用，不写一行代码就能通过 AP-2 校验、拿到 66.7% 严格分数**——
  `ipc` 与 `test` surface 缺少可达性要求，且验证器无法检测实现漂移。

## 开源与商业价值

规范、Schema、验证器和参考适配器保持开放。商业价值可以来自：

- 企业迁移与架构改造；
- 影核 CI 和可视化报告；
- 独立认证与兼容性实验室；
- Electron、Tauri、.NET、Swift 等商业支持；
- Agent 权限、审计与策略控制台；
- 测试设备云和干净 Windows/macOS 环境；
- 行业测试包、培训和认证课程。

标准必须保持中立：自测永远免费，认证规则公开，商业客户不能购买标准条款。详见 [docs/BUSINESS.md](docs/BUSINESS.md)。

## 当前状态

**v0.1.0 工作草案。**

目前阶段的目标不是宣称标准已经完成，而是：

1. 发布清晰、可讨论的规范；
2. 用 U-King 做真实改造；
3. 发布验证器和测试证据；
4. 吸引更多桌面应用提交实现报告；
5. 在真实实现基础上推进 v1.0。

规范正文：[SPEC.md](SPEC.md)  
推广路线：[docs/ADOPTION.md](docs/ADOPTION.md)  
项目宣言：[MANIFESTO.md](MANIFESTO.md)  
首发手册：[docs/LAUNCH.md](docs/LAUNCH.md)  
参与方式：[CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

Apache License 2.0，见 [LICENSE](LICENSE)。
