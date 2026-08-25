const github = "https://github.com/dongsheng123132/action-parity";

const shadows = ["GUI", "CLI", "MCP", "API", "Tests"];

const rules = [
  {
    number: "01",
    titleZh: "没有第二份业务实现",
    titleEn: "No duplicate implementation",
    bodyZh: "按钮、命令和工具都调用同一个 Action Core；修一次，所有入口一起生效。",
    bodyEn: "Buttons, commands, and tools invoke the same Action Core. Fix it once, and every interface changes together.",
  },
  {
    number: "02",
    titleZh: "没有界面独占的策略",
    titleEn: "No interface-only policy",
    bodyZh: "确认、权限与风险控制必须在动作核心强制，不能只靠前端弹窗。",
    bodyEn: "Confirmation, authorization, and risk controls are enforced below every interface, not only in a dialog.",
  },
  {
    number: "03",
    titleZh: "没有独立的状态真相源",
    titleEn: "No shadow-owned truth",
    bodyZh: "界面可以缓存状态，但不能拥有状态；所有入口最终观察同一份事实。",
    bodyEn: "A shadow may cache state, but it cannot own it. Every interface ultimately observes the same facts.",
  },
  {
    number: "04",
    titleZh: "没有只能从界面到达的动作",
    titleEn: "No GUI-only business action",
    bodyZh: "每个有意义的 GUI 动作都保留一条非视觉机器入口，让 Agent 不必猜像素。",
    bodyEn: "Every meaningful GUI action has a non-visual machine path, so agents never have to guess at pixels.",
  },
];

const capabilities = [
  {
    label: "SPEC",
    titleZh: "规范",
    titleEn: "Specification",
    bodyZh: "定义 Action、Core、Shadow、Binding、状态、事件、安全与一致性要求。",
    bodyEn: "Defines actions, cores, shadows, bindings, state, events, safety, and conformance.",
    href: `${github}/blob/main/SPEC.md`,
  },
  {
    label: "SCHEMA",
    titleZh: "机器可读清单",
    titleEn: "Machine-readable manifest",
    bodyZh: "用 JSON Schema 描述应用、动作、界面、风险、证据和外部状态资源。",
    bodyEn: "Describes applications, actions, surfaces, risks, evidence, and external state resources in JSON Schema.",
    href: `${github}/blob/main/schema/action-parity.schema.json`,
  },
  {
    label: "VALIDATOR",
    titleZh: "开源验证器",
    titleEn: "Open-source validator",
    bodyZh: "定位架构违规、未证明声明、缺失机器入口和不安全的确认策略。",
    bodyEn: "Finds architectural violations, unproven claims, missing machine paths, and unsafe confirmation policies.",
    href: `${github}/tree/main/src`,
  },
  {
    label: "PILOT",
    titleZh: "真实应用试点",
    titleEn: "Real application pilot",
    bodyZh: "从 U-King 的六个低风险动作开始，验证渐进式改造与跨界面同步。",
    bodyEn: "Starts with six low-risk U-King actions to prove incremental adoption and cross-interface parity.",
    href: `${github}/blob/main/docs/U-KING-PILOT.md`,
  },
];

const manifesto = [
  {
    enTitle: "One core, many shadows.",
    enBody: "There is one place where a behavior lives. GUI, CLI, TUI, MCP, API, and automation are shadows it casts on different platforms — each shaped by its platform's conventions, none of them holding a behavior of its own.",
    zh: "一核多影。行为只有一个落脚处，GUI、CLI、TUI、MCP、API 都是它投在各平台上的影子——影子有各自的形状，但没有自己的行为。",
  },
  {
    enTitle: "A behavior should be written once, and a platform should cost one shadow.",
    enBody: "A feature duplicated across interfaces will drift, and AI-assisted development makes duplication cheap while making drift invisible. Adding a behavior should cost one implementation; adding a platform should cost one shadow, not one reimplementation per behavior.",
    zh: "一个行为写一遍，多一个平台只多一个影子。不是每个平台把每个行为重写一遍。AI 让「复制一份实现」变得极便宜，也让「三份已经跑偏」变得看不见。",
  },
  {
    enTitle: "Humans and agents deserve semantic access.",
    enBody: "Humans need understandable interfaces. Agents need discoverable actions, typed inputs, structured results, and stable state. Neither should receive a weaker version of the product.",
    zh: "人和 Agent 都应该获得语义级访问能力。",
  },
  {
    enTitle: "Computer Use is a compatibility layer, not the foundation.",
    enBody: "Screenshots, coordinates, and input injection remain valuable for old software and final visual verification. New software should expose meaning directly.",
    zh: "Computer Use 是兼容层，不应是新软件的地基。",
  },
  {
    enTitle: "Conformance is a yes or a no, not a percentage.",
    enBody: "Claims such as “AI-ready” are not enough, so applications publish manifests, mappings, exceptions, and tests. But a shadow either holds behavior of its own or it does not, and that question has no score. A number with a numerator will be optimized; write down what is wrong and where.",
    zh: "符合与否是能与不能，不是百分比。有分子的数字就会被优化——把错在哪、在哪一行写出来，比给一个分数有用。",
  },
  {
    enTitle: "Safety belongs below the interface.",
    enBody: "Permissions, confirmation, risk, audit, cancellation, and rollback cannot live only in a prompt or dialog.",
    zh: "权限、确认、审计和回滚必须位于界面之下。",
  },
  {
    enTitle: "Real GUI testing still matters.",
    enBody: "A correct Action Core does not prove that a button is reachable, a label is readable, or a layout works. Semantic and visual interface tests remain part of conformance.",
    zh: "动作核心正确，不能代替真实 GUI 测试。",
  },
  {
    enTitle: "Open standards create larger markets.",
    enBody: "The specification should be freely implementable. Companies should compete on tools, reliability, integration, support, and trust—not private access to the definition of compatibility.",
    zh: "开放标准会创造更大的商业市场。",
  },
];

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#main-content">
        跳到主要内容 / Skip to content
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="ActionParity 影核首页">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-copy">
            <strong>ActionParity</strong>
            <small>影核协议 · ShadowCore Protocol</small>
          </span>
        </a>
        <nav aria-label="主要导航 / Primary navigation">
          <a href="#principles">原则 / Principles</a>
          <a href="#tooling">工具 / Tooling</a>
          <a href="#manifesto">宣言 / Manifesto</a>
          <a href="#adopt">接入 / Adopt</a>
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
            BILINGUAL EDITION · 中英双语 · v0.5 WORKING DRAFT
          </div>
          <h1>一个动作，<span>所有界面。</span></h1>
          <p className="hero-title-en" lang="en">One action. Every interface.</p>
          <p className="hero-lead">
            影核（ActionParity）是面向 AI 时代的动作同源开放标准。让 GUI、CLI、MCP、API
            与测试共同调用一个无界面的 <strong>Action Core</strong>。
          </p>
          <p className="hero-lead translation" lang="en">
            ActionParity is an open standard for the AI era. GUI, CLI, MCP, API, automation, and tests all invoke the same headless <strong>Action Core</strong>.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={`${github}/blob/main/SPEC.md`}>
              规范 / Specification <span aria-hidden="true">→</span>
            </a>
            <a className="button button-secondary" href="#manifesto">
              宣言 / Manifesto
            </a>
          </div>
          <div className="proof-row" aria-label="项目当前状态 / Project status">
            <div><strong>25/25</strong><span>测试通过 / tests passing</span></div>
            <div><strong>6</strong><span>试点动作 / pilot actions</span></div>
            <div><strong>4</strong><span>二元规则 / binary rules</span></div>
          </div>
        </div>

        <div className="hero-system" aria-label="Multiple interfaces connected to one Action Core">
          <div className="orbit orbit-one" aria-hidden="true" />
          <div className="orbit orbit-two" aria-hidden="true" />
          <div className="core">
            <span className="core-kicker">ONE CORE</span>
            <strong>Action</strong><strong>Core</strong>
            <span className="core-pulse" aria-hidden="true" />
          </div>
          {shadows.map((shadow, index) => (
            <div className={`shadow shadow-${index + 1}`} key={shadow}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <strong>{shadow}</strong>
            </div>
          ))}
          <div className="system-caption">
            <span>HUMAN NATIVE</span><i aria-hidden="true" /><span>AGENT NATIVE</span>
          </div>
        </div>
      </section>

      <section className="problem section-shell">
        <div className="section-label">WHY ACTIONPARITY · 为什么需要影核</div>
        <div className="problem-grid">
          <div className="problem-copy">
            <h2>行为不该长在界面里。</h2>
            <h3 className="heading-en" lang="en">Behavior should not live inside the interface.</h3>
            <p>当业务逻辑分别写进按钮、命令和 API，多一个界面就多一份实现；当软件只能通过屏幕操作，Agent 就只能猜坐标、读截图，并把业务正确性寄托在像素上。</p>
            <p className="translation" lang="en">When business logic is repeated in buttons, commands, and APIs, every new interface creates another implementation. When software can only be driven through a screen, agents must guess coordinates and place correctness in pixels.</p>
          </div>
          <div className="comparison" aria-label="传统架构与影核架构对比 / Architecture comparison">
            <div className="comparison-card old-way">
              <span className="comparison-tag">INTERFACE-BOUND</span>
              <h3>过去 / Before</h3>
              <ul>
                <li><span>GUI</span><i />独立实现 / duplicate</li>
                <li><span>CLI</span><i />独立实现 / duplicate</li>
                <li><span>API</span><i />独立实现 / duplicate</li>
              </ul>
              <small>行为漂移 · 重复修复 · DRIFT · REWORK</small>
            </div>
            <div className="comparison-arrow" aria-hidden="true">→</div>
            <div className="comparison-card new-way">
              <span className="comparison-tag">ACTION-NATIVE</span>
              <h3>影核 / ActionParity</h3>
              <div className="mini-core"><span>GUI</span><span>CLI</span><span>MCP</span><strong>ONE ACTION CORE</strong></div>
              <small>一次实现 · 统一状态 · IMPLEMENT ONCE</small>
            </div>
          </div>
        </div>
      </section>

      <section className="principles section-shell" id="principles">
        <div className="section-heading">
          <div>
            <div className="section-label">THE INVARIANT · 核心不变量</div>
            <h2>影子里，不许有这四样东西。</h2>
            <h3 className="heading-en" lang="en">Four things a shadow may never contain.</h3>
          </div>
          <div>
            <p>符合与不符合是二元判断。分数可以帮助审计，但不能替代架构事实。</p>
            <p className="translation" lang="en">Conformance is binary. Scores may support an audit, but they cannot replace an architectural fact.</p>
          </div>
        </div>
        <div className="rule-grid">
          {rules.map((rule) => (
            <article className="rule-card" key={rule.number}>
              <span className="rule-number">{rule.number}</span>
              <div className="rule-line" aria-hidden="true" />
              <h3>{rule.titleZh}</h3>
              <h4 lang="en">{rule.titleEn}</h4>
              <p>{rule.bodyZh}</p>
              <p className="translation" lang="en">{rule.bodyEn}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture section-shell">
        <div className="architecture-copy">
          <div className="section-label">ONE CORE, MANY SHADOWS · 一核多影</div>
          <h2>界面仍然原生，行为只有一份。</h2>
          <h3 className="heading-en" lang="en">Native interfaces. One behavior.</h3>
          <p>GUI 不需要每次启动 CLI 子进程。不同界面可以直接引用同一个动作库，也可以通过本地 IPC 调用同一个常驻运行时。关键不是传输方式，而是所有入口抵达同一个规范实现。</p>
          <p className="translation" lang="en">A GUI does not need to spawn a CLI process. Interfaces may share a library or call one runtime over local IPC. The transport is not the invariant; reaching the same canonical implementation is.</p>
          <ul className="check-list">
            <li><span>✓</span>稳定 Action ID 与 Schema / Stable IDs and schemas</li>
            <li><span>✓</span>统一结果、状态和事件 / Shared results, state, and events</li>
            <li><span>✓</span>结构化机器入口 / Structured machine access</li>
            <li><span>✓</span>核心层安全与审计 / Core-enforced safety and audit</li>
          </ul>
        </div>
        <div className="action-terminal" aria-label="ActionParity action example">
          <div className="terminal-bar"><span /><span /><span /><small>action-parity.json</small></div>
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
          <div className="terminal-result"><span className="status-dot" aria-hidden="true" />3 shadows → 1 canonical action</div>
        </div>
      </section>

      <section className="tooling section-shell" id="tooling">
        <div className="section-heading">
          <div>
            <div className="section-label">OPEN TOOLCHAIN · 开放工具链</div>
            <h2>规范不是口号，它可以被检查。</h2>
            <h3 className="heading-en" lang="en">A standard that can be checked.</h3>
          </div>
          <div>
            <p>规范、Schema、验证器与示例全部开放，任何团队都能免费自测。</p>
            <p className="translation" lang="en">The specification, schema, validator, and examples are open for every team to use.</p>
          </div>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <a className="capability-card" href={capability.href} key={capability.label}>
              <span>{capability.label}</span>
              <h3>{capability.titleZh}</h3>
              <h4 lang="en">{capability.titleEn}</h4>
              <p>{capability.bodyZh}</p>
              <p className="translation" lang="en">{capability.bodyEn}</p>
              <strong aria-hidden="true">↗</strong>
            </a>
          ))}
        </div>
        <div className="cli-block">
          <div><span className="cli-prompt">$</span><code>node bin/action-parity.mjs validate action-parity.json</code></div>
          <div className="cli-output"><span>VALID</span><span>Violations&nbsp;&nbsp;0</span><span>Unproven&nbsp;&nbsp;&nbsp;0</span></div>
        </div>
      </section>

      <section className="manifesto-full" id="manifesto">
        <div className="section-shell">
          <div className="manifesto-intro">
            <div>
              <div className="section-label">影核宣言</div>
              <h2>软件迎来了一种新的用户：AI Agent。</h2>
              <p>过去几十年，应用默认所有有意义的操作都会经过屏幕、鼠标和人的手。AI 改变了这个前提，但大多数软件仍把能力锁在像素后面。</p>
            </div>
            <div lang="en">
              <div className="section-label">THE ACTIONPARITY MANIFESTO</div>
              <h2>Software has a new kind of user.</h2>
              <p>For decades, applications assumed that every meaningful action would pass through a screen, a pointer, and a human hand. AI agents changed that assumption, but most software still hides its capabilities behind pixels.</p>
            </div>
          </div>
          <div className="manifesto-belief">我们相信 / <span lang="en">We believe</span></div>
          <ol className="manifesto-grid">
            {manifesto.map((item, index) => (
              <li className="manifesto-card" key={item.enTitle}>
                <span className="manifesto-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="manifesto-copy">
                  <span className="manifesto-lang">中文</span>
                  <p>{item.zh}</p>
                </div>
                <div className="manifesto-copy" lang="en">
                  <span className="manifesto-lang">ENGLISH</span>
                  <h3>{item.enTitle}</h3>
                  <p>{item.enBody}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="manifesto-promise">
            <span>我们的承诺只有一句 / Our promise is simple</span>
            <strong>一个动作，所有界面。</strong>
            <strong lang="en">One action. Every interface.</strong>
            <p>无论一个人点击、一个脚本调用、一个 Agent 执行，还是一个测试验证，他们操作的都应该是同一个软件。</p>
            <p lang="en">When a person clicks, a script calls, an agent invokes, or a test verifies, they should be operating the same application.</p>
            <a href={`${github}/blob/main/MANIFESTO.md`}>GitHub 原文 / Source manifesto ↗</a>
          </div>
        </div>
      </section>

      <section className="adopt section-shell" id="adopt">
        <div className="adopt-panel">
          <div className="adopt-copy">
            <div className="section-label">START SMALL · 从小处开始</div>
            <h2>不用推倒重写，从一个纵切动作开始。</h2>
            <h3 className="heading-en" lang="en">Start with one vertical action.</h3>
            <p>选择一个低风险、可观察结果的动作，把它从界面事件中抽出来，再让 GUI 与机器入口共同调用。第一条证据链跑通后，再扩展到更多动作和平台。</p>
            <p className="translation" lang="en">Choose one low-risk action with an observable result, extract it from the interface event, and let both GUI and machine paths invoke it. Expand only after the first evidence chain works.</p>
            <a className="button button-primary" href={`${github}/blob/main/docs/ADOPTION.md`}>采用指南 / Adoption guide <span aria-hidden="true">→</span></a>
          </div>
          <ol className="adopt-steps">
            <li><span>01</span><div><strong>盘点动作 / Inventory</strong><p>区分业务动作与纯界面交互。Separate business behavior from presentation.</p></div></li>
            <li><span>02</span><div><strong>抽出核心 / Extract</strong><p>建立稳定 ID、Schema 与无界面实现。Create stable IDs, schemas, and a headless implementation.</p></div></li>
            <li><span>03</span><div><strong>连接影子 / Bind</strong><p>让 GUI、CLI、MCP 走同一个注册点。Connect every interface to one registry.</p></div></li>
            <li><span>04</span><div><strong>留下证据 / Prove</strong><p>验证绑定、状态、安全与真实界面。Test bindings, state, safety, and the real GUI.</p></div></li>
          </ol>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <div><strong>ActionParity</strong><small>影核 · One action. Every interface.</small></div>
        </div>
        <div className="footer-links">
          <a href={`${github}/blob/main/SPEC.md`}>规范 / Spec</a>
          <a href={`${github}/blob/main/MANIFESTO.md`}>宣言 / Manifesto</a>
          <a href={`${github}/blob/main/CONTRIBUTING.md`}>参与 / Contribute</a>
          <a href={`${github}/blob/main/GOVERNANCE.md`}>治理 / Governance</a>
          <a href={github}>GitHub</a>
        </div>
        <p>Apache License 2.0 · Working Draft v0.5 · Bilingual Edition · 2026</p>
      </footer>
    </main>
  );
}
