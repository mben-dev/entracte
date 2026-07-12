import * as fs from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import type { PatchError, SponsorItem } from "./spinner-patch";

/**
 * OPT-IN, reversible Codex sponsor for the OpenAI Codex extension.
 *
 * Codex renders its chat inside a sandboxed `vscode-webview://` iframe, which the
 * main-renderer bundle patch (spinner-patch.ts) cannot reach. The only route in is
 * to patch the Codex extension's OWN webview resources on disk — exactly what the
 * competitors that support Codex do (idlepay patches the stable `webview/index.html`).
 *
 * Codex serves the webview under a strict CSP (verified from its extension.js):
 *   default-src 'none'; img-src <self> https: data: blob:; script-src <self>;
 *   style-src <self> 'unsafe-inline'; connect-src <openai hosts only>
 * so inline scripts and cross-origin fetch/XHR are blocked, BUT:
 *   - a same-origin external `./assets/*.js` passes `script-src <self>`,
 *   - inline styles pass `style-src 'unsafe-inline'`,
 *   - an `<img>` beacon to any https host passes `img-src https:` → the view is
 *     recorded (real earnings on Codex, not cosmetic),
 *   - an `<a href target=_blank>` is opened externally by the webview host → the
 *     entracte click redirect records the click.
 *
 * We therefore (a) drop a self-contained `entracte-codex.js` into the extension's
 * `webview/assets/` with the sponsor pool baked in, and (b) add one `<script defer
 * src="./assets/entracte-codex.js">` to `webview/index.html`, guarded by markers.
 * Both are reversible; the write is atomic; a courtesy backup of index.html is kept.
 * The extensions dir is user-owned (writable) so — unlike the bundle patch — this
 * needs no macOS App Management permission.
 */

const MARK_OPEN = "<!-- entracte-codex:start -->";
const MARK_CLOSE = "<!-- entracte-codex:end -->";
const ASSET_NAME = "entracte-codex.js";
const BACKUP_SUFFIX = ".entracte-backup";

/** The Codex webview dir in the CURRENT editor, or null if Codex isn't installed. */
function webviewDir(): string | null {
	try {
		const ext = vscode.extensions.all.find((e) =>
			/^openai\.chatgpt$/i.test(e.id),
		);
		if (!ext) return null;
		const dir = join(ext.extensionPath, "webview");
		if (fs.existsSync(join(dir, "index.html"))) return dir;
	} catch {
		/* fall through */
	}
	return null;
}

function indexPath(dir: string): string {
	return join(dir, "index.html");
}
function assetPath(dir: string): string {
	return join(dir, "assets", ASSET_NAME);
}

export function isSupported(): boolean {
	return webviewDir() !== null;
}

export function isInjected(): boolean {
	const dir = webviewDir();
	if (!dir) return false;
	try {
		return fs.readFileSync(indexPath(dir), "utf8").includes(MARK_OPEN);
	} catch {
		return false;
	}
}

function codeOf(e: unknown, restore = false): PatchError {
	if ((e as NodeJS.ErrnoException)?.code === "EACCES") return "eacces";
	return restore ? "restore-failed" : "write-failed";
}

function atomicWrite(target: string, content: string): void {
	const tmp = `${target}.entracte-tmp`;
	fs.writeFileSync(tmp, content, "utf8");
	fs.renameSync(tmp, target);
}

/** Remove a previously-injected entracte block (idempotent). */
function stripBlock(html: string): string {
	const start = html.indexOf(MARK_OPEN);
	if (start === -1) return html;
	const end = html.indexOf(MARK_CLOSE, start);
	if (end === -1) return html;
	// also swallow the leading newline/indent we added before MARK_OPEN
	let from = start;
	while (from > 0 && (html[from - 1] === " " || html[from - 1] === "\t"))
		from--;
	if (from > 0 && html[from - 1] === "\n") from--;
	return html.slice(0, from) + html.slice(end + MARK_CLOSE.length);
}

/**
 * The runtime dropped next to Codex's own bundle. Self-contained, no fetch.
 *
 * FLICKER-FREE design: Codex's conversation is a VIRTUALIZED, React-managed list,
 * so a node injected into it is either flung thousands of px off-screen (rows are
 * transform-positioned, scrollTop stays 0) or removed-and-re-added on every stream
 * re-render (visible flicker). So we mount ONE fixed-position overlay on
 * `document.body` — OUTSIDE React's reconciliation root, so React never clobbers
 * it — and just pin it a few px above the composer. Same proven approach as the
 * Cursor overlay.
 *
 * It's shown ONLY while Codex is thinking/streaming. Generation signal (verified
 * live over CDP): Codex shows a *Stop* control and an `.animate-spin` indicator
 * throughout reasoning + streaming, both absent when idle or paused for approval.
 * So \`generating()\` = a stop button OR a spinner is present; a short grace window
 * absorbs single-sample noise. Painted in the advertiser's colors; ONE \`<img>\`
 * view beacon per generation cycle (never faked); the overlay is an \`<a>\` to the
 * entracte click redirect. \`__ENTRACTE_POOL__\` is replaced at enable() time.
 */
const RUNTIME = `/* entracte-codex — added by the entracte extension; remove via "entracte: Disable Codex sponsor". */
(function(){
  if (window.__entracteCodex) return;
  window.__entracteCodex = true;
  var POOL = __ENTRACTE_POOL__;
  if (!Array.isArray(POOL) || !POOL.length) return;
  var OV_ID = "entracte-codex-ov";
  var idx = -1, lastGen = 0, shown = false, ov = null;

  function hexA(hex, a){
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(107,124,255," + a + ")";
    var n = parseInt(m[1], 16);
    return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
  }
  function beacon(url){ try { var i = new Image(); i.referrerPolicy = "no-referrer"; i.src = url; } catch(e){} }

  // A concrete card background from the webview theme (falls back to the body bg).
  function bgColor(){
    try {
      var cs = getComputedStyle(document.documentElement);
      var c = cs.getPropertyValue("--vscode-editorHoverWidget-background").trim() || cs.getPropertyValue("--vscode-editorWidget-background").trim();
      if (c) return c;
      var bc = getComputedStyle(document.body).backgroundColor;
      if (bc && bc !== "rgba(0, 0, 0, 0)" && bc !== "transparent") return bc;
    } catch(e){}
    return "#1e1e1e";
  }
  // The entracte iridescent (aurora) border, spun via an @property-animated angle,
  // injected once as a <style> (webview CSP allows 'unsafe-inline' styles).
  function ensureCss(){
    if (document.getElementById("entracte-codex-css")) return;
    var st = document.createElement("style");
    st.id = "entracte-codex-css";
    st.textContent = '@property --ent-a{syntax:"<angle>";initial-value:0deg;inherits:false}@keyframes ent-spin{to{--ent-a:360deg}}#' + OV_ID + '{border:2px solid transparent;background:linear-gradient(var(--ent-bg,#1e1e1e),var(--ent-bg,#1e1e1e)) padding-box,conic-gradient(from var(--ent-a),#8b5cf6,#3b82f6,#22d3ee,#34d399,#f472b6,#8b5cf6) border-box;animation:ent-spin 5s linear infinite}';
    document.head.appendChild(st);
  }

  function overlay(){
    if (ov && ov.isConnected) return ov;
    ensureCss();
    ov = document.createElement("a");
    ov.id = OV_ID;
    ov.target = "_blank"; ov.rel = "noopener noreferrer";
    ov.style.cssText = "position:fixed;z-index:2147483000;display:none;box-sizing:border-box;text-decoration:none;color:inherit;padding:10px 12px;border-radius:12px;font:12px/1.45 var(--vscode-font-family,system-ui);cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.28);";
    document.body.appendChild(ov);
    return ov;
  }

  // Paint the overlay for one sponsor (our own content only — no user input).
  function render(sp){
    var badge = sp.badgeColor || "#6b7cff";
    var o = overlay();
    o.href = sp.clickUrl || "#";
    o.style.setProperty("--ent-bg", bgColor()); // border + bg come from the iris <style>
    o.textContent = "";
    var top = document.createElement("div");
    top.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:4px;";
    var pill = document.createElement("span");
    pill.textContent = (sp.label || "SPONSORED").toUpperCase();
    pill.style.cssText = "font-size:8.5px;font-weight:700;letter-spacing:.7px;padding:1px 5px;border-radius:4px;background:" + badge + ";color:" + (sp.textColor || "#fff") + ";";
    var brand = document.createElement("span");
    brand.textContent = "\\u25C6 entracte";
    brand.style.cssText = "font-size:10px;font-weight:700;letter-spacing:.2px;margin-left:auto;background:linear-gradient(90deg,#a78bfa,#60a5fa,#22d3ee,#34d399,#f472b6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;";
    top.appendChild(pill); top.appendChild(brand);
    o.appendChild(top);
    // Ads: headline + body. Content (news): only a title (headline empty), so show
    // the title as the head and the source domain below — never the title twice.
    var head = sp.headline || sp.body || "";
    var sub = sp.headline ? (sp.body || "") : "";
    if (!sp.headline){ try { sub = new URL(String(sp.clickUrl || "")).hostname.replace(/^www\\./, ""); } catch(e){ sub = ""; } }
    if (head){
      var h = document.createElement("div");
      h.textContent = head;
      h.style.cssText = "font-weight:600;margin-bottom:2px;";
      o.appendChild(h);
    }
    if (sub){
      var b = document.createElement("div");
      b.textContent = sub;
      b.style.cssText = "opacity:.85;";
      o.appendChild(b);
    }
    if (sp.clickUrl){
      var cta = document.createElement("div");
      cta.textContent = (sp.cta || "Learn more") + " \\u2197";
      cta.style.cssText = "margin-top:5px;font-weight:600;color:" + badge + ";";
      o.appendChild(cta);
    }
  }

  // Codex is thinking/streaming iff a Stop control or a spinner is on screen.
  function generating(){
    if (document.querySelector('.animate-spin')) return true;
    var bs = document.querySelectorAll('button,[role="button"]');
    for (var i = 0; i < bs.length; i++){
      var l = (bs[i].getAttribute('aria-label') || bs[i].getAttribute('title') || '').toLowerCase();
      if (/stop|interrupt|arr\\u00eat/.test(l)) return true;
    }
    return false;
  }

  // The visible composer's full-width surface rect — where to pin the overlay.
  function composerRect(){
    var inputs = document.querySelectorAll('.ProseMirror, textarea, [contenteditable="true"], [role="textbox"]');
    var vh = window.innerHeight, best = null;
    for (var i = 0; i < inputs.length; i++){
      var r = inputs[i].getBoundingClientRect();
      if (r.top < vh && r.bottom > 0 && r.width > 60) best = inputs[i];
    }
    if (!best) return null;
    var node = best;
    for (var j = 0; j < 8 && node.parentElement; j++){
      if (node.getBoundingClientRect().width > window.innerWidth * 0.55) break;
      node = node.parentElement;
    }
    return node.getBoundingClientRect();
  }

  function tick(){
    var now = Date.now();
    if (generating()) lastGen = now;
    var on = (now - lastGen) < 1500; // grace absorbs 1-frame blips in the signal
    var o = overlay();
    if (on){
      var r = composerRect();
      if (!r){ o.style.display = "none"; return; }
      if (!shown){
        shown = true;
        idx = (idx + 1) % POOL.length; // one rotation + one beacon per generation cycle
        render(POOL[idx]);
        if (POOL[idx].viewUrl) beacon(POOL[idx].viewUrl);
      }
      // pin the overlay a few px above the composer surface, matched to its width
      o.style.left = Math.round(r.left) + "px";
      o.style.width = Math.round(r.width) + "px";
      o.style.bottom = Math.round(window.innerHeight - r.top + 8) + "px";
      o.style.display = "block";
    } else if (shown || o.style.display !== "none"){
      shown = false;
      o.style.display = "none";
    }
  }

  function start(){
    tick();
    // A steady poll drives show/hide + position; no MutationObserver, nothing to
    // clobber — the overlay lives on document.body, immune to React re-renders.
    setInterval(tick, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;

export function enable(pool: SponsorItem[]): {
	ok: boolean;
	error?: PatchError;
} {
	const dir = webviewDir();
	if (!dir) return { ok: false, error: "unsupported-editor" };
	try {
		const idx = indexPath(dir);
		const original = fs.readFileSync(idx, "utf8");
		// Courtesy backup of the pristine (pre-entracte) index.html.
		if (!original.includes(MARK_OPEN)) {
			try {
				fs.writeFileSync(idx + BACKUP_SUFFIX, original, "utf8");
			} catch {
				/* backup is best-effort; strip-based restore doesn't need it */
			}
		}
		// Write the runtime asset with the pool baked in.
		fs.mkdirSync(join(dir, "assets"), { recursive: true });
		atomicWrite(
			assetPath(dir),
			RUNTIME.replace("__ENTRACTE_POOL__", JSON.stringify(pool)),
		);
		// Inject one same-origin <script> before </head>, guarded by markers.
		const clean = stripBlock(original);
		// No trailing whitespace after MARK_CLOSE: stripBlock consumes exactly the
		// leading "\n<indent>" + block, so disable() restores the file byte-for-byte.
		const block = `\n    ${MARK_OPEN}\n    <script defer src="./assets/${ASSET_NAME}"></script>\n    ${MARK_CLOSE}`;
		const at = clean.lastIndexOf("</head>");
		const patched =
			at === -1 ? clean + block : clean.slice(0, at) + block + clean.slice(at);
		atomicWrite(idx, patched);
		return { ok: true };
	} catch (e) {
		return { ok: false, error: codeOf(e) };
	}
}

/** Strip our block from index.html and remove the asset. No-op if not patched. */
export function disable(): { ok: boolean; error?: PatchError } {
	const dir = webviewDir();
	if (!dir) return { ok: false, error: "unsupported-editor" };
	try {
		const idx = indexPath(dir);
		const html = fs.readFileSync(idx, "utf8");
		if (html.includes(MARK_OPEN)) atomicWrite(idx, stripBlock(html));
		try {
			fs.rmSync(assetPath(dir), { force: true });
		} catch {
			/* asset removal is best-effort */
		}
		return { ok: true };
	} catch (e) {
		return { ok: false, error: codeOf(e, true) };
	}
}
