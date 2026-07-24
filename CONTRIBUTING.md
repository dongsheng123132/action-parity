# Contributing to ActionParity

ActionParity needs application implementers, QA engineers, accessibility experts, framework maintainers, agent builders, security reviewers, and technical writers.

## Ways to contribute

- Report a real GUI/CLI/MCP parity problem.
- Submit an implementation report.
- Challenge a normative requirement with evidence.
- Add a framework adapter or example.
- Improve the JSON Schema and validator.
- Review security, accessibility, or internationalization.
- Translate documentation.

## Before proposing a new requirement

Check:

- [SPEC.md](SPEC.md);
- [docs/LANDSCAPE.md](docs/LANDSCAPE.md);
- existing issues and discussions;
- whether an existing standard already solves the transport or schema problem.

ActionParity should specify the parity invariant and conformance evidence, not recreate adjacent protocols.

## Specification proposal

Open an issue containing:

1. problem statement;
2. real application use case;
3. proposed normative language;
4. manifest or schema example;
5. compatibility impact;
6. security and privacy impact;
7. accessibility impact;
8. alternatives considered.

After discussion, submit a focused pull request.

## Implementation report

Reports should identify:

- application and version;
- operating system and framework;
- ActionParity version;
- claimed conformance level;
- required Surfaces;
- strict score and exceptions;
- public manifest;
- test and build instructions;
- evidence artifact;
- known gaps.

Do not include credentials, private user data, or destructive test instructions.

## Pull requests

- Keep normative and editorial changes separate.
- Add or update tests for schema and validator changes.
- Update examples when a schema change affects them.
- Update `CHANGELOG.md`.
- Explain compatibility impact.
- Use clear, compact commit messages.

## Developer setup

Requires Node.js 20 or later.

```bash
npm install
npm test
node bin/action-parity.mjs validate examples/minimal/action-parity.json
```

## Design rules for machine Surfaces

- stdout is result data;
- stderr is logs and progress;
- non-TTY output contains no ANSI or spinner;
- JSON responses include a stable success indicator and error information;
- non-interactive flags exist for automation;
- exit codes remain simple and documented;
- secrets do not appear in command history or output.

## Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contribution is licensed under the Apache License 2.0.

