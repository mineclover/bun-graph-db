import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import type { WorkBook } from "xlsx";
import { SheetMatrixSerializer } from "../SheetMatrixSerializer.js";
import type { ResolvedSyncTargetSelection } from "../TabularSyncTargetRegistry.js";
import type { ExcelTableRow } from "../types/ExcelRowSchema.js";
import type {
	TabularDestinationGateway,
	TabularWritePlan,
} from "./TabularDestinationGateway.js";

type XlsxModule = typeof import("xlsx");
let xlsxModulePromise: Promise<XlsxModule> | undefined;

function loadXlsx(): Promise<XlsxModule> {
	if (!xlsxModulePromise) {
		xlsxModulePromise = import("xlsx").catch((error: unknown) => {
			xlsxModulePromise = undefined;
			const detail = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Optional Excel adapter 'xlsx' is not installed. Install SheetJS ('xlsx') to enable .xlsx tabular sync targets. (${detail})`,
			);
		});
	}
	return xlsxModulePromise;
}

type CellValue = string | number | boolean | null;
type SheetMatrix = CellValue[][];

const workbookMetadataColumns = [
	"tableIdentifier",
	"tableId",
	"sheetName",
	"description",
	"lastSyncedAt",
	"rowCount",
];
const schemaMetadataColumns = [
	"tableIdentifier",
	"sheetName",
	"columnName",
	"sourceType",
	"sourceKey",
	"dataType",
	"required",
	"searchable",
	"order",
];

export class ExcelFileGateway implements TabularDestinationGateway {
	private readonly matrixSerializer = new SheetMatrixSerializer();

	supports(selection: ResolvedSyncTargetSelection): boolean {
		return selection.target.kind === "excel-file";
	}

	async readRows(
		selection: ResolvedSyncTargetSelection,
	): Promise<ExcelTableRow[]> {
		const workbookPath = this.workbookPath(selection);
		const XLSX = await loadXlsx();
		const workbook = await this.readWorkbook(XLSX, workbookPath);
		if (!workbook) return [];

		return this.matrixSerializer.fromMatrix(
			this.readMatrix(XLSX, workbook, selection.sheetName),
		);
	}

	async verifyWritable(selection: ResolvedSyncTargetSelection): Promise<void> {
		const workbookPath = this.workbookPath(selection);
		const XLSX = await loadXlsx();
		await this.readWorkbook(XLSX, workbookPath);

		const temporaryPath = `${workbookPath}.${randomUUID()}.probe`;
		await mkdir(dirname(workbookPath), { recursive: true });
		try {
			await writeFile(temporaryPath, new Uint8Array());
		} finally {
			await rm(temporaryPath, { force: true });
		}
	}

	async writeSheet(plan: TabularWritePlan): Promise<void> {
		const workbookPath = this.workbookPath(plan.selection);
		const XLSX = await loadXlsx();
		const workbook =
			(await this.readWorkbook(XLSX, workbookPath)) || XLSX.utils.book_new();
		const tableMatrix = this.matrixSerializer.toMatrix(plan.schema, plan.rows);

		this.replaceSheet(XLSX, workbook, plan.selection.sheetName, tableMatrix);
		this.upsertMetadataRows(
			XLSX,
			workbook,
			plan.metadataUpdate.metadataSheetName,
			workbookMetadataColumns,
			plan.metadataUpdate.tableRows.map((row) => this.toCellRecord(row)),
			"tableIdentifier",
		);
		this.upsertMetadataRows(
			XLSX,
			workbook,
			plan.metadataUpdate.schemaSheetName,
			schemaMetadataColumns,
			plan.metadataUpdate.schemaRows.map((row) => this.toCellRecord(row)),
			"tableIdentifier",
		);

		await this.writeWorkbookAtomically(
			XLSX,
			workbookPath,
			workbook,
			plan.selection.sheetName,
		);
	}

	private workbookPath(selection: ResolvedSyncTargetSelection): string {
		if (
			selection.target.kind !== "excel-file" ||
			!selection.target.workbookPath.trim()
		) {
			throw new Error(
				`Excel target '${selection.target.id}' requires a workbookPath.`,
			);
		}

		const extension = extname(selection.target.workbookPath).toLowerCase();
		if (extension !== ".xlsx") {
			throw new Error(
				`Excel target '${selection.target.id}' must use a .xlsx workbookPath.`,
			);
		}

		return selection.target.workbookPath;
	}

	private async readWorkbook(
		XLSX: XlsxModule,
		workbookPath: string,
	): Promise<WorkBook | null> {
		if (!existsSync(workbookPath)) return null;
		const content = await readFile(workbookPath);
		return XLSX.read(content, { type: "buffer" });
	}

	private readMatrix(
		XLSX: XlsxModule,
		workbook: WorkBook,
		sheetName: string,
	): SheetMatrix {
		const sheet = workbook.Sheets[sheetName];
		if (!sheet) return [];

		return XLSX.utils
			.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
			.map((row) => row.map((cell) => this.toCellValue(cell)));
	}

	private replaceSheet(
		XLSX: XlsxModule,
		workbook: WorkBook,
		sheetName: string,
		matrix: SheetMatrix,
	): void {
		workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(matrix);
		if (!workbook.SheetNames.includes(sheetName))
			workbook.SheetNames.push(sheetName);
	}

	private upsertMetadataRows(
		XLSX: XlsxModule,
		workbook: WorkBook,
		sheetName: string,
		columns: string[],
		rows: Array<Record<string, CellValue | undefined>>,
		keyColumn: string,
	): void {
		const existingRows = this.toRecords(
			this.readMatrix(XLSX, workbook, sheetName),
			columns,
		);
		const replacements = new Map(
			rows.map((row) => [String(row[keyColumn] || ""), row]),
		);
		const retained = existingRows.filter(
			(row) => !replacements.has(String(row[keyColumn] || "")),
		);
		const merged = [...retained, ...rows].sort((left, right) =>
			String(left[keyColumn] || "").localeCompare(
				String(right[keyColumn] || ""),
			),
		);
		const matrix: SheetMatrix = [
			columns,
			...merged.map((row) => columns.map((column) => row[column] ?? null)),
		];

		this.replaceSheet(XLSX, workbook, sheetName, matrix);
	}

	private toRecords(
		matrix: SheetMatrix,
		fallbackColumns: string[],
	): Array<Record<string, CellValue>> {
		const [header, ...rows] = matrix;
		const columns = header?.length
			? header.map((column) => String(column || ""))
			: fallbackColumns;
		if (columns.length === 0) return [];

		return rows
			.filter((row) => row.some((value) => value !== null && value !== ""))
			.map((row) =>
				Object.fromEntries(
					columns.map((column, index) => [column, row[index] ?? null]),
				),
			);
	}

	private async writeWorkbookAtomically(
		XLSX: XlsxModule,
		workbookPath: string,
		workbook: WorkBook,
		expectedSheetName: string,
	): Promise<void> {
		const directory = dirname(workbookPath);
		const temporaryPath = `${workbookPath}.${randomUUID()}.tmp.xlsx`;
		await mkdir(directory, { recursive: true });

		try {
			const output = XLSX.write(workbook, {
				bookType: "xlsx",
				type: "buffer",
				compression: true,
			});
			await writeFile(temporaryPath, output);

			const verifiedWorkbook = await this.readWorkbook(XLSX, temporaryPath);
			if (!verifiedWorkbook?.Sheets[expectedSheetName]) {
				throw new Error(
					`Excel workbook verification failed for sheet '${expectedSheetName}'.`,
				);
			}

			await rename(temporaryPath, workbookPath);
		} catch (error) {
			await rm(temporaryPath, { force: true });
			throw error;
		}
	}

	private toCellValue(value: unknown): CellValue {
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			value === null
		) {
			return value;
		}
		return value === undefined ? null : String(value);
	}

	private toCellRecord(value: object): Record<string, CellValue | undefined> {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				item === undefined ? undefined : this.toCellValue(item),
			]),
		);
	}
}
