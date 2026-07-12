<!-- Workstream E coherence: README added; leads with earn-AI-credits, states what it renders + credits/privacy. -->

# Your AI thinks. You earn AI credits.

Earn **AI credits** in [opencode](https://opencode.ai) — a single, tasteful
sponsor line rendered in the TUI while your agent works. Every valid impression
on your surface credits you, spendable on any model. Prefer no ads? The same line
can show a motivation quote or a dev-news headline instead (and earns nothing).

## Install

Add the plugin to your opencode config so it loads on startup:

```jsonc
// opencode.json
{
  "plugin": ["entracte-opencode"]
}
```

opencode fetches it from npm on next launch. The sponsor line then renders in the
working row (the `app_bottom` slot) while the agent thinks.

## What it renders

- **One sponsor line** in the opencode working row while your agent is active —
  never a full banner, never a takeover.
- **Signed in:** the line shows the sponsor plus today's earnings, attributed to
  your publisher, and you **earn AI credits** on every valid impression.
- **Not signed in:** the line prompts a one-time sign-in (OAuth device flow —
  approve in your browser, no password typed into the TUI). Nothing is attributed
  until you link.
- **Prefer no ads?** Switch the display to motivation quotes or dev news — the
  row then shows content instead of a sponsor, and earns nothing. Your call.

## Credits & privacy

- **You earn AI credits**, not cash — credited automatically, spendable on any
  supported model. No thresholds, no payout friction.
- **Cookieless.** No cookies, no device IDs, no cross-site identifiers. Views and
  clicks are metered server-side with a one-time token.
- **Reads no code or prompts.** Only your publisher slug goes out, to ask for one
  sponsor. Never your source, your conversations, or any personal profile.
- **Patches nothing.** It renders through opencode's own plugin slot; removing the
  plugin leaves zero trace.

Env (optional): `ENTRACTE_API` (default `https://api.entracte.ai`).

## License

[PolyForm Noncommercial 1.0.0](../../LICENSE) — source-available, not OSI open
source; noncommercial use is free, commercial use needs a license from us.
