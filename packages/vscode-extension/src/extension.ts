import * as vscode from "vscode";
import * as codexPatch from "./codex-patch";
import * as spinnerPatch from "./spinner-patch";

/**
 * entracte VS Code / Cursor / Windsurf extension — a cookieless WALLET in the
 * status bar. The item always shows your credit balance (`◆ entracte · $X`);
 * sponsors are never rendered in the status bar. Ad impressions (and earnings)
 * come from the opt-in in-agent overlay, which shows the sponsor inside the
 * editor's AI agent while it works.
 *
 * Sign in once (OAuth device flow) to attribute the impressions to YOUR
 * publisher and earn a revenue share. Nothing runs until you sign in. No
 * cookies, no telemetry, reads no code/prompts.
 */

const SURFACE = "extension";
const POLL_MS = 60_000; // refresh the wallet
const EARNINGS_MS = 5 * 60_000; // refresh the "today" total less often
const SECRET_KEY = "entracte.creds";

interface Creds {
	token: string;
	publisher: string;
}

let item: vscode.StatusBarItem;
let secrets: vscode.SecretStorage;
let creds: Creds | null = null;
let creditsInfo: {
	hasKey: boolean;
	remainingUsd: number | null;
	earnedUsd: number | null;
	disabled?: boolean;
} | null = null;
let lastBalanceAt = 0;
let hiddenThisSession = false;
let linking = false;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let spinnerActive = false;
let codexActive = false;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cfg<T>(key: string, fallback: T): T {
	return vscode.workspace.getConfiguration("entracte").get<T>(key) ?? fallback;
}
function apiBase(): string {
	return cfg("apiUrl", "https://api.entracte.ai").replace(/\/$/, "");
}
/** The web app URL (for the dashboard) — derived from the API host (api.X → X). */
function siteUrl(): string {
	const configured = cfg("siteUrl", "").replace(/\/$/, "");
	if (configured) return configured;
	return apiBase().replace(/\/\/api\./, "//");
}
function authHeaders(): Record<string, string> {
	const h: Record<string, string> = { "Content-Type": "application/json" };
	if (creds?.token) h.authorization = `Bearer ${creds.token}`;
	return h;
}
// Balance figures from /api/publisher/credits are USD dollars (OpenRouter is
// USD-only), not cents — match the web dashboard's 2-decimal formatting.
function fmtUsd(dollars: number): string {
	return `$${dollars.toFixed(2)}`;
}
/** The spendable balance: what's left on the live key, else what's earned. */
function balanceUsd(): number | null {
	if (!creditsInfo) return null;
	if (creditsInfo.hasKey && creditsInfo.remainingUsd != null)
		return creditsInfo.remainingUsd;
	return creditsInfo.earnedUsd;
}

// --- API ------------------------------------------------------------------

async function refreshBalance(force = false): Promise<void> {
	if (!creds?.token) {
		creditsInfo = null;
		return;
	}
	if (!force && Date.now() - lastBalanceAt < EARNINGS_MS) return;
	try {
		// The wallet shows spendable AI credits, so read the credits endpoint
		// (USD, reflects consumption) rather than lifetime earnings (EUR, static).
		const res = await fetch(`${apiBase()}/api/publisher/credits`, {
			headers: authHeaders(),
			signal: AbortSignal.timeout(4000),
		});
		if (!res.ok) return;
		const d = (await res.json()) as {
			hasKey?: boolean;
			remainingUsd?: number | null;
			earnedUsd?: number | null;
			disabled?: boolean;
		};
		creditsInfo = {
			hasKey: !!d.hasKey,
			remainingUsd: d.remainingUsd ?? null,
			earnedUsd: d.earnedUsd ?? null,
			disabled: d.disabled,
		};
		lastBalanceAt = Date.now();
	} catch {
		/* keep the last known balance */
	}
}

async function setMode(mode: "ads" | "quotes" | "news"): Promise<void> {
	if (!creds?.token) {
		await startLink();
		return;
	}
	try {
		const res = await fetch(`${apiBase()}/api/publisher`, {
			method: "PATCH",
			headers: authHeaders(),
			body: JSON.stringify({ contentMode: mode }),
			signal: AbortSignal.timeout(4000),
		});
		if (res.ok) {
			const shown = mode === "ads" ? "sponsors" : mode;
			vscode.window.showInformationMessage(
				`entracte: your in-agent overlay now shows ${shown}.`,
			);
			await tick();
			// The in-agent card is a baked pool, so a mode change only shows after we
			// re-fetch (now reflecting the new mode) and re-bake it.
			await rebakeInAgent();
		}
	} catch {
		vscode.window.showWarningMessage("entracte: couldn't switch mode. Retry.");
	}
}

// OAuth device flow (RFC 8628): request a code, open the browser, poll to link.
async function startLink(): Promise<void> {
	if (linking) return;
	linking = true;
	void tick();
	try {
		const res = await fetch(`${apiBase()}/api/device/start`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ surface: SURFACE }),
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) throw new Error("start failed");
		const s = (await res.json()) as {
			deviceCode: string;
			verificationUrlComplete: string;
			interval: number;
			expiresIn: number;
		};
		await vscode.env.openExternal(vscode.Uri.parse(s.verificationUrlComplete));

		const ok = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "entracte: approve the sign-in in your browser…",
				cancellable: true,
			},
			async (_progress, cancel) => {
				const deadline = Date.now() + (s.expiresIn ?? 600) * 1000;
				const every = (s.interval || 5) * 1000;
				while (Date.now() < deadline && !cancel.isCancellationRequested) {
					await delay(every);
					try {
						const pr = await fetch(`${apiBase()}/api/device/poll`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ deviceCode: s.deviceCode }),
							signal: AbortSignal.timeout(8000),
						});
						const p = (await pr.json()) as {
							status: string;
							machineToken?: string;
							publisher?: { slug?: string };
						};
						if (p.status === "ok" && p.machineToken) {
							creds = {
								token: p.machineToken,
								publisher: p.publisher?.slug ?? "you",
							};
							await secrets.store(SECRET_KEY, JSON.stringify(creds));
							return true;
						}
						if (p.status === "expired") return false;
					} catch {
						/* transient — keep polling */
					}
				}
				return false;
			},
		);

		if (ok) {
			await refreshBalance(true);
			vscode.window.showInformationMessage(
				`entracte: signed in as ${creds?.publisher}. You'll earn a share from the sponsors shown here.`,
			);
		}
	} catch {
		vscode.window.showWarningMessage(
			"entracte: sign-in didn't complete — run “entracte: Sign in & earn” to retry.",
		);
	} finally {
		linking = false;
		void tick();
	}
}

async function signOut(): Promise<void> {
	creds = null;
	creditsInfo = null;
	await secrets.delete(SECRET_KEY);
	void tick();
}

// --- Rendering ------------------------------------------------------------

function showNudge(): void {
	item.text = "$(megaphone) entracte — sign in to earn";
	const tip = new vscode.MarkdownString(
		"Sign in to earn AI credits from the sponsors shown in your editor's agent, and see your balance here.\n\nClick for the menu — sign in, switch modes, or enable the in-agent sponsor.\n\n_No cookies, no telemetry, reads no code._",
	);
	tip.isTrusted = false;
	item.tooltip = tip;
	item.show();
}

/** The wallet: the status-bar item always shows your credit balance. Sponsors
 * are never rendered here — impressions and earnings come from the in-agent
 * overlay, so the status bar stays a clean balance readout. */
function renderWallet(): void {
	const bal = balanceUsd();
	item.text = bal != null ? `◆ entracte · ${fmtUsd(bal)}` : "◆ entracte";
	const tip = new vscode.MarkdownString(undefined, true);
	tip.isTrusted = false;
	tip.appendMarkdown("**entracte** — your AI credits\n\n");
	if (creds) tip.appendMarkdown(`Signed in as **${creds.publisher}**`);
	if (creditsInfo?.hasKey && creditsInfo.remainingUsd != null) {
		tip.appendMarkdown(
			` · **${fmtUsd(creditsInfo.remainingUsd)}** left to spend`,
		);
		if (creditsInfo.earnedUsd != null)
			tip.appendMarkdown(` · ${fmtUsd(creditsInfo.earnedUsd)} earned`);
	} else if (creditsInfo?.earnedUsd != null) {
		tip.appendMarkdown(
			` · **${fmtUsd(creditsInfo.earnedUsd)}** earned — redeem in the dashboard to spend`,
		);
	}
	tip.appendMarkdown("\n\n");
	if (creditsInfo?.disabled)
		tip.appendMarkdown(
			"Your key is paused — regenerate it in the dashboard.\n\n",
		);
	tip.appendMarkdown(
		spinnerActive
			? "Sponsors are showing **in your agent** — you earn as they display.\n\n"
			: "Enable the **in-agent sponsor** from the menu to start earning.\n\n",
	);
	tip.appendMarkdown("_Click for the menu · cookieless, no tracking._");
	item.tooltip = tip;
	item.show();
}

async function tick(): Promise<void> {
	if (!cfg("enabled", true) || hiddenThisSession) {
		item.hide();
		return;
	}
	if (linking) {
		item.text = "$(loading~spin) entracte — approve in browser…";
		item.tooltip = "Finish the sign-in in your browser to start earning.";
		item.show();
		return;
	}
	// Nothing runs until you sign in — no unpaid impressions on the user.
	if (!creds) {
		showNudge();
		return;
	}
	await refreshBalance();
	renderWallet();
}

// --- Lifecycle ------------------------------------------------------------

// --- Opt-in in-spinner sponsor (patches the editor's renderer, reversible) ---

/** A pool of distinct sponsors to bake into the injected renderer script. */
async function fetchPool(): Promise<spinnerPatch.SponsorItem[]> {
	try {
		const res = await fetch(`${apiBase()}/api/serve/pool`, {
			method: "POST",
			headers: authHeaders(),
			body: JSON.stringify({
				publisher: creds?.publisher ?? cfg("publisher", "entracte"),
				adType: "entracte-text",
				surface: SURFACE,
			}),
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return [];
		const d = (await res.json()) as {
			sponsors?: {
				headline?: string;
				body?: string;
				cta?: string;
				clickUrl: string;
				viewUrl: string;
				badgeColor?: string;
				textColor?: string;
				sponsoredLabel?: string;
			}[];
		};
		return (
			(d.sponsors ?? [])
				.map((s) => ({
					line: `${s.headline ?? ""} ${s.body ?? ""}`.trim(),
					clickUrl: s.clickUrl,
					viewUrl: s.viewUrl,
					badgeColor: s.badgeColor,
					textColor: s.textColor,
					headline: s.headline,
					body: s.body,
					cta: s.cta,
					// "SPONSORED" for ads, "News"/"Motivation" in content mode.
					label: s.sponsoredLabel,
				}))
				// Ads carry a clickUrl; content items (news/quotes) may not — keep any
				// item with text so content mode renders too.
				.filter((s) => s.line)
		);
	} catch {
		return [];
	}
}

function spinnerError(code?: spinnerPatch.PatchError): string {
	switch (code) {
		case "eacces":
			return "entracte: no permission to modify this editor's files. On macOS the app can be read-only — install it to a writable location and retry.";
		case "unsupported-editor":
			return "entracte: couldn't find this editor's renderer — unsupported build.";
		default:
			return "entracte: couldn't change the in-spinner sponsor — try again.";
	}
}

async function offerReload(msg: string): Promise<void> {
	const pick = await vscode.window.showInformationMessage(msg, "Reload");
	if (pick === "Reload") {
		await vscode.commands.executeCommand("workbench.action.reloadWindow");
	}
}

/** Re-bake whatever in-agent surfaces are active with a freshly-fetched pool
 * (used after a content-mode switch so the card reflects ads / news / quotes). */
async function rebakeInAgent(): Promise<void> {
	if (!spinnerActive && !codexActive) return;
	const pool = await fetchPool();
	if (!pool.length) return;
	let baked = false;
	if (spinnerActive && spinnerPatch.isInjected()) {
		baked = spinnerPatch.enable(pool).ok || baked;
	}
	if (codexActive && codexPatch.isInjected()) {
		baked = codexPatch.enable(pool).ok || baked;
	}
	if (baked) {
		await offerReload(
			"entracte: display updated — reload the window to apply.",
		);
	}
}

async function enableInSpinner(): Promise<void> {
	if (!spinnerPatch.isSupported()) {
		vscode.window.showWarningMessage(spinnerError("unsupported-editor"));
		return;
	}
	if (!creds) {
		await startLink();
		if (!creds) return;
	}
	const choice = await vscode.window.showWarningMessage(
		"Show the entracte sponsor inside the editor's thinking spinner? This modifies this editor's own files (reversible via “entracte: Disable in-spinner sponsor”). The editor may then show a “Your installation appears to be corrupt” notice — that's expected while it's on, and it clears when you disable. Not an officially supported surface; it may need re-enabling after an editor update.",
		{ modal: true },
		"Enable",
	);
	if (choice !== "Enable") return;
	const pool = await fetchPool();
	if (!pool.length) {
		vscode.window.showWarningMessage(
			"entracte: no sponsor to show right now — try again shortly.",
		);
		return;
	}
	const r = spinnerPatch.enable(pool);
	if (r.ok) {
		spinnerActive = true;
		void tick();
		await offerReload(
			"entracte: in-spinner sponsor enabled. Reload the window to apply.",
		);
	} else {
		vscode.window.showErrorMessage(spinnerError(r.error));
	}
}

async function disableInSpinner(): Promise<void> {
	const r = spinnerPatch.disable();
	if (r.ok) {
		spinnerActive = false;
		void tick();
		await offerReload(
			"entracte: in-spinner sponsor removed — editor restored. Reload to apply.",
		);
	} else {
		vscode.window.showErrorMessage(spinnerError(r.error));
	}
}

// --- Opt-in Codex sponsor (patches the OpenAI Codex extension's own webview) ---

async function enableCodex(): Promise<void> {
	if (!codexPatch.isSupported()) {
		vscode.window.showWarningMessage(
			"entracte: the OpenAI Codex extension isn't installed in this editor.",
		);
		return;
	}
	if (!creds) {
		await startLink();
		if (!creds) return;
	}
	const choice = await vscode.window.showWarningMessage(
		"Show the entracte sponsor inside the OpenAI Codex chat? This adds a small, reversible script to the Codex extension's own webview files (revert via “entracte: Disable Codex sponsor”). Not an officially supported surface — Codex may need re-enabling after it updates.",
		{ modal: true },
		"Enable",
	);
	if (choice !== "Enable") return;
	const pool = await fetchPool();
	if (!pool.length) {
		vscode.window.showWarningMessage(
			"entracte: no sponsor to show right now — try again shortly.",
		);
		return;
	}
	const r = codexPatch.enable(pool);
	if (r.ok) {
		codexActive = true;
		void tick();
		await offerReload(
			"entracte: Codex sponsor enabled. Reload the window, then reopen the Codex panel to apply.",
		);
	} else {
		vscode.window.showErrorMessage(spinnerError(r.error));
	}
}

async function disableCodex(): Promise<void> {
	const r = codexPatch.disable();
	if (r.ok) {
		codexActive = false;
		void tick();
		await offerReload(
			"entracte: Codex sponsor removed — Codex webview restored. Reload to apply.",
		);
	} else {
		vscode.window.showErrorMessage(spinnerError(r.error));
	}
}

// Reset where the in-agent overlay sits (its position lives in the renderer's
// localStorage, which only the injector can touch — so we re-bake with a fresh
// token that makes the injector clear the saved position once on next load).
async function resetInAgentPosition(): Promise<void> {
	if (!spinnerPatch.isInjected()) {
		vscode.window.showInformationMessage(
			"entracte: enable the in-agent sponsor first.",
		);
		return;
	}
	const pool = await fetchPool();
	if (!pool.length) {
		vscode.window.showWarningMessage(
			"entracte: no sponsor to show right now — try again shortly.",
		);
		return;
	}
	const r = spinnerPatch.enable(pool, `${Date.now()}`);
	if (r.ok) {
		await offerReload(
			"entracte: in-agent sponsor position reset. Reload to apply.",
		);
	} else {
		vscode.window.showErrorMessage(spinnerError(r.error));
	}
}

// --- The status-bar menu (click the item → a QuickPick of every action) ------

type MenuItem = vscode.QuickPickItem & { run: () => void | Promise<void> };

async function showMenu(): Promise<void> {
	const items: MenuItem[] = [];
	const signedIn = !!creds;

	if (spinnerPatch.isSupported()) {
		items.push(
			spinnerActive
				? {
						label: "$(circle-slash) Disable in-agent sponsor",
						detail:
							"Remove the sponsor from the editor's agent — restores the editor",
						run: disableInSpinner,
					}
				: {
						label: "$(rocket) Enable in-agent sponsor",
						detail:
							"Show the sponsor inside the editor's agent while it works (opt-in, reversible)",
						run: enableInSpinner,
					},
		);
		if (spinnerActive) {
			items.push({
				label: "$(move) Reset in-agent sponsor position",
				detail: "Move it back to its default spot (above the input)",
				run: resetInAgentPosition,
			});
		}
	}

	if (codexPatch.isSupported()) {
		items.push(
			codexActive
				? {
						label: "$(circle-slash) Disable Codex sponsor",
						detail: "Remove the sponsor from the OpenAI Codex chat",
						run: disableCodex,
					}
				: {
						label: "$(rocket) Enable Codex sponsor",
						detail:
							"Show the sponsor inside the OpenAI Codex chat (opt-in, reversible)",
						run: enableCodex,
					},
		);
	}

	items.push({
		label: "$(refresh) Refresh the balance",
		run: () => {
			void refreshBalance(true);
			void tick();
		},
	});

	items.push(
		{
			label: "$(megaphone) Show sponsors (earn)",
			run: () => setMode("ads"),
		},
		{
			label: "$(quote) Show motivation quotes",
			run: () => setMode("quotes"),
		},
		{ label: "$(rss) Show dev news", run: () => setMode("news") },
	);

	if (signedIn) {
		items.push(
			{
				label: "$(dashboard) Open dashboard",
				detail: `${siteUrl()}/publisher`,
				run: () =>
					void vscode.env.openExternal(
						vscode.Uri.parse(`${siteUrl()}/publisher`),
					),
			},
			{
				label: "$(sign-out) Sign out",
				detail: creds?.publisher ? `Signed in as ${creds.publisher}` : "",
				run: signOut,
			},
		);
	} else {
		items.push({
			label: "$(sign-in) Sign in & earn",
			detail: "Attribute the impressions to you and earn a revenue share",
			run: startLink,
		});
	}

	const bal = balanceUsd();
	const title =
		bal != null
			? `entracte · ${fmtUsd(bal)} in AI credits`
			: "entracte — cookieless sponsors";
	const pick = await vscode.window.showQuickPick(items, {
		title,
		placeHolder: "Choose an action",
	});
	if (pick) await pick.run();
}

export async function activate(
	context: vscode.ExtensionContext,
): Promise<void> {
	secrets = context.secrets;
	try {
		const raw = await secrets.get(SECRET_KEY);
		if (raw) creds = JSON.parse(raw) as Creds;
	} catch {
		creds = null;
	}

	spinnerActive = spinnerPatch.isInjected();
	codexActive = codexPatch.isInjected();

	// A high priority keeps the item from being pushed into the status-bar
	// overflow "…" on a crowded bar (gitlens, prettier, supermaven, etc.).
	item = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		10_000,
	);
	item.name = "entracte";
	// A subtle chip background so it stands out from the plain-text items on a
	// crowded status bar (users kept losing it among LF / TypeScript / …).
	item.backgroundColor = new vscode.ThemeColor(
		"statusBarItem.prominentBackground",
	);
	item.command = "entracte.menu";
	context.subscriptions.push(item);

	context.subscriptions.push(
		vscode.commands.registerCommand("entracte.open", () => void showMenu()),
		vscode.commands.registerCommand("entracte.menu", () => void showMenu()),
		vscode.commands.registerCommand("entracte.signIn", () => void startLink()),
		vscode.commands.registerCommand("entracte.signOut", () => void signOut()),
		vscode.commands.registerCommand(
			"entracte.showSponsors",
			() => void setMode("ads"),
		),
		vscode.commands.registerCommand(
			"entracte.showQuotes",
			() => void setMode("quotes"),
		),
		vscode.commands.registerCommand(
			"entracte.showNews",
			() => void setMode("news"),
		),
		vscode.commands.registerCommand("entracte.refresh", () => {
			void refreshBalance(true);
			void tick();
		}),
		vscode.commands.registerCommand("entracte.hide", () => {
			hiddenThisSession = true;
			item.hide();
		}),
		vscode.commands.registerCommand(
			"entracte.enableInSpinner",
			() => void enableInSpinner(),
		),
		vscode.commands.registerCommand(
			"entracte.resetInAgentPosition",
			() => void resetInAgentPosition(),
		),
		vscode.commands.registerCommand(
			"entracte.disableInSpinner",
			() => void disableInSpinner(),
		),
		vscode.commands.registerCommand(
			"entracte.enableCodex",
			() => void enableCodex(),
		),
		vscode.commands.registerCommand(
			"entracte.disableCodex",
			() => void disableCodex(),
		),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("entracte")) void tick();
		}),
		vscode.window.onDidChangeWindowState(() => {
			if (vscode.window.state.focused) void tick();
		}),
	);

	void tick();
	pollTimer = setInterval(() => void tick(), POLL_MS);
	context.subscriptions.push({
		dispose: () => {
			if (pollTimer) clearInterval(pollTimer);
		},
	});
}

export function deactivate(): void {
	if (pollTimer) clearInterval(pollTimer);
}
