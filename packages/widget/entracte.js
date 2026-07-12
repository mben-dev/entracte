/**
 * entracte widget — the cookieless developer sponsorship embed.
 *
 * Usage:
 *   <div data-ea-publisher="acme" data-ea-ad-type="entracte-text" id="slot-1"></div>
 *   <script async src="https://cdn.entracte.ai/entracte.js" data-ea-api="https://api.entracte.ai"></script>
 *
 * It auto-discovers every [data-ea-publisher] element, asks the server for a
 * decision, renders it, and fires a viewability pixel + click callback. It sets
 * NO cookies and NO localStorage, sends no identifiers, and never throws into
 * the host page. A house ad is always returned, so a slot is never empty.
 *
 * License: PolyForm-Noncommercial-1.0.0.
 */
(() => {
	const SCRIPT = document.currentScript;
	const DEFAULT_API = SCRIPT?.getAttribute("data-ea-api") || "";
	const SELECTOR = "[data-ea-publisher]";

	function apiBase(el) {
		return el.getAttribute("data-ea-api") || DEFAULT_API || "";
	}

	// Finding H4 (defense-in-depth): the server strips control chars, but a
	// compromised or OLDER server could ship control characters in advertiser
	// copy. Strip [\x00-\x1F\x7F] first, THEN HTML-escape. Together these ensure
	// no raw markup and no control chars ever enter the host DOM.
	function escapeHtml(value) {
		return (
			String(value)
				// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping untrusted control chars
				.replace(/[\x00-\x1F\x7F]/g, "")
				.replace(
					/[&<>"']/g,
					(m) =>
						({
							"&": "&amp;",
							"<": "&lt;",
							">": "&gt;",
							'"': "&quot;",
							"'": "&#39;",
						})[m],
				)
		);
	}

	// Finding H4: only ever set an href / fire a pixel for an http(s) URL — blocks
	// javascript:, data:, and control-char-smuggling URLs from the serve response.
	function safeUrl(u) {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — stripping untrusted control chars
		const s = String(u ?? "").replace(/[\x00-\x1F\x7F]/g, "");
		return /^https?:\/\//i.test(s) ? s : "";
	}

	async function loadAd(el) {
		if (el.__eaLoaded) return;
		el.__eaLoaded = true;

		const publisher = el.getAttribute("data-ea-publisher");
		if (!publisher) return;
		const adType = el.getAttribute("data-ea-ad-type") || "entracte-text";
		const keywords = (el.getAttribute("data-ea-keywords") || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);

		try {
			const res = await fetch(`${apiBase(el)}/api/serve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					publisher,
					adType,
					divId: el.id || undefined,
					keywords,
					url: location.href,
				}),
			});
			if (!res.ok) return;
			const data = await res.json();
			if (data?.filled && data.creative) render(el, data);
		} catch {
			/* fail silently — an ad slot must never break the host page */
		}
	}

	function render(el, data) {
		const c = data.creative;
		const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
		const img = (dark ? c.imageDark : c.imageLight) || c.imageLight;

		const anchor = document.createElement("a");
		// Finding H4: never inject a raw href — only http(s), so no javascript:/data: URIs.
		anchor.href = safeUrl(data.clickUrl);
		anchor.target = "_blank";
		anchor.rel = "noopener sponsored";
		anchor.style.cssText =
			"display:flex;gap:.6rem;align-items:center;justify-content:space-between;" +
			"padding:.6rem .75rem;border:1px solid var(--ea-border,#e5e5e5);border-radius:.5rem;" +
			"font:14px/1.4 system-ui,sans-serif;color:var(--ea-fg,#171717);text-decoration:none;" +
			"background:var(--ea-bg,#fff);";

		const imgHtml =
			img && c.format === "image"
				? `<img src="${escapeHtml(img)}" alt="" style="width:auto;height:40px;border-radius:.25rem;flex:none">`
				: "";
		const headline = c.headline
			? `<strong style="font-weight:600">${escapeHtml(c.headline)}</strong> `
			: "";
		const cta = c.cta
			? ` <span style="white-space:nowrap;color:var(--ea-accent,#059669);font-weight:600">${escapeHtml(c.cta)} →</span>`
			: "";

		anchor.innerHTML =
			`${imgHtml}<span style="flex:1;min-width:0">${headline}${escapeHtml(c.body)}${cta}</span>` +
			`<span style="flex:none;font-size:10px;text-transform:uppercase;letter-spacing:.04em;` +
			`color:var(--ea-muted,#a3a3a3)">${escapeHtml(data.sponsoredLabel || "Sponsored")}</span>`;

		el.textContent = "";
		el.appendChild(anchor);
		// Finding H4: only fire the impression pixel for a validated http(s) URL.
		fireWhenVisible(el, safeUrl(data.viewUrl));
	}

	function fireWhenVisible(el, viewUrl) {
		if (!viewUrl) return;
		let fired = false;
		const fire = () => {
			if (fired) return;
			fired = true;
			// Cookieless GET pixel — counts the impression server-side.
			const px = new Image();
			px.src = viewUrl;
		};
		if ("IntersectionObserver" in window) {
			const io = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (
							entry.isIntersecting &&
							document.visibilityState === "visible"
						) {
							fire();
							io.disconnect();
						}
					}
				},
				{ threshold: 0.5 },
			);
			io.observe(el);
		} else {
			fire();
		}
	}

	function init() {
		for (const el of document.querySelectorAll(SELECTOR)) loadAd(el);
	}

	window.entracte = { load: loadAd, init };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
