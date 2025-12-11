#!/usr/bin/env bun

/**
 * Simple Template Fix Script
 *
 * 간단히 수정 가능한 실패 템플릿들을 위한 수정 스크립트
 *
 * 수정 대상:
 * 1. create-table (ID: 870): template_type을 'mutation'으로 변경, variables_schema와 default_variables 추가
 * 2. create-table-with-params (ID: 871): 쿼리에서 'isActive' 필드 제거
 * 3. create-node-with-params (ID: 868): 쿼리에서 'title' → 'content' 필드 변경
 * 4. update-node-with-params (ID: 903): 쿼리에서 'title' → 'content' 필드 변경
 * 5. delete-todo (ID: 818): variables_schema와 default_variables 추가
 */

import { Database } from 'bun:sqlite'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'

interface TemplateUpdate {
  id: number
  identifier: string
  description: string
  updates: {
    template_type?: string
    query_text?: string
    variables_schema?: string
    default_variables?: string
  }
}

class TemplateFixService {
  private db: Database
  private backupPath: string

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.backupPath = `${dbPath}.backup-${Date.now()}`
  }

  /**
   * 백업 생성
   */
  createBackup(): void {
    console.log(`🔄 Creating backup: ${this.backupPath}`)
    copyFileSync(this.db.filename, this.backupPath)
    console.log(`✅ Backup created successfully`)
  }

  /**
   * 백업에서 복원
   */
  restoreFromBackup(): void {
    console.log(`🔄 Restoring from backup: ${this.backupPath}`)
    this.db.close()
    copyFileSync(this.backupPath, this.db.filename)
    this.db = new Database(this.db.filename)
    console.log(`✅ Restored from backup successfully`)
  }

  /**
   * 템플릿 정보 조회
   */
  getTemplate(id: number): any {
    const query = this.db.prepare(`
      SELECT id, identifier, name, template_type, query_text, variables_schema, default_variables
      FROM templates
      WHERE id = ?
    `)
    return query.get(id)
  }

  /**
   * 템플릿 업데이트
   */
  updateTemplate(id: number, updates: any): void {
    const setParts: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      setParts.push(`${key} = ?`)
      values.push(value)
    }

    values.push(id)

    const updateQuery = `
      UPDATE templates
      SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    const stmt = this.db.prepare(updateQuery)
    stmt.run(...values)
  }

  /**
   * 수정 전후 검증
   */
  validateTemplate(id: number, expectedChanges: any): boolean {
    const template = this.getTemplate(id)

    for (const [key, expectedValue] of Object.entries(expectedChanges)) {
      if (template[key] !== expectedValue) {
        console.error(`❌ Validation failed for template ${id}: ${key} = ${template[key]}, expected ${expectedValue}`)
        return false
      }
    }

    return true
  }

  /**
   * 수정 대상 템플릿들 정의
   */
  getTemplateUpdates(): TemplateUpdate[] {
    return [
      {
        id: 870,
        identifier: 'create-table',
        description: "template_type을 'mutation'으로 변경, variables_schema와 default_variables 추가",
        updates: {
          template_type: 'mutation',
          variables_schema: JSON.stringify({
            input: {
              type: 'object',
              required: true,
              properties: {
                identifier: {
                  type: 'string',
                  required: true,
                  description: '테이블 식별자',
                },
                description: {
                  type: 'string',
                  required: true,
                  description: '테이블 설명',
                },
              },
            },
          }),
          default_variables: JSON.stringify({
            input: {
              identifier: 'new-table',
              description: '새로운 테이블입니다',
            },
          }),
        },
      },
      {
        id: 871,
        identifier: 'create-table-with-params',
        description: "쿼리에서 'isActive' 필드 제거",
        updates: {
          query_text: `mutation CreateTableWithParams($input: CreateTableInput!) {
  createTable(input: $input) {
    success
    table {
      id
      identifier
      description
      createdAt
    }
    errors {
      message
      code
    }
  }
}`,
        },
      },
      {
        id: 868,
        identifier: 'create-node-with-params',
        description: "쿼리에서 'title' → 'content' 필드 변경",
        updates: {
          query_text: `mutation CreateNodeWithParams($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      tableId
      createdAt
    }
    errors {
      message
      code
    }
  }
}`,
        },
      },
      {
        id: 903,
        identifier: 'update-node-with-params',
        description: "쿼리에서 'title' → 'content' 필드 변경",
        updates: {
          query_text: `mutation UpdateNodeWithParams($id: ID!, $input: UpdateNodeInput!) {
  updateNode(id: $id, input: $input) {
    success
    node {
      id
      content
      updatedAt
    }
    errors {
      message
      code
    }
  }
}`,
        },
      },
      {
        id: 818,
        identifier: 'delete-todo',
        description: 'variables_schema와 default_variables 추가',
        updates: {
          variables_schema: JSON.stringify({
            todoId: {
              type: 'string',
              required: true,
              description: '삭제할 TODO ID',
            },
          }),
          default_variables: JSON.stringify({
            todoId: 'example-todo-id',
          }),
        },
      },
    ]
  }

  /**
   * 모든 템플릿 수정 실행
   */
  async fixAllTemplates(): Promise<void> {
    const updates = this.getTemplateUpdates()

    console.log(`🔧 Starting template fixes for ${updates.length} templates`)

    // 트랜잭션 시작
    const transaction = this.db.transaction(() => {
      for (const update of updates) {
        console.log(`\n📝 Processing ${update.identifier} (ID: ${update.id})`)
        console.log(`   Description: ${update.description}`)

        // 수정 전 상태 확인
        const beforeTemplate = this.getTemplate(update.id)
        if (!beforeTemplate) {
          console.error(`❌ Template ${update.id} not found`)
          continue
        }

        console.log(`   Before: template_type=${beforeTemplate.template_type}`)

        // 업데이트 실행
        this.updateTemplate(update.id, update.updates)

        // 수정 후 상태 확인
        const afterTemplate = this.getTemplate(update.id)
        console.log(`   After: template_type=${afterTemplate.template_type}`)

        // 기본 검증
        const expectedType = update.updates.template_type || beforeTemplate.template_type
        if (afterTemplate.template_type !== expectedType) {
          throw new Error(`Template ${update.id} update failed: template_type mismatch`)
        }

        console.log(`   ✅ Successfully updated ${update.identifier}`)
      }
    })

    try {
      transaction()
      console.log(`\n🎉 All templates fixed successfully!`)
    } catch (error) {
      console.error(`\n❌ Transaction failed: ${error.message}`)
      throw error
    }
  }

  /**
   * 수정 결과 검증
   */
  async validateAllFixes(): Promise<boolean> {
    console.log(`\n🔍 Validating all fixes...`)

    const updates = this.getTemplateUpdates()
    let allValid = true

    for (const update of updates) {
      console.log(`\n📋 Validating ${update.identifier} (ID: ${update.id})`)

      const template = this.getTemplate(update.id)
      if (!template) {
        console.error(`❌ Template ${update.id} not found`)
        allValid = false
        continue
      }

      // 각 업데이트 항목 검증
      for (const [key, expectedValue] of Object.entries(update.updates)) {
        if (template[key] !== expectedValue) {
          console.error(`❌ ${key}: expected '${expectedValue}', got '${template[key]}'`)
          allValid = false
        } else {
          console.log(`✅ ${key}: ${expectedValue ? 'OK' : 'NULL'}`)
        }
      }
    }

    return allValid
  }

  /**
   * 요약 보고서 생성
   */
  generateReport(): void {
    console.log(`\n📊 Fix Summary Report`)
    console.log(`${'='.repeat(50)}`)

    const updates = this.getTemplateUpdates()

    for (const update of updates) {
      const template = this.getTemplate(update.id)

      console.log(`\n🎯 ${update.identifier} (ID: ${update.id})`)
      console.log(`   Description: ${update.description}`)
      console.log(`   Template Type: ${template.template_type}`)
      console.log(`   Has Variables Schema: ${template.variables_schema ? 'Yes' : 'No'}`)
      console.log(`   Has Default Variables: ${template.default_variables ? 'Yes' : 'No'}`)

      if (update.updates.query_text) {
        console.log(`   Query Updated: Yes`)
      }
    }

    console.log(`\n📈 Total templates processed: ${updates.length}`)
  }

  close(): void {
    this.db.close()
  }
}

// 메인 실행 함수
async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'bun-graph-db.sqlite')

  if (!existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`)
    process.exit(1)
  }

  const service = new TemplateFixService(dbPath)

  try {
    // 백업 생성
    service.createBackup()

    // 템플릿 수정 실행
    await service.fixAllTemplates()

    // 검증
    const isValid = await service.validateAllFixes()

    if (isValid) {
      console.log(`\n🎉 All template fixes completed and validated successfully!`)

      // 요약 보고서
      service.generateReport()
    } else {
      console.error(`\n❌ Validation failed. Rolling back...`)
      service.restoreFromBackup()
      process.exit(1)
    }
  } catch (error) {
    console.error(`\n💥 Error during template fixes: ${error.message}`)

    try {
      service.restoreFromBackup()
      console.log(`✅ Rollback completed`)
    } catch (rollbackError) {
      console.error(`💥 Rollback failed: ${rollbackError.message}`)
    }

    process.exit(1)
  } finally {
    service.close()
  }
}

// 스크립트 실행
if (import.meta.main) {
  main().catch(console.error)
}

export { TemplateFixService }
