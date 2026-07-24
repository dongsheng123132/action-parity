# Brand, Trademark, and Namespace Plan

**Brand:** ActionParity  
**Chinese descriptor:** 动作同源标准  
**Tagline:** One action. Every interface.

This document is a project strategy, not legal advice or a trademark clearance
opinion.

## Recommendation

Registering a trademark is worthwhile if ActionParity will be used for
certification, commercial tooling, training, or an industry consortium. Open
source licensing protects the code and specification; it does not prevent another
party from using a confusingly similar brand or issuing misleading badges.

The first filing should normally be the plain word mark `ACTIONPARITY`. A logo can
be filed later after its design stabilizes.

Do not start with a certification mark. Certification marks have jurisdiction-
specific ownership and governance requirements. First build independent
implementations, public conformance rules, and neutral governance. A future
`ActionParity Certified` program can then be held by an appropriate neutral legal
entity.

## Clearance before filing

A domain or GitHub repository being available does not mean the trademark is
available.

Before filing:

1. Search the exact term and confusingly similar spellings, sounds, and meanings.
2. Search by relevant goods and services, not only by word.
3. Search the official [China Trademark Office](https://sbj.cnipa.gov.cn/),
   [WIPO Global Brand Database](https://www.wipo.int/en/web/global-brand-database),
   and the national registers of target markets.
4. Search ordinary web use, companies, package registries, app stores, and open
   source projects for unregistered prior use.
5. Have a trademark professional review the final class descriptions and
   ownership entity before payment.

WIPO explicitly advises checking national and regional registers in addition to
its global database. A simple exact-name search is only a knockout search, not
full clearance.

## Likely filing scope

Confirm wording against the current Nice Classification and local practice:

- **Class 9:** downloadable software, validators, SDKs, and testing tools;
- **Class 42:** SaaS, software testing, technical conformance, development, and
  hosted validation;
- **Class 41:** training and certification education, only if that business will
  actually be offered.

Avoid filing many speculative classes merely to occupy them. Trademark rights
must match real or intended use and maintenance obligations.

## Namespace reservation

After clearance and before a public promotion campaign, reserve:

- primary domains;
- GitHub organization or repository aliases;
- package names/scopes on npm, PyPI, crates.io, NuGet, and Docker if they will be
  used;
- major social/community handles;
- common misspellings only when the cost is justified.

Read-only checks on 2026-07-24 produced these preliminary results:

| Name | Preliminary result | Evidence and limitation |
|---|---|---|
| `actionparity.com` | No registration record returned | Verisign RDAP returned HTTP 404; recheck at checkout |
| `actionparity.org` | Reported available | Alibaba Cloud `CheckDomain` returned `Avail: 1`; recheck at checkout |
| `actionparity.cn` | Reported available | Alibaba Cloud `CheckDomain` returned `Avail: 1`; recheck at checkout |
| `actionparity.ai` | Not determined | The available registrar API did not support this suffix |

Availability can change at any moment. Registration, renewal, DNS changes, and
other paid actions require an explicit price-and-term decision.

## Open-standard trademark policy

The specification and validator can remain under open licenses while the name and
certification badge are governed separately.

A future `TRADEMARKS.md` should permit:

- truthful statements such as “implements ActionParity 0.x”;
- links, compatibility discussion, and community forks;
- unmodified redistribution of official badges under published rules.

It should prohibit:

- implying certification without passing the public process;
- confusing forks with the official project;
- using the name to suggest endorsement or partnership;
- modified badges that appear official.

The trademark should protect trust in the conformance claim, not give its owner a
private veto over implementations of the open specification.

## Ownership and neutrality

The initial owner should be a stable person or legal entity capable of maintaining
and enforcing the mark. If a neutral foundation or association is planned, decide
ownership early; later assignment adds cost and paperwork.

Before paid certification launches:

- publish objective pass/fail rules;
- allow free self-testing;
- separate specification governance from sales;
- disclose conflicts of interest;
- provide an appeal process;
- allow multiple independent testing labs.

Commercial value should come from implementation, hosted CI, migration, audit,
support, training, and trustworthy certification—not from charging for access to
the standard itself.
