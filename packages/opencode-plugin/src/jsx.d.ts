// @opentui/solid intrinsic elements (box/text/span/…) aren't typed here; accept
// any element so tsc passes. The Solid preset does the real transform at build.
declare namespace JSX {
	interface IntrinsicElements {
		// biome-ignore lint/suspicious/noExplicitAny: TUI element props are untyped
		[elem: string]: any;
	}
}
