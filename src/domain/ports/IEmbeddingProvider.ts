export type EmbeddingTaskType =
  | 'retrieval_query'
  | 'retrieval_document'
  | 'clustering'
  | 'classification'
  | 'semantic_similarity'
  | 'question_answering'
  | 'fact_verification'
  | 'code_retrieval'

export interface EmbeddingMediaInput {
  kind: 'image' | 'audio' | 'video'
  payload: unknown
}

export interface EmbeddingInput {
  text?: string
  title?: string | null
  task?: EmbeddingTaskType
  media?: EmbeddingMediaInput
}

export interface EmbeddingResult {
  vector: number[]
  dimension: number
  model: string
  norm: number
}

/**
 * Runtime-agnostic embedding provider contract shared across Node, WebGPU/WASM Browsers,
 * and Cloudflare Workers.
 */
export interface IEmbeddingProvider {
  readonly modelId: string
  readonly dimension: number
  embed(input: EmbeddingInput): Promise<EmbeddingResult>
  embedBatch(inputs: readonly EmbeddingInput[]): Promise<EmbeddingResult[]>
}
