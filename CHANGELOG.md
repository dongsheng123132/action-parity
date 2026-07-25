# Changelog

All notable project changes will be documented here.

## 0.2.0 - 2026-07-26

Credibility of the score, prompted by the cc-switch pilot: a pure GUI
application with no machine entry point passed AP-2 validation at 66.7% without
a line of new code. Breaking, because a report key was renamed rather than
aliased.

- **Two scores, never one.** `strict_parity_percent` is replaced by
  `declared_parity_percent` plus `evidenced_parity_percent`; a required Binding
  counts as evidence only when it names a re-runnable test.
- **AP-2 now requires binding evidence.** The previous wording claimed AP-2
  proved that Surfaces invoke the same Action Core, which no static check can
  demonstrate. §14.2 now states the requirement the validator can actually
  enforce.
- **Targets and achieved level are separated.** `conformance_targets` is
  self-declared and no longer reads as an outcome; reports state the achieved
  level and the blockers preventing the next one. AP-4 is never derived from a
  manifest.
- **Exceptions are visible in every report format.** They were present in JSON
  and missing from human output, so `0 errors, 0 warnings` could hide a backlog.
  An exception past its `review_by` date now warns.

Known and still open: `ipc` and `test` Surfaces have no reachability
requirement, so an in-process-only Surface still scores like an externally
reachable one (case F1). Tracked for 0.3.0.

## 0.1.0 - 2026-07-24

Initial working draft:

- ActionParity name and positioning;
- normative specification;
- JSON Schema;
- manifest validator and report command;
- minimal and U-King examples;
- adjacent-standards landscape;
- adoption and commercialization plans;
- open governance and contribution process.

