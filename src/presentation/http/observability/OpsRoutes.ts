import type { AccessControl } from "@/application/security/AccessControl.js";
import { BUN_GRAPH_DB_API_VERSION } from "@/core/contracts/RestRouteContract.js";
import {
	renderStudioCss,
	renderStudioHtml,
	renderStudioJs,
} from "@/presentation/studio/StudioHtml.js";
import {
	classifyHttpSurface,
	type MetricsRegistry,
} from "./MetricsRegistry.js";

/**
 * Shared handler for operational observability & inspector routes (`/studio`, `/metrics`, `/api/audit-log`).
 * Returns `null` when the request does not match an ops/studio route.
 */
export function handleOpsOrStudioRoute(
	request: Request,
	url: URL,
	metrics: MetricsRegistry,
	accessControl?: AccessControl,
	studioTitle?: string,
): Response | null {
	if (request.method !== "GET") return null;

	if (url.pathname === "/studio") {
		return new Response(
			renderStudioHtml({
				title: studioTitle,
				version: BUN_GRAPH_DB_API_VERSION,
			}),
			{
				headers: {
					"Content-Type": "text/html; charset=utf-8",
					"Cache-Control": "no-cache",
				},
			},
		);
	}

	if (url.pathname === "/studio.css") {
		return new Response(renderStudioCss(), {
			headers: {
				"Content-Type": "text/css; charset=utf-8",
				"Cache-Control": "no-cache",
			},
		});
	}

	if (url.pathname === "/studio.js") {
		return new Response(renderStudioJs(), {
			headers: {
				"Content-Type": "text/javascript; charset=utf-8",
				"Cache-Control": "no-cache",
			},
		});
	}

	if (url.pathname === "/metrics") {
		const activeTokens = accessControl?.listPrincipals().length;
		if (url.searchParams.get("format") === "json") {
			return new Response(
				JSON.stringify(metrics.toJsonSnapshot({ activeTokens })),
				{
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "no-store",
					},
				},
			);
		}

		return new Response(metrics.renderPrometheus({ activeTokens }), {
			headers: {
				"Content-Type": "text/plain; version=0.0.4; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	}

	if (url.pathname === "/api/audit-log") {
		const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
		const limit =
			Number.isSafeInteger(rawLimit) && rawLimit > 0
				? Math.min(rawLimit, 500)
				: 100;
		const outcomeParam = url.searchParams.get("outcome");
		const outcome =
			outcomeParam === "allowed" || outcomeParam === "denied"
				? outcomeParam
				: undefined;
		const principalId =
			url.searchParams.get("principalId")?.trim() || undefined;
		const events =
			accessControl?.getAuditEvents({ limit, outcome, principalId }) ?? [];
		return new Response(
			JSON.stringify({
				success: true,
				events,
				total: events.length,
			}),
			{
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				},
			},
		);
	}

	return null;
}

export function recordHttpResponseMetric(
	metrics: MetricsRegistry,
	request: Request,
	pathname: string,
	response: Response,
	startedAtMs: number,
): Response {
	const isMutation =
		pathname.startsWith("/api/") &&
		!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
	metrics.recordHttpRequest({
		method: request.method,
		surface: classifyHttpSurface(pathname),
		status: response.status,
		durationMs: Math.max(0, Date.now() - startedAtMs),
		isMutation,
	});
	return response;
}
