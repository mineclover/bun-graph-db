import type { PresetBlueprintName } from "@/application/blueprints/PresetBlueprints.js";
import type {
	IVisualizationPlugin,
	ViewDataSlice,
	ViewIntent,
} from "@/presentation/ui/contracts.js";

export function createAuditViewPlugin(): IVisualizationPlugin {
	let root: HTMLElement | null = null;
	let emit: (intent: ViewIntent) => void = () => {};

	const render = (slice: ViewDataSlice): void => {
		if (!root) return;
		root.replaceChildren();

		const controls = document.createElement("div");
		controls.className = "board-controls";
		const left = document.createElement("div");
		left.className = "chip-list";
		for (const preset of [
			"knowledge",
			"product-spec",
			"decision-log",
		] as PresetBlueprintName[]) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.textContent = `Apply '${preset}'`;
			btn.addEventListener("click", () =>
				emit({ type: "apply-preset", preset }),
			);
			left.append(btn);
		}
		controls.append(left);

		const refreshOpsBtn = document.createElement("button");
		refreshOpsBtn.type = "button";
		refreshOpsBtn.textContent = "Refresh Audit & Ops";
		refreshOpsBtn.addEventListener("click", () =>
			emit({ type: "refresh-ops" }),
		);
		controls.append(refreshOpsBtn);
		root.append(controls);

		const audit = slice.audit;
		if (audit) {
			const kpis = document.createElement("div");
			kpis.className = "audit-grid";

			const makeAuditCard = (
				labelText: string,
				mainText: string,
				subText: string,
				subMono = false,
			): HTMLDivElement => {
				const card = document.createElement("div");
				card.className = "audit-card";
				const lbl = document.createElement("div");
				lbl.className = "muted";
				lbl.textContent = labelText;
				const strong = document.createElement("strong");
				strong.textContent = mainText;
				const sub = document.createElement("div");
				sub.className = subMono ? "mono muted" : "muted";
				sub.textContent = subText;
				card.append(lbl, strong, sub);
				return card;
			};

			kpis.append(
				makeAuditCard(
					"IA Health",
					audit.healthy ? "Healthy" : "Attention Needed",
					`${audit.errorCount} errors · ${audit.warningCount} warnings`,
				),
				makeAuditCard("Total Tables", String(audit.totalTables), `Mode: ${slice.mode}`),
			);

			if (slice.opsHealth) {
				const statusStr = String(slice.opsHealth.status ?? "OK");
				const verStr = String(
					slice.opsHealth.embeddedAssetsVersion ?? "",
				).slice(0, 12);
				kpis.append(
					makeAuditCard("Server /health", statusStr, verStr || "connected", true),
				);
			}
			root.append(kpis);

			if (audit.tables.length > 0) {
				const wrap = document.createElement("div");
				wrap.className = "table-wrapper";
				const table = document.createElement("table");
				table.className = "data-table";
				const thead = document.createElement("thead");
				const headRow = document.createElement("tr");
				for (const heading of [
					"Table",
					"Nodes",
					"Attributes",
					"Hierarchy",
					"Orphans",
					"Conformance",
				]) {
					const th = document.createElement("th");
					th.scope = "col";
					th.textContent = heading;
					headRow.append(th);
				}
				thead.append(headRow);
				const tbody = document.createElement("tbody");
				for (const t of audit.tables) {
					const tr = document.createElement("tr");
					const cells: Array<[string, string]> = [
						["Table", t.identifier],
						["Nodes", String(t.nodeCount)],
						["Attributes", String(t.attributeCount)],
						[
							"Hierarchy",
							`${t.hierarchyMode} (${t.hierarchyValidation.valid ? "valid" : "cycle/multi"})`,
						],
						["Orphans", String(t.orphanNodeIds.length)],
						["Conformance", t.conformance.valid ? "valid" : "issues"],
					];
					for (const [label, value] of cells) {
						const td = document.createElement("td");
						td.dataset.label = label;
						td.textContent = value;
						tr.append(td);
					}
					tbody.append(tr);
				}
				table.append(thead, tbody);
				wrap.append(table);
				root.append(wrap);
			}

			if (audit.issues.length > 0) {
				const issueList = document.createElement("ul");
				issueList.className = "relation-list";
				issueList.style.marginTop = "0.75rem";
				for (const issue of audit.issues) {
					const li = document.createElement("li");
					li.className = "relation-item";
					const badge = document.createElement("span");
					badge.className = `badge badge--${issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warn" : "neutral"}`;
					badge.textContent = issue.severity;
					const msg = document.createElement("span");
					msg.textContent = `[${issue.tableIdentifier}] ${issue.code}: ${issue.message}`;
					li.append(msg, badge);
					issueList.append(li);
				}
				root.append(issueList);
			}
		}

		if (slice.opsMetrics || slice.opsAuditLog) {
			const details = document.createElement("details");
			details.style.marginTop = "0.75rem";
			const sum = document.createElement("summary");
			sum.textContent = "Server /metrics & /api/audit-log JSON";
			const pre = document.createElement("pre");
			pre.className = "raw-json";
			pre.textContent = JSON.stringify(
				{
					metrics: slice.opsMetrics ?? null,
					auditLog: slice.opsAuditLog ?? null,
				},
				null,
				2,
			);
			details.append(sum, pre);
			root.append(details);
		}
	};

	return {
		id: "audit",
		label: "Audit & Ops",
		supports() {
			return true;
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
