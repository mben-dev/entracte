# @entracte/widget

The cookieless, RGPD-native developer sponsorship widget. **No cookies, no
localStorage, no identifiers sent from the client** — the server derives geo/UA
from the request. A house ad is always returned, so a slot is never empty. The
widget never throws into the host page.

## Drop-in

```html
<div data-ea-publisher="acme" data-ea-ad-type="entracte-text" id="slot-1"></div>
<script
  async
  src="https://cdn.entracte.ai/entracte.js"
  data-ea-api="https://api.entracte.ai"
></script>
```

It auto-discovers every `[data-ea-publisher]` element on the page.

## Attributes

| Attribute | On | Meaning |
|---|---|---|
| `data-ea-publisher` | slot | your publisher slug (required) |
| `data-ea-ad-type` | slot | format slug, default `entracte-text` |
| `data-ea-keywords` | slot | comma-separated contextual keywords (e.g. `rust,wasm`) — never PII |
| `data-ea-api` | slot or script | API base URL |

## Programmatic

```js
window.entracte.load(document.getElementById("slot-1"));
```

## Theming

Styles use CSS custom properties on the slot: `--ea-bg`, `--ea-fg`, `--ea-border`,
`--ea-accent`, `--ea-muted`. `prefers-color-scheme` is respected for image variants.

## How it stays cookieless

The impression is counted only when the slot is genuinely in the viewport, via a
one-time GET pixel to a server callback that carries the offer nonce. The click
is a normal link to a server redirect that carries the same nonce. No state is
stored on the device; replay/one-time-use is enforced server-side.
