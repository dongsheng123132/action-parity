# Audit Profile: conformance levels and coverage scores

> **This is one way to audit an implementation. It is not the standard.**
>
> An application can fully satisfy ActionParity — one Action Core, shadows that
> carry no behavior of their own, discoverable and invocable without pixels —
> and never produce a level or a percentage. Conformance is defined in
> [`SPEC.md`](../SPEC.md) §5, and it is binary.
>
> This profile exists because teams asked for a graded path and because
> certification needs something to certify. Use it when a staged plan or an
> external claim is genuinely useful. Do not use it as the definition of doing
> this correctly.

## Why this was moved out of the specification

In the 0.1.0 through 0.4.0 drafts, levels and scores lived in the specification
and grew to dominate it. A word count at 0.3.0 found `AP-1` through `AP-4`
appearing 140 times in the repository while `shadow` appeared zero times in
`SPEC.md` — the architectural claim the standard is named after had never
entered its own normative text. The chapter defining the architecture was 14
lines; the chapters defining the scoreboard were 92.

The pilot evidence pointed the same way. Across a real conversion, the score
moved *against* the work: an application with no machine entry point at all
scored 66.7% and passed AP-2, and adding a genuine CLI plus sixteen headless
regression tests dropped it to AP-1. Two rounds of scoring fixes corrected that
inversion, and within those same two rounds two ways to game the score were
found. A number with a numerator and a denominator will be optimized. The three
things that actually improved the product — a machine entry point, a
confirmation gate pushed below the interface, a manifest generated instead of
hand-written — needed no percentage to identify.

Levels remain useful as a roadmap: *what should we do next?* is a real question,
and "reach AP-2" is a better answer than a list of clauses. They are a poor
definition of correctness, which is why they now live here.

## Conformance levels

### AP-1 Core

An AP-1 implementation:

- publishes a valid manifest;
- exposes stable Action IDs;
- declares input and output schemas;
- executes all claimed business Actions headlessly;
- names `execution.headless_evidence` for every Action;
- passes Action contract tests.

`headless: true` is a boolean an implementer can set without running anything. The evidence field is what separates an Action proven to run without a display from one assumed to.

### AP-2 Parity

An AP-2 implementation satisfies AP-1 and:

- declares required Surfaces;
- binds every non-exempt Action to every required Surface;
- provides every non-exempt Action with a machine Surface that is not `in-process` (SPEC §8.2.1);
- supplies a re-runnable test in `binding.test` for every required Binding;
- reports all exceptions.

A Binding without a test is a claim, not a demonstration. A manifest alone cannot show that two Surfaces reach the same Action Core: an implementation can declare one Action ID over two independent implementations and no static check will notice.

### AP-3 Agent

An AP-3 implementation satisfies AP-2 and:

- provides structured machine results;
- supports discovery without human documentation;
- enforces risk, confirmation, and authority below the interface layer;
- emits progress and supports cancellation where applicable;
- maintains correlated audit records for state-changing Actions.

### AP-4 Verified

An AP-4 implementation satisfies AP-3 and:

- publishes a signed or reproducible conformance report;
- includes Action, Binding, State synchronization, accessibility, and critical real-interface tests;
- identifies application artifact version and test environment;
- contains no undisclosed parity exception.

## Coverage scores

Scores are a secondary output. A validator MUST report violations first
(SPEC §5.2); coverage percentages are an annotation on that report, never the
headline and never a badge.

When published, a report MUST publish two scores, never one:

```text
declared parity  = present required bindings   / total required bindings × 100
evidenced parity = evidenced required bindings / total required bindings × 100
```

where a required Binding is *evidenced* only when it names a re-runnable test, and:

```text
total required bindings =
  number of non-presentation Actions × number of required Surfaces
```

Publishing declared parity alone is non-conformant reporting. The two numbers answer different questions — "is the manifest filled in?" and "can any of it be re-run?" — and a single number lets the first masquerade as the second.

Exceptions remain in the denominator and MUST appear in every report format, including human-readable output. An exception past its `review_by` date MUST be reported as a warning.

Scores measure coverage, not product quality. A high score does not replace security, accessibility, correctness, or usability review.

### Targets versus achieved level

`conformance_targets` states what an implementation is aiming for. It is self-declared and MUST NOT be reported as an outcome. A report MUST state the achieved level separately, derived only from what the manifest and its evidence demonstrate, and MUST list the blockers preventing the next level.

AP-2 is the highest level derivable from a manifest and its declared evidence. AP-3 describes runtime behaviour — structured results, policy enforced below the interface layer, real audit records — and AP-4 requires a published conformance report. A static validator MUST NOT award either. In particular `audit_required: true` declares that an Action needs audit, not that audit exists, and MUST NOT be read as an AP-3 grade.

## Known limits of scoring

Recorded so that nobody rediscovers them as surprises:

- **Anything with a denominator can be shrunk.** Excluding a machine Surface
  from the required set raises evidenced parity without changing the product.
  SPEC §6.4 requires an `exclusion_reason` and makes every exclusion visible,
  which makes the move honest rather than impossible.
- **The Surface hardest to prove is usually the one that matters.** A Surface
  that cannot be tested next to the GUI is precisely the Surface that cannot
  demonstrate they reach the same core.
- **Doing real work can lower the score.** Evidence-based scoring starts from
  the truth rather than from the declaration, so an honest team's first measured
  number is often worse than its first unmeasured one. This is the scoring
  working; it still surprises people.
- **A level is not a safety claim.** The pilot's most valuable finding — a
  destructive Action guarded only by a dialog — was found by filling in
  `effects.confirmation`, not by any score.
