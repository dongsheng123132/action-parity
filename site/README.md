# ActionParity website

Official website source for [ActionParity（影核）](https://github.com/dongsheng123132/action-parity), built with vinext for Cloudflare Workers-compatible deployment.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The website lives in `app/page.tsx`; its visual system and responsive behavior live in `app/globals.css`.

## Validation

```bash
npm test
npm run lint
```

`npm test` builds the production worker and verifies the rendered homepage, metadata, canonical URL, GitHub links, and removal of starter content.

## Publishing

Sites deployment metadata is stored in `.openai/hosting.json`. The public domain is intended to be `actionparity.com`; DNS and access policy are managed outside this source directory.

The protocol specification, schema, validator, governance, and examples remain in the repository root.
