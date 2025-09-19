#!/usr/bin/env bun

/**
 * NODE 카테고리 템플릿 개선 스크립트
 * GraphQL 스키마에 맞게 NODE 템플릿들을 수정합니다
 */

import { Database } from 'bun:sqlite'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const DB_PATH = 'data/bun-graph-db.sqlite'
const BACKUP_DIR = join(process.cwd(), 'backups', 'node-templates')

interface NodeTemplateFixConfig {
  identifier: string
  issues: string[]
  newQuery: string
  newVariablesSchema?: any
  newDefaultVariables?: any
}

// NODE 템플릿 수정 설정
const NODE_TEMPLATE_FIXES: NodeTemplateFixConfig[] = [
  {
    identifier: 'create-node-with-params',
    issues: ['Cannot query field "tableId" on type "TableNode"'],
    newQuery: `mutation CreateNodeWithParams($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      createdAt
      updatedAt
      table {
        id
        identifier
        description
      }
      attributes {
        id
        value
        attribute {
          name
        }
      }
    }
    errors {
      message
    }
  }
}`,
    newVariablesSchema: {
      type: "object",
      properties: {
        input: {
          type: "object",
          properties: {
            content: { type: "string", description: "노드 내용" },
            tableId: { type: "string", description: "테이블 ID" }
          },
          required: ["content", "tableId"]
        }
      },
      required: ["input"]
    },
    newDefaultVariables: {
      input: {
        content: "새로운 노드",
        tableId: "1"
      }
    }
  },
  {
    identifier: 'update-node-with-params',
    issues: ['Variable "$input" got invalid value { title: "...", content: "..." }; Field "title" is not defined by type "UpdateNodeInput"'],
    newQuery: `mutation UpdateNodeWithParams($id: ID!, $input: UpdateNodeInput!) {
  updateNode(id: $id, input: $input) {
    success
    node {
      id
      content
      createdAt
      updatedAt
      table {
        id
        identifier
        description
      }
      attributes {
        id
        value
        attribute {
          name
        }
      }
    }
    errors {
      message
    }
  }
}`,
    newVariablesSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "노드 ID" },
        input: {
          type: "object",
          properties: {
            content: { type: "string", description: "노드 내용" }
          },
          required: ["content"]
        }
      },
      required: ["id", "input"]
    },
    newDefaultVariables: {
      id: "1",
      input: {
        content: "업데이트된 내용"
      }
    }
  }
]

async function main() {
  console.log('🔧 NODE 카테고리 템플릿 개선 시작')

  try {
    // 1. 백업 디렉토리 생성
    await ensureBackupDirectory()

    // 2. 템플릿 백업
    const templatesBackup = await backupNodeTemplates()
    console.log(`📦 ${templatesBackup.length}개 템플릿 백업 완료`)

    // 3. NODE 템플릿 개선
    const improvedCount = await improveNodeTemplates()
    console.log(`🔧 ${improvedCount}개 템플릿 개선 완료`)

    // 4. 결과 요약
    await generateImprovementReport(templatesBackup, improvedCount)

    console.log('✅ NODE 템플릿 개선 완료!')

  } catch (error) {
    console.error('❌ 개선 중 오류 발생:', error)
    process.exit(1)
  }
}

async function ensureBackupDirectory() {
  try {
    await fs.access(BACKUP_DIR)
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  }
  console.log(`📁 백업 디렉토리: ${BACKUP_DIR}`)
}

async function backupNodeTemplates() {
  const db = new Database(DB_PATH)

  const identifiers = NODE_TEMPLATE_FIXES.map(fix => fix.identifier)
  const query = `
    SELECT * FROM templates
    WHERE identifier IN (${identifiers.map(() => '?').join(',')})
  `

  const templates = db.query(query).all(...identifiers)
  db.close()

  // 백업 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = join(BACKUP_DIR, `node-templates-backup-${timestamp}.json`)

  const backupData = {
    timestamp: new Date().toISOString(),
    templates: templates,
    improvementReason: 'GraphQL schema alignment - updating queries to match current schema'
  }

  await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2))
  console.log(`💾 백업 저장: ${backupFile}`)

  return templates
}

async function improveNodeTemplates() {
  const db = new Database(DB_PATH)
  let improvedCount = 0

  try {
    db.exec('BEGIN TRANSACTION')

    for (const fix of NODE_TEMPLATE_FIXES) {
      console.log(`🔧 개선 중: ${fix.identifier}`)

      const updateQuery = `
        UPDATE templates
        SET
          query_text = ?,
          variables_schema = ?,
          default_variables = ?,
          updated_at = datetime('now'),
          version = '1.1.0'
        WHERE identifier = ?
      `

      const variablesSchema = fix.newVariablesSchema ? JSON.stringify(fix.newVariablesSchema) : null
      const defaultVariables = fix.newDefaultVariables ? JSON.stringify(fix.newDefaultVariables) : null

      const result = db.query(updateQuery).run(
        fix.newQuery,
        variablesSchema,
        defaultVariables,
        fix.identifier
      )

      if (result.changes > 0) {
        improvedCount++
        console.log(`  ✅ ${fix.identifier} 개선 완료`)
        console.log(`     해결된 문제: ${fix.issues.join(', ')}`)
      } else {
        console.log(`  ⚠️ ${fix.identifier} 템플릿을 찾을 수 없음`)
      }
    }

    db.exec('COMMIT')
    return improvedCount

  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  } finally {
    db.close()
  }
}

async function generateImprovementReport(templates: any[], improvedCount: number) {
  const timestamp = new Date().toISOString()

  const report = `# NODE 템플릿 개선 리포트

**개선 일시**: ${timestamp}
**개선된 템플릿 수**: ${improvedCount}개

## 개선된 템플릿 목록

| 템플릿명 | 사용횟수 | 개선 내용 |
|---------|---------|----------|
${NODE_TEMPLATE_FIXES.map(fix => {
  const template = templates.find(t => t.identifier === fix.identifier)
  const usageCount = template ? template.usage_count : 0
  return `| ${fix.identifier} | ${usageCount}회 | ${fix.issues.join(', ')} |`
}).join('\n')}

## 개선 내용

### 1. create-node-with-params
- **문제**: TableNode에서 tableId 필드 쿼리 시도
- **해결**: CreateNodeInput 구조에 맞게 input 객체 사용
- **변경사항**:
  - 쿼리 구조를 \`createNode(input: CreateNodeInput!)\` 형태로 변경
  - 변수 스키마 재정의
  - 기본값 추가

### 2. update-node-with-params
- **문제**: UpdateNodeInput에 없는 title 필드 사용
- **해결**: content 필드만 사용하도록 수정
- **변경사항**:
  - 불필요한 title 필드 제거
  - content 필드만 포함한 input 구조
  - 변수 스키마 및 기본값 재정의

## 스키마 호환성

모든 NODE 템플릿이 현재 GraphQL 스키마와 호환되도록 수정되었습니다:
- ✅ TableNode 타입 필드 정확히 매칭
- ✅ Input 타입 구조 준수
- ✅ 변수 스키마 정의 완료
- ✅ 기본값 제공으로 테스트 가능

## 테스트 방법

\`\`\`bash
# NODE 템플릿 테스트 실행
bun run scripts/test-templates.ts

# 개별 템플릿 테스트
curl -X POST http://localhost:4000/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "...", "variables": {...}}'
\`\`\`

---
*자동 생성됨 by improve-node-templates.ts*
`

  const reportFile = join(BACKUP_DIR, `improvement-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  await fs.writeFile(reportFile, report)

  console.log(`📋 리포트 생성: ${reportFile}`)
}

if (import.meta.main) {
  main()
}