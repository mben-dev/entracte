import { solidPlugin } from "esbuild-plugin-solid";
import { defineConfig } from "tsup";

// opencode's TUI is @opentui/solid — a NON-DOM Solid renderer. Compile JSX with
// the Solid preset in "universal" mode, emitting @opentui/solid runtime calls.
export default defineConfig({
	entry: ["src/index.tsx"],
	format: ["esm"],
	target: "node18",
	platform: "node",
	clean: true,
	// Provided by the opencode runtime install, not bundled.
	external: ["@opentui/solid", "solid-js"],
	esbuildPlugins: [
		solidPlugin({
			solid: { moduleName: "@opentui/solid", generate: "universal" },
		}),
	],
});
