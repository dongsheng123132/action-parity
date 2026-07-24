# Security Policy

## Reporting

Do not open a public issue for:

- a validator vulnerability that can execute code;
- a credential exposure;
- a test path that can alter real user state;
- a certification or report-signing bypass;
- a dangerous default in a reference adapter.

Until a dedicated security mailbox is established, use GitHub's private vulnerability reporting for this repository.

## Scope

The v0.1 validator reads local JSON and does not execute application actions. Reference manifests are examples and must not contain secrets.

Future adapters and conformance runners must treat application actions as potentially destructive. They should:

- run with least privilege;
- isolate test state;
- require explicit authority for destructive scenarios;
- use timeouts and cancellation;
- redact credentials;
- preserve audit evidence;
- distinguish an attempted action from a completed effect.

## Supported versions

Before 1.0, only the latest tagged draft receives security fixes.

