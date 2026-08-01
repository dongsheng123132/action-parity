# Rust Action Registry example

This example registers two Actions once and derives six GUI/CLI/MCP Bindings.
Nothing in the three Surface definitions implements note behavior.

From the repository root:

```text
npm run generate:rust-example
node bin/action-parity.mjs verify examples/rust-registry/generated/action-parity.json
```

`generate:rust-example` writes a deterministic Manifest, CLI help catalog, MCP
tool catalog, TypeScript Action client, and registry bundle. The generated
client contains Action constants, Schema-derived input/output types, a typed
generic caller, and a Tauri caller without importing the Tauri package.

Editable GUI code keeps one transport bridge in `gui/actions.ts`:

```ts
import { ACTION } from "../generated/action-client";
import { createGuiActionClient } from "./actions";

const call = createGuiActionClient(invoke);
const result = await call(ACTION.NOTE_CREATE, { title: "typed input" });
```

Neither the bridge nor feature code repeats `"note.create"`. Adding an Action
changes the Rust Registry and the GUI presentation; generation supplies the
cross-language contract. `verify` then:

1. reruns the Rust exporter and compares the generated Manifest;
2. executes the declared parity test without a shell;
3. requires one runtime observation per Action and Surface;
4. checks that the request and Action Core saw the same `execution_id`;
5. hashes the Manifest, plan, binary, command output, and evidence report.

Edit a generated GUI `target` or `action-client.ts` by hand and the generator
check fails even when the edited file is otherwise syntactically valid.
