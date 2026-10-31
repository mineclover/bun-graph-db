import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { JsonlBackupService } from '@/domain/services/JsonlBackupService.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { CommonTokens } from '@/infrastructure/container/tokens/CommonTokens.js'
import { GraphQLTokens } from '@/infrastructure/container/tokens/GraphQLTokens.js'
import { RepositoryTokens } from '@/infrastructure/container/tokens/RepositoryTokens.js'
import { UseCaseTokens } from '@/infrastructure/container/tokens/UseCaseTokens.js'
import type { NodeMutations } from '@/presentation/graphql/mutations/NodeMutations.js'
import { AttributeApiController } from '@/presentation/http/controllers/AttributeApiController.js'

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

describe('NodeAttributeSchemaGate & Single Schema Mutation Enforcement', () => {
  let container: DIContainer
  let tempDir: string

  beforeEach(async () => {
    TableSchemaProjectionService.clearCache()
    container = await createTestContainer()
    tempDir = mkdtempSync(join(tmpdir(), 'schema-gate-test-'))
  })

  afterEach(async () => {
    TableSchemaProjectionService.clearCache()
    rmSync(tempDir, { recursive: true, force: true })
    await container?.dispose()
  })

  test('enforces enum, range, format, unsafe JSON keys, and required-attribute deletion protection across GraphQL and REST', async () => {
    const createTable = (await container.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const createAttribute = (await container.resolve(
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    )) as CreateAttributeUseCase
    const createNode = (await container.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const attributeTypeRepo = (await container.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    )) as IAttributeTypeRepository
    const attributeRepo = (await container.resolve(
      RepositoryTokens.ATTRIBUTE_REPOSITORY,
    )) as IAttributeRepository
    const nodeAttributeRepo = (await container.resolve(
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    )) as INodeAttributeRepository
    const nodeMutations = (await container.resolve(
      GraphQLTokens.NODE_MUTATIONS,
    )) as NodeMutations
    const schemaGate = (await container.resolve(
      CommonTokens.NODE_ATTRIBUTE_SCHEMA_GATE,
    )) as NodeAttributeSchemaGate

    await attributeTypeRepo.save(
      AttributeType.create(
        'task_status',
        'string',
        undefined,
        'Task status enum',
        JSON.stringify({ enum: ['todo', 'doing', 'done'] }),
      ),
    )
    await attributeTypeRepo.save(
      AttributeType.create(
        'task_priority',
        'integer',
        undefined,
        'Priority 1..5',
        JSON.stringify({ minimum: 1, maximum: 5 }),
      ),
    )
    await attributeTypeRepo.save(
      AttributeType.create('due_date', 'string', 'date', 'ISO calendar date'),
    )
    await attributeTypeRepo.save(
      AttributeType.create('meta_obj', 'object', undefined, 'Metadata object'),
    )

    const statusType = await attributeTypeRepo.findByIdentifier('task_status')
    const priorityType = await attributeTypeRepo.findByIdentifier('task_priority')
    const dueDateType = await attributeTypeRepo.findByIdentifier('due_date')
    const metaObjType = await attributeTypeRepo.findByIdentifier('meta_obj')
    if (!statusType || !priorityType || !dueDateType || !metaObjType) {
      throw new Error('Expected saved attribute types to be resolvable')
    }

    const { table } = await createTable.execute({
      identifier: 'tasks',
      description: 'Tasks table',
    })

    const { attribute: statusAttr } = await createAttribute.execute({
      tableId: table.id,
      identifier: 'status',
      attributeTypeId: statusType.getId(),
      isRequired: true,
    })
    const { attribute: priorityAttr } = await createAttribute.execute({
      tableId: table.id,
      identifier: 'priority',
      attributeTypeId: priorityType.getId(),
      isRequired: false,
    })
    await createAttribute.execute({
      tableId: table.id,
      identifier: 'due_date',
      attributeTypeId: dueDateType.getId(),
      isRequired: false,
    })
    const { attribute: metaObjAttr } = await createAttribute.execute({
      tableId: table.id,
      identifier: 'meta',
      attributeTypeId: metaObjType.getId(),
      isRequired: false,
    })

    const { node } = await createNode.execute({
      tableId: table.id,
      content: 'task-1',
      attributes: {
        status: 'todo',
        priority: 3,
        due_date: '2026-10-31',
      },
    })

    // 1. GraphQL setNodeAttribute rejects enum violation
    const badEnum = await nodeMutations.setNodeAttribute(
      {},
      {
        input: {
          nodeId: node.id,
          attributeId: statusAttr.id,
          value: 'invalid-status',
        },
      },
    )
    expect(badEnum.success).toBe(false)
    expect(badEnum.errors[0]?.message).toContain('enum')

    // 2. GraphQL updateNodeAttributeValue rejects range violation (maximum: 5)
    const badRange = await nodeMutations.updateNodeAttributeValue(
      {},
      {
        nodeId: node.id,
        attributeId: priorityAttr.id,
        value: '99',
      },
    )
    expect(badRange.success).toBe(false)
    expect(badRange.errors[0]?.code).toBe('maximum')

    // 3. GraphQL setNodeAttributesByIdentifier rejects invalid ISO calendar date (Feb 30)
    const badDate = await nodeMutations.setNodeAttributesByIdentifier(
      {},
      {
        input: {
          nodeId: node.id,
          attributesByIdentifier: [{ identifier: 'due_date', value: '2026-02-30' }],
        },
      },
    )
    expect(badDate.success).toBe(false)
    expect(badDate.errors[0]?.code).toBe('format')

    // 4. GraphQL setNodeAttribute rejects unsafe JSON keys (__proto__)
    const badUnsafeJson = await nodeMutations.setNodeAttribute(
      {},
      {
        input: {
          nodeId: node.id,
          attributeId: metaObjAttr.id,
          value: '{"__proto__":{"polluted":true}}',
        },
      },
    )
    expect(badUnsafeJson.success).toBe(false)
    expect(badUnsafeJson.errors[0]?.code).toBe('unsafe-json-key')

    // 5. GraphQL removeNodeAttribute blocks removing required attribute 'status', allows optional 'priority'
    const blockedRemove = await nodeMutations.removeNodeAttribute(
      {},
      { nodeId: node.id, attributeId: statusAttr.id },
    )
    expect(blockedRemove.success).toBe(false)
    expect(blockedRemove.errors[0]?.code).toBe('required')

    const allowedRemove = await nodeMutations.removeNodeAttribute(
      {},
      { nodeId: node.id, attributeId: priorityAttr.id },
    )
    expect(allowedRemove.success).toBe(true)

    // 6. REST AttributeApiController enforces the exact same gate (400 on invalid value and on required removal)
    const restController = new AttributeApiController(
      createAttribute,
      attributeRepo,
      nodeAttributeRepo,
      noopLogger as never,
      undefined,
      schemaGate,
    )

    let restStatus = 200
    let restPayload: unknown
    const mockRes = {
      status(code: number) {
        restStatus = code
        return this
      },
      json(payload: unknown) {
        restPayload = payload
        return this
      },
    }

    await restController.setNodeAttribute(
      {
        body: {
          input: {
            nodeId: node.id,
            attributeId: priorityAttr.id,
            value: '0', // minimum is 1
          },
        },
      } as never,
      mockRes as never,
    )
    expect(restStatus).toBe(400)
    expect((restPayload as { success: boolean; error: string }).success).toBe(false)

    restStatus = 200
    await restController.removeNodeAttribute(
      {
        body: {
          nodeId: node.id,
          attributeId: statusAttr.id,
        },
      } as never,
      mockRes as never,
    )
    expect(restStatus).toBe(400)
  })

  test('audits existing table nodes after dynamic schema evolution and validates JSONL backup roundtrip', async () => {
    const createTable = (await container.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const createAttribute = (await container.resolve(
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    )) as CreateAttributeUseCase
    const createNode = (await container.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const attributeTypeRepo = (await container.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    )) as IAttributeTypeRepository
    const schemaGate = (await container.resolve(
      CommonTokens.NODE_ATTRIBUTE_SCHEMA_GATE,
    )) as NodeAttributeSchemaGate
    const jsonlBackup = (await container.resolve(
      CommonTokens.JSONL_BACKUP_SERVICE,
    )) as JsonlBackupService

    await attributeTypeRepo.save(
      AttributeType.create('email_type', 'string', 'email', 'Email'),
    )
    const emailType = await attributeTypeRepo.findByIdentifier('email_type')
    if (!emailType) {
      throw new Error('Expected saved email attribute type to be resolvable')
    }

    const { table } = await createTable.execute({
      identifier: 'accounts',
      description: 'Accounts',
    })
    await createAttribute.execute({
      tableId: table.id,
      identifier: 'email',
      attributeTypeId: emailType.getId(),
      isRequired: true,
    })

    const { node } = await createNode.execute({
      tableId: table.id,
      content: 'acct-1',
      attributes: { email: 'alice@example.com' },
    })

    const beforeEvolution = await schemaGate.auditTableConformance({ tableId: table.id })
    expect(beforeEvolution.valid).toBe(true)
    expect(beforeEvolution.conformantNodes).toBe(1)
    expect(beforeEvolution.violationCount).toBe(0)

    // Export JSONL backup and verify overwrite import succeeds while conformant
    const backupDir = join(tempDir, 'backup')
    const exported = await jsonlBackup.export({
      outputDir: backupDir,
      tableIdentifiers: ['accounts'],
      includeRelations: false,
    })
    expect(exported.success).toBe(true)

    const validImport = await jsonlBackup.import({
      inputDir: backupDir,
      tableIdentifiers: ['accounts'],
      conflictResolution: 'overwrite',
    })
    expect(validImport.success).toBe(true)
    expect(validImport.stats.nodesUpdated).toBe(1)

    // Evolve schema: add a new required attribute 'region' -> existing node is flagged in conformance audit
    await createAttribute.execute({
      tableId: table.id,
      identifier: 'region',
      attributeTypeId: '1', // default string type
      isRequired: true,
    })

    const afterEvolution = await schemaGate.auditTableConformance({ tableId: table.id })
    expect(afterEvolution.valid).toBe(false)
    expect(afterEvolution.nonConformantNodes).toBe(1)
    expect(afterEvolution.violations).toEqual([
      expect.objectContaining({
        nodeId: node.id,
        attributeIdentifier: 'region',
        code: 'required',
      }),
    ])
  })
})
