# Releasing the installable toolchain

The toolchain and Manifest specification are independent release lines. Read
their current values with:

```text
action-parity --version --json
```

At toolchain `0.8.0`, the current wire Manifest remains specification `0.5.0`.
See [VERSIONING.md](VERSIONING.md) for the compatibility rules and the reason
the historical public tags jumped from `v0.1.0` to `v0.6.0`.

## Release channels are separate facts

A GitHub Release, npm publication, and crates.io publication are three distinct
external states. Release notes MUST say which channels were actually verified.

- A GitHub Release may attach the `npm pack` tarball. That tarball is directly
  installable even when the npm registry is still pending.
- `action-parity@<version>` is available only after `npm publish` succeeds and
  a clean external `npx` check passes.
- `action-parity-sdk@<version>` is a second npm package with its own
  publication state. The toolchain being published does not make the SDK
  published.
- `action-parity-core` and `action-parity-tauri` are available only after each
  crate is served by crates.io and `cargo info` succeeds.

Never describe a local release check or an attached GitHub asset as a registry
publication.

## Release gate

From a clean commit, run:

```text
npm ci
npm run check
npm run check:release
```

`check:release` is deliberately stronger than `npm pack --dry-run`. It:

1. checks npm, CLI, Cargo workspace, adapter dependency, and Manifest Schema
   versions;
2. packs the npm package and checks required files;
3. installs that tarball in a new temporary consumer project;
4. executes the installed CLI, including its machine-readable version output,
   and generates Manifest, CLI, MCP, and TypeScript artifacts;
5. packs `action-parity-sdk`, installs that tarball in a second clean consumer,
   and runs the adopter loop against it — register an Action, dispatch it,
   export a bundle, list MCP tools, run the generated CLI — because a monorepo
   import proves nothing about the published package;
6. packages `action-parity-core` and checks the complete
   `action-parity-tauri` publish file set.

This catches the common failure where the monorepo passes but a published file,
runtime dependency, executable bit, version identity, or crate file is missing.

## GitHub Release

After the gate passes, create the version tag from the clean release commit and
attach the tarball produced by `npm pack`. The release title and first paragraph
MUST state both identities, for example:

```text
Toolchain v0.8.0 / Manifest specification 0.5.0
```

The notes MUST also state whether npm and crates.io are published or pending.
Do not move an existing public tag or create backdated 0.2–0.5 toolchain tags.

## Registry publication order

Confirm credentials before changing registry state:

```text
npm whoami
cargo login
```

The Rust crates require a two-phase first publication because the Tauri adapter
depends on the published core crate:

```text
cargo publish -p action-parity-core
# wait until crates.io serves action-parity-core <toolchain-version>
cargo package -p action-parity-tauri
cargo publish -p action-parity-tauri
npm publish --access public
npm publish --access public --workspace action-parity-sdk
```

Then verify from clean directories outside the repository:

```text
cargo info action-parity-core@<toolchain-version>
cargo info action-parity-tauri@<toolchain-version>
npx --yes action-parity@<toolchain-version> --version --json
npm view action-parity-sdk@<toolchain-version> version
```

If authentication is unavailable, stop at the GitHub tarball channel and mark
the registries pending. Never ask a user to paste a token into a command or log.

## Downstream adoption gate

Downstream Rust projects must not commit a dependency on a developer's absolute
filesystem path. They may depend on `action-parity-core` only after the exact
crate version is externally resolvable. JavaScript projects may temporarily pin
the immutable GitHub Release asset URL, then move to
`action-parity = "^<toolchain-version>"` after npm verification.

Existing applications should preserve their dispatcher and migrate one
vertical Action slice before expanding the Registry. A package release is not
evidence that an application binding is correct; `action-parity verify` remains
the completion gate.
