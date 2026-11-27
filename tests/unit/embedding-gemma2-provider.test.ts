import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import type { EmbedNodesUseCase } from '@/application/use-cases/nodes/EmbedNodes.js'
import { createPortableGraphNode } from '@/infrastructure/container/PortableBootstrap.js'
import { Database as NodeSqliteDatabase } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import {
  EMBEDDING_GEMMA_2_MODEL_ID,
  EmbeddingGemma2Provider,
  assertValidEmbeddingGemma2Dtype,
  createDeterministicHashEmbeddingBackend,
  createHttpEmbeddingGemma2Backend,
  createTransformersJsEmbeddingGemma2Backend,
  formatEmbeddingGemma2Prompt,
  truncateAndNormalizeMrl,
} from '@/infrastructure/embeddings/EmbeddingGemma2Provider.js'
import { computeFloat32Norm } from '@/domain/services/vector/ExactVectorIndex.js'
import {
  constantTimeEqual,
  decodeBase64,
  encodeBase64,
  sha256Base64Url,
  sha256Hex,
} from '@/shared/utils/portableHash.js'

function unitVectorAt(index: number, dim = 768): number[] {
  const vec = new Array<number>(dim).fill(0)
  vec[index] = 1
  return vec
}

describe('Portable Hash & google/embeddinggemma-2 Provider', () => {
  test('matches Node node:crypto SHA-256 hex/base64url bit-for-bit and checks constantTimeEqual', () => {
    const samples = [
      '',
      'bun-graph-db',
      '{"hello":"world","count":42}',
      `한글과 UTF-8 멀티바이트 🚀 엔트로피 테스트 ${'x'.repeat(256)}`,
    ]
    for (const sample of samples) {
      const nodeHex = createHash('sha256').update(sample).digest('hex')
      const nodeB64Url = createHash('sha256').update(sample).digest('base64url')
      expect(sha256Hex(sample)).toBe(nodeHex)
      expect(sha256Base64Url(sample)).toBe(nodeB64Url)
    }

    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes)
    expect(constantTimeEqual('secret-token-1', 'secret-token-1')).toBe(true)
    expect(constantTimeEqual('secret-token-1', 'secret-token-2')).toBe(false)
    expect(constantTimeEqual('short', 'longer')).toBe(false)
  })

  test('formats all 8 google/embeddinggemma-2 task prompt templates and media rules', () => {
    expect(
      formatEmbeddingGemma2Prompt({
        task: 'retrieval_query',
        text: 'hybrid search architecture',
      }),
    ).toBe('task: search result | query: hybrid search architecture')

    expect(
      formatEmbeddingGemma2Prompt({
        task: 'retrieval_document',
        title: 'MRL Guide',
        text: 'Truncate then re-normalize.',
      }),
    ).toBe('title: MRL Guide | text: Truncate then re-normalize.')

    expect(
      formatEmbeddingGemma2Prompt({
        task: 'retrieval_document',
        text: 'Untitled note',
      }),
    ).toBe('title: none | text: Untitled note')

    expect(
      formatEmbeddingGemma2Prompt({ task: 'question_answering', text: 'What is LCA?' }),
    ).toBe('task: question answering | query: What is LCA?')
    expect(
      formatEmbeddingGemma2Prompt({ task: 'fact_verification', text: 'DO allows 100 params.' }),
    ).toBe('task: fact checking | query: DO allows 100 params.')
    expect(
      formatEmbeddingGemma2Prompt({ task: 'classification', text: 'BUG' }),
    ).toBe('task: classification | query: BUG')
    expect(
      formatEmbeddingGemma2Prompt({ task: 'clustering', text: 'graph' }),
    ).toBe('task: clustering | query: graph')
    expect(
      formatEmbeddingGemma2Prompt({ task: 'semantic_similarity', text: 'node edge' }),
    ).toBe('task: sentence similarity | query: node edge')
    expect(
      formatEmbeddingGemma2Prompt({ task: 'code_retrieval', text: 'WebSqliteDatabase' }),
    ).toBe('task: code retrieval | query: WebSqliteDatabase')

    // Raw media inputs take no text prefix
    expect(
      formatEmbeddingGemma2Prompt({
        media: { kind: 'image', payload: new Uint8Array([1, 2, 3]) },
      }),
    ).toBe('')
  })

  test('enforces Matryoshka (MRL) 768/512/256/128 truncation with L2 re-normalization and rejects fp16 / NaN', () => {
    const raw768 = Array.from({ length: 768 }, (_, idx) => (idx < 256 ? idx + 1 : 99))
    for (const dim of [768, 512, 256, 128] as const) {
      const mrl = truncateAndNormalizeMrl(raw768, dim)
      expect(mrl.vector).toHaveLength(dim)
      expect(mrl.norm).toBeCloseTo(1, 5)
      expect(computeFloat32Norm(mrl.vector)).toBeCloseTo(1, 5)
    }

    expect(() => assertValidEmbeddingGemma2Dtype('fp16')).toThrow(/NaN/)
    expect(() => assertValidEmbeddingGemma2Dtype('q4')).not.toThrow()
    expect(() => truncateAndNormalizeMrl([1, Number.NaN, ...new Array(126).fill(0)], 128)).toThrow(
      /Non-finite/,
    )
    expect(() => truncateAndNormalizeMrl([1, 2, 3], 128)).toThrow(/smaller than/)
  })

  test('supports Transformers.js (WebGPU/WASM), OpenAI HTTP, and Ollama HTTP backends', async () => {
    const capturedPrompts: string[] = []
    const transformersProvider = new EmbeddingGemma2Provider({
      dimension: 256,
      dtype: 'q4',
      backend: createTransformersJsEmbeddingGemma2Backend(async (inputs, opts) => {
        expect(opts?.pooling).toBe('mean')
        expect(opts?.normalize).toBe(true)
        const list = Array.isArray(inputs) ? inputs : [inputs]
        capturedPrompts.push(...list)
        return {
          tolist: () => list.map((_, i) => unitVectorAt(i, 768)),
        }
      }),
    })

    const tRes = await transformersProvider.embedBatch([
      { task: 'retrieval_document', title: 'Alpha', text: 'First document' },
      { task: 'retrieval_query', text: 'find alpha' },
    ])
    expect(capturedPrompts).toEqual([
      'title: Alpha | text: First document',
      'task: search result | query: find alpha',
    ])
    expect(tRes).toHaveLength(2)
    expect(tRes[0]?.dimension).toBe(256)
    expect(tRes[0]?.model).toBe(EMBEDDING_GEMMA_2_MODEL_ID)
    expect(tRes[0]?.norm).toBeCloseTo(1, 5)

    // OpenAI HTTP backend + index sorting
    const openaiProvider = new EmbeddingGemma2Provider({
      dimension: 128,
      backend: createHttpEmbeddingGemma2Backend({
        endpoint: 'https://embed.local/v1/embeddings',
        format: 'openai',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              data: [
                { index: 1, embedding: unitVectorAt(1, 768) },
                { index: 0, embedding: unitVectorAt(0, 768) },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      }),
    })
    const oaiRes = await openaiProvider.embedBatch([
      { task: 'retrieval_document', text: 'doc 0' },
      { task: 'retrieval_document', text: 'doc 1' },
    ])
    expect(oaiRes[0]?.vector[0]).toBeCloseTo(1, 5)
    expect(oaiRes[1]?.vector[1]).toBeCloseTo(1, 5)

    // Ollama /api/embed backend
    const ollamaProvider = new EmbeddingGemma2Provider({
      dimension: 512,
      backend: createHttpEmbeddingGemma2Backend({
        endpoint: 'http://127.0.0.1:11434/api/embed',
        format: 'ollama',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              embeddings: [unitVectorAt(7, 768)],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      }),
    })
    const ollamaRes = await ollamaProvider.embed({ task: 'retrieval_query', text: 'hello' })
    expect(ollamaRes.dimension).toBe(512)
    expect(ollamaRes.vector[7]).toBeCloseTo(1, 5)
  })

  test('EmbedNodesUseCase & HybridSearchNodes auto-embed text queries seamlessly via PortableBootstrap', async () => {
    const raw = new DatabaseSync(':memory:')
    expect(raw).toBeTruthy()
    raw.close()

    const db = new NodeSqliteDatabase(':memory:')
    const provider = new EmbeddingGemma2Provider({
      dimension: 256,
      dtype: 'bf16',
      backend: createDeterministicHashEmbeddingBackend(768),
    })

    const node = await createPortableGraphNode(db, {
      databaseLabel: ':gemma2:test:',
      embeddingProvider: provider,
    })

    try {
      const createdTable = await node.executeGraphQL(
        `mutation {
          createTable(input: { identifier: "gemma_notes", description: "Notes with EmbeddingGemma-2" }) {
            success
            table { id }
          }
        }`,
      )
      const tableId = (createdTable.data as { createTable: { table: { id: string } } }).createTable.table.id

      const createdNodes = await Promise.all([
        node.executeGraphQL(
          `mutation($tableId: ID!) {
            createNode(input: {
              tableId: $tableId
              title: "Matryoshka Embeddings"
              content: "EmbeddingGemma 2 slices vectors to 256 dimensions with L2 normalization"
            }) { success node { id } }
          }`,
          { tableId },
        ),
        node.executeGraphQL(
          `mutation($tableId: ID!) {
            createNode(input: {
              tableId: $tableId
              title: "Cloudflare Edge SQLite"
              content: "Durable Objects enforce a 100 bind parameter ceiling per query"
            }) { success node { id } }
          }`,
          { tableId },
        ),
      ])
      expect(
        (createdNodes[0].data as { createNode: { success: boolean } }).createNode.success,
      ).toBe(true)

      const embedder = node.embedNodes as EmbedNodesUseCase
      expect(embedder).toBeDefined()
      const batchSummary = await embedder.embedTableNodes(tableId)
      expect(batchSummary.embeddedCount).toBe(2)
      expect(batchSummary.dimension).toBe(256)
      expect(batchSummary.model).toBe(EMBEDDING_GEMMA_2_MODEL_ID)

      // HybridSearch with textQuery ONLY automatically invokes EmbeddingGemma2Provider with retrieval_query task
      const searchResult = await node.executeGraphQL(
        `query($tableId: ID!) {
          hybridSearchNodes(input: {
            tableId: $tableId
            textQuery: "Matryoshka dimensions normalization"
            limit: 2
          }) {
            results {
              node { id title }
              vectorScore
              ftsRank
              combinedScore
            }
            metrics {
              vectorCandidates
              lexicalCandidates
            }
          }
        }`,
        { tableId },
      )
      const payload = (
        searchResult.data as {
          hybridSearchNodes: {
            results: Array<{
              node: { title: string }
              vectorScore: number | null
              ftsRank: number | null
            }>
            metrics: { vectorCandidates: number; lexicalCandidates: number }
          }
        }
      ).hybridSearchNodes

      expect(payload.metrics.vectorCandidates).toBeGreaterThanOrEqual(1)
      expect(payload.results[0]?.node.title).toBe('Matryoshka Embeddings')
      expect(payload.results[0]?.vectorScore).toBeGreaterThan(0.2)
    } finally {
      await node.dispose()
      db.close()
    }
  })
})
