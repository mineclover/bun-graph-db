#!/usr/bin/env bun
/**
 * Table Information Aggregator
 * AI 친화적인 테이블 정보 통합 조회 시스템
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4141/graphql'

async function executeGraphQLQuery(query: string, variables: any = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  return await response.json()
}

interface TableInfo {
  id: string
  identifier: string
  description: string
  nodeCount: number
  attributeCount: number
  createdAt: string
}

interface AttributeInfo {
  id: string
  identifier: string
  name: string
  type: string
  description?: string
}

interface TemplateInfo {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: string
  tags: string[]
  complexity: string
  usagePattern: string
}

interface TableDocumentation {
  overview: string
  schema: string
  sampleData: string
  usageExamples: string
  bestPractices: string
}

interface ComprehensiveTableInfo {
  table: TableInfo
  attributes: AttributeInfo[]
  relatedTemplates: TemplateInfo[]
  documentation: TableDocumentation
  aiInsights: {
    summary: string
    keyFeatures: string[]
    commonUseCases: string[]
    recommendedWorkflows: string[]
  }
}

async function getTableInfo(tableIdentifier?: string): Promise<TableInfo[]> {
  const query = `
    query GetTables($pagination: PaginationInput) {
      tables(pagination: $pagination) {
        tables {
          id
          identifier
          description
          createdAt
          statistics {
            nodeCount
            attributeCount
          }
        }
      }
    }
  `

  const result = await executeGraphQLQuery(query, {
    pagination: { limit: 200, offset: 0 },
  })

  if (!result.data?.tables?.tables) {
    console.warn('⚠️ 테이블 데이터를 가져올 수 없습니다.')
    return []
  }

  const tables = result.data.tables.tables.map((table: any) => ({
    id: table.id,
    identifier: table.identifier,
    description: table.description || '',
    nodeCount: table.statistics?.nodeCount || 0,
    attributeCount: table.statistics?.attributeCount || 0,
    createdAt: table.createdAt,
  }))

  if (tableIdentifier) {
    return tables.filter((table: TableInfo) =>
      table.identifier.toLowerCase().includes(tableIdentifier.toLowerCase())
    )
  }

  return tables
}

async function getTableAttributes(tableId: string): Promise<AttributeInfo[]> {
  const query = `
    query GetTableAttributes($tableId: ID!) {
      table(id: $tableId) {
        attributes {
          id
          identifier
          name
          description
          attributeType {
            id
            name
          }
        }
      }
    }
  `

  const result = await executeGraphQLQuery(query, { tableId })

  if (!result.data?.table?.attributes) {
    return []
  }

  return result.data.table.attributes.map((attr: any) => ({
    id: attr.id,
    identifier: attr.identifier,
    name: attr.name,
    type: attr.attributeType?.name || 'unknown',
    description: attr.description || '',
  }))
}

async function getRelatedTemplates(tableIdentifier: string): Promise<TemplateInfo[]> {
  const query = `
    query SearchTemplates($pagination: PaginationInput) {
      searchTemplates(pagination: $pagination) {
        templates {
          identifier
          name
          description
          query
          defaultVariables
          tags
        }
      }
    }
  `

  const result = await executeGraphQLQuery(query, {
    pagination: { limit: 200, offset: 0 },
  })

  if (!result.data?.searchTemplates?.templates) {
    return []
  }

  const allTemplates = result.data.searchTemplates.templates

  // 테이블과 관련된 템플릿 필터링
  const relatedTemplates = allTemplates.filter((template: any) => {
    const query = template.query.toLowerCase()
    const defaultVars = template.defaultVariables?.toLowerCase() || ''
    const templateId = template.identifier.toLowerCase()
    const tableId = tableIdentifier.toLowerCase()

    return (
      query.includes(tableId) ||
      defaultVars.includes(tableId) ||
      templateId.includes(tableId) ||
      query.includes('table') ||
      query.includes('node') ||
      query.includes('attribute')
    )
  })

  return relatedTemplates.map((template: any) => ({
    identifier: template.identifier,
    name: template.name,
    description: template.description || '',
    query: template.query,
    defaultVariables: template.defaultVariables || '{}',
    tags: template.tags || [],
    complexity: calculateComplexity(template.query),
    usagePattern: generateUsagePattern(template),
  }))
}

function calculateComplexity(query: string): string {
  const complexityScore =
    (query.match(/mutation|query/gi) || []).length +
    (query.match(/\{[^}]*\}/g) || []).length +
    (query.split('\n').length - 1)

  if (complexityScore <= 5) return 'LOW'
  if (complexityScore <= 15) return 'MEDIUM'
  return 'HIGH'
}

function generateUsagePattern(template: any): string {
  const hasVariables = template.defaultVariables && template.defaultVariables !== '{}'
  const isMutation = template.query.toLowerCase().includes('mutation')
  const isQuery = template.query.toLowerCase().includes('query')

  if (isMutation && hasVariables) {
    return `executeTemplateWithGraphQL("${template.identifier}", { /* variables */ })`
  } else if (isMutation) {
    return `executeTemplateWithGraphQL("${template.identifier}", {})`
  } else if (isQuery && hasVariables) {
    return `executeTemplateWithGraphQL("${template.identifier}", { /* query parameters */ })`
  } else {
    return `executeTemplateWithGraphQL("${template.identifier}", {})`
  }
}

function generateDocumentation(
  table: TableInfo,
  attributes: AttributeInfo[],
  templates: TemplateInfo[]
): TableDocumentation {
  const overview = `
# ${table.identifier} 테이블

**설명**: ${table.description || '테이블 설명이 없습니다.'}
**생성일**: ${new Date(table.createdAt).toLocaleDateString('ko-KR')}
**데이터 현황**: ${table.nodeCount}개 노드, ${table.attributeCount}개 속성
**테이블 ID**: ${table.id}
  `.trim()

  const schema = `
## 스키마 구조

### 속성 정의
${
  attributes.length === 0
    ? '- 정의된 속성이 없습니다.'
    : attributes
        .map(
          (attr) =>
            `- **${attr.identifier}** (${attr.type}): ${attr.name}${attr.description ? ' - ' + attr.description : ''}`
        )
        .join('\n')
}

### GraphQL 타입
\`\`\`graphql
type ${table.identifier.charAt(0).toUpperCase() + table.identifier.slice(1)}Node {
  id: ID!
  content: String!
  createdAt: DateTime!
  ${attributes.map((attr) => `${attr.identifier}: String`).join('\n  ')}
}
\`\`\`
  `.trim()

  const sampleData = `
## 샘플 데이터 구조

\`\`\`json
{
  "id": "123",
  "content": "샘플 노드 내용",
  "createdAt": "2025-01-01T00:00:00Z"${attributes.length > 0 ? ',' : ''}
  ${attributes.map((attr) => `"${attr.identifier}": "샘플 값"`).join(',\n  ')}
}
\`\`\`
  `.trim()

  const usageExamples = `
## 사용 예제

### 기본 노드 생성
\`\`\`bash
curl -X POST http://localhost:4141/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "mutation { createNode(input: { tableId: \\"${table.id}\\", content: \\"새 노드\\" }) { success node { id content } errors { message } } }"}'
\`\`\`

### 템플릿을 통한 작업
${templates
  .slice(0, 3)
  .map(
    (template) => `
**${template.name}:**
\`\`\`bash
curl -X POST http://localhost:4141/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "mutation { ${template.usagePattern} { success data errors { message } } }"}'
\`\`\`
`
  )
  .join('')}
  `.trim()

  const bestPractices = `
## 모범 사례

### 노드 생성 시
- 명확하고 의미있는 content 제공
- 필요한 속성 값 사전 준비
- 중복 데이터 생성 방지

### 속성 관리
- 속성 타입에 맞는 값 입력
- 필수 속성 누락 방지
- 데이터 일관성 유지

### 템플릿 활용
- 표준 템플릿 우선 사용
- 변수 값 검증 후 실행
- 에러 처리 및 로깅
  `.trim()

  return {
    overview,
    schema,
    sampleData,
    usageExamples,
    bestPractices,
  }
}

function generateAIInsights(
  table: TableInfo,
  attributes: AttributeInfo[],
  templates: TemplateInfo[]
): any {
  const summary = `${table.identifier} 테이블은 ${table.nodeCount}개의 노드와 ${table.attributeCount}개의 속성을 가진 ${table.description || '데이터 저장소'}입니다. ${templates.length}개의 관련 템플릿이 제공됩니다.`

  const keyFeatures = [
    `${table.nodeCount}개 노드 저장 중`,
    `${attributes.length}개 구조화된 속성`,
    `${templates.length}개 사용 가능한 템플릿`,
    attributes.length > 0 ? '타입 안전 속성 시스템' : '유연한 컨텐츠 저장',
  ]

  const commonUseCases = [
    '노드 생성 및 관리',
    '속성 기반 데이터 구조화',
    '관계형 데이터 연결',
    '검색 및 필터링',
  ]

  const recommendedWorkflows = [
    `1. 테이블 확인: executeTemplateWithGraphQL("get-table-statistics-enhanced", { tableId: "${table.id}" })`,
    `2. 노드 생성: executeTemplateWithGraphQL("create-node-with-params", { tableId: "${table.id}", content: "내용" })`,
    attributes.length > 0
      ? `3. 속성 설정: 정의된 ${attributes.length}개 속성 활용`
      : '3. 속성 추가: 필요시 새 속성 정의',
    `4. 데이터 조회: 검색 템플릿 활용으로 효율적 데이터 접근`,
  ]

  return {
    summary,
    keyFeatures,
    commonUseCases,
    recommendedWorkflows,
  }
}

async function aggregateTableInformation(tableIdentifier?: string): Promise<void> {
  console.log('🔍 테이블 정보 통합 조회 시작\n')

  try {
    // 서버 연결 확인
    const healthCheck = await executeGraphQLQuery(`
      query { healthCheck { status } }
    `)

    if (!healthCheck.data?.healthCheck?.status) {
      console.error('❌ GraphQL 서버에 연결할 수 없습니다.')
      process.exit(1)
    }

    console.log('✅ GraphQL 서버 연결 확인\n')

    // 테이블 목록 조회
    const tables = await getTableInfo(tableIdentifier)

    if (tables.length === 0) {
      console.log('📋 조회된 테이블이 없습니다.')
      return
    }

    console.log(`📊 ${tables.length}개 테이블 정보 수집 중...\n`)

    const comprehensiveInfos: ComprehensiveTableInfo[] = []

    for (const table of tables) {
      console.log(`🔍 ${table.identifier} 테이블 분석 중...`)

      // 속성 정보 수집
      const attributes = await getTableAttributes(table.id)

      // 관련 템플릿 수집
      const relatedTemplates = await getRelatedTemplates(table.identifier)

      // 문서화 생성
      const documentation = generateDocumentation(table, attributes, relatedTemplates)

      // AI 인사이트 생성
      const aiInsights = generateAIInsights(table, attributes, relatedTemplates)

      const comprehensiveInfo: ComprehensiveTableInfo = {
        table,
        attributes,
        relatedTemplates,
        documentation,
        aiInsights,
      }

      comprehensiveInfos.push(comprehensiveInfo)

      console.log(`   ✅ 속성: ${attributes.length}개, 템플릿: ${relatedTemplates.length}개`)
    }

    // AI 친화적 출력 생성
    await generateAIFriendlyOutput(comprehensiveInfos, tableIdentifier)

    console.log('\n🎉 테이블 정보 통합 조회 완료!')
  } catch (error) {
    console.error('❌ 시스템 오류:', error)
    process.exit(1)
  }
}

async function generateAIFriendlyOutput(
  infos: ComprehensiveTableInfo[],
  searchFilter?: string
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = searchFilter
    ? `table-info-${searchFilter}-${timestamp}.md`
    : `comprehensive-table-info-${timestamp}.md`
  const outputPath = `./claudedocs/${filename}`

  let output = `# 🗄️ 테이블 정보 통합 보고서

**생성일시**: ${new Date().toLocaleString('ko-KR')}
**대상 테이블**: ${searchFilter || '전체'} (${infos.length}개)

## 📊 요약

`

  // 전체 요약
  const totalNodes = infos.reduce((sum, info) => sum + info.table.nodeCount, 0)
  const totalAttributes = infos.reduce((sum, info) => sum + info.attributes.length, 0)
  const totalTemplates = infos.reduce((sum, info) => sum + info.relatedTemplates.length, 0)

  output += `- **총 테이블**: ${infos.length}개
- **총 노드**: ${totalNodes}개
- **총 속성**: ${totalAttributes}개
- **관련 템플릿**: ${totalTemplates}개

---

`

  // 각 테이블별 상세 정보
  for (const info of infos) {
    output += `## 🏗️ ${info.table.identifier}

### 📋 기본 정보
${info.documentation.overview}

### 🤖 AI 인사이트
**요약**: ${info.aiInsights.summary}

**핵심 특징**:
${info.aiInsights.keyFeatures.map((feature) => `- ${feature}`).join('\n')}

**일반적 사용 사례**:
${info.aiInsights.commonUseCases.map((useCase) => `- ${useCase}`).join('\n')}

**권장 워크플로우**:
${info.aiInsights.recommendedWorkflows.map((workflow) => `- ${workflow}`).join('\n')}

${info.documentation.schema}

### 🧪 관련 템플릿 (${info.relatedTemplates.length}개)

${
  info.relatedTemplates.length === 0
    ? '- 관련 템플릿이 없습니다.'
    : info.relatedTemplates
        .map(
          (template) => `
#### ${template.name}
- **식별자**: \`${template.identifier}\`
- **복잡도**: ${template.complexity}
- **사용법**: \`${template.usagePattern}\`
- **설명**: ${template.description}
- **태그**: ${template.tags.join(', ') || '없음'}
`
        )
        .join('')
}

${info.documentation.sampleData}

${info.documentation.usageExamples}

${info.documentation.bestPractices}

---

`
  }

  // 부록: 전체 템플릿 목록
  output += `## 📚 부록: 전체 템플릿 참조

### AI 활용을 위한 템플릿 카탈로그

`

  const allTemplates = infos.flatMap((info) => info.relatedTemplates)
  const uniqueTemplates = Array.from(new Map(allTemplates.map((t) => [t.identifier, t])).values())

  uniqueTemplates.forEach((template) => {
    output += `**${template.identifier}**
\`\`\`bash
# ${template.name}
${template.usagePattern}
\`\`\`

`
  })

  await Bun.write(outputPath, output)
  console.log(`\n📋 AI 친화적 보고서 저장: ${outputPath}`)

  // JSON 형태로도 저장 (구조화된 데이터)
  const jsonPath = outputPath.replace('.md', '.json')
  await Bun.write(
    jsonPath,
    JSON.stringify(
      {
        metadata: {
          generatedAt: new Date().toISOString(),
          searchFilter: searchFilter || null,
          tableCount: infos.length,
          totalNodes,
          totalAttributes,
          totalTemplates,
        },
        tables: infos,
      },
      null,
      2
    )
  )

  console.log(`📋 구조화된 데이터 저장: ${jsonPath}`)
}

// 스크립트 실행
if (import.meta.main) {
  const args = process.argv.slice(2)
  const tableFilter = args[0] // 테이블 필터 (선택사항)

  if (tableFilter) {
    console.log(`🎯 특정 테이블 조회: ${tableFilter}`)
  } else {
    console.log('🎯 전체 테이블 조회')
  }

  aggregateTableInformation(tableFilter)
}

export { aggregateTableInformation }
