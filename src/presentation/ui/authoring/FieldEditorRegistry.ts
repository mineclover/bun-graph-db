import type { TableColumnSummary } from "@/domain/value-objects/ColumnConfig.js";
import type {
	FieldEditorContext,
	FieldEditorSpec,
} from "@/presentation/ui/contracts.js";

function attachImeSafeCommit(
	el: HTMLInputElement | HTMLTextAreaElement,
	onCommit: () => void,
	onCancel?: () => void,
): void {
	el.addEventListener("keydown", (event) => {
		const keyEvent = event as KeyboardEvent;
		if (keyEvent.isComposing || keyEvent.keyCode === 229) return;
		if (keyEvent.key === "Escape") {
			keyEvent.preventDefault();
			onCancel?.();
			return;
		}
		if (keyEvent.key === "Enter" && !(el instanceof HTMLTextAreaElement && !keyEvent.metaKey && !keyEvent.ctrlKey)) {
			keyEvent.preventDefault();
			onCommit();
		}
	});
}

function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function makeBadge(text: string, tone = "neutral"): HTMLElement {
	const span = document.createElement("span");
	span.className = `badge badge--${tone}`;
	span.textContent = text;
	return span;
}

const enumSelectSpec: FieldEditorSpec = {
	id: "enum-select",
	matches(col) {
		return Boolean(
			(col.config.enumValues && col.config.enumValues.length > 0) ||
				col.config.role === "status" ||
				col.config.role === "category",
		);
	},
	renderCell(value, col) {
		const valStr = formatCellValue(value);
		const tone =
			valStr === "approved" || valStr === "active" || valStr === "done"
				? "ok"
				: valStr === "draft" || valStr === "working" || valStr === "episodic"
					? "accent"
					: valStr === "superseded" || valStr === "archived"
						? "muted"
						: col.config.role === "status"
							? "warn"
							: "neutral";
		return makeBadge(valStr, tone);
	},
	renderEditor(ctx: FieldEditorContext) {
		const options = ctx.column.config.enumValues ?? [];
		if (options.length === 0) {
			return defaultTextSpec.renderEditor(ctx);
		}
		const select = document.createElement("select");
		select.className = "field-input";
		if (ctx.error) select.setAttribute("aria-invalid", "true");
		const blank = document.createElement("option");
		blank.value = "";
		blank.textContent = "— select —";
		select.append(blank);
		for (const optVal of options) {
			const opt = document.createElement("option");
			opt.value = optVal;
			opt.textContent = optVal;
			if (String(ctx.value ?? "") === optVal) opt.selected = true;
			select.append(opt);
		}
		select.addEventListener("change", () => {
			ctx.onChange(select.value || null);
			ctx.onCommit();
		});
		select.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				ctx.onCancel?.();
			}
		});
		return select;
	},
};

const numberMetricSpec: FieldEditorSpec = {
	id: "number-metric",
	matches(col) {
		return (
			col.config.role === "priority" ||
			col.config.role === "metric" ||
			col.attributeTypeId === "number" ||
			col.attributeTypeId === "integer"
		);
	},
	renderCell(value) {
		const span = document.createElement("span");
		span.className = "cell-numeric";
		if (value !== null && value !== undefined && value !== "") {
			span.dataset.value = String(value);
		}
		span.textContent = formatCellValue(value);
		return span;
	},
	renderEditor(ctx) {
		const input = document.createElement("input");
		input.type = "number";
		input.step = "any";
		input.className = "field-input cell-numeric";
		input.value =
			ctx.value !== null && ctx.value !== undefined ? String(ctx.value) : "";
		if (ctx.error) input.setAttribute("aria-invalid", "true");
		input.addEventListener("input", () => {
			const trimmed = input.value.trim();
			ctx.onChange(trimmed === "" ? null : Number(trimmed));
		});
		attachImeSafeCommit(input, ctx.onCommit, ctx.onCancel);
		return input;
	},
};

const tagChipsSpec: FieldEditorSpec = {
	id: "tag-chips",
	matches(col) {
		return col.config.role === "tag";
	},
	renderCell(value) {
		const wrap = document.createElement("div");
		wrap.className = "chip-list";
		const list = Array.isArray(value)
			? value.map(String)
			: typeof value === "string" && value.trim()
				? value
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean)
				: [];
		if (list.length === 0) {
			const muted = document.createElement("span");
			muted.className = "muted";
			muted.textContent = "—";
			wrap.append(muted);
			return wrap;
		}
		for (const item of list.slice(0, 6)) {
			wrap.append(makeBadge(item, "accent"));
		}
		return wrap;
	},
	renderEditor(ctx) {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "field-input";
		input.placeholder = "comma-separated tags";
		input.value = Array.isArray(ctx.value)
			? ctx.value.map(String).join(", ")
			: String(ctx.value ?? "");
		if (ctx.error) input.setAttribute("aria-invalid", "true");
		input.addEventListener("input", () => {
			const items = input.value
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			ctx.onChange(items);
		});
		attachImeSafeCommit(input, ctx.onCommit, ctx.onCancel);
		return input;
	},
};

const datePickerSpec: FieldEditorSpec = {
	id: "date-picker",
	matches(col) {
		return col.config.role === "date";
	},
	renderCell(value) {
		const text = formatCellValue(value);
		if (text === "—") {
			const span = document.createElement("span");
			span.className = "muted";
			span.textContent = "—";
			return span;
		}
		const time = document.createElement("time");
		time.dateTime = text;
		time.textContent = text.slice(0, 10);
		return time;
	},
	renderEditor(ctx) {
		const input = document.createElement("input");
		input.type = "date";
		input.className = "field-input";
		const raw = String(ctx.value ?? "");
		input.value = raw.length >= 10 ? raw.slice(0, 10) : "";
		if (ctx.error) input.setAttribute("aria-invalid", "true");
		input.addEventListener("change", () => {
			ctx.onChange(input.value || null);
			ctx.onCommit();
		});
		attachImeSafeCommit(input, ctx.onCommit, ctx.onCancel);
		return input;
	},
};

const referencePickerSpec: FieldEditorSpec = {
	id: "reference-picker",
	matches(col) {
		return col.config.role === "reference";
	},
	renderCell(value) {
		return makeBadge(formatCellValue(value), "neutral");
	},
	renderEditor(ctx) {
		if (ctx.referenceCandidates && ctx.referenceCandidates.length > 0) {
			const select = document.createElement("select");
			select.className = "field-input";
			const empty = document.createElement("option");
			empty.value = "";
			empty.textContent = "— reference —";
			select.append(empty);
			for (const cand of ctx.referenceCandidates) {
				const opt = document.createElement("option");
				opt.value = cand.id;
				opt.textContent = cand.label;
				if (String(ctx.value ?? "") === cand.id) opt.selected = true;
				select.append(opt);
			}
			select.addEventListener("change", () => {
				ctx.onChange(select.value || null);
				ctx.onCommit();
			});
			return select;
		}
		return defaultTextSpec.renderEditor(ctx);
	},
};

const defaultTextSpec: FieldEditorSpec = {
	id: "default-text",
	matches() {
		return true;
	},
	renderCell(value, col) {
		const span = document.createElement("span");
		if (col.config.role === "slug") {
			span.className = "mono";
		}
		span.textContent = formatCellValue(value);
		return span;
	},
	renderEditor(ctx) {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "field-input";
		input.value =
			ctx.value !== null && ctx.value !== undefined ? String(ctx.value) : "";
		if (ctx.error) input.setAttribute("aria-invalid", "true");
		input.addEventListener("input", () => {
			ctx.onChange(input.value);
		});
		attachImeSafeCommit(input, ctx.onCommit, ctx.onCancel);
		return input;
	},
};

export interface FieldEditorRegistry {
	resolve(col: TableColumnSummary): FieldEditorSpec;
	listSpecs(): readonly FieldEditorSpec[];
	register(spec: FieldEditorSpec, prepend?: boolean): void;
}

export function createDefaultFieldEditorRegistry(): FieldEditorRegistry {
	const specs: FieldEditorSpec[] = [
		enumSelectSpec,
		numberMetricSpec,
		tagChipsSpec,
		datePickerSpec,
		referencePickerSpec,
		defaultTextSpec,
	];

	return {
		resolve(col: TableColumnSummary): FieldEditorSpec {
			for (const spec of specs) {
				if (spec.matches(col)) return spec;
			}
			return defaultTextSpec;
		},
		listSpecs(): readonly FieldEditorSpec[] {
			return [...specs];
		},
		register(spec: FieldEditorSpec, prepend = true): void {
			if (prepend) {
				specs.unshift(spec);
			} else {
				specs.push(spec);
			}
		},
	};
}
