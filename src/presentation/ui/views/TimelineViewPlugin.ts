import type {
	IVisualizationPlugin,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

function makeSignalBar(label: string, val: number): HTMLElement {
	const wrap = document.createElement("div");
	wrap.className = "signal-bar";
	const head = document.createElement("span");
	head.textContent = `${label}: ${val.toFixed(2)}`;
	const prog = document.createElement("progress");
	prog.max = 1;
	prog.value = Math.min(1, Math.max(0, val));
	wrap.append(head, prog);
	return wrap;
}

export function createTimelineViewPlugin(): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		const hits = slice.memoryHits ?? [];
		const stats = slice.memoryStats;

		const topBar = document.createElement("div");
		topBar.className = "board-controls";
		const statsWrap = document.createElement("div");
		statsWrap.className = "kpi-strip";
		if (stats) {
			const totalEl = document.createElement("span");
			totalEl.className = "kpi-pill";
			totalEl.textContent = `Total: ${stats.total}`;
			const embEl = document.createElement("span");
			embEl.className = "kpi-pill";
			embEl.textContent = `Embedded: ${stats.embeddedCount}`;
			const topicEl = document.createElement("span");
			topicEl.className = "kpi-pill";
			topicEl.textContent = `Topics: ${stats.topicCount}`;
			statsWrap.append(totalEl, embEl, topicEl);
		}
		topBar.append(statsWrap);

		const consolidateBtn = document.createElement("button");
		consolidateBtn.type = "button";
		consolidateBtn.textContent = "Consolidate Recent Memories";
		consolidateBtn.disabled = hits.length < 2;
		consolidateBtn.addEventListener("click", () =>
			emit({ type: "consolidate-memory" }),
		);
		topBar.append(consolidateBtn);
		root.append(topBar);

		if (hits.length === 0) {
			const empty = document.createElement("p");
			empty.className = "muted";
			empty.textContent =
				"No AI memories recalled yet. Use '+ New -> Quick AI Memory' to record a memory.";
			root.append(empty);
			return;
		}

		const list = document.createElement("div");
		list.className = "timeline-list";

		for (const hit of hits) {
			const card = document.createElement("article");
			card.className = "timeline-card";

			const head = document.createElement("div");
			head.className = "timeline-card__head";

			const titleLeft = document.createElement("div");
			titleLeft.className = "chip-list";
			const idBtn = document.createElement("button");
			idBtn.type = "button";
			idBtn.className = "ghost mono";
			idBtn.textContent = `#${hit.memory.id}`;
			idBtn.addEventListener("click", () =>
				emit({ type: "open-detail", nodeId: hit.memory.id }),
			);

			const kindBadge = document.createElement("span");
			kindBadge.className = "badge badge--accent";
			kindBadge.textContent = hit.memory.kind;

			const statusBadge = document.createElement("span");
			statusBadge.className = `badge badge--${hit.memory.status === "active" ? "ok" : "muted"}`;
			statusBadge.textContent = hit.memory.status;

			titleLeft.append(idBtn, kindBadge, statusBadge);
			if (hit.memory.topicPath.length > 0) {
				const topicBadge = document.createElement("span");
				topicBadge.className = "badge";
				topicBadge.textContent = hit.memory.topicPath.join("/");
				titleLeft.append(topicBadge);
			}

			const timeEl = document.createElement("time");
			timeEl.className = "muted mono";
			timeEl.dateTime = hit.memory.recordedAt;
			timeEl.textContent = `${hit.memory.recordedAt.slice(0, 16).replace("T", " ")} · half-life ${hit.memory.halfLifeDays}d`;

			head.append(titleLeft, timeEl);

			const contentP = document.createElement("p");
			contentP.style.margin = "0";
			contentP.textContent = hit.memory.content;

			const signals = document.createElement("div");
			signals.className = "signal-bars";
			const graphSignal =
				hit.score.hopDistance !== null
					? 1 / (1 + Math.max(0, hit.score.hopDistance))
					: 0;
			signals.append(
				makeSignalBar("Combined", hit.score.combined),
				makeSignalBar("Lexical/Hybrid", hit.score.hybrid),
				makeSignalBar("Vector", hit.score.vectorScore ?? 0),
				makeSignalBar("Recency", hit.score.recency),
				makeSignalBar("Salience/Graph", Math.max(hit.score.salience, graphSignal)),
			);

			card.append(head, contentP, signals);
			list.append(card);
		}
		root.append(list);
	};

	return {
		id: "timeline",
		label: "Timeline",
		supports(table, _columns, slice) {
			return (
				table?.identifier === "ai_memories" ||
				(slice?.memoryHits?.length ?? 0) > 0
			);
		},
		mount(container, onIntent) {
			root = container;
			emit = onIntent;
		},
		update(slice) {
			render(slice);
		},
		destroy() {
			root?.replaceChildren();
			root = null;
		},
	};
}
