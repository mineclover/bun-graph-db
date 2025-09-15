#!/usr/bin/env bun
/**
 * Todo Domain Setup
 *
 * Todo 관리를 위한 도메인 설정 (테이블 생성 및 속성 정의)
 */

interface GraphQLResponse {
  data?: any
  errors?: Array<{ message: string }>
}

class TodoDomainSetup {
  private serverUrl = 'http://localhost:4000/graphql'

  async setupTodoDomain(): Promise<void> {
    console.log('🎯 Setting up Todo domain...\n')

    // 1. Todo 테이블 생성
    await this.createTodoTable()
    console.log()

    // 2. 필요한 속성 타입들 생성
    await this.createAttributeTypes()
    console.log()

    // 3. Todo 속성들 생성
    await this.createTodoAttributes()
    console.log()

    console.log('✅ Todo domain setup completed!')
  }

  private async createTodoTable(): Promise<void> {
    console.log('📋 Creating Todo table...')

    const mutation = `
      mutation CreateTodoTable {
        createTable(input: {
          identifier: "todos"
          description: "할일 관리를 위한 테이블"
        }) {
          success
          table {
            id
            identifier
            description
          }
          errors {
            message
          }
        }
      }
    `

    const result = await this.executeGraphQL(mutation)

    if (result.data?.createTable?.success) {
      const table = result.data.createTable.table
      console.log(`   ✅ Todo table created: ${table.identifier} (ID: ${table.id})`)
    } else {
      const errors = result.data?.createTable?.errors || result.errors || []
      console.log(`   ❌ Failed to create table:`)
      errors.forEach((error: any) => console.log(`      - ${error.message}`))
    }
  }

  private async createAttributeTypes(): Promise<void> {
    console.log('🏷️ Creating attribute types for todos...')

    const attributeTypes = [
      {
        identifier: 'todo_status',
        name: 'TodoStatus',
        description: '할일 상태',
        dataType: 'string',
        constraints: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
      },
      {
        identifier: 'todo_priority',
        name: 'TodoPriority',
        description: '할일 우선순위',
        dataType: 'string',
        constraints: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      },
      {
        identifier: 'todo_category',
        name: 'TodoCategory',
        description: '할일 카테고리',
        dataType: 'string',
        constraints: ['WORK', 'PERSONAL', 'SHOPPING', 'HEALTH', 'LEARNING', 'OTHER'],
      },
    ]

    for (const type of attributeTypes) {
      const mutation = `
        mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
          createAttributeType(input: $input) {
            success
            attributeType {
              id
              identifier
              name
              description
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: type.identifier,
          name: type.name,
          description: type.description,
          dataType: type.dataType,
          constraints: type.constraints,
        },
      }

      const result = await this.executeGraphQL(mutation, variables)

      if (result.data?.createAttributeType?.success) {
        console.log(`   ✅ ${type.name} attribute type created`)
      } else {
        const errors = result.data?.createAttributeType?.errors || result.errors || []
        console.log(`   ⚠️ ${type.name} may already exist or failed:`)
        errors.forEach((error: any) => console.log(`      - ${error.message}`))
      }
    }
  }

  private async createTodoAttributes(): Promise<void> {
    console.log('📝 Creating todo attributes...')

    // 먼저 todos 테이블 ID 조회
    const todoTableId = await this.getTodoTableId()
    if (!todoTableId) {
      console.log('   ❌ Could not find todos table')
      return
    }

    // 속성 타입 ID들 조회
    const attributeTypeIds = await this.getAttributeTypeIds()

    // 기본 속성 타입들도 조회
    const basicAttributeTypes = await this.getBasicAttributeTypeIds()

    const attributes = [
      {
        identifier: 'todo_title',
        name: 'title',
        description: '할일 제목',
        attributeTypeId: basicAttributeTypes.string || basicAttributeTypes.text,
      },
      {
        identifier: 'todo_description',
        name: 'description',
        description: '할일 상세 설명',
        attributeTypeId: basicAttributeTypes.text || basicAttributeTypes.string,
      },
      {
        identifier: 'todo_status',
        name: 'status',
        description: '할일 상태',
        attributeTypeId: attributeTypeIds.TodoStatus || attributeTypeIds.todo_status,
      },
      {
        identifier: 'todo_priority',
        name: 'priority',
        description: '할일 우선순위',
        attributeTypeId: attributeTypeIds.TodoPriority || attributeTypeIds.todo_priority,
      },
      {
        identifier: 'todo_category',
        name: 'category',
        description: '할일 카테고리',
        attributeTypeId: attributeTypeIds.TodoCategory || attributeTypeIds.todo_category,
      },
      {
        identifier: 'todo_due_date',
        name: 'due_date',
        description: '마감일',
        attributeTypeId: basicAttributeTypes.date || basicAttributeTypes.datetime,
      },
      {
        identifier: 'todo_created_at',
        name: 'created_at',
        description: '생성일',
        attributeTypeId: basicAttributeTypes.datetime || basicAttributeTypes.date,
      },
      {
        identifier: 'todo_completed_at',
        name: 'completed_at',
        description: '완료일',
        attributeTypeId: basicAttributeTypes.datetime || basicAttributeTypes.date,
      },
    ]

    for (const attr of attributes) {
      if (!attr.attributeTypeId) {
        console.log(`   ⚠️ Skipping ${attr.name} - no attribute type found`)
        continue
      }

      const mutation = `
        mutation CreateAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            success
            attribute {
              id
              identifier
              name
              description
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: attr.identifier,
          name: attr.name,
          description: attr.description,
          tableId: todoTableId,
          attributeTypeId: attr.attributeTypeId,
        },
      }

      const result = await this.executeGraphQL(mutation, variables)

      if (result.data?.createAttribute?.success) {
        console.log(`   ✅ ${attr.name} attribute created`)
      } else {
        const errors = result.data?.createAttribute?.errors || result.errors || []
        console.log(`   ⚠️ ${attr.name} attribute creation issue:`)
        errors.forEach((error: any) => console.log(`      - ${error.message}`))
      }
    }
  }

  private async getTodoTableId(): Promise<string | null> {
    const query = `
      query GetTables {
        tables {
          nodes {
            id
            identifier
          }
        }
      }
    `

    const result = await this.executeGraphQL(query)
    const tables = result.data?.tables?.nodes || []
    const todoTable = tables.find((table: any) => table.identifier === 'todos')

    return todoTable?.id || null
  }

  private async getAttributeTypeIds(): Promise<Record<string, string>> {
    const query = `
      query GetAttributeTypes {
        attributeTypes {
          attributeTypes {
            id
            identifier
            name
            dataType
          }
        }
      }
    `

    const result = await this.executeGraphQL(query)
    const attributeTypes = result.data?.attributeTypes?.attributeTypes || []

    const typeIds: Record<string, string> = {}
    attributeTypes.forEach((type: any) => {
      typeIds[type.name] = type.id
      typeIds[type.identifier] = type.id
    })

    return typeIds
  }

  private async getBasicAttributeTypeIds(): Promise<Record<string, string>> {
    const query = `
      query GetAttributeTypes {
        attributeTypes {
          attributeTypes {
            id
            identifier
            name
            dataType
          }
        }
      }
    `

    const result = await this.executeGraphQL(query)
    const attributeTypes = result.data?.attributeTypes?.attributeTypes || []

    const basicTypes: Record<string, string> = {}
    attributeTypes.forEach((type: any) => {
      if (
        ['string', 'boolean', 'integer', 'number', 'date', 'datetime', 'text'].includes(
          type.dataType
        )
      ) {
        basicTypes[type.dataType] = type.id
        basicTypes[type.identifier] = type.id
        if (type.name) {
          basicTypes[type.name] = type.id
        }
      }
    })

    return basicTypes
  }

  private async executeGraphQL(query: string, variables?: any): Promise<GraphQLResponse> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })

      return await response.json()
    } catch (error) {
      return { errors: [{ message: `Network error: ${error}` }] }
    }
  }

  async showTodoDomainStatus(): Promise<void> {
    console.log('\n📊 Todo Domain Status:')
    console.log('─'.repeat(50))

    // 테이블 확인
    const todoTableId = await this.getTodoTableId()
    if (todoTableId) {
      console.log(`✅ Todo table exists (ID: ${todoTableId})`)

      // 속성들 확인
      const query = `
        query GetTodoTableAttributes($tableId: ID!) {
          table(id: $tableId) {
            id
            identifier
            attributes {
              id
              name
              description
            }
          }
        }
      `

      const result = await this.executeGraphQL(query, { tableId: todoTableId })
      const attributes = result.data?.table?.attributes || []

      console.log(`📝 Attributes (${attributes.length}):`)
      attributes.forEach((attr: any) => {
        console.log(`   - ${attr.name}: ${attr.description}`)
      })
    } else {
      console.log('❌ Todo table not found')
    }

    // 속성 타입들 확인
    const attributeTypeIds = await this.getAttributeTypeIds()
    console.log(`\n🏷️ Custom Attribute Types (${Object.keys(attributeTypeIds).length}):`)
    Object.entries(attributeTypeIds).forEach(([name, id]) => {
      console.log(`   - ${name} (ID: ${id})`)
    })
  }
}

// CLI 인터페이스
async function main() {
  const setup = new TodoDomainSetup()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'setup':
      await setup.setupTodoDomain()
      break
    case 'status':
      await setup.showTodoDomainStatus()
      break
    default:
      console.log(`
🎯 Todo Domain Setup CLI

Usage:
  setup    Setup todo domain (table + attributes)
  status   Show current todo domain status

Examples:
  bun todo-domain-setup.ts setup
  bun todo-domain-setup.ts status
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TodoDomainSetup }
