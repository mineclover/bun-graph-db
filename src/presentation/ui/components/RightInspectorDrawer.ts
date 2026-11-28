import type { FieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import { validateRowDraft } from "@/presentation/ui/clients/sharedHelpers.js";
import type {
	PlatformRow,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

export interface RightInspectorController {
	render(row: PlatformRow | null, slice: ViewDataSlice): void;
	destroy(): void;
}

export function mountRightInspectorDrawer(
	container: HTMLElement,
	editors: FieldEditorRegistry,
	onIntent: (intent: ViewIntent) => void,
	onClose: () => void,
): RightInspectorController {
	const render = (row: PlatformRow | null, slice: ViewDataSlice): void => {
		container.replaceChildren();
		if (!row) {
			container.hidden = true;
			return;
		}
		container.hidden = false;

		const header = document.createElement("div");
		header.className = "inspector-header";
		const heading = document.createElement("h2");
		heading.textContent = `Node #${row.id}`;
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.setAttribute("aria-label", "Close inspector");
		closeBtn.textContent = "Close";
		closeBtn.addEventListener("click", onClose);
		header.append(heading, closeBtn);
		container.append(header);

		if (
			(row.breadcrumbs?.length ?? 0) > 0 ||
			(row.topicBreadcrumbs?.length ?? 0) > 0
		) {
			const crumbs = document.createElement("div");
			crumbs.className = "chip-list";
			for (const b of row.breadcrumbs ?? row.topicBreadcrumbs ?? []) {
				const chip = document.createElement("span");
				chip.className = "badge";
				chip.textContent = b.title || b.key || `#${b.id}`;
				crumbs.append(chip);
			}
			container.append(crumbs);
		}

		let titleDraft = row.title ?? "";
		let contentDraft = row.content ?? "";
		const attrDraft: Record<string, unknown> = { ...(row.attributes ?? {}) };
		let fieldErrors = new Map<string, string>();

		const form = document.createElement("form");
		form.className = "form-grid";

		const errorHost = document.createElement("div");

		// Title field
		const titleWrap = document.createElement("div");
		titleWrap.className = "form-field";
		const titleLabel = document.createElement("label");
		titleLabel.htmlFor = `inspector-title-${row.id}`;
		titleLabel.textContent = "Title";
		const titleInput = document.createElement("input");
		titleInput.id = `inspector-title-${row.id}`;
		titleInput.className = "field-input";
		titleInput.value = titleDraft;
		titleInput.addEventListener("input", () => {
			titleDraft = titleInput.value;
		});
		titleInput.addEventListener("keydown", (event) => {
			if (event.isComposing || event.keyCode === 229) return;
			if (event.key === "Enter") {
				event.preventDefault();
				commitPatch();
			}
		});
		titleWrap.append(titleLabel, titleInput);
		form.append(titleWrap);

		// Markdown content field
		const contentWrap = document.createElement("div");
		contentWrap.className = "form-field";
		const contentLabel = document.createElement("label");
		contentLabel.htmlFor = `inspector-content-${row.id}`;
		contentLabel.textContent = "Content (Markdown)";
		const contentInput = document.createElement("textarea");
		contentInput.id = `inspector-content-${row.id}`;
		contentInput.className = "field-input";
		contentInput.value = contentDraft;
		contentInput.addEventListener("input", () => {
			contentDraft = contentInput.value;
		});
		contentInput.addEventListener("keydown", (event) => {
			if (event.isComposing || event.keyCode === 229) return;
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				commitPatch();
			}
		});
		contentWrap.append(contentLabel, contentInput);
		form.append(contentWrap);

		// Schema-driven typed attribute editors
		const refCandidates = slice.rows.map((r) => ({
			id: r.id,
			label: `${r.title || r.content.slice(0, 28)} (#${r.id})`,
		}));

		const renderAttrFields = (): void => {
			errorHost.replaceChildren();
			for (const col of slice.columns) {
				const fieldWrap = document.createElement("div");
				fieldWrap.className = "form-field";
				const lbl = document.createElement("label");
				lbl.textContent = `${col.name || col.identifier}${col.isRequired ? " *" : ""}`;
				const spec = editors.resolve(col);
				const err = fieldErrors.get(col.identifier);
				const inputEl = spec.renderEditor({
					column: col,
					value: attrDraft[col.identifier],
					error: err,
					referenceCandidates: refCandidates,
					onChange(next) {
						if (next === null || next === "") {
							delete attrDraft[col.identifier];
						} else {
							attrDraft[col.identifier] = next;
						}
					},
					onCommit() {
						commitPatch();
					},
				});
				fieldWrap.append(lbl, inputEl);
				if (err) {
					const errP = document.createElement("p");
					errP.className = "field-error";
					errP.textContent = err;
					fieldWrap.append(errP);
				}
				errorHost.append(fieldWrap);
			}
		};

		const commitPatch = (): void => {
			const report = validateRowDraft(
				slice.columns,
				{ content: contentDraft, attributes: attrDraft },
				false,
			);
			fieldErrors = new Map(report.issues.map((i) => [i.field, i.message]));
			if (!report.valid) {
				renderAttrFields();
				return;
			}
			onIntent({
				type: "inline-update",
				nodeId: row.id,
				patch: {
					title: titleDraft.trim() || null,
					content: contentDraft.trim(),
					attributes: attrDraft,
				},
			});
		};

		renderAttrFields();
		form.append(errorHost);

		form.addEventListener("submit", (event) => {
			event.preventDefault();
			commitPatch();
		});

		const btnRow = document.createElement("div");
		btnRow.className = "chip-list";
		const saveBtn = document.createElement("button");
		saveBtn.type = "submit";
		saveBtn.className = "primary";
		saveBtn.textContent = "Save Changes";
		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "danger";
		delBtn.textContent = "Delete Node";
		delBtn.addEventListener("click", () =>
			onIntent({ type: "delete-row", nodeId: row.id }),
		);
		btnRow.append(saveBtn, delBtn);
		form.append(btnRow);
		container.append(form);

		// Relation Composer
		const relSection = document.createElement("section");
		const relHeading = document.createElement("h3");
		relHeading.className = "rail-section-title";
		relHeading.textContent = "Relations";
		relSection.append(relHeading);

		const connected = slice.relations.filter(
			(rel) => rel.sourceNodeId === row.id || rel.targetNodeId === row.id,
		);
		if (connected.length > 0) {
			const relList = document.createElement("ul");
			relList.className = "relation-list";
			for (const rel of connected) {
				const li = document.createElement("li");
				li.className = "relation-item";
				const isOutgoing = rel.sourceNodeId === row.id;
				const otherId = isOutgoing ? rel.targetNodeId : rel.sourceNodeId;
				const otherRow = slice.rows.find((r) => r.id === otherId);
				const otherLabel = otherRow?.title || `#${otherId}`;
				const desc = document.createElement("span");
				desc.textContent = isOutgoing
					? `→ [${rel.relationType}] ${otherLabel}`
					: `← [${rel.relationType}] ${otherLabel}`;
				const rmBtn = document.createElement("button");
				rmBtn.type = "button";
				rmBtn.className = "danger";
				rmBtn.textContent = "Remove";
				rmBtn.addEventListener("click", () =>
					onIntent({ type: "delete-relation", relationId: rel.id }),
				);
				li.append(desc, rmBtn);
				relList.append(li);
			}
			relSection.append(relList);
		} else {
			const noneP = document.createElement("p");
			noneP.className = "muted";
			noneP.style.fontSize = "0.78rem";
			noneP.textContent = "No linked relations yet.";
			relSection.append(noneP);
		}

		const relForm = document.createElement("form");
		relForm.className = "form-grid";
		relForm.style.marginTop = "0.55rem";
		const relTypeInput = document.createElement("input");
		relTypeInput.placeholder = "relation type (e.g. dependsOn, parentOf)";
		relTypeInput.value = slice.relationTypes[0]?.identifier ?? "dependsOn";
		relTypeInput.setAttribute("list", `rel-types-${row.id}`);
		const datalist = document.createElement("datalist");
		datalist.id = `rel-types-${row.id}`;
		for (const rt of slice.relationTypes) {
			const opt = document.createElement("option");
			opt.value = rt.identifier;
			datalist.append(opt);
		}

		const targetSelect = document.createElement("select");
		targetSelect.setAttribute("aria-label", "Target node for relation");
		for (const cand of refCandidates) {
			if (cand.id === row.id) continue;
			const opt = document.createElement("option");
			opt.value = cand.id;
			opt.textContent = cand.label;
			targetSelect.append(opt);
		}

		const addRelBtn = document.createElement("button");
		addRelBtn.type = "submit";
		addRelBtn.textContent = "+ Link Relation";
		addRelBtn.disabled = targetSelect.options.length === 0;

		relForm.addEventListener("submit", (event) => {
			event.preventDefault();
			const relType = relTypeInput.value.trim();
			const targetId = targetSelect.value;
			if (!relType || !targetId) return;
			onIntent({
				type: "create-relation",
				sourceNodeId: row.id,
				targetNodeId: targetId,
				relationType: relType,
			});
		});
		relForm.append(relTypeInput, datalist, targetSelect, addRelBtn);
		relSection.append(relForm);
		container.append(relSection);

		// Raw JSON details
		const details = document.createElement("details");
		const summary = document.createElement("summary");
		summary.textContent = "Raw Node JSON";
		const pre = document.createElement("pre");
		pre.className = "raw-json";
		pre.textContent = JSON.stringify(row, null, 2);
		details.append(summary, pre);
		container.append(details);
	};

	return {
		render,
		destroy() {
			container.replaceChildren();
		},
	};
}
