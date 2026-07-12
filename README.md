# entracte — open client surfaces

**entracte** is a cookieless, GDPR-native sponsorship network for developer
tools: one tasteful, clearly-labelled sponsor line on the surfaces you already
use — Claude Code, Cursor, VS Code, opencode, your docs or newsletter — and you
earn **AI credits** from every impression shown on your surface.

This repository is the **open-source client**: the code that runs **on your
machine**. Read it and verify for yourself rather than taking our word for it:

- **Cookieless.** No cookies are set on any surface.
- **Reads no code, no prompts.** Only your repo's *shape* (language / framework)
  is used for context — never file contents.
- **No telemetry.** Nothing is phoned home about you; removing it leaves zero trace.
- **Earning is opt-in.** Nothing bills until you explicitly sign in, and then
  impressions are attributed only to **your own** account.
- **Patches nothing by default.** The CLI uses only Claude Code's supported
  settings. The editor extension's in-agent sponsor is **opt-in** and
  **byte-reversibly** removable.

> The service backend (the auction, pricing, moderation, dashboards) is
> proprietary. Privacy, though, is a **client-side** property — it lives in the
> code here, which you can audit line by line. Publishing it is the point.

## Packages

| Package | Surface | Install |
|---|---|---|
| [`entracte`](packages/cli) | Claude Code — a status-line sponsor (optional spinner verb) | `npx entracte` |
| [`entracte-opencode`](packages/opencode-plugin) | opencode — a line in the thinking spinner | `bun add entracte-opencode` |
| [`entracte-vscode`](packages/vscode-extension) | VS Code · Cursor · Windsurf — a credit wallet + an opt-in in-agent sponsor | VS Code Marketplace / Open VSX |
| [`@entracte/widget`](packages/widget) | Your website · docs · newsletter | `<script defer src=".../entracte.js">` |

## Verify it yourself

Each package builds from its own source (`pnpm install` at the root, then
`pnpm --filter <package> build`). Diff the build output against the published
artifact (npm / the marketplaces) to confirm what you install matches what's here.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — source-available: noncommercial use is
free; any commercial use needs a license from the copyright holder
(Mohamed Benfriha).
