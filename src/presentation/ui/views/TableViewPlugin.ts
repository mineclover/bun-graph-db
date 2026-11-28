import type { TableColumnSummary } from "@/domain/value-objects/ColumnConfig.js";
import type { FieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import type {
	IVisualizationPlugin,
	PlatformRow,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

function cellDisplayText(val: unknown): string {
	if (val === null || val === undefined) return "—";
	if (Array.isArray(val)) return val.join(", ");
	if (typeof val === "object") return JSON.stringify(val);
	return String(val);
}

function getComparableValue(row: PlatformRow, key: string): string | number {
	if (key === "id") {
		const num = Number(row.id);
		return Number.isFinite(num) ? num : row.id;
	}
	if (key === "title") return row.title ?? "";
	if (key === "content") return row.content ?? "";
	const raw = row.attributes?.[key];
	if (typeof raw === "number") return raw;
	if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
		return Number(raw);
	}
	return cellDisplayText(raw);
}

export function createTableViewPlugin(
	editors: FieldEditorRegistry,
): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};
	let editingKey: { nodeId: string; colKey: string } | null = null;
	let latestSlice: ViewDataSlice | null = null;

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		// Facet chip bar
		const facetEntries = Object.entries(slice.facets ?? {}).filter(
			([, buckets]) => buckets.length > 0,
		);
		if (facetEntries.length > 0) {
			const facetBar = document.createElement("div");
			facetBar.className = "chip-list";
			facetBar.style.marginBottom = "0.75rem";
			for (const [key, buckets] of facetEntries) {
				const groupLabel = document.createElement("span");
				groupLabel.className = "muted";
				groupLabel.style.fontSize = "0.75rem";
				groupLabel.textContent = `${key}:`;
				facetBar.append(groupLabel);
				for (const bucket of buckets.slice(0, 6)) {
					const active = slice.activeFacets[key] === bucket.value;
					const chip = document.createElement("button");
					chip.type = "button";
					chip.className = "facet-chip";
					chip.setAttribute("aria-pressed", active ? "true" : "false");
					chip.textContent = `${bucket.value} (${bucket.count})`;
					chip.addEventListener("click", () => {
						emit({
							type: "filter-facet",
							key,
							value: active ? null : bucket.value,
						});
					});
					facetBar.append(chip);
				}
			}
			if (Object.keys(slice.activeFacets).length > 0) {
				const clearBtn = document.createElement("button");
				clearBtn.type = "button";
				clearBtn.className = "facet-chip ghost";
				clearBtn.textContent = "Clear filters";
				clearBtn.addEventListener("click", () => emit({ type: "clear-facets" }));
				facetBar.append(clearBtn);
			}
			root.append(facetBar);
		}

		if (slice.rows.length === 0) {
			const empty = document.createElement("p");
			empty.className = "muted";
			empty.textContent = slice.table
				? `No records match the current filter in '${slice.table.identifier}'. Use "+ New" to create one.`
				: "Select or create a table to inspect records.";
			root.append(empty);
			return;
		}

		const visibleCols: TableColumnSummary[] = slice.columns.filter(
			(col) => !col.config.hidden,
		);
		const tableCols: Array<{
			key: string;
			label: string;
			col?: TableColumnSummary;
			sortable: boolean;
			editable: boolean;
		}> = [
			{ key: "id", label: "ID", sortable: true, editable: false },
			{ key: "title", label: "Title", sortable: true, editable: false },
			{ key: "content", label: "Content", sortable: true, editable: false },
			...visibleCols.slice(0, 8).map((col) => ({
				key: col.identifier,
				label: col.name || col.identifier,
				col,
				sortable: col.config.sortable !== false,
				editable: true,
			})),
		];

		const sortCol = slice.sortColumn ?? "id";
		const sortDir = slice.sortDirection ?? "ascending";
		const sortedRows = [...slice.rows].sort((a, b) => {
			const va = getComparableValue(a, sortCol);
			const vb = getComparableValue(b, sortCol);
			let cmp = 0;
			if (typeof va === "number" && typeof vb === "number") {
				cmp = va - vb;
			} else {
				cmp = String(va).localeCompare(String(vb));
			}
			return sortDir === "ascending" ? cmp : -cmp;
		});

		const wrapper = document.createElement("div");
		wrapper.className = "table-wrapper";
		wrapper.tabIndex = 0;
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute(
			"aria-label",
			`${slice.table?.identifier ?? "Records"} data table`,
		);

		const table = document.createElement("table");
		table.className = "data-table";
		table.id = "data-table";

		const thead = document.createElement("thead");
		const headTr = document.createElement("tr");
		for (const def of tableCols) {
			const th = document.createElement("th");
			th.scope = "col";
			const isSorted = sortCol === def.key;
			th.setAttribute("aria-sort", isSorted ? sortDir : "none");
			if (def.sortable) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "table-sort-btn";
				btn.setAttribute("commandfor", "data-table");
				btn.setAttribute("command", "--sort");
				btn.dataset.sortKey = def.key;
				const indicator = isSorted
					? sortDir === "ascending"
						? " ▲"
						: " ▼"
					: "";
				btn.textContent = `${def.label}${indicator}`;
				btn.addEventListener("click", () => {
					const nextDir =
						isSorted && sortDir === "ascending"
							? "descending"
							: "ascending";
					emit({ type: "sort", columnKey: def.key, direction: nextDir });
				});
				th.append(btn);
			} else {
				th.textContent = def.label;
			}
			headTr.append(th);
		}
		const actionTh = document.createElement("th");
		actionTh.scope = "col";
		actionTh.textContent = "Actions";
		headTr.append(actionTh);
		thead.append(headTr);
		table.append(thead);

		const tbody = document.createElement("tbody");
		for (const row of sortedRows) {
			const tr = document.createElement("tr");
			if (slice.selection.has(row.id)) {
				tr.classList.add("is-selected");
			}

			for (const def of tableCols) {
				const td = document.createElement("td");
				td.dataset.label = def.label;

				if (def.key === "id") {
					const idBtn = document.createElement("button");
					idBtn.type = "button";
					idBtn.className = "ghost mono";
					idBtn.textContent = `#${row.id}`;
					idBtn.title = "Open node inspector";
					idBtn.addEventListener("click", () =>
						emit({ type: "open-detail", nodeId: row.id }),
					);
					td.append(idBtn);
				} else if (def.key === "title") {
					const titleBtn = document.createElement("button");
					titleBtn.type = "button";
					titleBtn.className = "ghost";
					titleBtn.style.textAlign = "start";
					titleBtn.textContent = row.title || "—";
					titleBtn.addEventListener("click", () =>
						emit({ type: "open-detail", nodeId: row.id }),
					);
					td.append(titleBtn);
				} else if (def.key === "content") {
					td.textContent =
						row.content.length > 96
							? `${row.content.slice(0, 93)}...`
							: row.content;
				} else if (def.col) {
					const colSpec = def.col;
					const attrVal = row.attributes?.[def.key];
					const isEditing =
						editingKey?.nodeId === row.id &&
						editingKey?.colKey === def.key;

					if (isEditing) {
						let draftVal: unknown = attrVal;
						const editor = editors.resolve(colSpec);
						const widget = editor.renderEditor({
							column: colSpec,
							value: attrVal,
							onChange(next) {
								draftVal = next;
							},
							onCommit() {
								editingKey = null;
								emit({
									type: "inline-update",
									nodeId: row.id,
									patch: { attributes: { [def.key]: draftVal } },
								});
							},
							onCancel() {
								editingKey = null;
								if (latestSlice) render(latestSlice);
							},
						});
						td.append(widget);
					} else {
						td.classList.add("cell-editable");
						td.title = `Click to edit ${def.label}`;
						const editor = editors.resolve(colSpec);
						td.append(editor.renderCell(attrVal, colSpec));
						td.addEventListener("click", () => {
							editingKey = { nodeId: row.id, colKey: def.key };
							if (latestSlice) render(latestSlice);
							const input = td.querySelector<HTMLElement>(
								"input, select, textarea",
							);
							input?.focus();
						});
					}
				}
				tr.append(td);
			}

			const actionTd = document.createElement("td");
			actionTd.dataset.label = "Actions";
			const actions = document.createElement("div");
			actions.className = "cell-actions";

			const inspectBtn = document.createElement("button");
			inspectBtn.type = "button";
			inspectBtn.textContent = "Inspect";
			inspectBtn.addEventListener("click", () =>
				emit({ type: "open-detail", nodeId: row.id }),
			);

			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.className = "danger";
			delBtn.textContent = "Delete";
			delBtn.addEventListener("click", () =>
				emit({ type: "delete-row", nodeId: row.id }),
			);

			actions.append(inspectBtn, delBtn);
			actionTd.append(actions);
			tr.append(actionTd);
			tbody.append(tr);
		}
		table.append(tbody);
		wrapper.append(table);
		root.append(wrapper);
	};

	return {
		id: "table",
		label: "Table",
		supports() {
			return true;
		},
		mount(container, onIntent) {
			root = container;
			emit = onIntent;
		},
		update(slice) {
			latestSlice = slice;
			render(slice);
		},
		destroy() {
			editingKey = null;
			latestSlice = null;
			root?.replaceChildren();
			root = null;
		},
	};
}
