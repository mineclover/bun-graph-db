import {
	EMBEDDED_STUDIO_CSS,
	EMBEDDED_STUDIO_JS,
} from "@/generated/embedded-assets.js";

export interface StudioHtmlOptions {
	title?: string;
	version?: string;
	defaultEndpointBase?: string;
}

/**
 * Returns the standalone stylesheet served at `/studio.css`.
 */
export function renderStudioCss(): string {
	return EMBEDDED_STUDIO_CSS;
}

/**
 * Returns the standalone browser ESM bundle served at `/studio.js`.
 */
export function renderStudioJs(): string {
	return EMBEDDED_STUDIO_JS;
}

/**
 * Self-contained, offline-friendly Web Studio HTML shell powered by `<graph-memory-workspace>`.
 */
export function renderStudioHtml(options: StudioHtmlOptions = {}): string {
	const title = options.title ?? "Bun Graph DB Studio";
	const version = options.version ?? "1.0.0";
	const baseUrl = (options.defaultEndpointBase ?? "").replace(/\/+$/, "");

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${escapeHtml(baseUrl)}/studio.css" />
</head>
<body data-studio-version="${escapeHtml(version)}" data-base-url="${escapeHtml(baseUrl)}">
  <graph-memory-workspace
    mode="remote-http"
    endpoint-base="${escapeHtml(baseUrl)}"
    title="${escapeHtml(title)}"
    version="${escapeHtml(version)}">
  </graph-memory-workspace>
  <script type="module" src="${escapeHtml(baseUrl)}/studio.js"></script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
