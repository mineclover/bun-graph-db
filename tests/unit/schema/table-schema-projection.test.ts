import { describe, expect, it } from 'bun:test'
import {
  projectTableSchema,
  validateProjectedNodeInput,
  validateProjectedNodeUpdateInput,
  type TableProjectionInput,
} from '../../../src/core/schema/TableSchemaProjection'

function sampleInput(): TableProjectionInput {
  return {
    table: {
      id: 'table_tasks',
      identifier: 'project_tasks',
      description: 'Project task table',
      updatedAt: '2026-04-15T00:00:00.000Z',
    },
    attributeTypes: [
      {
        id: 'type_status',
        identifier: 'status',
        jsonType: 'string',
        validationSchema: JSON.stringify({ enum: ['todo', 'doing', 'done'] }),
      },
      {
        id: 'type_priority',
        identifier: 'priority',
        jsonType: 'integer',
        validationSchema: JSON.stringify({ minimum: 1, maximum: 5 }),
      },
      {
        id: 'type_owner_email',
        identifier: 'owner_email',
        jsonType: 'string',
        format: 'email',
      },
      {
        id: 'type_address',
        identifier: 'address',
        jsonType: 'object',
        validationSchema: JSON.stringify({
          required: ['city'],
          properties: {
            city: { type: 'string', minLength: 2 },
          },
          additionalProperties: false,
        }),
      },
      {
        id: 'type_tags',
        identifier: 'tags',
        jsonType: 'array',
        validationSchema: JSON.stringify({
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', pattern: '^[a-z]+$' },
        }),
      },
    ],
    attributes: [
      {
        id: 'attr_status',
        tableId: 'table_tasks',
        identifier: 'status',
        attributeTypeId: 'type_status',
        isRequired: true,
      },
      {
        id: 'attr_priority',
        tableId: 'table_tasks',
        identifier: 'priority',
        attributeTypeId: 'type_priority',
        isRequired: false,
      },
      {
        id: 'attr_owner_email',
        tableId: 'table_tasks',
        identifier: 'owner_email',
        attributeTypeId: 'type_owner_email',
        isRequired: true,
      },
      {
        id: 'attr_address',
        tableId: 'table_tasks',
        identifier: 'address',
        attributeTypeId: 'type_address',
        isRequired: false,
      },
      {
        id: 'attr_tags',
        tableId: 'table_tasks',
        identifier: 'tags',
        attributeTypeId: 'type_tags',
        isRequired: false,
      },
    ],
  }
}

describe('TableSchemaProjection', () => {
  it('projects table attributes into $defs with ref edges', () => {
    const projection = projectTableSchema(sampleInput())

    expect(projection.diagnostics).toEqual([])
    expect(projection.rootRef).toBe('#/$defs/NodeInput_ProjectTasks')
    expect(projection.document.$defs).toHaveProperty('AttributeType_Status')
    expect(projection.document.$defs).toHaveProperty('Attribute_Status')
    expect(projection.document.$defs).toHaveProperty('NodeAttributes_ProjectTasks')

    const nodeAttributes = projection.document.$defs?.NodeAttributes_ProjectTasks
    expect(nodeAttributes).toEqual(expect.objectContaining({
      type: 'object',
      required: ['status', 'owner_email'],
      additionalProperties: false,
    }))
    expect(nodeAttributes?.properties?.status).toEqual({ $ref: '#/$defs/AttributeType_Status' })
    expect(nodeAttributes?.properties?.priority).toEqual({ $ref: '#/$defs/AttributeType_Priority' })

    expect(projection.refs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: '#/$defs/NodeInput_ProjectTasks/properties/attributes',
        to: '#/$defs/NodeAttributes_ProjectTasks',
        kind: 'tableAttributes',
      }),
      expect.objectContaining({
        from: '#/$defs/Attribute_Status/properties/value',
        to: '#/$defs/AttributeType_Status',
        kind: 'attributeType',
      }),
      expect.objectContaining({
        from: '#/$defs/NodeAttributes_ProjectTasks/properties/status',
        to: '#/$defs/AttributeType_Status',
        kind: 'valueSchema',
      }),
    ]))

    expect(projection.sources['#/$defs/NodeAttributes_ProjectTasks/properties/status']).toEqual({
      kind: 'db',
      entity: 'attribute',
      id: 'attr_status',
      pointer: '#',
    })
  })

  it('validates node input against the projected table attribute schema', () => {
    const projection = projectTableSchema(sampleInput())

    expect(validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Ship projection experiment',
      attributes: {
        status: 'doing',
        priority: 3,
        owner_email: 'dev@example.com',
      },
    }, projection)).toEqual({ valid: true, errors: [] })

    const invalid = validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Ship projection experiment',
      attributes: {
        status: 'blocked',
        priority: 9,
        extra: true,
      },
    }, projection)

    expect(invalid.valid).toBe(false)
    if (!invalid.valid) {
      expect(invalid.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '#/attributes/status', code: 'enum' }),
        expect.objectContaining({ path: '#/attributes/priority', code: 'maximum' }),
        expect.objectContaining({ path: '#/attributes/owner_email', code: 'required' }),
        expect.objectContaining({ path: '#/attributes/extra', code: 'additional-property' }),
      ]))
    }
  })

  it('changes versionHash when attribute type schema changes', () => {
    const first = projectTableSchema(sampleInput())
    const changed = sampleInput()
    changed.attributeTypes = changed.attributeTypes.map(type =>
      type.id === 'type_priority'
        ? { ...type, validationSchema: JSON.stringify({ minimum: 1, maximum: 10 }) }
        : type,
    )

    const second = projectTableSchema(changed)

    expect(second.versionHash).not.toBe(first.versionHash)
    expect(validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Now valid',
      attributes: {
        status: 'todo',
        priority: 9,
        owner_email: 'dev@example.com',
      },
    }, second)).toEqual({ valid: true, errors: [] })
  })

  it('validates partial node update input without requiring all required attributes', () => {
    const projection = projectTableSchema(sampleInput())

    expect(validateProjectedNodeUpdateInput({
      tableId: 'table_tasks',
      attributes: {
        priority: 3,
      },
    }, projection)).toEqual({ valid: true, errors: [] })

    const invalid = validateProjectedNodeUpdateInput({
      tableId: 'table_tasks',
      attributes: {
        status: 'blocked',
        priority: 9,
        extra: true,
      },
    }, projection)

    expect(invalid.valid).toBe(false)
    if (!invalid.valid) {
      expect(invalid.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '#/attributes/status', code: 'enum' }),
        expect.objectContaining({ path: '#/attributes/priority', code: 'maximum' }),
        expect.objectContaining({ path: '#/attributes/extra', code: 'additional-property' }),
      ]))
      expect(invalid.errors).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '#/attributes/owner_email', code: 'required' }),
      ]))
    }
  })

  it('validates nested object and array attribute schemas', () => {
    const projection = projectTableSchema(sampleInput())

    expect(validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Nested values',
      attributes: {
        status: 'todo',
        owner_email: 'dev@example.com',
        address: { city: 'Seoul' },
        tags: ['alpha', 'beta'],
      },
    }, projection)).toEqual({ valid: true, errors: [] })

    const invalid = validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Nested values',
      attributes: {
        status: 'todo',
        owner_email: 'dev@example.com',
        address: { zip: 123 },
        tags: ['OK', 3],
      },
    }, projection)

    expect(invalid.valid).toBe(false)
    if (!invalid.valid) {
      expect(invalid.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '#/attributes/address/city', code: 'required' }),
        expect.objectContaining({ path: '#/attributes/address/zip', code: 'additional-property' }),
        expect.objectContaining({ path: '#/attributes/tags/0', code: 'pattern' }),
        expect.objectContaining({ path: '#/attributes/tags/1', code: 'type' }),
      ]))
    }

    const duplicateItems = validateProjectedNodeInput({
      tableId: 'table_tasks',
      content: 'Duplicate tags',
      attributes: {
        status: 'todo',
        owner_email: 'dev@example.com',
        tags: ['alpha', 'alpha'],
      },
    }, projection)

    expect(duplicateItems.valid).toBe(false)
    if (!duplicateItems.valid) {
      expect(duplicateItems.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '#/attributes/tags', code: 'uniqueItems' }),
      ]))
    }
  })

  it('reports diagnostics for missing attribute type and invalid validation schema', () => {
    const input = sampleInput()
    input.attributes = [
      ...input.attributes,
      {
        id: 'attr_missing',
        tableId: 'table_tasks',
        identifier: 'missing',
        attributeTypeId: 'does_not_exist',
        isRequired: false,
      },
    ]
    input.attributeTypes = [
      ...input.attributeTypes,
      {
        id: 'type_bad_json',
        identifier: 'bad_json',
        jsonType: 'string',
        validationSchema: '{not json',
      },
    ]

    const projection = projectTableSchema(input)

    expect(projection.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'attribute-type-not-found',
        source: expect.objectContaining({ entity: 'attribute', id: 'attr_missing' }),
      }),
      expect.objectContaining({
        code: 'invalid-json',
        source: expect.objectContaining({ entity: 'attributeType', id: 'type_bad_json' }),
      }),
    ]))
  })
})
