# The ActionParity Manifesto

Software has a new kind of user.

For decades, applications assumed that every meaningful action would pass through a screen, a pointer, and a human hand. AI agents changed that assumption, but most software still hides its capabilities behind pixels.

We believe:

1. **One core, many shadows.**

   There is one place where a behavior lives. GUI, CLI, TUI, MCP, API, and automation are shadows it casts on different platforms — each shaped by its platform's conventions, none of them holding a behavior of its own.

2. **A behavior should be written once, and a platform should cost one shadow.**

   A feature duplicated across interfaces will drift, and AI-assisted development makes duplication cheap while making drift invisible. Adding a behavior should cost one implementation; adding a platform should cost one shadow, not one reimplementation per behavior.

3. **Humans and agents deserve semantic access.**

   Humans need understandable interfaces. Agents need discoverable actions, typed inputs, structured results, and stable state. Neither should receive a weaker version of the product.

4. **Computer Use is a compatibility layer, not the foundation.**

   Screenshots, coordinates, and input injection remain valuable for old software and final visual verification. New software should expose meaning directly.

5. **Conformance is a yes or a no, not a percentage.**

   Claims such as "AI-ready" are not enough, so applications publish manifests, mappings, exceptions, and tests. But a shadow either holds behavior of its own or it does not, and that question has no score. A number with a numerator will be optimized; write down what is wrong and where.

6. **Safety belongs below the interface.**

   Permissions, confirmation, risk, audit, cancellation, and rollback cannot live only in a prompt or dialog.

7. **Real GUI testing still matters.**

   A correct Action Core does not prove that a button is reachable, a label is readable, or a layout works. Semantic and visual interface tests remain part of conformance.

8. **Open standards create larger markets.**

   The specification should be freely implementable. Companies should compete on tools, reliability, integration, support, and trust—not private access to the definition of compatibility.

Our promise is simple:

> **One action. Every interface.**

When a person clicks, a script calls, an agent invokes, or a test verifies, they should be operating the same application.

---

# 影核（ActionParity）宣言

软件迎来了一种新的用户：AI Agent。

过去几十年，应用默认所有有意义的操作都会经过屏幕、鼠标和人的手。AI 改变了这个前提，但大多数软件仍把能力锁在像素后面。

我们相信：

1. **一核多影。** 行为只有一个落脚处，GUI、CLI、TUI、MCP、API 都是它投在各平台上的影子——影子有各自的形状，但没有自己的行为。
2. **一个行为写一遍，多一个平台只多一个影子。** 不是每个平台把每个行为重写一遍。AI 让「复制一份实现」变得极便宜，也让「三份已经跑偏」变得看不见。
3. **人和 Agent 都应该获得语义级访问能力。**
4. **Computer Use 是兼容层，不应是新软件的地基。**
5. **符合与否是能与不能，不是百分比。** 有分子的数字就会被优化——把错在哪、在哪一行写出来，比给一个分数有用。
6. **权限、确认、审计和回滚必须位于界面之下。**
7. **动作核心正确，不能代替真实 GUI 测试。**
8. **开放标准会创造更大的商业市场。**

我们的承诺只有一句：

> **一个动作，所有界面。**

无论一个人点击、一个脚本调用、一个 Agent 执行，还是一个测试验证，他们操作的都应该是同一个软件。

