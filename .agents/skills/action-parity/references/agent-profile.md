# ActionParity Agent Profile

Create `action-parity.config.json` at the project root. It is a discovery map for coding agents, not another Manifest and not a place for business policy.

```json
{
  "$schema": "node_modules/action-parity/schema/action-parity.agent-profile.schema.json",
  "format": "action-parity.agent-profile/v1",
  "manifest": "generated/action-parity.json",
  "registry": {
    "export": ["my-app", "export-action-registry", "--json"],
    "source_paths": ["src/action_registry.rs"]
  },
  "generated_paths": [
    "generated/action-parity.json",
    "generated/cli-help.json",
    "generated/mcp-tools.json"
  ],
  "commands": {
    "generate": ["npm", "run", "action-parity:generate"],
    "generate_check": ["npm", "run", "action-parity:check-generated"],
    "verify": ["npm", "run", "action-parity:verify"]
  }
}
```

Rules:

- All paths are relative to the profile and must stay inside the project root.
- Every command is an argv array: `[program, arg1, ...]`. Shell strings are rejected.
- `registry.export` must print one Registry Bundle JSON document to stdout.
- `generate_check` must be read-only and fail when generated files are missing or drifted.
- `verify` must execute evidence rather than only validating filenames.
- Add `verify_changed` only when it really selects affected Actions.
- Add `compat` only when it really compares the public Action contract with a base revision.
- `generated_paths` are derived artifacts. Agents must not edit them directly.

Validate discovery from the project root or any nested directory:

```text
action-parity context . --json
```

The canonical Schema ships at `schema/action-parity.agent-profile.schema.json` in the `action-parity` package.
