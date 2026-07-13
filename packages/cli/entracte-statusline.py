#!/usr/bin/env python3
"""
entracte statusline — serves one cookieless sponsor line in Claude Code.

The CLEAN, official way to monetize the developer intermission: it writes NO
files of Anthropic's, patches nothing, and uses only the supported `statusLine`
field. It calls the same surface-agnostic /api/serve endpoint as the web widget.

Install:
  1. cp packages/cli/entracte-statusline.py ~/.claude/entracte-statusline.py
     chmod +x ~/.claude/entracte-statusline.py
  2. In ~/.claude/settings.json add:
       "statusLine": {
         "type": "command",
         "command": "~/.claude/entracte-statusline.py",
         "refreshInterval": 30
       }

Env (optional): ENTRACTE_API (default https://api.entracte.ai),
ENTRACTE_PUBLISHER (default "entracte").

License: PolyForm-Noncommercial-1.0.0.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request


def _install_id():
    """Anonymous per-machine install id, shared with the Node CLI. Best-effort:
    a random UUID at ~/.config/entracte/install-id; never identity/IP-derived."""
    try:
        cfg = os.environ.get("XDG_CONFIG_HOME") or os.path.join(
            os.path.expanduser("~"), ".config"
        )
        path = os.path.join(cfg, "entracte", "install-id")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                v = f.read().strip()
                if v:
                    return v
        import uuid

        os.makedirs(os.path.dirname(path), exist_ok=True)
        vid = str(uuid.uuid4())
        with open(path, "w", encoding="utf-8") as f:
            f.write(vid)
        return vid
    except Exception:
        return None

API = os.environ.get("ENTRACTE_API", "https://api.entracte.ai").rstrip("/")
PUBLISHER = os.environ.get("ENTRACTE_PUBLISHER", "entracte")
SERVE_TTL = 30  # seconds — don't hit the API on every refresh


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    sid = str(data.get("session_id") or "x")
    cwd = (data.get("workspace") or {}).get("current_dir") or data.get("cwd") or ""
    transcript = data.get("transcript_path") or ""
    cache = f"/tmp/entracte-sl-{sid}"

    # Serve cache: reuse the last decision for SERVE_TTL to keep the hook fast.
    if os.path.exists(cache) and time.time() - os.path.getmtime(cache) < SERVE_TTL:
        sys.stdout.write(_read(cache))
        return

    # Contextual keywords from the repo — never the code itself, just its shape.
    keywords: list[str] = []
    if os.path.exists(os.path.join(cwd, "adonisrc.ts")):
        keywords = ["adonisjs", "typescript"]
    elif os.path.exists(os.path.join(cwd, "next.config.ts")) or os.path.exists(
        os.path.join(cwd, "next.config.js")
    ):
        keywords = ["nextjs", "typescript"]
    elif os.path.exists(os.path.join(cwd, "Cargo.toml")):
        keywords = ["rust"]
    elif os.path.exists(os.path.join(cwd, "go.mod")):
        keywords = ["go"]
    elif os.path.exists(os.path.join(cwd, "package.json")):
        keywords = ["typescript"]

    try:
        payload = {
            "publisher": PUBLISHER,
            "adType": "entracte-text",
            "keywords": keywords,
        }
        iid = _install_id()
        if iid:
            payload["installId"] = iid
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{API}/api/serve", data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            decision = json.load(resp)
    except Exception:
        sys.stdout.write(_read(cache))  # show last line (or nothing) on failure
        return

    creative = decision.get("creative") or {}
    if not decision.get("filled") or not creative:
        return

    text = f"{(creative.get('headline') or '').strip()} {(creative.get('body') or '').strip()}".strip()
    if len(text) > 58:
        text = text[:57] + "…"
    label = decision.get("sponsoredLabel") or "Sponsored"
    click = decision.get("clickUrl") or ""

    dim = "\033[2m"
    reset = "\033[0m"
    if click:
        # OSC 8 makes it Cmd/Ctrl-clickable in iTerm2 / Kitty / WezTerm.
        line = f"\033]8;;{click}\033\\⬦ {text}\033]8;;\033\\  {dim}· {label}{reset}"
    else:
        line = f"⬦ {text}  {dim}· {label}{reset}"

    with open(cache, "w") as fh:
        fh.write(line)

    # Fire the view beacon ONLY when the session is genuinely active (transcript
    # touched < 5 min ago) — advertisers pay for real attention, not idle tabs.
    view_url = decision.get("viewUrl") or ""
    if (
        view_url
        and transcript
        and os.path.exists(transcript)
        and time.time() - os.path.getmtime(transcript) < 300
    ):
        subprocess.Popen(
            ["curl", "-s", "-m", "3", view_url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    sys.stdout.write(line)


def _read(path: str) -> str:
    try:
        with open(path) as fh:
            return fh.read()
    except Exception:
        return ""


if __name__ == "__main__":
    main()
