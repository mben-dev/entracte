# Changelog

All notable changes to the entracte extension are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] — Wallet shows spendable AI credits (USD)

- The status-bar wallet now shows your **spendable balance in USD** — what's
  left on your AI-credit key — read from `/api/publisher/credits`. It decreases
  as you spend and matches the web dashboard. Previously it showed lifetime
  earnings (tracked in €) labelled with a `$`, so it never moved when you spent
  credits. Falls back to your earned total until you've opened a key.

## [0.6.1] — Hero tagline + correct earner attribution

- Store copy now leads with "Your AI thinks. You earn AI credits."
- The in-agent pool is fetched for the signed-in publisher (not the default
  config slug), so switching content mode (ads / quotes / news) and earning
  attribution both track the account you signed in with.

## [0.5.15] — Steady in-chat card (no flicker) in VS Code

- Widened the no-growth window to ~5s so the card stays steady through a bursty
  multi-step reply instead of flickering between steps; it hides a few seconds
  after the reply truly stops.

## [0.5.14] — Card shows again in VS Code (virtualized-list-safe)

- Reverted the completion-toolbar signal: VS Code's agent chat is a VIRTUALIZED
  list, so "last visible row is finished" read as done almost always and the card
  stopped showing. Detect generation via the reply still streaming (visible text
  growing) + the live working step, which survives virtualization. Hide is a short
  delay after the reply stops.

## [0.5.13] — VS Code: state-machine detection (start → finish)

- The in-chat card in VS Code now tracks the turn as a state machine: it shows
  from the reasoning phase, through streaming and multi-step work, and hides the
  moment the turn is finished — detected by the completion toolbar (thumbs +
  "· N credits" footer) that appears only when the whole turn is done. No more
  "appears late" / "never disappears".

## [0.5.12] — Card reliably clears in VS Code'''s agent view

- In VS Code's agent sessions view, step summaries ("Generating patch (306
  lines)", `.progress-step`) persist after the turn ends and were keeping the
  card open. Detect live work only via `.chat-working-progress` so the card
  disappears when the agent finishes.

## [0.5.11] — Shows during reasoning, steady across tab switches

- The in-chat card now appears from the **reasoning/thinking phase** (detects a
  standalone "…ing" status), not only once the reply starts streaming.
- It no longer **reappears when you switch tabs back to the chat** — only real
  incremental streaming (not a full re-mount) is treated as generation.

## [0.5.10] — In-chat card width

- The in-chat card is now inset (12px each side) so it lines up with the composer
  input instead of stretching edge-to-edge.

## [0.5.9] — Card clears when generation ends

- Rewrote the "is generating" detection so the in-chat card reliably **disappears
  when the agent finishes** (it no longer stays up after a "Reviewed …"/"Worked
  for Ns" summary). Now driven by an active-work hint plus whether the reply is
  still streaming — robust across Cursor and VS Code.

## [0.5.8] — VS Code generation signal + card width

- Fixed the VS Code generation detection (uses Copilot Chat's `.chat-working-progress`
  step, which only exists while it's working) so the in-chat card actually shows.
- The in-chat card now matches the composer input's width and left edge instead
  of stretching edge-to-edge.

## [0.5.7] — In-agent sponsor works in VS Code too

- The in-agent card now detects VS Code's Copilot Chat DOM (in addition to
  Cursor's Composer) — generation signal, conversation anchor and input anchor
  all adapt to whichever editor you're in.

## [0.5.6] — Richer in-chat card + easier-to-spot wallet

- The in-chat sponsor is now a **taller multi-line card** — SPONSORED label,
  headline, description, and a call-to-action button — instead of a one-liner.
- The status-bar wallet now has a **chip background** so it stands out on a
  crowded status bar.

## [0.5.5] — In-chat sponsor is now a proper card

- The in-chat sponsor is a **boxed card** (tinted in the advertiser's colors), not
  a plain line, so it clearly reads as a sponsor.
- Fixed its placement: it now anchors to the **last row of the turn** (bottom of
  the conversation), instead of getting jammed between the thinking summary and
  the reply.

## [0.5.4] — Two display modes: in-chat (default) or overlay

- The in-agent sponsor now has **two display modes**, switchable with a **⇄** on
  the sponsor itself (your choice is remembered):
  - **In-chat** (default): a single sponsored card that sits right in the
    conversation, next to what the agent is doing, and clears when it's done — no
    stacking, no floating box.
  - **Overlay**: the draggable floating box from before.

## [0.5.3] — Reset the in-agent position

- New command/menu item **“Reset in-agent sponsor position”** to move the banner
  back to its default spot if you drag it somewhere awkward.
- The banner can no longer be dragged behind the tabs bar or off-screen (it's
  clamped to the visible area), so it can't get lost.

## [0.5.2] — Drag the in-agent sponsor where you want it

- The in-agent sponsor is now **draggable**: grab the ↕ handle to move it
  anywhere (e.g. above the files list, out of the way), and its position is
  remembered across sessions. Double-click the handle to reset. Defaults to just
  above the input.

## [0.5.1] — In-agent sponsor as a top banner

- The in-agent sponsor now renders as a **banner at the top of the agent panel**
  instead of floating above the input — so it never overlaps Cursor's file list,
  Undo/Keep/Review bar, or the input box. Re-enable the in-agent sponsor to pick
  up the new placement.

## [0.5.0] — The status bar is now your wallet

- The status-bar item is now a **credit wallet**: it always shows your balance
  (`◆ entracte · $X`) and never gets replaced by a sponsor line. Cleaner, and it
  never fires an impression for an ad you didn't see.
- **Sponsors show in the in-agent overlay** (inside the editor's AI agent),
  which is where impressions and earnings now come from — enable it from the menu.
- Simplified the menu accordingly (“Refresh the balance”, no stale “open current
  sponsor”).

## [0.4.3] — Recognizable in every mode

- The status-bar item now always leads with the entracte diamond (◆), even in
  motivation-quotes or dev-news mode, so it stays recognizable and obviously
  clickable — a quote line no longer looks like a stray item and the menu is
  always reachable.
- Shortened the extension display name to “entracte”, so notifications read
  “Source: entracte” instead of the full tagline.

## [0.4.2] — Brand mark in the status bar

- Use the entracte diamond (◆) in the status-bar counter instead of the generic
  sparkle icon, matching the terminal and email brand mark.

## [0.4.1] — Always-visible status bar

- **The status-bar item no longer vanishes** when you're signed in and there's
  no sponsor to serve — it now shows a persistent credit counter (`entracte · $X`)
  so the extension is always reachable. Raised its priority so a crowded status
  bar can't push it into the overflow menu.

## [0.4.0] — In-agent sponsor & one-click menu

- **In-agent sponsor for Cursor (opt-in, reversible).** Show the sponsor line
  right inside Cursor's agent while it works, pinned just above the input. It
  renders in the advertiser's own colors and clears Cursor's Undo/Keep/Review
  bar. Enable/disable from the menu — it patches the editor's own renderer only
  while you opt in, and fully restores on disable. Not shown in a fake
  simulator: it renders in the real agent.
- **Status-bar menu.** Click the entracte item to open a quick menu — enable or
  disable the in-agent sponsor, refresh the sponsor, switch between
  sponsors / motivation quotes / dev-news, open your dashboard, and sign in or
  out — all in one place.
- Advertiser colors now flow through to every surface (status bar + in-agent).

[0.4.0]: https://github.com/mben-dev/entracte.ai/releases/tag/vscode-v0.4.0

## [0.1.0] — Initial release

- **Cookieless sponsor line** rendered as a single right-aligned status-bar item,
  served from the same surface-agnostic `/api/serve` decision as every other
  entracte surface. Click the line to open the sponsor.
- **Device-flow sign-in** (OAuth device flow, RFC 8628): approve in your browser
  to attribute impressions to your publisher and **earn AI credits** spendable on
  Claude, ChatGPT, or any model. Your balance is shown inline in the status bar,
  and the token is kept in the editor's encrypted SecretStorage.
- **Content modes** — switch the same line between **sponsors** (earn),
  **motivation quotes**, and **dev-news** with a single command.
- **Gated behind sign-in** — nothing is shown until you sign in, so no unpaid
  impressions ever run on you; the view beacon fires only while the window is
  focused.
- **Privacy by design** — cookieless, no telemetry, reads no code or prompts, and
  never patches the editor (a single status-bar item via the public API).
- Ships for **VS Code, Cursor and Windsurf** via the Visual Studio Marketplace
  and Open VSX.

[0.1.0]: https://github.com/mben-dev/entracte.ai/releases/tag/vscode-v0.1.0
