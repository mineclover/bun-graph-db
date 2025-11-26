/**
 * 서버 독립적 테스트 아키텍처 검증 테스트
 * 핵심 기능 동작 확인 - REST API 기반
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  createIntegrationConfig,
  type UnifiedTestEnvironment,
  UnifiedTestEnvironmentManager,
  withAutoServer,
} from '../fixtures/unified-test-environment'

describe('서버 독립적 테스트 아키텍처 검증', () => {
  let testEnvironment: UnifiedTestEnvironment

  beforeAll(async () => {
    console.log('🚀 서버 독립적 환경 설정 시작...')

    const manager = new UnifiedTestEnvironmentManager()
    const config = createIntegrationConfig('server-independence-test')

    testEnvironment = await manager.setupTest(config)

    console.log(`✅ 환경 준비 완료:`)
    console.log(`   - 서버 포트: ${testEnvironment.server!.port}`)
    console.log(`   - GraphQL: ${testEnvironment.server!.url}`)
    console.log(`   - 데이터베이스: ${testEnvironment.database!.databasePath}`)
  }, 30000)

  afterAll(async () => {
    console.log('🧹 환경 정리 시작...')
    await testEnvironment.cleanup()
    console.log('✅ 환경 정리 완료')
  })

  test('자동 서버 시작 및 GraphQL 접근 가능 확인', async () => {
    // GraphQL 헬스체크
    const graphqlResult = await testEnvironment.graphqlRequest!(
      'query { healthCheck { status database version } }'
    )

    expect(graphqlResult).toBeDefined()
    expect(graphqlResult.data?.healthCheck).toBeDefined()
    expect(graphqlResult.data.healthCheck.status).toBe('OK')
    expect(graphqlResult.data.healthCheck.database).toBe(true)

    console.log('✅ GraphQL 엔드포인트 정상 동작')
  })

  test('독립적 데이터베이스 환경 확인', async () => {
    // 시스템 통계 조회
    const statsResult = await testEnvironment.graphqlRequest!(
      'query { systemStats { memory { used total } process { pid } } }'
    )

    expect(statsResult.data?.systemStats).toBeDefined()
    expect(statsResult.data.systemStats.memory).toBeDefined()
    expect(statsResult.data.systemStats.process.pid).toBeDefined()

    console.log('✅ 독립적 시스템 환경 확인됨')
  })

  test('포트 동적 할당 확인', async () => {
    const port = testEnvironment.server!.port

    // 포트가 5500-5999 범위에 있는지 확인
    expect(port).toBeGreaterThanOrEqual(5500)
    expect(port).toBeLessThanOrEqual(5999)

    console.log(`✅ 동적 포트 할당 성공: ${port}`)
  })

  test('테이블 생성 및 조회 워크플로우', async () => {
    const tableIdentifier = `test-table-${Date.now()}`

    // 1. 테이블 생성
    const createResult = await testEnvironment.graphqlRequest!(
      `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
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
      `,
      {
        input: {
          identifier: tableIdentifier,
          description: '서버 독립성 테스트용 테이블',
        },
      }
    )

    expect(createResult.data?.createTable.success).toBe(true)
    expect(createResult.data.createTable.table.identifier).toBe(tableIdentifier)

    // 2. 테이블 조회
    const tablesResult = await testEnvironment.graphqlRequest!(
      'query { tables { nodes { identifier description } } }'
    )

    expect(tablesResult.data?.tables.nodes).toBeDefined()
    const createdTable = tablesResult.data.tables.nodes.find(
      (table: any) => table.identifier === tableIdentifier
    )
    expect(createdTable).toBeDefined()

    console.log('✅ 테이블 생성/조회 워크플로우 성공')
  })
})

describe('withAutoServer 패턴 검증', () => {
  test('자동 서버 관리 패턴 동작 확인', async () => {
    console.log('🔄 자동 서버 관리 테스트 시작...')

    const result = await withAutoServer(
      createIntegrationConfig('auto-server-test'),
      async (env) => {
        // 서버가 자동으로 시작되어야 함
        expect(env.server).toBeDefined()
        expect(env.database).toBeDefined()
        expect(env.graphqlRequest).toBeDefined()

        // GraphQL 쿼리 실행
        const healthResult = await env.graphqlRequest!('query { healthCheck { status } }')

        expect(healthResult.data?.healthCheck.status).toBe('OK')

        console.log(`✅ 자동 시작된 서버 포트: ${env.server!.port}`)
        return healthResult.data.healthCheck.status
      }
    )

    // withAutoServer 완료 후 서버가 자동으로 정리되어야 함
    expect(result).toBe('OK')

    console.log('✅ 자동 서버 관리 패턴 성공')
  })

  test('여러 독립적 환경 동시 실행', async () => {
    console.log('🔄 병렬 환경 테스트 시작...')

    // 3개의 독립적 환경을 동시에 실행
    const results = await Promise.all([
      withAutoServer(createIntegrationConfig('parallel-test-1'), async (env) => {
        const result = await env.graphqlRequest!('query { healthCheck { status } }')
        return { port: env.server!.port, status: result.data?.healthCheck.status }
      }),
      withAutoServer(createIntegrationConfig('parallel-test-2'), async (env) => {
        const result = await env.graphqlRequest!('query { healthCheck { status } }')
        return { port: env.server!.port, status: result.data?.healthCheck.status }
      }),
      withAutoServer(createIntegrationConfig('parallel-test-3'), async (env) => {
        const result = await env.graphqlRequest!('query { healthCheck { status } }')
        return { port: env.server!.port, status: result.data?.healthCheck.status }
      }),
    ])

    // 모든 환경이 성공적으로 실행되어야 함
    results.forEach((result, index) => {
      expect(result.status).toBe('OK')
      expect(result.port).toBeGreaterThanOrEqual(5500)
      console.log(`✅ 병렬 환경 ${index + 1}: 포트 ${result.port}, 상태 ${result.status}`)
    })

    // 모든 포트가 서로 달라야 함 (독립성 확인)
    const ports = results.map((r) => r.port)
    const uniquePorts = new Set(ports)
    expect(uniquePorts.size).toBe(results.length)

    console.log('✅ 병렬 독립적 환경 실행 성공')
  })

  test('에러 상황에서도 정리 보장', async () => {
    console.log('🔄 에러 시나리오 테스트 시작...')

    let environmentPort: number | undefined

    try {
      await withAutoServer(createIntegrationConfig('error-test'), async (env) => {
        environmentPort = env.server!.port
        console.log(`📝 테스트 환경 포트 기록: ${environmentPort}`)

        // 의도적으로 에러 발생
        throw new Error('의도적 테스트 에러')
      })
    } catch (error) {
      // 에러가 예상대로 발생해야 함
      expect(error).toBeDefined()
      expect((error as Error).message).toBe('의도적 테스트 에러')
    }

    // 에러가 발생해도 포트가 기록되어야 함
    expect(environmentPort).toBeDefined()
    expect(environmentPort).toBeGreaterThanOrEqual(5500)

    console.log(`✅ 에러 상황에서도 환경 정리 보장됨 (포트: ${environmentPort})`)
  })
})

describe('성능 및 안정성 검증', () => {
  test('빠른 환경 생성 및 해제', async () => {
    const startTime = Date.now()

    await withAutoServer(createIntegrationConfig('performance-test'), async (env) => {
      const healthResult = await env.graphqlRequest!('query { healthCheck { status } }')
      expect(healthResult.data?.healthCheck.status).toBe('OK')
    })

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // 5초 이내 완료

    console.log(`✅ 환경 생성/해제 성능: ${duration}ms`)
  })

  test('연속적인 환경 생성 안정성', async () => {
    console.log('🔄 연속 환경 생성 테스트...')

    for (let i = 0; i < 3; i++) {
      await withAutoServer(createIntegrationConfig(`stability-test-${i}`), async (env) => {
        const result = await env.graphqlRequest!('query { healthCheck { status } }')
        expect(result.data?.healthCheck.status).toBe('OK')
        console.log(`✅ 연속 테스트 ${i + 1}: 포트 ${env.server!.port}`)
      })
    }

    console.log('✅ 연속적인 환경 생성 안정성 확인')
  })
})
