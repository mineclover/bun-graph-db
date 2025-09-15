#!/usr/bin/env bun

/**
 * Add Fixed Tags Script
 *
 * template-system-guide.md에 언급된 핵심 템플릿들에 'fixed' 태그를 추가하는 스크립트
 */

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

// 핵심 템플릿들의 ID와 기존 태그 정보
const coreTemplates = [
  {
    id: '668',
    identifier: 'create-table',
    currentTags: ['table', 'create', 'schema'],
  },
  {
    id: '671',
    identifier: 'test-health-check',
    currentTags: ['general'],
  },
  {
    id: '682',
    identifier: 'search-templates-advanced',
    currentTags: ['general'],
  },
  {
    id: '690',
    identifier: 'list-tables-with-pagination',
    currentTags: ['general'],
  },
  {
    id: '733',
    identifier: 'create-template-basic',
    currentTags: ['basic', 'create', 'management'],
  },
  {
    id: '807',
    identifier: 'bulk-data-import',
    currentTags: ['bulk', 'import', 'data-migration', 'batch-processing'],
  },
  {
    id: '808',
    identifier: 'real-time-monitoring',
    currentTags: ['monitoring', 'real-time', 'performance', 'subscription', 'system'],
  },
  {
    id: '809',
    identifier: 'data-validation',
    currentTags: ['validation', 'data-quality', 'integrity', 'schema'],
  },
  {
    id: '810',
    identifier: 'advanced-analytics',
    currentTags: ['analytics', 'graph-algorithms', 'centrality', 'clustering', 'pathfinding'],
  },
  {
    id: '811',
    identifier: 'data-export',
    currentTags: ['export', 'data-transfer', 'formats', 'streaming'],
  },
  {
    id: '812',
    identifier: 'query-optimization',
    currentTags: ['optimization', 'performance', 'indexing', 'tuning'],
  },
  {
    id: '814',
    identifier: 'template-lifecycle-management',
    currentTags: ['lifecycle', 'management', 'versioning', 'analytics'],
  },
]

async function addFixedTag(templateId: string, identifier: string, currentTags: string[]) {
  // fixed 태그가 이미 있는지 확인
  if (currentTags.includes('fixed')) {
    console.log(`✅ ${identifier}: 이미 fixed 태그가 있음`)
    return { success: true, skipped: true }
  }

  // fixed 태그 추가
  const newTags = [...currentTags, 'fixed']

  const mutation = `
    mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
      updateTemplate(id: $id, input: $input) {
        success
        template {
          identifier
          tags
        }
        errors {
          message
        }
      }
    }
  `

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          id: templateId,
          input: {
            tags: newTags,
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    if (!data.data.updateTemplate.success) {
      throw new Error(`업데이트 실패: ${JSON.stringify(data.data.updateTemplate.errors)}`)
    }

    return {
      success: true,
      template: data.data.updateTemplate.template,
      skipped: false,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      skipped: false,
    }
  }
}

async function main() {
  console.log('🏷️ 핵심 템플릿에 Fixed 태그 추가 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📋 처리할 템플릿 수: ${coreTemplates.length}개`)

  const results = []

  for (const template of coreTemplates) {
    console.log(`\n🔄 처리 중: ${template.identifier} (ID: ${template.id})`)

    const result = await addFixedTag(template.id, template.identifier, template.currentTags)
    results.push({ ...template, result })

    if (result.success) {
      if (result.skipped) {
        console.log(`  ⏭️ 건너뜀: 이미 fixed 태그 존재`)
      } else {
        console.log(`  ✅ 성공: fixed 태그 추가됨`)
        console.log(`  📝 새로운 태그: [${result.template?.tags?.join(', ')}]`)
      }
    } else {
      console.log(`  ❌ 실패: ${result.error}`)
    }

    // 서버 부하 방지를 위한 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // 결과 요약
  console.log('\n📊 처리 결과 요약:')
  const successful = results.filter((r) => r.result.success && !r.result.skipped)
  const skipped = results.filter((r) => r.result.success && r.result.skipped)
  const failed = results.filter((r) => !r.result.success)

  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`  ⏭️ 건너뜀: ${skipped.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)

  if (failed.length > 0) {
    console.log('\n❌ 실패한 템플릿들:')
    failed.forEach((f) => {
      console.log(`  - ${f.identifier}: ${f.result.error}`)
    })
  }

  console.log('\n🎉 Fixed 태그 추가 완료!')
}

// 스크립트 실행
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 스크립트 실행 중 오류:', error)
    process.exit(1)
  })
}
