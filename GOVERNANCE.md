# Governance

ActionParity is currently a founder-led working draft with the explicit goal of becoming a multi-stakeholder, community-governed standard.

## Principles

1. Normative work happens in public.
2. Implementer evidence has more weight than abstract preference.
3. The standard composes adjacent standards where possible.
4. No vendor receives private conformance exceptions.
5. Specification access and self-validation remain free.
6. Security, accessibility, and user authority are not optional add-ons.

## Roles

### Contributors

Anyone participating through issues, discussions, implementation reports, reviews, or pull requests.

### Editors

Maintainers responsible for editorial consistency, schemas, release preparation, and recording decisions. Editors do not gain unilateral authority to redefine consensus.

### Technical Steering Group

Before v1.0, the project intends to establish a group representing at least:

- application implementers;
- framework or SDK maintainers;
- testing and accessibility expertise;
- AI-agent/tooling expertise;
- security and enterprise users.

No single commercial organization should hold a permanent majority.

## Change process

### Editorial changes

Typos, broken links, formatting, and clarifications that do not change conformance semantics may be merged through normal pull-request review.

### Normative changes

A normative change requires:

1. a public issue using the specification-proposal template;
2. at least one concrete use case;
3. proposed normative text;
4. compatibility and security analysis;
5. at least 14 calendar days for public review once the project reaches 0.5;
6. a recorded editor decision and dissent summary.

Before 0.5, maintainers may use a shorter review period to keep the experimental draft moving, but decisions must remain public and reversible.

### Breaking changes

Breaking changes must:

- identify affected implementations;
- include a migration path;
- receive a version bump consistent with semantic versioning;
- remain open for a minimum 30-day review once the project reaches 1.0.

## Releases

- Every release has a Git tag and changelog.
- Schemas are versioned with the specification.
- Published conformance claims identify an exact specification version.
- Draft releases may change incompatibly before 1.0.
- Stable releases do not alter normative requirements in patch versions.

## Conflicts of interest

Editors and steering-group members must disclose material commercial interests relevant to a proposal.

Commercial participation is welcome. Undisclosed pay-to-play requirements, private exemptions, or mandatory single-vendor services are not.

## Appeals

A contributor may request reconsideration when:

- new implementation evidence appears;
- required process was not followed;
- a decision creates an undisclosed vendor dependency;
- security or accessibility impact was not addressed.

Appeals must focus on evidence and process. They are discussed publicly.

## Trademark and certification

The specification license does not automatically grant rights to imply official certification.

Before certification marks are launched, the project will publish:

- objective eligibility rules;
- permitted badge use;
- expiration and revocation rules;
- verifier accreditation;
- dispute and appeal process.

Implementers may always truthfully state the exact draft they self-tested against, such as:

```text
Self-tested against ActionParity 0.1.0 AP-2
```

They must not state or imply independent certification without verification.

## Transition target

The project should not call v1.0 final until:

- at least three independent applications implement the draft;
- at least two operating systems are represented;
- at least three application frameworks are represented;
- a multi-party steering group is operating;
- intellectual-property and trademark policies are explicit;
- conformance tests and reports are reproducible.

