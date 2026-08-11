#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateOpenApiProjection } from "@oa-sdk/openapi-projection-contract";
import { buildBunGraphDbOpenApiDocument } from "../src/core/schema/BunGraphDbOpenApiDocument.js";
import {
	toTableSchemaOpenApiOperationContractProjectionResult,
	toTableSchemaOpenApiProjectionResult,
} from "../src/core/schema/TableSchemaOpenApiProjection.js";
import { projectTableSchema } from "../src/core/schema/TableSchemaProjection.js";
import {
	createOaSdkProjectionFixture,
	OA_SDK_PROJECTION_FIXTURE_ID,
} from "./fixtures/oa-sdk-projection-fixture.js";

/**
 * Cross-repository validation evidence only. These files are never an authored
 * TypeSpec input or an OA SDK approved OpenAPI snapshot.
 */
export const OA_SDK_PROJECTION_ARTIFACT_SCHEMA =
	"bun-graph-db.oa-sdk-projection-artifacts.v1";

export const OA_SDK_PROJECTION_ARTIFACT_FILES = [
	"bun-graph-db.openapi.json",
	"project_tasks.component-bundle.envelope.json",
	"project_tasks.component-bundle.openapi.json",
	"project_tasks.operation-contract.envelope.json",
	"project_tasks.operation-contract.openapi.json",
	"manifest.json",
] as const;

type ArtifactFileName = (typeof OA_SDK_PROJECTION_ARTIFACT_FILES)[number];
type ContentFileName = Exclude<ArtifactFileName, "manifest.json">;

export interface ProjectionArtifactManifest {
	schemaVersion: typeof OA_SDK_PROJECTION_ARTIFACT_SCHEMA;
	fixtureId: typeof OA_SDK_PROJECTION_FIXTURE_ID;
	projectionVersionHash: string;
	artifacts: Array<{
		path: ContentFileName;
		bytes: number;
		sha256: string;
	}>;
}

export type ProjectionArtifactFiles = Readonly<
	Record<ArtifactFileName, string>
>;

export function createProjectionArtifactFiles(): ProjectionArtifactFiles {
	const tableProjection = projectTableSchema(createOaSdkProjectionFixture());
	const componentEnvelope =
		toTableSchemaOpenApiProjectionResult(tableProjection);
	const operationEnvelope =
		toTableSchemaOpenApiOperationContractProjectionResult(tableProjection);
	const fullDocument = buildBunGraphDbOpenApiDocument();

	assertValidProjection("component-bundle", componentEnvelope);
	assertValidProjection("operation-contract", operationEnvelope);
	assertValidProjection("full-api-document", {
		profile: "full-api-document",
		projection: fullDocument,
		refs: [],
		diagnostics: [],
		sources: {},
		versionHash: sha256(canonicalJson(fullDocument)),
	});

	if (componentEnvelope.versionHash !== operationEnvelope.versionHash) {
		throw new Error(
			"Component and operation projections must share one table projection versionHash",
		);
	}

	const contentFiles: Record<ContentFileName, string> = {
		"bun-graph-db.openapi.json": canonicalJson(fullDocument),
		"project_tasks.component-bundle.envelope.json":
			canonicalJson(componentEnvelope),
		"project_tasks.component-bundle.openapi.json": canonicalJson(
			componentEnvelope.projection,
		),
		"project_tasks.operation-contract.envelope.json":
			canonicalJson(operationEnvelope),
		"project_tasks.operation-contract.openapi.json": canonicalJson(
			operationEnvelope.projection,
		),
	};
	const manifest: ProjectionArtifactManifest = {
		schemaVersion: OA_SDK_PROJECTION_ARTIFACT_SCHEMA,
		fixtureId: OA_SDK_PROJECTION_FIXTURE_ID,
		projectionVersionHash: tableProjection.versionHash,
		artifacts: (Object.keys(contentFiles) as ContentFileName[])
			.sort()
			.map((path) => ({
				path,
				bytes: Buffer.byteLength(contentFiles[path]),
				sha256: sha256(contentFiles[path]),
			})),
	};

	return {
		...contentFiles,
		"manifest.json": canonicalJson(manifest),
	};
}

export function verifyProjectionArtifactDeterminism(): ProjectionArtifactFiles {
	const first = createProjectionArtifactFiles();
	const second = createProjectionArtifactFiles();

	for (const path of OA_SDK_PROJECTION_ARTIFACT_FILES) {
		if (first[path] !== second[path]) {
			throw new Error(`Projection artifact is not deterministic: ${path}`);
		}
	}
	return first;
}

export function writeProjectionArtifacts(
	outputDirectory: string,
	files = verifyProjectionArtifactDeterminism(),
): string[] {
	const target = resolve(outputDirectory);
	mkdirSync(target, { recursive: true });

	return OA_SDK_PROJECTION_ARTIFACT_FILES.map((path) => {
		const outputPath = resolve(target, path);
		writeFileSync(outputPath, files[path], "utf8");
		return outputPath;
	});
}

export function canonicalJson(value: unknown): string {
	return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

export function sha256(content: string): string {
	return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		console.log(
			"Usage: bun run scripts/export-oa-sdk-projection-artifacts.ts --out <directory>",
		);
		return;
	}

	const outputDirectory = readRequiredOption(args, "--out");
	const paths = writeProjectionArtifacts(outputDirectory);
	console.log(
		`Wrote ${paths.length} deterministic OA SDK projection artifacts:`,
	);
	for (const path of paths) console.log(`  ${path}`);
}

function assertValidProjection(label: string, value: unknown): void {
	const result = validateOpenApiProjection(value);
	if (result.valid) return;

	const details = result.diagnostics
		.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
		.join("; ");
	throw new Error(`${label} projection validation failed: ${details}`);
}

function sortJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortJson);
	if (value instanceof Date) return value.toISOString();
	if (!isRecord(value)) return value;

	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort()) {
		const child = value[key];
		if (child !== undefined) result[key] = sortJson(child);
	}
	return result;
}

function readRequiredOption(args: readonly string[], name: string): string {
	const index = args.indexOf(name);
	const value = index === -1 ? undefined : args[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(
			`${name} is required and must name an explicit output directory`,
		);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (import.meta.main) {
	await main();
}
