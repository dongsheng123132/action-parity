# Releasing the installable toolchain

The specification version and toolchain version are separate. The current
toolchain is `0.6.0`; it emits the current `0.5.0` wire Manifest until a newer
wire schema is deliberately selected.

## Release gate

From a clean commit, run:

```text
npm ci
npm run check
npm run check:release
```

`check:release` is deliberately stronger than `npm pack --dry-run`. It:

1. checks npm, CLI, Cargo workspace, and adapter dependency versions;
2. packs the npm package and checks required files;
3. installs that tarball in a new temporary consumer project;
4. executes the installed CLI and generates Manifest, CLI, MCP, and TypeScript artifacts;
5. packages `action-parity-core` and checks the complete
   `action-parity-tauri` publish file set.

This catches the common failure where the monorepo passes but a published file,
runtime dependency, executable bit, or crate version is missing. On the first
release, Cargo cannot fully package the Tauri crate until crates.io can resolve
the newly published core crate; this is why the gate checks its exact publish
set and the next section publishes in two phases.

## Publication order

Publishing changes external state. After reviewing the package owners and
credentials, publish in this order:

```text
cargo publish -p action-parity-core
# wait until crates.io serves action-parity-core 0.6.0
cargo package -p action-parity-tauri
cargo publish -p action-parity-tauri
npm publish --access public
```

The Tauri crate declares both `version = "0.6.0"` and a workspace `path`. Cargo
uses the path inside this monorepo and the version from crates.io for consumers.

Then verify from directories outside the repository:

```text
cargo info action-parity-core@0.6.0
cargo info action-parity-tauri@0.6.0
npx --yes action-parity@0.6.0 --version
```

Only after those pass should the maintainer create and push tag `v0.6.0` and
publish the GitHub Release notes. Do not tag first and discover that downstream
projects cannot install the artifacts.

## Redline adoption gate

Redline must not commit a dependency on a developer's absolute filesystem path.
Its first reproducible integration begins after the commands above succeed. It
can then depend on `action-parity-core = "0.6.0"` and
`action-parity = "^0.6.0"`, preserve its existing `dispatch()`, and migrate one
vertical slice before expanding all nine Actions.
