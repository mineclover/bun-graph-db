import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { SqliteNodeSearchRepository } from "../../src/infrastructure/database/sqlite/SqliteNodeSearchRepository";

const databases: Database[] = [];

afterEach(() => {
	databases.splice(0).forEach((database) => {
		database.close();
	});
});

describe("SqliteNodeSearchRepository full-text search", () => {
	test("uses the table-scoped FTS index for text filters", async () => {
		const db = new Database(":memory:");
		databases.push(db);
		db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE node_attributes (node_id TEXT, attribute_id TEXT, value TEXT);
      CREATE TABLE attributes (id TEXT, identifier TEXT, attribute_type_id TEXT);
      CREATE TABLE attribute_types (id TEXT, json_type TEXT);
      CREATE VIRTUAL TABLE node_search_fts USING fts5(node_id UNINDEXED, table_id UNINDEXED, content);
      INSERT INTO nodes VALUES
        ('alpha-match', 'alpha', 'release candidate ships today', 'Release', NULL, NULL, '2026-08-10', '2026-08-10'),
        ('beta-match', 'beta', 'release candidate belongs elsewhere', 'Release', NULL, NULL, '2026-08-10', '2026-08-10'),
        ('alpha-miss', 'alpha', 'unrelated note', 'Note', NULL, NULL, '2026-08-10', '2026-08-10');
      INSERT INTO node_search_fts(rowid, node_id, table_id, content)
      SELECT rowid, id, table_id, content || ' ' || title FROM nodes;
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [
					{
						logicalOperator: "and",
						filters: [
							{
								field: "_text_search",
								operator: "contains",
								value: "release candidate",
								valueType: "string",
							},
						],
					},
				],
				limit: 10,
				offset: 0,
			},
			[],
		);

		expect(result.total).toBe(1);
		expect(result.data.map((item) => item.node.getId())).toEqual([
			"alpha-match",
		]);
		expect(result.data[0]?.relevanceScore).toBeNumber();
	});

	test("matches numeric table ids stored in the affinity-free FTS table", async () => {
		const db = new Database(":memory:");
		databases.push(db);
		db.exec(`
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY,
        table_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE node_attributes (node_id INTEGER, attribute_id INTEGER, value TEXT);
      CREATE TABLE attributes (id INTEGER, identifier TEXT, attribute_type_id INTEGER);
      CREATE TABLE attribute_types (id INTEGER, json_type TEXT);
      CREATE VIRTUAL TABLE node_search_fts USING fts5(node_id UNINDEXED, table_id UNINDEXED, content);
      INSERT INTO nodes VALUES
        (1, 1, 'release candidate', 'Release', NULL, NULL, '2026-08-10', '2026-08-10'),
        (2, 2, 'release candidate', 'Other table', NULL, NULL, '2026-08-10', '2026-08-10');
      INSERT INTO node_search_fts(rowid, node_id, table_id, content)
      SELECT rowid, id, table_id, content || ' ' || title FROM nodes;
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"1",
			{ conditions: [], textSearch: "release candidate", limit: 10, offset: 0 },
			[],
		);

		expect(result.total).toBe(1);
		expect(result.data.map((item) => item.node.getId())).toEqual(["1"]);
		expect(result.data[0]?.relevanceScore).toBeNumber();
	});

	test("paginates node ids before fetching complete attribute sets", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('n1', 'alpha', 'one', 'One', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('n2', 'alpha', 'two', 'Two', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('n3', 'alpha', 'three', 'Three', NULL, NULL, '2026-08-01', '2026-08-01');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('n1', 'color', 'red'), ('n1', 'size', 'large'), ('n1', 'status', 'active'),
        ('n2', 'color', 'blue'), ('n2', 'size', 'large'), ('n2', 'status', 'active'),
        ('n3', 'color', 'green'), ('n3', 'size', 'small'), ('n3', 'status', 'inactive');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{ conditions: [], limit: 2, offset: 0 },
			[],
		);

		expect(result.total).toBe(3);
		expect(result.data).toHaveLength(2);
		expect(result.hasNextPage).toBe(true);
		expect(
			result.data.map((item) => Object.keys(item.attributes).sort()),
		).toEqual([
			["color", "size", "status"],
			["color", "size", "status"],
		]);
	});

	test("matches AND filters against independent attribute rows", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('n1', 'alpha', 'one', 'One', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('n2', 'alpha', 'two', 'Two', NULL, NULL, '2026-08-02', '2026-08-02');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('n1', 'color', 'red'), ('n1', 'size', 'large'),
        ('n2', 'color', 'red'), ('n2', 'size', 'small');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [
					{
						logicalOperator: "and",
						filters: [
							{
								field: "color",
								operator: "equals",
								value: "red",
								valueType: "string",
							},
							{
								field: "size",
								operator: "equals",
								value: "large",
								valueType: "string",
							},
						],
					},
				],
				limit: 10,
				offset: 0,
			},
			[
				{ identifier: "color", dataType: "string" },
				{ identifier: "size", dataType: "string" },
			],
		);

		expect(result.total).toBe(1);
		expect(result.data.map((item) => item.node.getId())).toEqual(["n1"]);
	});

	test("scopes attribute identifiers to the searched table", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO attributes VALUES ('beta-color', 'beta', 'color', 'string');
      INSERT INTO nodes VALUES
        ('correct-schema', 'alpha', 'one', 'One', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('wrong-schema', 'alpha', 'two', 'Two', NULL, NULL, '2026-08-02', '2026-08-02');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('correct-schema', 'color', 'red'),
        ('wrong-schema', 'beta-color', 'red');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [
					{
						logicalOperator: "and",
						filters: [
							{
								field: "color",
								operator: "equals",
								value: "red",
								valueType: "string",
							},
						],
					},
				],
				limit: 10,
				offset: 0,
			},
			[{ identifier: "color", dataType: "string" }],
		);

		expect(result.total).toBe(1);
		expect(result.data.map((item) => item.node.getId())).toEqual([
			"correct-schema",
		]);
	});

	test("unions OR filters without duplicating nodes that match both sets", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('n1', 'alpha', 'one', 'One', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('n2', 'alpha', 'two', 'Two', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('n3', 'alpha', 'three', 'Three', NULL, NULL, '2026-08-01', '2026-08-01');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('n1', 'color', 'red'), ('n1', 'size', 'large'),
        ('n2', 'color', 'blue'), ('n2', 'size', 'large'),
        ('n3', 'color', 'red'), ('n3', 'size', 'small');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [
					{
						logicalOperator: "or",
						filters: [
							{
								field: "color",
								operator: "equals",
								value: "red",
								valueType: "string",
							},
							{
								field: "size",
								operator: "equals",
								value: "large",
								valueType: "string",
							},
						],
					},
				],
				limit: 10,
				offset: 0,
			},
			[
				{ identifier: "color", dataType: "string" },
				{ identifier: "size", dataType: "string" },
			],
		);

		expect(result.total).toBe(3);
		expect(result.data.map((item) => item.node.getId()).sort()).toEqual([
			"n1",
			"n2",
			"n3",
		]);
	});

	test("sorts integer attributes numerically instead of lexicographically", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('n10', 'alpha', 'ten', 'Ten', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('n2', 'alpha', 'two', 'Two', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('n-high', 'alpha', 'high', 'High', NULL, NULL, '2026-08-01', '2026-08-01'),
        ('n-low', 'alpha', 'low', 'Low', NULL, NULL, '2026-07-31', '2026-07-31');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('n10', 'size', '10'), ('n2', 'size', '2'),
        ('n-high', 'size', '9007199254740993'),
        ('n-low', 'size', '9007199254740992');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [],
				sortBy: [{ field: "size", direction: "asc" }],
				limit: 10,
				offset: 0,
			},
			[{ identifier: "size", dataType: "integer" }],
		);

		expect(result.data.map((item) => item.node.getId())).toEqual([
			"n2",
			"n10",
			"n-low",
			"n-high",
		]);
	});

	test("combines node-field and attribute-value matches without FTS", async () => {
		const db = createAttributeSearchDatabase();
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('content-match', 'alpha', 'release candidate', 'Release', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('attribute-match', 'alpha', 'unrelated', 'Note', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('both-match', 'alpha', 'release candidate', 'Both', NULL, NULL, '2026-08-01', '2026-08-01');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('attribute-match', 'status', 'release candidate'),
        ('both-match', 'status', 'release candidate');
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{ conditions: [], textSearch: "release candidate", limit: 10, offset: 0 },
			[],
		);

		expect(result.total).toBe(3);
		expect(result.data.map((item) => item.node.getId()).sort()).toEqual([
			"attribute-match",
			"both-match",
			"content-match",
		]);
	});

	test("keeps attribute-value text matches when FTS is available", async () => {
		const db = createAttributeSearchDatabase(true);
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('content-match', 'alpha', 'release candidate', 'Release', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('attribute-match', 'alpha', 'unrelated', 'Note', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('both-match', 'alpha', 'release candidate', 'Both', NULL, NULL, '2026-08-01', '2026-08-01');
      INSERT INTO node_attributes(node_id, attribute_id, value)
      VALUES
        ('attribute-match', 'status', 'release candidate'),
        ('both-match', 'status', 'release candidate');
      INSERT INTO node_search_fts(rowid, node_id, table_id, content)
      SELECT rowid, id, table_id, content || ' ' || title FROM nodes;
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{ conditions: [], textSearch: "release candidate", limit: 10, offset: 0 },
			[],
		);

		expect(result.total).toBe(3);
		expect(result.data.map((item) => item.node.getId()).sort()).toEqual([
			"attribute-match",
			"both-match",
			"content-match",
		]);
	});

	test("keeps unranked OR-filter matches alongside ranked FTS matches", async () => {
		const db = createAttributeSearchDatabase(true);
		databases.push(db);
		db.exec(`
      INSERT INTO nodes VALUES
        ('fts-match', 'alpha', 'release candidate', 'Release', NULL, NULL, '2026-08-03', '2026-08-03'),
        ('filter-match', 'alpha', 'unrelated', 'Active', NULL, NULL, '2026-08-02', '2026-08-02'),
        ('both-match', 'alpha', 'release candidate', 'Both', NULL, NULL, '2026-08-01', '2026-08-01'),
        ('miss', 'alpha', 'unrelated', 'Miss', NULL, NULL, '2026-07-31', '2026-07-31');
      INSERT INTO node_attributes(node_id, attribute_id, value) VALUES
        ('filter-match', 'status', 'active'),
        ('both-match', 'status', 'active'),
        ('miss', 'status', 'inactive');
      INSERT INTO node_search_fts(rowid, node_id, table_id, content)
      SELECT rowid, id, table_id, content || ' ' || title FROM nodes;
    `);

		const repository = new SqliteNodeSearchRepository(db);
		const result = await repository.searchNodes(
			"alpha",
			{
				conditions: [
					{
						logicalOperator: "or",
						filters: [
							{
								field: "_text_search",
								operator: "contains",
								value: "release candidate",
								valueType: "string",
							},
							{
								field: "status",
								operator: "equals",
								value: "active",
								valueType: "string",
							},
						],
					},
				],
				limit: 10,
				offset: 0,
			},
			[{ identifier: "status", dataType: "string" }],
		);

		expect(result.total).toBe(3);
		expect(result.data.map((item) => item.node.getId()).sort()).toEqual([
			"both-match",
			"filter-match",
			"fts-match",
		]);
		expect(
			result.data.find((item) => item.node.getId() === "filter-match")
				?.relevanceScore,
		).toBeUndefined();
		expect(
			result.data.find((item) => item.node.getId() === "fts-match")
				?.relevanceScore,
		).toBeNumber();
	});
});

function createAttributeSearchDatabase(withFts = false): Database {
	const db = new Database(":memory:");
	db.exec(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      content TEXT NOT NULL,
      title TEXT,
      description TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE attribute_types (id TEXT PRIMARY KEY, json_type TEXT);
    CREATE TABLE attributes (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      identifier TEXT,
      attribute_type_id TEXT,
      UNIQUE(table_id, identifier)
    );
    CREATE TABLE node_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT,
      attribute_id TEXT,
      value TEXT,
      UNIQUE(node_id, attribute_id)
    );
    CREATE INDEX idx_node_attributes_attr_value_node
      ON node_attributes(attribute_id, value, node_id);
    INSERT INTO attribute_types VALUES ('string', 'string');
    INSERT INTO attributes VALUES
      ('color', 'alpha', 'color', 'string'),
      ('size', 'alpha', 'size', 'string'),
      ('status', 'alpha', 'status', 'string');
  `);
	if (withFts) {
		db.exec(
			"CREATE VIRTUAL TABLE node_search_fts USING fts5(node_id UNINDEXED, table_id UNINDEXED, content)",
		);
	}
	return db;
}
