import * as fs from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";

/**
 * OPT-IN, reversible "in-agent" sponsor for Cursor / VS Code / Windsurf.
 *
 * There is no supported API to render inside the editor's own AI panel, so — only
 * when the user explicitly enables it — we append a small self-contained script to
 * the editor's renderer bundle. It's gated behind a consent dialog and fully
 * reversible: "pristine" is always re-derived from the LIVE bundle, never a stale
 * backup, so an editor update can't be clobbered; the write is atomic.
 *
 * v4 — the overlay approach (validated live against Cursor's Composer over CDP:
 * shown 44/44 samples while generating, 0 wipes). Cursor's agent transcript is a
 * React *virtualized* list, so anything injected INTO a thinking row is wiped on
 * its next ~1s re-render. Instead we mount ONE fixed-position overlay on
 * `document.body` — outside React's reconciliation root, so it can never be
 * clobbered — and toggle it on the generation signal (an
 * `.agent-transcript-row-activity` whose text lacks a "for Ns" duration = live).
 * It is pinned just above the composer input (`.composer-input-blur-wrapper`),
 * painted in the advertiser's own colors, rotated one sponsor per generation, and
 * fires an <img> view beacon exactly once per generation (never faked). A generic
 * thinking-verb heuristic is kept as a fallback for other editors.
 */

const MARKER =
	"/* ENTRACTE-AGENT v5 — added by the entracte extension; remove via “entracte: Disable in-spinner sponsor” */";
// Version-agnostic prefix so enable/disable clean ANY prior entracte block.
const MARKER_PREFIX = "/* ENTRACTE-AGENT";
const BACKUP_SUFFIX = ".entracte-backup";

// The renderer bundle, relative to appRoot. Appending a bare IIFE is only valid
// for the JS bundle (modern VS Code / Cursor / Windsurf) — we never touch HTML.
const CANDIDATES = ["out/vs/workbench/workbench.desktop.main.js"];

export interface SponsorItem {
	line: string;
	clickUrl: string;
	viewUrl: string;
	/** The advertiser's own colors (hex), used to paint the overlay. */
	badgeColor?: string;
	textColor?: string;
	/** Separate fields for the richer multi-line in-chat card. */
	headline?: string;
	body?: string;
	cta?: string;
	/** Pill label: "SPONSORED" for ads, "News"/"Motivation" in content mode. */
	label?: string;
}

export type PatchError =
	| "unsupported-editor"
	| "eacces"
	| "write-failed"
	| "restore-failed";

/** The renderer bundle to patch, or null on an unsupported editor build. */
export function targetFile(): string | null {
	for (const rel of CANDIDATES) {
		try {
			const p = join(vscode.env.appRoot, rel);
			if (fs.existsSync(p)) return p;
		} catch {
			/* keep trying */
		}
	}
	return null;
}

export function isSupported(): boolean {
	return targetFile() !== null;
}

export function isInjected(): boolean {
	const t = targetFile();
	if (!t) return false;
	try {
		return fs.readFileSync(t, "utf8").includes(MARKER_PREFIX);
	} catch {
		return false;
	}
}

/** Everything before our appended block — the pristine bundle, from LIVE content.
 * Matches the version-agnostic prefix so a v3 block is cleaned by a v4 enable. */
function stripBlock(content: string): string {
	const at = content.indexOf(`\n${MARKER_PREFIX}`);
	return at === -1 ? content : content.slice(0, at);
}

function codeOf(e: unknown, restore = false): PatchError {
	if ((e as NodeJS.ErrnoException)?.code === "EACCES") return "eacces";
	return restore ? "restore-failed" : "write-failed";
}

/** Write atomically (tmp + rename) so a partial write can't corrupt the bundle. */
function atomicWrite(target: string, content: string): void {
	const tmp = `${target}.entracte-tmp`;
	fs.writeFileSync(tmp, content, "utf8");
	fs.renameSync(tmp, target);
}

/** The IIFE appended to the renderer bundle. Runs in the renderer (no fetch).
 * Two user-switchable display modes (a ⇄ toggle on the sponsor flips them, saved
 * in localStorage as `entracte-agent-style`):
 *  - "chat" (default): ONE card inserted right after the live thinking row, moved
 *    as thinking progresses and removed when idle — so it reads as part of the
 *    conversation and never accumulates (validated: max 1 card).
 *  - "overlay": a body-level fixed box (outside React's root, never wiped),
 *    DRAGGABLE via a ↕ grip, position persisted (double-click the grip to reset),
 *    clamped on-screen; defaults just above the composer input.
 * Both gate on the generation signal, DOM-built (never innerHTML), http(s) links
 * only, one view beacon per generation. */
function injector(pool: SponsorItem[], _resetToken = ""): string {
	const data = JSON.stringify(pool);
	// ONE fixed overlay on document.body — OUTSIDE the editor's virtualized React
	// transcript, so a re-render can never wipe or displace it (that ping-pong was
	// the flicker). Shown only while generating, pinned above the composer, painted
	// with a solid theme background so it reads over the transcript. One boxed card,
	// one view beacon per turn.
	return `\n${MARKER}\n(function(){"use strict";try{
var P=${data};if(!P||!P.length)return;
// SELF-CLEANING: this block lives in the editor's bundle, and the editor runs NO
// extension code on uninstall — so we can't un-patch there. Instead the injected
// code checks that the entracte extension folder still exists; if it was
// uninstalled, we render nothing and remove the overlay (below). Fail OPEN (keep
// rendering) only if fs is unavailable — never break the feature over the check.
function extPresent(){try{var os=require('os'),fs=require('fs'),path=require('path');var home=os.homedir();var D=['.cursor/extensions','.vscode/extensions','.vscode-oss/extensions','.windsurf/extensions'];for(var d=0;d<D.length;d++){try{var L=fs.readdirSync(path.join(home,D[d]));for(var j=0;j<L.length;j++)if(L[j].indexOf('entracte.entracte-vscode')===0)return true;}catch(e){}}return false;}catch(e){return true;}}
if(!extPresent())return;
var OV="entracte-agent-line",i=-1,lastGen=0,shown=false,ck=0,TMR=null;
function rgba(h,a){try{h=(''+h).replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');var n=parseInt(h,16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}catch(e){return 'rgba(111,120,230,'+a+')';}}
function beacon(u){try{if(u&&/^https?:\\/\\//.test(u)){var im=new Image();im.referrerPolicy="no-referrer";im.src=u;}}catch(e){}}
// Reliable "is generating" (verified live over CDP): Cursor shows a stop button
// (.codicon-debug-stop) in the composer while the agent runs; VS Code Copilot shows
// a live working step. Both vanish when done. Content-growth was dropped — Cursor
// re-renders its transcript at idle, which kept re-arming it and pinned the card;
// the -ing work-row is only a fallback (Cursor doesn't always show one).
function generating(){
if(document.querySelector('.composer-bar .codicon-debug-stop,.chat-input-container .codicon-debug-stop'))return true;
if(document.querySelector('.chat-working-progress'))return true;
var r=document.querySelectorAll('.agent-transcript-row-activity,.agent-transcript-row-work-group');
if(r.length&&/^[a-z]+ing\\b/i.test((r[r.length-1].textContent||'').trim()))return true;
return false;}
// The composer surface (Cursor / VS Code), to pin the overlay just above it.
// Rise above the whole composer cluster — the "N Files / Undo All / Keep All /
// Review" bar sits above the input, so anchor to the tallest still-reasonable
// parent (stop before it becomes the full pane) so the card never covers it.
function anchorRect(){var inp=document.querySelector('.composer-input-blur-wrapper')||document.querySelector('.aislash-editor-input')||document.querySelector('.interactive-input-part');
if(!inp)return null;var ir=inp.getBoundingClientRect();var top=ir.top;var node=inp,g=0;
while(node.parentElement&&g++<6){var pr=node.parentElement.getBoundingClientRect();
if(pr.height>0&&pr.height<window.innerHeight*0.5&&pr.top<top-2){top=pr.top;node=node.parentElement;}else break;}
return {left:ir.left,width:ir.width,top:top};}
// The theme's own floating-widget background (same var VS Code uses for hovers /
// find widget) so the card matches the surrounding UI and text stays legible; the
// badge-colored border + shadow are what set it apart from the chat behind it.
function bgColor(){try{var wb=document.querySelector('.monaco-workbench');var cs=wb?getComputedStyle(wb):null;
var c=cs&&(cs.getPropertyValue('--vscode-editorHoverWidget-background').trim()||cs.getPropertyValue('--vscode-editorWidget-background').trim()||cs.getPropertyValue('--vscode-editor-background').trim());
return c||'#1e1e1e';}catch(e){return '#1e1e1e';}}
// The theme's text color. The overlay lives on document.body (OUTSIDE
// .monaco-workbench), so color:inherit would pick up body's default BLACK — we set
// the theme foreground explicitly so the card text stays legible on every theme.
function fgColor(){try{var wb=document.querySelector('.monaco-workbench');var cs=wb?getComputedStyle(wb):null;
var c=cs&&(cs.getPropertyValue('--vscode-foreground').trim()||cs.getPropertyValue('--vscode-editorHoverWidget-foreground').trim());
return c||'#dddddd';}catch(e){return '#dddddd';}}
// The entracte iridescent (aurora) border that slowly rotates around the card —
// a conic-gradient on the border-box with the solid theme bg on the padding-box,
// spun via an @property-animated angle. Injected once as a <style>. Degrades to a
// static gradient where @property is unsupported.
function ensureCss(){if(document.getElementById('entracte-iris-css'))return;
var st=document.createElement('style');st.id='entracte-iris-css';
st.textContent='@property --ent-a{syntax:"<angle>";initial-value:0deg;inherits:false}@keyframes ent-spin{to{--ent-a:360deg}}#'+OV+'{border:2px solid transparent;background:linear-gradient(var(--ent-bg,#1e1e1e),var(--ent-bg,#1e1e1e)) padding-box,conic-gradient(from var(--ent-a),#8b5cf6,#3b82f6,#22d3ee,#34d399,#f472b6,#8b5cf6) border-box;animation:ent-spin 5s linear infinite}';
document.head.appendChild(st);}
function overlayEl(){var o=document.getElementById(OV);if(o&&document.body.contains(o))return o;
ensureCss();
o=document.createElement('a');o.id=OV;o.target='_blank';o.rel='noreferrer noopener';o.title='Sponsored via entracte';
o.style.cssText="position:fixed;z-index:2147483000;display:none;box-sizing:border-box;text-decoration:none;color:inherit;padding:11px 13px;border-radius:12px;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.32)";
document.body.appendChild(o);return o;}
function render(sp){var badge=sp.badgeColor||'#6f78e6';var o=overlayEl();
var u=String(sp.clickUrl||'');o.href=/^https?:\\/\\//.test(u)?u:'#';
o.style.setProperty('--ent-bg',bgColor());o.style.color=fgColor();
while(o.firstChild)o.removeChild(o.firstChild);
var top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:7px';
var pill=document.createElement('span');pill.textContent=(sp.label||'SPONSORED').toUpperCase();pill.style.cssText='font-size:9px;font-weight:700;letter-spacing:.5px;padding:2px 6px;border-radius:5px;background:'+badge+';color:'+(sp.textColor||'#ffffff');
var brand=document.createElement('span');brand.textContent='◆ entracte';brand.style.cssText='font-size:11px;font-weight:700;letter-spacing:.2px;margin-left:auto;background:linear-gradient(90deg,#a78bfa,#60a5fa,#22d3ee,#34d399,#f472b6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent';
top.appendChild(pill);top.appendChild(brand);o.appendChild(top);
var head=String(sp.headline||sp.body||sp.line||'');
var sub;if(sp.headline){sub=String(sp.body||'');}else{try{sub=new URL(String(sp.clickUrl||'')).hostname.replace(/^www\\./,'');}catch(e){sub='';}}
if(head){var h=document.createElement('div');h.textContent=head;h.style.cssText='font-weight:600;font-size:13.5px;line-height:1.35;margin-bottom:3px';o.appendChild(h);}
if(sub){var bd=document.createElement('div');bd.textContent=sub;bd.style.cssText='font-size:12px;opacity:.8;line-height:1.45';o.appendChild(bd);}
if(sp.clickUrl){var cta=document.createElement('div');cta.textContent=String(sp.cta||'Learn more')+' ↗';cta.style.cssText='margin-top:8px;font-size:12px;font-weight:600;color:'+badge;o.appendChild(cta);}}
function tick(){try{if((++ck%80)===0&&!extPresent()){var _o=document.getElementById(OV);if(_o&&_o.parentNode)_o.parentNode.removeChild(_o);if(TMR)clearInterval(TMR);return;}
var now=Date.now();if(generating())lastGen=now;var on=(now-lastGen)<1500;var o=overlayEl();
if(on){var a=anchorRect();if(!a){o.style.display='none';return;}
if(!shown){shown=true;i=(i+1)%P.length;render(P[i]);beacon(P[i].viewUrl);}
o.style.left=Math.round(a.left)+'px';o.style.width=Math.round(a.width)+'px';o.style.bottom=Math.round(window.innerHeight-a.top+8)+'px';o.style.display='block';}
else if(shown||o.style.display!=='none'){shown=false;o.style.display='none';}
}catch(e){}}
TMR=setInterval(tick,250);tick();
}catch(e){}})();\n`;
}
/**
 * Enable: derive pristine from the LIVE target (strip our block if present),
 * refresh the courtesy backup, then append a fresh injector.
 */
export function enable(
	pool: SponsorItem[],
	resetToken = "",
): {
	ok: boolean;
	error?: PatchError;
} {
	const t = targetFile();
	if (!t) return { ok: false, error: "unsupported-editor" };
	try {
		const pristine = stripBlock(fs.readFileSync(t, "utf8"));
		try {
			fs.writeFileSync(t + BACKUP_SUFFIX, pristine, "utf8");
		} catch {
			/* backup is a courtesy copy; not required for restore */
		}
		atomicWrite(t, pristine + injector(pool, resetToken));
		return { ok: true };
	} catch (e) {
		return { ok: false, error: codeOf(e) };
	}
}

/**
 * Disable: strip our block from the LIVE target — no dependency on the backup, so
 * it restores correctly even after an editor update. No-op if not patched.
 */
export function disable(): { ok: boolean; error?: PatchError } {
	const t = targetFile();
	if (!t) return { ok: false, error: "unsupported-editor" };
	try {
		const target = fs.readFileSync(t, "utf8");
		if (!target.includes(MARKER)) return { ok: true };
		atomicWrite(t, stripBlock(target));
		return { ok: true };
	} catch (e) {
		return { ok: false, error: codeOf(e, true) };
	}
}
