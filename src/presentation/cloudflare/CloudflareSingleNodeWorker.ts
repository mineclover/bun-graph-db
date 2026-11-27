import type { AccessControl } from '@/application/security/AccessControl.js'
import type {
  CloudflareR2BucketLike,
  ISnapshotStoragePort,
} from '@/domain/ports/ISnapshotStoragePort.js'
import { R2BucketSnapshotStorage } from '@/domain/ports/ISnapshotStoragePort.js'
import {
  createPortableGraphNode,
  type PortableGraphNode,
} from '@/infrastructure/container/PortableBootstrap.js'
import {
  type DoStorageLike,
  DoSqliteDatabase,
} from '@/infrastructure/database/sqlite/DoSqliteAdapter.js'

const VALID_NODE_KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStubLike
  getByName?(name: string): DurableObjectStubLike
}

export interface CloudflareSingleNodeEnv {
  GRAPH_NODE: DurableObjectNamespaceLike
  SNAPSHOT_BUCKET?: CloudflareR2BucketLike
  DEFAULT_NODE_KEY?: string
  GRAPH_NODE_HEADER?: string
}

export interface CloudflareDurableObjectNodeOptions {
  snapshotBucket?: CloudflareR2BucketLike
  nodeKey?: string
  graphqlEndpoint?: string
  accessControl?: AccessControl
  internalBridgeToken?: string
}

export interface CloudflareDurableObjectNode {
  readonly database: DoSqliteDatabase
  readonly snapshotStorage?: ISnapshotStoragePort
  getNode(): Promise<PortableGraphNode>
  fetch(request: Request): Promise<Response>
}

export function createCloudflareDurableObjectNode(
  storage: DoStorageLike,
  options: CloudflareDurableObjectNodeOptions = {},
): CloudflareDurableObjectNode {
  const database = new DoSqliteDatabase(storage)
  const snapshotStorage = options.snapshotBucket
    ? new R2BucketSnapshotStorage(options.snapshotBucket)
    : undefined
  const nodeKey = options.nodeKey?.trim() || 'default'

  let nodePromise: Promise<PortableGraphNode> | undefined

  const getNode = (): Promise<PortableGraphNode> => {
    if (nodePromise) {
      return nodePromise
    }
    const pending = createPortableGraphNode(database, {
      databaseLabel: `:cloudflare-do:${nodeKey}`,
      snapshotStorage,
      graphqlEndpoint: options.graphqlEndpoint,
      accessControl: options.accessControl,
      internalBridgeToken: options.internalBridgeToken,
    }).catch((error: unknown) => {
      nodePromise = undefined
      throw error
    })
    nodePromise = pending
    return pending
  }

  return {
    database,
    snapshotStorage,
    getNode,
    async fetch(request: Request): Promise<Response> {
      const node = await getNode()
      return await node.fetch(request)
    },
  }
}

export type SingleNodeKeyResolution =
  | { ok: true; nodeKey: string }
  | { ok: false; error: string }

export function resolveSingleNodeKey(
  request: Request,
  env: Pick<CloudflareSingleNodeEnv, 'DEFAULT_NODE_KEY' | 'GRAPH_NODE_HEADER'>,
): SingleNodeKeyResolution {
  const headerName = env.GRAPH_NODE_HEADER?.trim() || 'x-graph-node-key'
  const rawHeader = request.headers.get(headerName)

  if (rawHeader !== null) {
    const trimmed = rawHeader.trim()
    if (!VALID_NODE_KEY_PATTERN.test(trimmed)) {
      return {
        ok: false,
        error: `Invalid '${headerName}' header value. Expected 1-128 characters matching /^[A-Za-z0-9._-]{1,128}$/.`,
      }
    }
    return { ok: true, nodeKey: trimmed }
  }

  const defaultKey = env.DEFAULT_NODE_KEY?.trim() || 'default'
  return { ok: true, nodeKey: defaultKey }
}

export async function routeSingleNodeRequest(
  request: Request,
  env: CloudflareSingleNodeEnv,
): Promise<Response> {
  const resolution = resolveSingleNodeKey(request, env)
  if (!resolution.ok) {
    return new Response(
      JSON.stringify({
        success: false,
        error: resolution.error,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const stub = env.GRAPH_NODE.getByName
    ? env.GRAPH_NODE.getByName(resolution.nodeKey)
    : env.GRAPH_NODE.get(env.GRAPH_NODE.idFromName(resolution.nodeKey))

  return await stub.fetch(request)
}
