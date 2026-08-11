import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateOpenApiProjection } from "@oa-sdk/openapi-projection-contract";
import {
	createProjectionArtifactFiles,
	OA_SDK_PROJECTION_ARTIFACT_FILES,
	OA_SDK_PROJECTION_ARTIFACT_SCHEMA,
	type ProjectionArtifactManifest,
	verifyProjectionArtifactDeterminism,
	writeProjectionArtifacts,
} from "../../scripts/export-oa-sdk-projection-artifacts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("OA SDK projection artifacts", () => {
	test("uses production projection builders and shared validation", () => {
		const files = createProjectionArtifactFiles();
		const fullDocument = parseJson(files["bun-graph-db.openapi.json"]);
		const componentEnvelope = parseJson(
			files["project_tasks.component-bundle.envelope.json"],
		);
		const operationEnvelope = parseJson(
			files["project_tasks.operation-contract.envelope.json"],
		);

		expect(validateOpenApiProjection(componentEnvelope)).toEqual({
			valid: true,
			diagnostics: [],
		});
		expect(validateOpenApiProjection(operationEnvelope)).toEqual({
			valid: true,
			diagnostics: [],
		});
		expect(fullDocument).toEqual(
			expect.objectContaining({
				openapi: "3.2.0",
				paths: expect.objectContaining({
					"/api/openapi": expect.any(Object),
					"/api/tables/{tableId}/openapi-projection": expect.any(Object),
				}),
			}),
		);
		expect(operationEnvelope).toEqual(
			expect.objectContaining({
				profile: "operation-contract",
				projection: expect.objectContaining({
					paths: expect.objectContaining({
						"/schema-engine/tables/project_tasks/nodes": expect.any(Object),
						"/schema-engine/tables/project_tasks/nodes/{nodeId}":
							expect.any(Object),
					}),
				}),
			}),
		);
	});

	test("produces identical canonical bytes across independent generations", () => {
		const first = createProjectionArtifactFiles();
		const second = verifyProjectionArtifactDeterminism();

		expect(Object.keys(first).sort()).toEqual(
			[...OA_SDK_PROJECTION_ARTIFACT_FILES].sort(),
		);
		for (const path of OA_SDK_PROJECTION_ARTIFACT_FILES) {
			expect(second[path]).toBe(first[path]);
			expect(first[path].endsWith("\n")).toBe(true);
		}
	});

	test("writes two byte-identical directories with a verifiable hash manifest", () => {
		const firstDirectory = temporaryDirectory();
		const secondDirectory = temporaryDirectory();
		writeProjectionArtifacts(firstDirectory);
		writeProjectionArtifacts(secondDirectory);

		for (const path of OA_SDK_PROJECTION_ARTIFACT_FILES) {
			expect(readFileSync(join(firstDirectory, path))).toEqual(
				readFileSync(join(secondDirectory, path)),
			);
		}

		const manifest = JSON.parse(
			readFileSync(join(firstDirectory, "manifest.json"), "utf8"),
		) as ProjectionArtifactManifest;
		expect(manifest.schemaVersion).toBe(OA_SDK_PROJECTION_ARTIFACT_SCHEMA);
		expect(manifest.fixtureId).toBe("project_tasks/v1");
		expect(manifest.projectionVersionHash).toMatch(/^[a-f0-9]{8}$/);

		for (const artifact of manifest.artifacts) {
			const content = readFileSync(join(firstDirectory, artifact.path));
			expect(artifact.bytes).toBe(content.byteLength);
			expect(artifact.sha256).toBe(
				`sha256:${createHash("sha256").update(content).digest("hex")}`,
			);
		}
	});

	test("keeps execution metadata out of canonical evidence", () => {
		const files = createProjectionArtifactFiles();
		const manifest = parseJson(files["manifest.json"]);

		expect(manifest).not.toHaveProperty("generatedAt");
		expect(manifest).not.toHaveProperty("commit");
		expect(files["manifest.json"]).not.toContain(process.cwd());
	});
});

function temporaryDirectory(): string {
	const directory = mkdtempSync(
		join(tmpdir(), "bun-graph-db-oa-sdk-artifacts-"),
	);
	temporaryDirectories.push(directory);
	return directory;
}

function parseJson(value: string): Record<string, unknown> {
	return JSON.parse(value) as Record<string, unknown>;
}
