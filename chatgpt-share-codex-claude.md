# 寻找界面测试工具

## 🧑 USER

Original custom instructions no longer available

## 🧑 USER

AI 工具在开发的时候有一个弊端：出于隐私考虑，它不能直接截取目标软件的界面并上传给 AI。

所以有必要做一个第三方工具（比如用 Python 开发）：

1. 自动操作并遍历软件的所有界面并截图，保存在指定位置。
2. 再让 AI 介入做各种检查，看看软件是否符合设计需求，比如 UI 是否有缺陷。

感觉挺需要这么个东西的。你去 GitHub 上看一下有没有类似的开源项目或工具软件，如果没有的话，感觉我们可以做一个

## 🤖 ASSISTANT

我先查 GitHub 上现成的界面自动遍历、截图与 UI 检查项目，重点确认能否全程本地采集，并由你控制哪些截图交给 AI。

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

已找到 GUIrilla、TESTAR、Crawljax 等主动探索方案。更值得做的是本地 UI 验收模块，重点解决覆盖率、缺陷复现和证据安全交给 AI。

## 🤖 ASSISTANT

The output of this plugin was redacted.

## 🤖 ASSISTANT

**有，而且找到一个与你描述非常接近的项目：GUIrilla。它本身就是 Python 开发的，能自动探索 macOS 软件的界面，把截图、界面关系图和日志保存到指定目录。Windows 方向也有 TESTAR 这样的自动探索工具。**所以不必从零开发“自动点击＋截图”，更值得做的是把现有能力组合成一个**本地、可控、能给 AI 提供验收证据的工具**。citeturn361866view1turn753106view1

这次我核对了项目 README、官方文档，以及部分启动脚本、截图输出和遥测相关代码；还没有在你的 Windows、Mac 上实际运行，下面会区分“已有能力”和“需要补的部分”。

## 一、先把隐私问题说准确：不是不能截图，而是截图权限和数据外传要分开

现有工具已经能在获得用户授权后，截取指定应用的窗口、读取界面控件并执行操作。例如 Peekaboo 就提供这样的本地 CLI 和 MCP 工具，同时明确要求 macOS 的屏幕录制、辅助功能等权限。**第三方工具也需要这些授权，并不会天然绕过隐私限制。**citeturn479210search3

你提出的“两阶段”设计很有价值，但应该定义成：

> **先由本地程序采集、整理证据，再由用户决定哪些证据、交给哪个 AI 检查。**

**“截图先保存到文件夹”不等于“截图不会上传”。**例如 Midscene 的 AI 断言默认包含截图；选用云端模型时，截图就会进入模型请求。严格隐私模式应使用本地检查或本地模型，而不是仅仅把自动上传改成“AI 读取本地文件”。citeturn361866view3

---

## 二、最值得看的项目

### 1. GUIrilla：与你的“自动遍历软件并截图”最接近

**GitHub 仓库：`MacPaw/GUIrilla`**

它的目标就是**自动探索 macOS 桌面应用**：操作界面、记录操作后出现的状态，并把这些状态组织成图。官方明确说明，输出包括界面图、截图和日志，支持通过 `-o` 指定输出目录。技术要求是 macOS 13.2 及以上、Python 3.11，许可证为 MIT。citeturn361866view1

与你的设想最吻合的是：**采集阶段不一定需要调用云端 AI。**它支持用 `-l False` 关闭 LLM 辅助，改用确定性的输入生成和元素处理方式。也就是说，它已经具备你想要的“先遍历、先存图，再做后续分析”的基础。citeturn361866view1

但有两点必须注意：

**它首先是研究框架，不是现成的 UI 验收软件。**自动生成界面状态和截图，不等于已经会判断“这页是否符合你的设计稿”。

**它的默认工作流不能直接当成隐私加固后的产品。**我查看的启动脚本包含安装、启动、关闭应用的步骤，并在特定运行条件下调用卸载；配置还涉及系统密码和可选 Sentry 遥测。因此，试用时应先用测试账号、测试应用，检查并关闭不需要的安装、卸载、遥测和凭据处理逻辑。fileciteturn5file0L2-L2 fileciteturn7file0L8-L8 fileciteturn7file2L30-L30

**我的判断：它是你最应该先试的“Mac 软件界面采集器”，也是值得借鉴的遍历引擎。**

### 2. TESTAR：Windows 桌面软件自动探索，重点看它

**GitHub 仓库：`TESTARtool/TESTAR_dev`**

TESTAR 不是让你先写好每一步点击脚本，而是扫描当前界面的控件，推导可执行动作，选择动作，进入新状态，再继续探索和检查。它允许设置时间、动作数量、测试序列等停止条件。citeturn753106view1

截图保存这件事我也查了代码：它会在运行输出目录下建立 `scrshots`、`reports`、`logs` 等目录，而不只是给出一段“测试完成”的文字。fileciteturn9file0L2-L2

平台方面要分清：**Windows 是其桌面测试的主要支持方向**；Ubuntu 的文档主要对应 Web 测试，不能据此把它宣传成 Windows、Mac、Linux 原生桌面应用都通吃。仓库采用 BSD-3-Clause 许可证。citeturn188125search1turn565365view2

**我的判断：Windows 上要找“会自己探索界面的工具”，它比单纯的鼠标脚本库更对题。**但探索策略、危险动作过滤，以及按照你的设计要求进行验收，仍需要配置或扩展。

### 3. Midscene：更适合“操作界面＋AI 检查＋报告”

**GitHub 仓库：`web-infra-dev/midscene`**

这个项目值得你重点关注，因为它不仅能操作，还提供面向测试的接口：

- `aiAct`：用自然语言描述要做的操作。
- `aiQuery`：从界面提取结构化信息。
- `aiAssert`：判断界面是否满足一个要求。

当前官方文档已经提供 Windows、macOS、Linux 的桌面自动化方案，不限于网页；项目采用 MIT 许可证，也支持可自行部署的模型选项。citeturn831710view0turn878086view1

例如可以把要求写成：“打开设置窗口，检查保存按钮是否完整可见，错误提示是否遮挡输入框。”执行过程可以形成包含截图的报告。citeturn361866view3turn361866view4

但要区分：

> **Midscene 更接近“按要求操作和检查的测试员”，GUIrilla 更接近“给软件建立界面地图的探索器”。**

不能因为 Midscene 会操作桌面，就推断它已经内置了对任意软件完整、无遗漏的遍历。另一方面，严格采用你提出的“两阶段离线采集”模式时，也不应让云端模型从采集第一步就参与。

**我的判断：它适合做你产品里的 AI 检查能力，不一定要承担全部遍历工作。**

### 4. Crawljax：目标是网页时，它很对题

**GitHub 仓库：`crawljax/crawljax`**

Crawljax 会通过点击等事件探索动态 Web 应用，包括单页应用，并生成“界面状态—操作—下一个状态”的关系图。它的 CrawlOverview 插件能生成 HTML 报告，展示访问过的状态截图、被点击的元素和状态关系图。许可证为 Apache-2.0。citeturn188125search0turn188125search6

**我的判断：网页端可以借鉴它的状态探索和报告机制，但不能拿它直接控制任意 Windows、Mac 原生软件。**

### 另外三个，适合作为零件，不要误认为完整解决方案

| 项目 | 已有能力 | 对你的需求还缺什么 |
|---|---|---|
| **`openclaw/Peekaboo`** | Mac 应用截图、控件检查、点击输入、CLI/MCP 接入；MIT | “发现哪些页面没走过”的遍历策略，以及验收规范。citeturn479210search3 |
| **`pywinauto/pywinauto`** | Python 控制 Windows GUI，支持 Win32/UI Automation，可获取控件截图；BSD-3-Clause | 自动探索、状态去重、回退恢复和报告系统。citeturn831710view1 |
| **`garris/BackstopJS`** | Web 页面截图与历史基准图对比，生成视觉差异报告；MIT | 不负责理解任意桌面软件，也不能仅凭像素差异判断业务要求是否满足。citeturn831710view2 |

**所以，“会点击、会截图”和“会遍历软件并验收”，是两个不同级别的能力。选项目时一定要分清。**

---

## 三、还有没有必要自己做？有，但不要再做一个普通截图工具

**在这次核查的项目中，我没有找到一个已经成熟、开箱即用，并同时满足以下组合的统一工具：**

> Windows＋Mac 桌面软件，自动探索界面，本地证据管理，外传审批，按设计需求检查，生成可复现的缺陷报告，再交给编程 AI 修复。

这不等于市场上绝对没有，而是**现有项目分别解决了其中不同部分**。你的机会更可能在整合和产品化，而不是重新实现底层鼠标、键盘、截图功能。

我建议把产品定义为：

> **本地 UI 验收工具：替开发者把软件实际打开、走一遍，记录哪些界面检查过、哪里不合格，以及如何重现。**

这里真正值得自己做的是下面四件事。

### 1. 界面地图，而不是一堆不知道从哪来的截图

例如：

```text
主窗口
  → 模型管理
    → 添加模型弹窗
      → 必填项错误提示
      → 连接失败状态
  → 任务列表
    → 空列表
    → 正在执行
    → 执行失败
  → 设置
    → 主题切换
    → 快捷键设置
```

建议每个状态同时记录：截图、控件结构、进入该状态的操作、前一个状态、应用版本和显示环境。

这样 AI 才能区分“同一个页面换了一段内容”，还是“真的出现了一个以前没检查过的弹窗”。

**不要用截图数量代表覆盖率。**一百张首页截图，可能不如十张覆盖关键流程的截图有价值。

### 2. 把“全部界面”改成可衡量的覆盖目标

“点遍所有界面”不能只理解为点完侧边栏。

同一个页面可能有登录与未登录、空数据与有数据、加载与失败、不同权限、不同窗口宽度等状态。你的工具应该报告：

> 已覆盖预先登记的 20 个关键状态中的 17 个；2 个因缺少测试数据未进入；1 个被安全策略阻止。另探索到 6 个新增状态。

这里的数字只是报告示例。核心是：**已测、未测、受阻必须分开，不能把没有走到的地方默认算通过。**

对你自己的软件，应先列出关键页面和流程，再做自动探索补充；不必完全依赖程序“盲猜”。

### 3. 把客观检查和 AI 判断分开

我建议建立三类检查：

| 检查类型 | 适合检查什么 | 如何使用结果 |
|---|---|---|
| **确定性检查** | 可读取结构时的尺寸、可见性、必填项、点击后状态变化 | 条件明确时作为通过或失败依据 |
| **基准图对比** | 改代码后，原本正确的界面是否发生意外变化 | 标出差异，再判断是否属于预期修改 |
| **AI 视觉审查** | 疑似遮挡、布局异常、设计风格不一致，以及设计稿符合性 | 给出截图位置和理由，保留人工复核入口 |

这里不要让 AI 独自承担所有判断。Midscene 官方也提示，AI 断言可能出现误报或漏报，重要检查应结合确定性断言。视觉基准图则应按平台和显示环境管理，不能直接把 Mac 与 Windows 的渲染差异全部当成缺陷。citeturn361866view3turn878086search16

**“符合设计需求”还必须有参照物。**没有设计稿、组件规范、验收清单，AI 最多给你一般性的视觉意见，无法证明设计要求已经满足。

### 4. 隐私和动作权限，成为真正的产品能力

我建议默认采用这样的边界：

**采集侧只操作用户选定的应用和窗口。**默认允许已登记的导航动作；发送消息、删除文件、付费、安装、卸载、修改账号设置等动作不能随便探索。先用测试账号和可恢复的数据环境。

**证据侧把原始数据与可共享数据分开。**不只是截图，控件树、日志、路径、窗口标题也要检查是否包含敏感内容。优先使用假数据，从源头避免采入真实隐私。

**AI 侧分成严格本地和审批外传两种模式。**严格模式下使用本地规则或本地模型；云端模式只允许读取经过审查的证据副本。不能一边声称“已脱敏”，一边又给同一个 AI 任意读取原始截图目录的权限。

---

## 四、结合你的 U-King，我建议这样落地

**不要现在再开一个独立品牌。先在 U-King 里做一个“UI 验收”模块，用它检查你自己的软件。**

### 技术上：Python 可以做主控，不必强迫所有驱动都用 Python

我建议用 Python 管理任务、探索队列、截图目录、去重和报告；平台操作交给适合的工具：

**Mac 通用软件**，先试 GUIrilla 的自动探索，或用 Peekaboo 提供底层观察与操作；**Windows 通用软件**，先试 TESTAR，需要更可控的 Python 集成时用 pywinauto；**AI 视觉检查**，评估 Midscene 或单独的本地图片分析流程。上述项目分别已经具备相关能力，不必重新实现一套鼠标和截图驱动。citeturn361866view1turn479210search3turn753106view1turn831710view1turn831710view0

**对你自己的 Tauri 应用，还有更直接的路线。**当前 Tauri 官方推荐 WebdriverIO 的 `@wdio/tauri-service`，其嵌入式 WebDriver 方案支持 Windows、Linux、macOS。不过这需要在被测应用中集成相应测试插件，不能拿来直接控制任意第三方软件。citeturn753106view0

因此，我会明确分两种模式：

**自家应用验收模式：**已知页面、稳定控件标识、固定测试数据、可重跑流程，优先把准确率做好。

**第三方应用探索模式：**依靠系统控件树和视觉观察，允许发现新界面，同时明确覆盖限制。

### 第一版只做一个能验证价值的闭环

```text
选择应用与测试范围
        ↓
本地执行关键流程＋有限探索
        ↓
保存截图、控件结构、操作轨迹
        ↓
本地规则检查／批准后的 AI 检查
        ↓
生成缺陷报告
        ↓
编程 AI 修复
        ↓
重跑相同流程，验证问题是否消失
```

我建议首轮拿 U-King 的 **10—20 条关键流程**做实验，主动埋入“文字溢出、弹窗遮挡、按钮点击后无预期变化”几类已知问题，再在 Windows、Mac 上重复运行。

验证的不是“能不能生成漂亮报告”，而是：

**能否稳定进入目标状态、发现已知问题、给出可复现路径，以及修复后确认问题确实消失。**

缺陷报告应该接近这样，而不是一句“建议优化 UI”：

```text
问题：添加模型弹窗中的保存按钮被遮挡
环境：Windows，指定窗口尺寸与缩放比例
复现：模型管理 → 添加模型 → 输入较长名称
期望：保存按钮完整可见且可点击
实际：按钮下半部分被底部区域覆盖
证据：截图、控件位置、操作记录
结论：疑似布局缺陷，待复核
复测：修复后执行同一流程
```

这是拟定的报告示例，不是已经发现的 U-King 缺陷。

## 我的最终建议

**先试 GUIrilla 和 TESTAR，确认“自动探索＋本地截图”在你的真实软件上能达到什么程度；然后把精力放在 U-King 的证据管理、覆盖清单、设计要求检查和修复后复测上。**

它也很适合你一直在做的“AI 交付验证”：**不是 AI 说“界面改好了”，而是工具实际打开软件，留下检查过程和结果。**

**值得做的不是“给 AI 多一个截图按钮”，而是“让 AI 每次交付，都有一份能复查、能重跑的 UI 验收证据”。**

## 🧑 USER

结合影核协议。。。。做，一些截图，让ai去看界面ui的合理性。。。名字叫anycut 算是截图？any cut-cli ？让某些界面能截图，，，用影核协议超越之前的，ui验收软件，也可于做教程？软件教程？

## 🤖 ASSISTANT

对，这个方向一旦和**影核协议 / ActionParity**结合，就不只是“截图工具”了，而是可以变成：

**把软件界面投影成一套可被 AI 理解、检查、教学、复现的“影子界面资产”。**

`AnyCut` 这个名字能用，但如果只是叫截图，会把价值说小了。它真正该做的是 **UI Shadow Capture + UI Evidence + Tutorial Generation**。

我会把它定义成：

**AnyCut CLI：把任意软件的界面、状态、控件和操作路径，切成可被 AI 使用的“界面影核”。**

它不只是截图一张 PNG，而是一次 capture 产出一个完整包：

```text
AnyCut Capture
├── screenshot.png          # 视觉层
├── ui-tree.json            # 控件树 / Accessibility Tree
├── window.json             # 窗口尺寸、位置、平台
├── actions.json            # 怎么来到这里
├── state.json              # 当前页面状态
├── regions.json            # 可点击区域 / 输入框 / 菜单
├── context.md              # 页面语义摘要
└── shadow.json             # 影核协议统一描述
```

这一下就和普通截图软件拉开差距了。

---

### 影核协议为什么特别适合它

影核本来就是你之前说的：

**One Core, Many Shadows。**

一个真实软件界面，可以投影出很多“影子”：

```text
真实 UI
   ↓
影核
   ├── Screenshot Shadow
   ├── Accessibility Shadow
   ├── Text Shadow
   ├── Action Shadow
   ├── Tutorial Shadow
   ├── Test Shadow
   └── AI Shadow
```

同一个界面，给不同 AI 使用时，不需要每次都把整个真实桌面交出去。

比如 Claude Code 要修 UI：

> AnyCut 给它 Screenshot + DOM/控件树 + 状态。

教程 AI：

> 给它 Screenshot + Action Path。

测试 AI：

> 给它 Screenshot + Expected State + Previous State。

视觉模型：

> 只给裁剪后的局部截图。

这正是“影子”的意义。

---

## `AnyCut` 这个名字，我觉得其实挺好

因为它天然有几个解释：

**Any Cut**
= 任意裁剪。

但你可以把它重新定义成：

> **Cut anything into AI-readable shadows.**

中文甚至可以叫：

**万象切片 / 界面切片器 / 影切**

不过产品名我反而建议保留：

**AnyCut**

CLI：

```bash
anycut
```

命令设计可以很舒服：

```bash
anycut capture
anycut window
anycut app
anycut region
anycut crawl
anycut inspect
anycut audit
anycut tutorial
```

例如：

```bash
anycut capture --app "U-King"
```

抓当前窗口。

```bash
anycut crawl --app "U-King"
```

开始自动探索软件。

```bash
anycut audit ./captures/uking
```

让 AI 检查：

- 遮挡
- 对齐
- 字体
- 信息密度
- 按钮层级
- 空状态
- 错误状态
- 响应式
- 风格一致性

再例如：

```bash
anycut tutorial --app "U-King" \
  --goal "如何添加 DeepSeek API Key"
```

然后它自动：

```text
打开 U-King
→ 点模型
→ 点添加模型
→ 截图
→ 输入 API Key
→ 截图
→ 点测试连接
→ 截图
→ 输出教程
```

最后直接生成：

```text
01-open-model.png
02-add-provider.png
03-enter-key.png
04-test-connection.png
tutorial.md
tutorial.html
```

这个用途**非常强**。

---

# 我甚至觉得，“教程”可能比 UI 验收更容易先商业化

因为软件教程现在特别痛。

每次软件升级：

- 页面变了
- 按钮位置变了
- 老截图失效
- 帮助文档得重新写
- 客服得重新解释

AnyCut 可以做：

> **Living Tutorial / 活教程**

教程不再是一篇死文档，而是一条：

```text
目标
↓
操作序列
↓
界面状态
↓
截图
↓
说明
```

软件更新以后：

```bash
anycut tutorial verify
```

它重新跑一次。

如果：

> 第 3 步按钮找不到。

它就告诉你：

```text
教程已失效：
旧步骤：
设置 → API → 添加模型

新版：
设置 → 模型供应商 → 新建
```

然后自动更新截图。

这个其实很有价值。

---

# 这样 AnyCut 就有四个用途

我会把产品做成同一个底层，四种输出。

### ① AI UI 验收

```bash
anycut audit
```

AI 看：

> 这个页面合理吗？

不仅看截图，还看结构。

例如：

```text
发现：
Critical 0
Major 2
Minor 7

Major:
1. 保存按钮在 125% DPI 下被遮挡
2. 删除操作没有确认反馈
```

然后可以直接交给 Claude Code：

```bash
anycut audit --fix-with claude
```

---

### ② 软件教程

```bash
anycut tutorial
```

自动生成：

- Markdown
- HTML
- PDF
- 帮助中心文章
- GIF
- 视频脚本

这个跟你做 U-King 很匹配。

以后用户问：

> 怎么在 U-King 添加 OpenRouter？

不是 AI凭记忆回答。

而是：

```text
教程 Shadow
→ 当前版本 U-King
→ 实际操作验证
→ 当前截图
```

再回答用户。

可靠性会高很多。

---

### ③ AI Computer Vision / Computer Use 的视觉上下文层

这可能才是长期的大方向。

现在 Computer Use 基本是：

```text
截整屏
→ 给 AI
→ AI 找位置
→ 点击
→ 再截整屏
```

Token 和视觉成本非常高。

AnyCut 可以变成：

```text
屏幕
↓
AnyCut
↓
生成结构化 Shadow
↓
只把必要区域给 AI
```

例如页面有 1920×1080。

AI 真正需要看的是：

```text
450×300 的登录框
+
UI Tree
+
候选按钮坐标
```

这就变成：

> **AI 的视觉总线。**

这和你一直讲的“AI Computer 的南北桥”就开始连起来了。

---

### ④ 影核协议的真正落地案例

其实我特别建议你把它作为 **ActionParity / 影核协议的第一个杀手级 Demo**。

之前“影核协议”比较抽象：

> 一个动作核心，多端投影。

AnyCut 一做，人立刻能懂：

真实软件：

```text
┌─────────────────────┐
│      U-King         │
│                     │
│ 模型      DeepSeek  │
│                     │
│ [+ 添加模型]        │
└─────────────────────┘
```

影核：

```json
{
  "state": "model_manager",
  "elements": [
    {
      "role": "button",
      "name": "添加模型",
      "action": "model.add"
    }
  ]
}
```

然后：

```text
GUI Shadow
CLI Shadow
Tutorial Shadow
Test Shadow
AI Shadow
```

都是它。

这一下“影核”就从概念变成工程了。

---

# 甚至可以形成一个非常漂亮的协议关系

我会这样定义你几个协议之间的关系：

```text
                本象 2Origin
              描述“是什么”
                    │
                    ▼
真实软件 ─────→ 影核 Shadow Core
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
    AnyCut       ActionParity   TaskPassport
    看见它          操作它          证明它
       │            │            │
       ▼            ▼            ▼
 Screenshot      Actions      Evidence
 UI Tree          CLI         Result
 Tutorial         GUI         Audit
```

一句话：

> **AnyCut 负责“看见”，ActionParity 负责“行动”，TaskPassport 负责“证明”。**

这个关系其实很顺。

---

# MVP 我反而建议不要一开始搞“自动遍历所有软件”

第一版做到这 5 个命令就够强了：

```bash
anycut capture
```

截当前软件窗口。

```bash
anycut inspect
```

生成 screenshot + UI tree + 元素坐标。

```bash
anycut audit
```

AI 检查 UI。

```bash
anycut record
```

记录人的操作：

```text
点击
输入
切页
截图
```

```bash
anycut tutorial
```

把刚才操作生成教程。

这五个先打通。

**第二阶段才加：**

```bash
anycut crawl
```

自动遍历。

因为自动遍历是最难的，而 `record → tutorial → audit` 已经很有用了。

---

我甚至建议你以后把 AnyCut 的一句宣传语直接写成：

> **AnyCut — Cut any interface into AI-readable shadows.**

中文：

> **把任何软件界面，切成 AI 看得懂、验得过、教得会的影子。**

这比“AI 截图工具”高级很多，而且和你的**影核协议、AI 计算机、U-King**可以真正形成一个完整技术栈。memcite

## 🧑 USER

为什么ai有时候拒绝自动截图上传分析，，，隐私？这就是中间软件的机会？

## 🤖 ASSISTANT

对，核心原因通常就是**隐私、权限边界和数据外传风险**，但还不止这些。

AI 有时拒绝“自动截图并上传分析”，主要因为几个问题叠在一起：截图可能包含聊天内容、账号、邮箱、文件名、客户资料、支付信息，甚至其他人的个人信息；而“自动截图”又意味着持续获取屏幕内容，风险比用户手动上传一张图高得多。另外，不同系统还有屏幕录制、辅助功能、沙盒权限，AI 产品本身也可能被设计成“不主动采集本机屏幕”，避免越过用户授权边界。

所以你的判断是对的：**这里确实存在一个中间层软件的机会。**

但真正有价值的，不是“帮 AI 绕过限制自动截图”，而是做一个**合规的视觉代理层**：

```text
真实桌面 / 软件
        ↓
      AnyCut
        ↓
本地采集 + 范围限制 + 脱敏
        ↓
生成可控的 Shadow
        ↓
用户授权
        ↓
AI 分析
```

AnyCut 可以承担四个关键职责：只截指定软件而不是全屏；自动裁掉无关区域；识别并遮盖邮箱、手机号、API Key、聊天内容等敏感信息；记录“这张图为什么被截、来自哪个窗口、用户是否允许外传”。

这样 AI 得到的就不是“我的整个桌面”，而是：

```text
窗口：U-King / 模型设置
区域：添加模型弹窗
允许字段：按钮、布局、文字
已脱敏：API Key、账号名
目的：UI 验收
```

这其实非常符合你说的影核：**真实界面不直接暴露，先生成一个有限、可撤销、可审计的视觉影子。**

所以 AnyCut 真正的产品定位，我会改成：

> **AI Screen Gateway / UI Shadow Gateway**

而不只是 screenshot CLI。

更进一步，它可以解决现在 Computer Use 的一个大问题：AI 不需要每一步都拿整张 4K 屏幕，而是 AnyCut 本地先判断变化区域，只上传必要窗口或局部区域。这样同时降低**隐私风险、视觉 token 成本和误操作概率**。

例如：

```bash
anycut capture --app U-King --redact auto
```

只截 U-King，自动脱敏。

```bash
anycut share --to claude --purpose ui-audit
```

明确这批截图只能用于 UI 检查。

甚至：

```bash
anycut shadow --ttl 10m
```

产生一个 10 分钟后失效的“视觉影子”。

这就已经不是截图工具了，而是很接近你影核协议里的：

> **现实界面 → 最小必要投影 → AI 可用权限。**

这里还有一个很好的产品原则：

**AI 不应该拥有“看整个电脑”的权限，而应该拥有“为了完成当前任务，看到必要界面”的权限。**

如果 AnyCut 把这件事做好，它可以同时服务 Claude Code、Codex、OpenClaw、Hermes、U-King，甚至以后所有 Computer Use Agent。

所以我认为这条线是成立的，而且比单纯做 UI 验收更大：**UI 验收只是第一个非常自然的场景，教程生成、远程客服、Computer Use、AI 自动测试都可以建立在同一个视觉影核层上。** memcite

## 🧑 USER

适合在哪个项目下做事情呢？开发？影核？我电脑上怎么，在哪个文件夹上，用hermes 跑跑，先 astra 规划？让做座底？codex terra ，还是hermes +便宜的？还是claude sonnet ？

## 🤖 ASSISTANT

我建议**归到“影核协议”下面，而不是塞进 U-King 主仓库，也不要先做独立大项目。**

工程上把 **AnyCut 做成影核的第一个 reference implementation / 工具链**。这样以后 U-King 只是调用它，教程、UI 验收、Computer Use 都可以复用。

目录我会这么放：

```text
ShadowCore / 影核
├── spec/                 # 影核协议
├── anycut/               # ← 现在主要开发这里
│   ├── anycut-cli/
│   ├── capture/
│   ├── inspect/
│   ├── redact/
│   ├── audit/
│   ├── record/
│   └── tutorial/
├── examples/
└── docs/
```

如果你电脑上已经有影核/ActionParity 的工作目录，**就在那个目录开 Hermes**；如果没有，就新建一个干净的 `anycut` 仓库，先别碰 U-King。等跑通后，U-King 再作为消费者接入。

### 模型怎么分工

这件事我不建议一上来让便宜模型自由发挥。第一轮架构很关键，我会这样排：

**Astra → 规划；Claude Sonnet → 第一版工程骨架；Hermes + 便宜模型 → 长时间跑、测试、搜边界情况；Codex Terra → 第二轮独立审查/修复。**

具体顺序：

1. **先 Astra，只规划，不写大量代码。**让它研究 GUIrilla / TESTAR / Peekaboo / pywinauto 的思路，然后定义 AnyCut v0.1：协议格式、模块边界、安全模型、Mac/Windows adapter、CLI。
2. **再 Sonnet 做底座。**让它按照规划真正搭仓库，优先做 `capture → inspect → shadow.json → audit`。底层权限、进程、截图、Accessibility Tree 这些地方，我宁愿第一版多花一点模型成本。
3. **Hermes 接管体力活。**跑程序、反复截图、修小 bug、补测试、写 adapter、验证不同窗口。这里非常适合你便宜模型策略。
4. **最后让 Codex Terra 不看 Sonnet 的自我评价，独立验收。**重点攻击隐私泄露、误截其他窗口、危险动作、跨平台抽象和测试覆盖。

也就是说不是选一个模型：

> **Astra 当架构师 → Sonnet 当主程 → Hermes 当长期工程员 → Terra 当验收员。**

这反而就是你自己的多 AI 工作方式。

### 今晚第一刀不要做太大

先只做 **Mac v0.1**，甚至暂时不自动遍历。

目标就四条命令：

```bash
anycut capture --app "U-King"
anycut inspect
anycut redact
anycut audit
```

最终产生：

```text
runs/2026-09-06-001/
├── original.png
├── shadow.png
├── accessibility.json
├── shadow.json
└── audit.md
```

然后拿你自己的 U-King 做第一个靶子：

> “只允许 AnyCut 看 U-King 窗口 → 截图 → 获取 UI Tree → 本地生成影核 → 脱敏 → 再让视觉 AI 判断 UI 是否存在遮挡、错位、层级和一致性问题。”

**这个闭环跑通，就是 AnyCut 的出生点。**

自动遍历 `anycut crawl`、教程 `anycut tutorial` 都先别让 Sonnet 花时间。第二阶段再上，因为 `record → tutorial` 很容易建立在前面的 Shadow 数据上。

还有一个很关键的工程原则：**AnyCut Core 不依赖任何一家 AI。**核心只负责“看见→裁剪→脱敏→形成 Shadow”；Claude/GPT/Gemini/本地 VLM 都只是 `auditor adapter`。这样它以后才真的能成为影核协议的基础设施，而不是另一个 Claude 截图插件。

如果你愿意今晚直接开干，我建议你**在影核工作目录启动 Astra，把当前影核仓库结构给它，让它先产出 `ANYCUT_V0.1_PLAN.md`，禁止改代码**。规划出来以后再交 Sonnet 开第一刀。memcite

## 🧑 USER

是hermes 上调用codex astra ，然后，再调csonnet ，然后调 terra 独立验收，还是打开三个cli工具？

## 🤖 ASSISTANT

我更建议你**一个主控 CLI + 多模型后端**，而不是同时开三个 CLI 到处切。

对你这个 AnyCut/影核底座，最顺的是：

**Hermes 做总控 → 调 Astra 规划 → 调 Claude Sonnet 实现 → 调 Terra 独立验收。**

原因是这样上下文连续，任务、文件、约束都在一个总控里，不容易丢状态；而且以后 AnyCut 本身就要验证“多 AI 协作”，这个工作流正好当实战。

你可以把角色固定死：

```text
Hermes = PM / 调度器 / 长程执行
Astra   = 架构规划
Sonnet  = 主实现
Terra   = 独立 reviewer / tester
```

关键点是：**Terra 验收时不要直接继承 Sonnet 的结论。**让 Hermes 只给 Terra“代码 + 需求 + 验收标准”，不要给它“Sonnet 说已经完成”的总结，这样独立性更强。

我不太建议你一开始开三个 CLI，除非你想做“真正隔离的盲审”。三个 CLI 的问题是文件状态、任务进度、决策记录很容易不同步，你现在一个人开发，管理成本反而更高。

最实用的流程就是：

```text
Hermes
  ↓
Astra：只出 ANYCUT_V0.1_PLAN.md
  ↓
Sonnet：按计划实现
  ↓
Hermes：跑测试/整理证据
  ↓
Terra：独立审查
  ↓
Sonnet 或 Hermes：修复
  ↓
Terra：复验
```

如果 Hermes 当前已经能稳定调用这些模型，我会直接这么干。

只有两种情况我建议开独立 CLI：一是 Terra 做最终盲审；二是某个模型在 Hermes 里工具权限受限，比如不能真正执行 shell、看截图或读完整仓库。

所以你今晚可以很简单：**开一个 Hermes 在影核/AnyCut 工作目录里，把它当“总工位”。**

第一条就让它：

> 调 Astra，只规划 AnyCut v0.1，不改代码；输出 ANYCUT_V0.1_PLAN.md，目标是 Mac 上完成 capture / inspect / redact / audit，AnyCut Core 不依赖具体 AI 模型。

然后再让 Hermes 调 Sonnet 开工。

这套方式也很适合你以后直接展示成 U-King 的“多 AI 工程驾驶舱”。 memcite
