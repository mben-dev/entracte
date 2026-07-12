# Your AI thinks. You earn AI credits.

**A credit wallet in your status bar, plus an opt-in sponsor inside your
editor's AI agent. Sign in once to turn each impression — shown while your agent
thinks — into AI credits you can spend on Claude, ChatGPT, or any model. Or
switch the display to motivation quotes or dev-news and never see an ad.**

Nothing shows until you sign in, so no unpaid impressions ever run on you.

## What it does

- **A credit wallet in the status bar.** Your balance (`◆ entracte · $X`) sits
  at the right of the status bar — a clean readout, never an ad.
- **An opt-in in-agent sponsor.** One tasteful sponsor card appears inside the
  editor's AI agent — **Cursor Composer, VS Code Copilot & the Agents view, and
  OpenAI Codex** — *only while it's thinking*, and disappears when it's done.
- **Sign in once** (OAuth device flow — approve in your browser, no password
  typed into the editor) to attribute those impressions to your publisher and
  **earn AI credits**, spendable on Claude, ChatGPT, or any model.
- **Prefer no ads?** Switch the display to **motivation quotes** or **dev-news**
  with one command — the card then shows content instead of a sponsor, and earns
  nothing.
- Fires the view beacon **only while the window is focused**, so advertisers pay
  for real attention, never for a backgrounded window.

## Works in VS Code, Cursor & Windsurf

Published to both the **Visual Studio Marketplace** (VS Code) and **Open VSX**
(Cursor, Windsurf, and other VS Code-compatible editors). The same build runs
everywhere.

## Privacy

entracte is built to be a sponsor you can actually trust:

- **Cookieless.** No cookies, no device fingerprint, no cross-site identifiers.
  Views and clicks are counted server-side with a one-time token.
- **No telemetry.** We collect no analytics about you or your usage.
- **Reads no code or prompts.** The extension never reads your files, editor
  buffers, or anything you type — only your publisher slug goes out, to ask for
  one sponsor.
- **The status-bar wallet never patches the editor** — it uses only the public
  VS Code API.
- **The in-agent sponsor is opt-in and reversible.** There's no public API to
  render inside the editor's agent, so — *only when you explicitly enable it* —
  entracte adds a small, self-contained script to the editor (and, for Codex, to
  that extension's own webview). Disable it anytime to restore the original
  files. It's off by default.
- Your sign-in token is kept in the editor's encrypted **SecretStorage**.

## Commands

Run these from the Command Palette (or click the status-bar item for the menu):

| Command | What it does |
|---|---|
| `entracte: Sign in & earn` | Device-flow sign-in to attribute earnings to you |
| `entracte: Enable in-agent sponsor` | Show the sponsor inside the editor's agent (opt-in, reversible) |
| `entracte: Enable Codex sponsor` | Same, inside the OpenAI Codex chat |
| `entracte: Show sponsors (earn)` | Show sponsors — you earn AI credits |
| `entracte: Show motivation quotes` | Switch the display to quotes — no ads |
| `entracte: Show dev news` | Switch the display to dev-news — no ads |
| `entracte: Refresh the balance` | Fetch fresh earnings now |
| `entracte: Sign out` | Forget your token and stop earning |

## Settings

| Setting | Default | What |
|---|---|---|
| `entracte.enabled` | `true` | Show the entracte wallet in the status bar. |
| `entracte.apiUrl` | `https://api.entracte.ai` | Base URL of the entracte ad API. Change only if you self-host. |
| `entracte.publisher` | `entracte` | Advanced: the publisher slug used for anonymous serves. Signing in overrides this and is how earnings are attributed to you. |

## Install

- **VS Code** — install **entracte** from the Extensions view (Visual Studio
  Marketplace).
- **Cursor & Windsurf** — install it from **Open VSX** via the Extensions view.
- **Sideload** — grab the `.vsix` from the
  [releases](https://github.com/mben-dev/entracte.ai/releases) and run
  **Extensions ▸ … ▸ Install from VSIX…**, then reload.

After installing, click the status-bar item (or run **entracte: Sign in &
earn**) to sign in and start earning.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE).

---

<!-- Workstream E coherence: lead the footer with earner value, not RGPD. -->

Made by [entracte](https://entracte.ai) — earn AI credits on the surfaces
developers actually live in. Cookieless, RGPD-native, EU-hosted.
