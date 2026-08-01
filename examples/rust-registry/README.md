# Rust Action Registry example

This example registers two Actions once and derives six GUI/CLI/MCP Bindings.
Nothing in the three Surface definitions implements note behavior.

From the repository root:

```text
npm run generate:rust-example
node bin/action-parity.mjs verify examples/rust-registry/generated/action-parity.json
```

`generate:rust-example` writes a deterministic Manifest, CLI help catalog, MCP
tool catalog, and registry bundle. `verify` then:

1. reruns the Rust exporter and compares the generated Manifest;
2. executes the declared parity test without a shell;
3. requires one runtime observation per Action and Surface;
4. checks that the request and Action Core saw the same `execution_id`;
5. hashes the Manifest, plan, binary, command output, and evidence report.

Edit a generated GUI `target` by hand and verification fails at the generator
comparison even though the edited JSON still passes schema validation.
