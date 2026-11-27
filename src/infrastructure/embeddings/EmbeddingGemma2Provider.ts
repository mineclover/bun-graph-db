import type {
  EmbeddingInput,
  EmbeddingResult,
  EmbeddingTaskType,
  IEmbeddingProvider,
} from '@/domain/ports/IEmbeddingProvider.js'
import { computeFloat32Norm } from '@/domain/services/vector/ExactVectorIndex.js'

export const EMBEDDING_GEMMA_2_MODEL_ID = 'google/embeddinggemma-2'
export const EMBEDDING_GEMMA_2_ONNX_MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX'
export const EMBEDDING_GEMMA_2_DIMENSIONS = [768, 512, 256, 128] as const

export type EmbeddingGemma2Dimension = (typeof EMBEDDING_GEMMA_2_DIMENSIONS)[number]
export type EmbeddingGemma2Dtype = 'fp32' | 'bf16' | 'q8' | 'q4'

export interface EmbeddingGemma2BackendRequest {
  prompt: string
  rawInput: EmbeddingInput
  modelId: string
  dtype: EmbeddingGemma2Dtype
}

export interface EmbeddingGemma2Backend {
  embedBatch(requests: readonly EmbeddingGemma2BackendRequest[]): Promise<number[][]>
}

export interface EmbeddingGemma2ProviderOptions {
  modelId?: string
  dimension?: EmbeddingGemma2Dimension
  dtype?: EmbeddingGemma2Dtype
  backend: EmbeddingGemma2Backend
}

export function assertValidEmbeddingGemma2Dtype(dtype: string): EmbeddingGemma2Dtype {
  if (dtype === 'fp16' || dtype === 'float16') {
    throw new Error(
      'google/embeddinggemma-2 activations do not support float16 (produces NaN); use bf16, fp32, q8, or q4.',
    )
  }
  if (dtype === 'fp32' || dtype === 'bf16' || dtype === 'q8' || dtype === 'q4') {
    return dtype
  }
  throw new Error(
    `Unsupported EmbeddingGemma-2 dtype '${dtype}'. Expected 'fp32', 'bf16', 'q8', or 'q4'.`,
  )
}

export function isValidEmbeddingGemma2Dimension(value: number): value is EmbeddingGemma2Dimension {
  return (EMBEDDING_GEMMA_2_DIMENSIONS as readonly number[]).includes(value)
}

/**
 * Formats official `google/embeddinggemma-2` asymmetric/symmetric task prompt prefixes.
 * Raw media-only inputs receive an empty string per model card requirements.
 */
export function formatEmbeddingGemma2Prompt(input: EmbeddingInput): string {
  const rawText = input.text?.trim() ?? ''
  if (input.media && rawText.length === 0) {
    return ''
  }

  const task: EmbeddingTaskType = input.task ?? 'retrieval_document'
  switch (task) {
    case 'retrieval_document': {
      const cleanTitle = input.title?.trim()
      return `title: ${cleanTitle && cleanTitle.length > 0 ? cleanTitle : 'none'} | text: ${rawText}`
    }
    case 'retrieval_query':
      return `task: search result | query: ${rawText}`
    case 'question_answering':
      return `task: question answering | query: ${rawText}`
    case 'fact_verification':
      return `task: fact checking | query: ${rawText}`
    case 'classification':
      return `task: classification | query: ${rawText}`
    case 'clustering':
      return `task: clustering | query: ${rawText}`
    case 'semantic_similarity':
      return `task: sentence similarity | query: ${rawText}`
    case 'code_retrieval':
      return `task: code retrieval | query: ${rawText}`
  }
}

/**
 * Applies Matryoshka Representation Learning (MRL) prefix truncation and L2 unit re-normalization.
 */
export function truncateAndNormalizeMrl(
  vector: ArrayLike<number>,
  targetDimension: EmbeddingGemma2Dimension = 768,
): { vector: number[]; norm: number } {
  if (!isValidEmbeddingGemma2Dimension(targetDimension)) {
    throw new Error(
      `Invalid MRL dimension ${targetDimension}; expected one of ${EMBEDDING_GEMMA_2_DIMENSIONS.join(', ')}.`,
    )
  }
  if (vector.length < targetDimension) {
    throw new Error(
      `Embedding vector length (${vector.length}) is smaller than target MRL dimension (${targetDimension}).`,
    )
  }

  const sliced = new Array<number>(targetDimension)
  for (let i = 0; i < targetDimension; i += 1) {
    const val = Number(vector[i])
    if (!Number.isFinite(val)) {
      throw new Error(`Non-finite embedding value at index ${i}: ${String(vector[i])}`)
    }
    sliced[i] = val
  }

  const rawNorm = computeFloat32Norm(Float32Array.from(sliced))
  if (rawNorm === 0) {
    return { vector: sliced, norm: 0 }
  }

  const normalized = new Array<number>(targetDimension)
  for (let i = 0; i < targetDimension; i += 1) {
    normalized[i] = (sliced[i] as number) / rawNorm
  }
  return {
    vector: normalized,
    norm: computeFloat32Norm(Float32Array.from(normalized)),
  }
}

export class EmbeddingGemma2Provider implements IEmbeddingProvider {
  readonly modelId: string
  readonly dimension: EmbeddingGemma2Dimension
  readonly dtype: EmbeddingGemma2Dtype
  private readonly backend: EmbeddingGemma2Backend

  constructor(options: EmbeddingGemma2ProviderOptions) {
    this.modelId = options.modelId?.trim() || EMBEDDING_GEMMA_2_MODEL_ID
    const dimension = options.dimension ?? 768
    if (!isValidEmbeddingGemma2Dimension(dimension)) {
      throw new Error(
        `Invalid EmbeddingGemma-2 dimension ${dimension}; expected 768, 512, 256, or 128.`,
      )
    }
    this.dimension = dimension
    this.dtype = assertValidEmbeddingGemma2Dtype(options.dtype ?? 'bf16')
    this.backend = options.backend
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingResult> {
    const [result] = await this.embedBatch([input])
    if (!result) {
      throw new Error('EmbeddingGemma2Provider backend returned empty result')
    }
    return result
  }

  async embedBatch(inputs: readonly EmbeddingInput[]): Promise<EmbeddingResult[]> {
    if (inputs.length === 0) return []
    const requests: EmbeddingGemma2BackendRequest[] = inputs.map((rawInput) => ({
      prompt: formatEmbeddingGemma2Prompt(rawInput),
      rawInput,
      modelId: this.modelId,
      dtype: this.dtype,
    }))
    const rawVectors = await this.backend.embedBatch(requests)
    if (rawVectors.length !== inputs.length) {
      throw new Error(
        `EmbeddingGemma2Provider expected ${inputs.length} vectors from backend, got ${rawVectors.length}.`,
      )
    }
    return rawVectors.map((rawVector) => {
      const { vector, norm } = truncateAndNormalizeMrl(rawVector, this.dimension)
      return {
        vector,
        dimension: this.dimension,
        model: this.modelId,
        norm,
      }
    })
  }
}

export interface TransformersJsTensorLike {
  tolist?: () => number[][] | number[]
  data?: Float32Array | number[]
  dims?: readonly number[]
}

export type TransformersJsFeatureExtractor = (
  inputs: string | string[],
  options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean },
) => Promise<TransformersJsTensorLike>

function extractTensorRows(tensor: TransformersJsTensorLike, batchCount: number): number[][] {
  if (typeof tensor.tolist === 'function') {
    const listed = tensor.tolist()
    if (listed.length === 0) return []
    if (Array.isArray(listed[0])) {
      return (listed as number[][]).map((row) => row.map(Number))
    }
    return [(listed as number[]).map(Number)]
  }
  if (tensor.data && batchCount > 0) {
    const width = Math.floor(tensor.data.length / batchCount)
    const rows: number[][] = []
    for (let b = 0; b < batchCount; b += 1) {
      const row = new Array<number>(width)
      for (let i = 0; i < width; i += 1) {
        row[i] = Number(tensor.data[b * width + i])
      }
      rows.push(row)
    }
    return rows
  }
  throw new Error('Transformers.js extractor output must provide tolist() or typed data[]')
}

/**
 * Adapter over `@huggingface/transformers` v3 `pipeline('feature-extraction', 'onnx-community/embeddinggemma-2-ONNX', ...)`.
 */
export function createTransformersJsEmbeddingGemma2Backend(
  extractorOrLoader:
    | TransformersJsFeatureExtractor
    | (() => Promise<TransformersJsFeatureExtractor>),
  options: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean } = {},
): EmbeddingGemma2Backend {
  let cachedExtractor: TransformersJsFeatureExtractor | null =
    typeof extractorOrLoader === 'function' && extractorOrLoader.length > 0
      ? (extractorOrLoader as TransformersJsFeatureExtractor)
      : null
  let pendingExtractor: Promise<TransformersJsFeatureExtractor> | null = null

  const resolveExtractor = async (): Promise<TransformersJsFeatureExtractor> => {
    if (cachedExtractor) return cachedExtractor
    if (pendingExtractor) return await pendingExtractor
    if (typeof extractorOrLoader === 'function') {
      // Distinguish 0-arg loader factory vs function with optional args when tagged or returning Promise<function>
      const maybeResult = await (
        extractorOrLoader as (
          inputs?: string | string[],
          opts?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean },
        ) => Promise<TransformersJsFeatureExtractor | TransformersJsTensorLike>
      )(['__probe__'], undefined).catch(() => null)
      if (typeof maybeResult === 'function') {
        cachedExtractor = maybeResult
        return cachedExtractor
      }
    }
    pendingExtractor = (extractorOrLoader as () => Promise<TransformersJsFeatureExtractor>)()
    const resolved = await pendingExtractor
    cachedExtractor = resolved
    return resolved
  }

  return {
    async embedBatch(requests: readonly EmbeddingGemma2BackendRequest[]): Promise<number[][]> {
      const extractor = await resolveExtractor()
      const prompts = requests.map((req) => req.prompt)
      const tensor = await extractor(prompts, {
        pooling: options.pooling ?? 'mean',
        normalize: options.normalize ?? true,
      })
      return extractTensorRows(tensor, prompts.length)
    },
  }
}

export interface HttpEmbeddingGemma2BackendOptions {
  endpoint: string
  format?: 'openai' | 'ollama'
  model?: string
  headers?: Record<string, string>
  fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}

export function createHttpEmbeddingGemma2Backend(
  options: HttpEmbeddingGemma2BackendOptions,
): EmbeddingGemma2Backend {
  const format = options.format ?? 'openai'
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    async embedBatch(requests: readonly EmbeddingGemma2BackendRequest[]): Promise<number[][]> {
      const model = options.model ?? requests[0]?.modelId ?? EMBEDDING_GEMMA_2_MODEL_ID
      const inputs = requests.map((r) => r.prompt)
      const payload =
        format === 'ollama'
          ? { model, input: inputs }
          : { model, input: inputs, encoding_format: 'float' }

      const response = await fetchImpl(options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP embedding request failed (${response.status}): ${text}`)
      }
      const json = (await response.json()) as {
        embeddings?: number[][]
        data?: Array<{ embedding: number[]; index?: number }>
      }
      if (format === 'ollama' || Array.isArray(json.embeddings)) {
        if (!Array.isArray(json.embeddings)) {
          throw new Error('Ollama embedding response missing embeddings array')
        }
        return json.embeddings
      }
      if (!Array.isArray(json.data)) {
        throw new Error('OpenAI-compatible embedding response missing data array')
      }
      return [...json.data]
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding)
    },
  }
}

/**
 * Deterministic non-neural signed-hash feature projection backend for local tests and offline sandboxes.
 * Preserves semantic keyword/trigram overlap so `google/embeddinggemma-2` prompt & MRL pipelines can be
 * exercised without external model weights.
 */
export function createDeterministicHashEmbeddingBackend(
  rawDimension: EmbeddingGemma2Dimension = 768,
): EmbeddingGemma2Backend {
  return {
    async embedBatch(requests: readonly EmbeddingGemma2BackendRequest[]): Promise<number[][]> {
      return requests.map((req) => {
        const vec = new Array<number>(rawDimension).fill(0)
        // Strip task/title boilerplate slightly less weight than payload tokens, while still sensitive to prefix
        const text = req.prompt.toLowerCase()
        const tokens = text.split(/[^a-z0-9가-힣_-]+/i).filter(Boolean)

        const accumulate = (feature: string, weight: number): void => {
          let h1 = 2166136261
          let h2 = 0x9e3779b9
          for (let i = 0; i < feature.length; i += 1) {
            const c = feature.charCodeAt(i)
            h1 = Math.imul(h1 ^ c, 16777619) >>> 0
            h2 = Math.imul(h2 ^ (c * 31), 2246822519) >>> 0
          }
          const idx = h1 % rawDimension
          const sign = (h2 & 1) === 0 ? 1 : -1
          vec[idx] = (vec[idx] ?? 0) + sign * weight
        }

        for (const token of tokens) {
          accumulate(`w:${token}`, 2.0)
          if (token.length >= 3) {
            for (let i = 0; i <= token.length - 3; i += 1) {
              accumulate(`g:${token.slice(i, i + 3)}`, 0.6)
            }
          }
        }
        return vec
      })
    },
  }
}
