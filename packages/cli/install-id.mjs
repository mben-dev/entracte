/**
 * A stable, ANONYMOUS per-machine install id + the CLI version, sent with each
 * /serve call so the network can count active installs per surface. The id is a
 * random UUID stored once at ~/.config/entracte/install-id — first-party only,
 * NEVER derived from identity, IP or anything about you. Best-effort: any error
 * yields null and serving continues unaffected. No deps. PolyForm-Noncommercial-1.0.0.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const ID_FILE = join(CONFIG_HOME, "entracte", "install-id");

function readOrCreateId() {
	try {
		if (existsSync(ID_FILE)) {
			const v = readFileSync(ID_FILE, "utf8").trim();
			if (v) return v;
		}
		const id = randomUUID();
		mkdirSync(dirname(ID_FILE), { recursive: true });
		writeFileSync(ID_FILE, id, { mode: 0o600 });
		return id;
	} catch {
		return null;
	}
}

function readVersion() {
	try {
		const pkg = JSON.parse(
			readFileSync(
				join(dirname(fileURLToPath(import.meta.url)), "package.json"),
				"utf8",
			),
		);
		return typeof pkg.version === "string" ? pkg.version : null;
	} catch {
		return null;
	}
}

/** Anonymous per-machine install id (or null if it can't be read/written). */
export const INSTALL_ID = readOrCreateId();
/** Installed CLI version, best-effort (or null). */
export const VERSION = readVersion();
