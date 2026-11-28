import type { PresetBlueprintName } from "@/application/blueprints/PresetBlueprints.js";
import type { MemoryKind } from "@/application/services/AiMemoryService.js";
import type { FieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import { validateRowDraft } from "@/presentation/ui/clients/sharedHelpers.js";
import type {
	IGraphPlatformClient,
	ViewDataSlice,
} from "@/presentation/ui/contracts.js";

export interface QuickCaptureController {
	open(slice: ViewDataSlice, initialMode?: "row" | "memory" | "preset"): void;
	close(): void;
	destroy(): void;
}

export function mountQuickCaptureDialog(
	host: HTMLElement,
	client: IGraphPlatformClient,
	editors: FieldEditorRegistry,
	onCompleted: (message: string, focusTable?: string) => Promise<void>,
	onError: (message: string) => void,
): QuickCaptureController {
	const dialog = document.createElement("dialog");
	dialog.className = "platform-dialog";
	dialog.setAttribute("aria-label", "Quick Capture & Authoring");
	host.append(dialog);

	let activeMode: "row" | "memory" | "preset" = "row";
	let currentSlice: ViewDataSlice | null = null;

	const renderDialog = (): void => {
		dialog.replaceChildren();
		const slice = currentSlice;
		if (!slice) return;

		const top = document.createElement("div");
		top.className = "inspector-header";
		const heading = document.createElement("h2");
		heading.textContent = "Quick Capture";
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.textContent = "Close";
		closeBtn.addEventListener("click", () => dialog.close());
		top.append(heading, closeBtn);
		dialog.append(top);

		const modeTabs = document.createElement("div");
		modeTabs.className = "chip-list";
		modeTabs.style.marginBlock = "0.75rem";
		const modes: Array<{ id: "row" | "memory" | "preset"; label: string }> = [
			{ id: "row", label: `New Row (${slice.table?.identifier ?? "none"})` },
			{ id: "memory", label: "Quick AI Memory" },
			{ id: "preset", label: "Apply Preset Blueprint" },
		];
		for (const m of modes) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.setAttribute("aria-pressed", activeMode === m.id ? "true" : "false");
			btn.textContent = m.label;
			btn.addEventListener("click", () => {
				activeMode = m.id;
				renderDialog();
			});
			modeTabs.append(btn);
		}
		dialog.append(modeTabs);

		if (activeMode === "row") {
			if (!slice.table) {
				const warn = document.createElement("p");
				warn.className = "muted";
				warn.textContent =
					"No table is selected yet. Switch to 'Quick AI Memory' or 'Apply Preset Blueprint'.";
				dialog.append(warn);
				return;
			}
			const activeTable = slice.table;
			const form = document.createElement("form");
			form.className = "form-grid";
			let titleVal = "";
			let contentVal = "";
			const attrValues: Record<string, unknown> = {};

			const titleField = document.createElement("div");
			titleField.className = "form-field";
			const titleLbl = document.createElement("label");
			titleLbl.textContent = "Title";
			const titleInput = document.createElement("input");
			titleInput.placeholder = "Short record title...";
			titleInput.addEventListener("input", () => {
				titleVal = titleInput.value;
			});
			titleField.append(titleLbl, titleInput);

			const contentField = document.createElement("div");
			contentField.className = "form-field";
			const contentLbl = document.createElement("label");
			contentLbl.textContent = "Content *";
			const contentInput = document.createElement("textarea");
			contentInput.required = true;
			contentInput.placeholder = "Body / specification / note...";
			contentInput.addEventListener("input", () => {
				contentVal = contentInput.value;
			});
			contentField.append(contentLbl, contentInput);

			form.append(titleField, contentField);

			for (const col of slice.columns) {
				if (col.config.defaultValue !== undefined) {
					attrValues[col.identifier] = col.config.defaultValue;
				}
				const f = document.createElement("div");
				f.className = "form-field";
				const l = document.createElement("label");
				l.textContent = `${col.name || col.identifier}${col.isRequired ? " *" : ""}`;
				const spec = editors.resolve(col);
				const el = spec.renderEditor({
					column: col,
					value: attrValues[col.identifier],
					onChange(v) {
						if (v === null || v === "") delete attrValues[col.identifier];
						else attrValues[col.identifier] = v;
					},
					onCommit() {},
				});
				f.append(l, el);
				form.append(f);
			}

			const errMsg = document.createElement("p");
			errMsg.className = "field-error";
			form.append(errMsg);

			const submitBtn = document.createElement("button");
			submitBtn.type = "submit";
			submitBtn.className = "primary";
			submitBtn.textContent = `Create in ${activeTable.identifier}`;
			form.append(submitBtn);

			form.addEventListener("submit", async (event) => {
				event.preventDefault();
				const report = validateRowDraft(
					slice.columns,
					{ content: contentVal, attributes: attrValues },
					true,
				);
				if (!report.valid) {
					errMsg.textContent = report.issues
						.map((i) => `${i.field}: ${i.message}`)
						.join(" | ");
					return;
				}
				try {
					await client.createRow({
						tableId: activeTable.id,
						tableIdentifier: activeTable.identifier,
						title: titleVal.trim() || null,
						content: contentVal.trim(),
						attributes: attrValues,
					});
					dialog.close();
					await onCompleted(
						`Created record in ${activeTable.identifier}.`,
						activeTable.identifier,
					);
				} catch (error) {
					errMsg.textContent =
						error instanceof Error ? error.message : String(error);
					onError(errMsg.textContent);
				}
			});
			dialog.append(form);
			return;
		}

		if (activeMode === "memory") {
			const form = document.createElement("form");
			form.className = "form-grid";
			const contentInput = document.createElement("textarea");
			contentInput.required = true;
			contentInput.placeholder = "Fact, architectural decision, or observation...";
			const kindSelect = document.createElement("select");
			for (const kind of ["semantic", "episodic", "procedural", "working"]) {
				const opt = document.createElement("option");
				opt.value = kind;
				opt.textContent = kind;
				kindSelect.append(opt);
			}
			const topicInput = document.createElement("input");
			topicInput.placeholder = "Topic path (e.g. architecture/ui)";
			topicInput.value = "workspace/general";
			const importanceInput = document.createElement("input");
			importanceInput.type = "number";
			importanceInput.step = "0.1";
			importanceInput.min = "0";
			importanceInput.max = "1";
			importanceInput.value = "0.8";

			const submitBtn = document.createElement("button");
			submitBtn.type = "submit";
			submitBtn.className = "primary";
			submitBtn.textContent = "Remember Fact";

			form.append(
				contentInput,
				kindSelect,
				topicInput,
				importanceInput,
				submitBtn,
			);
			form.addEventListener("submit", async (event) => {
				event.preventDefault();
				const content = contentInput.value.trim();
				if (!content) return;
				const topicPath = topicInput.value
					.split("/")
					.map((s) => s.trim())
					.filter(Boolean);
				try {
					await client.remember({
						content,
						kind: kindSelect.value as MemoryKind,
						topicPath,
						importance: Number(importanceInput.value) || 0.8,
					});
					dialog.close();
					await onCompleted("Saved new AI memory.", "ai_memories");
				} catch (error) {
					onError(error instanceof Error ? error.message : String(error));
				}
			});
			dialog.append(form);
			return;
		}

		// Preset mode
		const presetWrap = document.createElement("div");
		presetWrap.className = "form-grid";
		for (const preset of [
			"knowledge",
			"product-spec",
			"decision-log",
		] as PresetBlueprintName[]) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = `Apply '${preset}' Blueprint Preset`;
			btn.addEventListener("click", async () => {
				try {
					await client.applyPreset(preset);
					dialog.close();
					await onCompleted(`Applied '${preset}' blueprint preset.`);
				} catch (error) {
					onError(error instanceof Error ? error.message : String(error));
				}
			});
			presetWrap.append(btn);
		}
		dialog.append(presetWrap);
	};

	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) dialog.close();
	});

	return {
		open(slice, initialMode = "row") {
			currentSlice = slice;
			activeMode = initialMode;
			renderDialog();
			if (!dialog.open) dialog.showModal();
		},
		close() {
			if (dialog.open) dialog.close();
		},
		destroy() {
			dialog.remove();
		},
	};
}
