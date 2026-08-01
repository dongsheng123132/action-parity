const github = "https://github.com/dongsheng123132/action-parity";

const shadows = ["GUI", "CLI", "MCP", "API", "Tests"];

const rules = [
  {
    number: "01",
    title: "没有第二份业务实现",
    english: "No duplicate implementation",
    body: "按钮、命令和工具都调用同一个 Action Core；修一次，所有入口一起生效。",
  },
  {
    number: "02",
    title: "没有界面独占的策略",
    english: "No interface-only policy",
    body: "确认、权限与风险控制必须在动作核心强制，不能只靠前端弹窗。",
  },
  {
    number: "03",
    title: "没有独立的状态真相源",
    english: "No shadow-owned truth",
    body: "界面可以缓存状态，但不能拥有状态；所有入口最终观察同一份事实。",
  },
  {
    number: "04",
    title: "没有只能从界面到达的动作",
    english: "No GUI-only business action",
    body: "每个有意义的 GUI 动作都保留一条非视觉机器入口，让 Agent 不必猜像素。",
  },
];

const capabilities = [
  {
    label: "SPEC",
    title: "规范",
    body: "定义 Action、Core、Shadow、Binding、状态、事件、安全与一致性要求。",
    href: `${github}/blob/main/SPEC.md`,
  },
  {
    label: "SCHEMA",
    title: "机器可读清单",
    body: "用 JSON Schema 描述应用、动作、界面、风险、证据和外部状态资源。",
    href: `${github}/blob/main/schema/action-parity.schema.json`,
  },
  {
    label: "VALIDATOR",
    title: "开源验证器",
    body: "定位架构违规、未证明声明、缺失机器入口和不安全的确认策略。",
    href: `${github}/tree/main/src`,
  },
  {
    label: "PILOT",
    title: "真实应用试点",
    body: "从 U-King 的六个低风险动作开始，验证渐进式改造与跨界面同步。",
    href: `${github}/blob/main/docs/U-KING-PILOT.md`,
  },
];

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="ActionParity 影核首页">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand-copy">
            <strong>ActionParity</strong>
            <small>影核协议</small>
          </span>
        </a>
        <nav aria-label="主要导航">
          <a href="#principles">原则</a>
          <a href="#tooling">工具</a>
          <a href="#adopt">接入</a>
          <a className="nav-github" href={github} target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy" id="main-content">
          <div className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            v0.5 工作草案 · Apache-2.0
          </div>
          <h1>
            一个动作，
            <span>所有界面。</span>
          </h1>
          <p className="hero-lead">
            影核（ActionParity）是面向 AI 时代的动作同源开放标准。让 GUI、CLI、MCP、API
            与测试共同调用一个无界面的 <strong>Action Core</strong>。
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={`${github}/blob/main/SPEC.md`}>
              阅读规范 <span aria-hidden="true">→</span>
            </a>
            <a className="button button-secondary" href={`${github}#readme`}>
              查看源码
            </a>
          </div>
          <div className="proof-row" aria-label="项目当前状态">
            <div>
              <strong>25/25</strong>
              <span>验证器测试通过</span>
            </div>
            <div>
              <strong>6</strong>
              <span>U-King 试点动作</span>
            </div>
            <div>
              <strong>4</strong>
              <span>二元架构规则</span>
            </div>
          </div>
        </div>

        <div className="hero-system" aria-label="多个界面连接同一个 Action Core 的架构示意">
          <div className="orbit orbit-one" aria-hidden="true" />
          <div className="orbit orbit-two" aria-hidden="true" />
          <div className="core">
            <span className="core-kicker">ONE CORE</span>
            <strong>Action</strong>
            <strong>Core</strong>
            <span className="core-pulse" aria-hidden="true" />
          </div>
          {shadows.map((shadow, index) => (
            <div className={`shadow shadow-${index + 1}`} key={shadow}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <strong>{shadow}</strong>
            </div>
          ))}
          <div className="system-caption">
            <span>HUMAN NATIVE</span>
            <i aria-hidden="true" />
            <span>AGENT NATIVE</span>
          </div>
        </div>
      </section>

      <section className="problem section-shell">
        <div className="section-label">WHY ACTIONPARITY</div>
        <div className="problem-grid">
          <div className="problem-copy">
            <h2>行为不该长在界面里。</h2>
            <p>
              当业务逻辑分别写进按钮、命令和 API，多一个界面就多一份实现；当软件只能通过屏幕操作，Agent
              就只能猜坐标、读截图，并把业务正确性寄托在像素上。
            </p>
          </div>
          <div className="comparison" aria-label="传统架构与影核架构对比">
            <div className="comparison-card old-way">
              <span className="comparison-tag">INTERFACE-BOUND</span>
              <h3>过去</h3>
              <ul>
                <li><span>GUI</span><i />独立实现</li>
                <li><span>CLI</span><i />独立实现</li>
                <li><span>API</span><i />独立实现</li>
              </ul>
              <small>行为漂移 · 重复修复 · 截图测试</small>
            </div>
            <div className="comparison-arrow" aria-hidden="true">→</div>
            <div className="comparison-card new-way">
              <span className="comparison-tag">ACTION-NATIVE</span>
              <h3>影核</h3>
              <div className="mini-core">
                <span>GUI</span><span>CLI</span><span>MCP</span>
                <strong>ONE ACTION CORE</strong>
              </div>
              <small>一次实现 · 统一状态 · 可机器验证</small>
            </div>
          </div>
        </div>
      </section>

      <section className="principles section-shell" id="principles">
        <div className="section-heading">
          <div>
            <div className="section-label">THE INVARIANT</div>
            <h2>影子里，不许有这四样东西。</h2>
          </div>
          <p>
            符合与不符合是二元判断。分数可以帮助审计，但不能替代架构事实。
          </p>
        </div>
        <div className="rule-grid">
          {rules.map((rule) => (
            <article className="rule-card" key={rule.number}>
              <span className="rule-number">{rule.number}</span>
              <div className="rule-line" aria-hidden="true" />
              <h3>{rule.title}</h3>
              <small>{rule.english}</small>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture section-shell">
        <div className="architecture-copy">
          <div className="section-label">ONE CORE, MANY SHADOWS</div>
          <h2>界面仍然原生，行为只有一份。</h2>
          <p>
            GUI 不需要每次启动 CLI 子进程。不同界面可以直接引用同一个动作库，也可以通过本地 IPC
            调用同一个常驻运行时。关键不是传输方式，而是所有入口抵达同一个规范实现。
          </p>
          <ul className="check-list">
            <li><span>✓</span>稳定 Action ID 与输入输出 Schema</li>
            <li><span>✓</span>统一结果、状态、事件和执行 ID</li>
            <li><span>✓</span>机器入口返回结构化数据</li>
            <li><span>✓</span>危险操作在核心层确认与审计</li>
          </ul>
        </div>
        <div className="action-terminal" aria-label="ActionParity 动作调用示例">
          <div className="terminal-bar">
            <span /><span /><span />
            <small>action-parity.json</small>
          </div>
          <pre><code>{`{
  "id": "gateway.start",
  "input_schema": { "type": "object" },
  "effects": {
    "class": "write",
    "risk": "medium",
    "confirmation": "conditional"
  },
  "execution": {
    "headless": true,
    "timeout_ms": 30000
  },
  "bindings": [
    { "surface": "desktop" },
    { "surface": "cli" },
    { "surface": "mcp" }
  ]
}`}</code></pre>
          <div className="terminal-result">
            <span className="status-dot" aria-hidden="true" />
            3 shadows → 1 canonical action
          </div>
        </div>
      </section>

      <section className="tooling section-shell" id="tooling">
        <div className="section-heading">
          <div>
            <div className="section-label">OPEN TOOLCHAIN</div>
            <h2>规范不是口号，它可以被检查。</h2>
          </div>
          <p>规范、Schema、验证器与示例全部开放，任何团队都能免费自测。</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <a className="capability-card" href={capability.href} key={capability.label}>
              <span>{capability.label}</span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
              <strong aria-hidden="true">↗</strong>
            </a>
          ))}
        </div>
        <div className="cli-block">
          <div>
            <span className="cli-prompt">$</span>
            <code>node bin/action-parity.mjs validate action-parity.json</code>
          </div>
          <div className="cli-output">
            <span>VALID</span>
            <span>Violations&nbsp;&nbsp;0</span>
            <span>Unproven&nbsp;&nbsp;&nbsp;0</span>
          </div>
        </div>
      </section>

      <section className="adopt section-shell" id="adopt">
        <div className="adopt-panel">
          <div className="adopt-copy">
            <div className="section-label">START SMALL</div>
            <h2>不用推倒重写，从一个纵切动作开始。</h2>
            <p>
              选择一个低风险、可观察结果的动作，把它从界面事件中抽出来，再让 GUI 与机器入口共同调用。
              第一条证据链跑通后，再扩展到更多动作和平台。
            </p>
            <a className="button button-primary" href={`${github}/blob/main/docs/ADOPTION.md`}>
              查看采用指南 <span aria-hidden="true">→</span>
            </a>
          </div>
          <ol className="adopt-steps">
            <li><span>01</span><div><strong>盘点动作</strong><p>区分业务动作与纯界面交互。</p></div></li>
            <li><span>02</span><div><strong>抽出核心</strong><p>建立稳定 ID、Schema 与无界面实现。</p></div></li>
            <li><span>03</span><div><strong>连接影子</strong><p>让 GUI、CLI、MCP 走同一个注册点。</p></div></li>
            <li><span>04</span><div><strong>留下证据</strong><p>验证绑定、状态同步、安全与真实界面。</p></div></li>
          </ol>
        </div>
      </section>

      <section className="manifesto section-shell">
        <p>“GUI 不是软件本身，CLI 也不是软件本身。它们是同一套动作和状态模型的不同投影。”</p>
        <div>
          <span>影核宣言</span>
          <a href={`${github}/blob/main/MANIFESTO.md`}>阅读全文 ↗</a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <div><strong>ActionParity</strong><small>影核 · 一个动作，所有界面。</small></div>
        </div>
        <div className="footer-links">
          <a href={`${github}/blob/main/SPEC.md`}>规范</a>
          <a href={`${github}/blob/main/CONTRIBUTING.md`}>参与</a>
          <a href={`${github}/blob/main/GOVERNANCE.md`}>治理</a>
          <a href={github}>GitHub</a>
        </div>
        <p>Apache License 2.0 · Working Draft v0.5 · 2026</p>
      </footer>
    </main>
  );
}
