/**
 * Template Import/Export Demo
 *
 * 템플릿 JSON import/export 기능을 테스트하는 데모
 */

import type { DemoRunner } from '../utils/demo-runner.js'
import { createDefaultClient } from '../utils/graphql-client.js'

export async function runImportExportDemo(runner: DemoRunner) {
  const client = createDefaultClient(runner.config.serverUrl)

  console.log('\n🎯 템플릿 Import/Export 데모 시작\n')

  try {
    // 1. 테스트용 템플릿 생성
    console.log('📝 1. 테스트용 템플릿 생성')
    const timestamp = Date.now()
    const createResponse = await client.createTemplate({
      identifier: `export-test-template-${timestamp}`,
      name: '내보내기 테스트 템플릿',
      description: 'Import/Export 기능 테스트를 위한 템플릿입니다.',
      query:
        'query ExportTestQuery($limit: Int = 10) { searchTemplates(first: $limit) { nodes { id identifier name isActive } } }',
      variables: { limit: 5 },
    })

    console.log('🔍 템플릿 생성 응답:', JSON.stringify(createResponse, null, 2))

    const createResult = createResponse.data?.createTemplate
    if (!createResult?.success || !createResult?.template) {
      console.error('❌ 템플릿 생성 실패:', createResult?.errors || createResponse.errors)
      return
    }

    const templateId = createResult.template.id
    const templateIdentifier = createResult.template.identifier
    console.log(`✅ 템플릿 생성 완료: ${templateIdentifier} (ID: ${templateId})`)

    // 2. 템플릿 내보내기 (ID로)
    console.log('\n📤 2. 템플릿 내보내기 (ID로)')
    const exportByIdResponse = await client.exportTemplate({
      templateId,
      includeStatistics: true,
    })

    console.log('🔍 내보내기 응답 (ID):', JSON.stringify(exportByIdResponse, null, 2))

    const exportByIdResult = exportByIdResponse.data?.exportTemplate
    if (!exportByIdResult?.success || !exportByIdResult?.exportData) {
      console.error(
        '❌ 템플릿 내보내기 실패 (ID):',
        exportByIdResult?.errors || exportByIdResponse.errors
      )
      return
    }

    console.log('✅ 템플릿 내보내기 완료 (ID)')
    console.log(`📋 파일명: ${exportByIdResult.filename}`)
    console.log(`📊 내보낸 데이터 크기: ${exportByIdResult.exportData.length}자`)

    // 내보낸 데이터 미리보기
    const exportedData = JSON.parse(exportByIdResult.exportData)
    console.log('📋 내보낸 데이터 미리보기:')
    console.log(`   - 템플릿 ID: ${exportedData.template.id}`)
    console.log(`   - 식별자: ${exportedData.template.identifier}`)
    console.log(`   - 이름: ${exportedData.template.name}`)
    console.log(`   - 활성화: ${exportedData.template.isActive}`)

    // 3. 템플릿 내보내기 (식별자로)
    console.log('\n📤 3. 템플릿 내보내기 (식별자로)')
    const exportByIdentifierResult = await client.exportTemplate({
      templateIdentifier,
      includeStatistics: true,
    })

    const exportByIdentifierData = exportByIdentifierResult.data?.exportTemplate
    if (!exportByIdentifierData?.success || !exportByIdentifierData.exportData) {
      console.error(
        '❌ 템플릿 내보내기 실패 (식별자):',
        exportByIdentifierData?.errors || exportByIdentifierResult.errors
      )
      return
    }

    console.log('✅ 템플릿 내보내기 완료 (식별자)')
    console.log(`📋 파일명: ${exportByIdentifierData.filename}`)

    // 4. 템플릿 가져오기 (새 식별자 생성)
    console.log('\n📥 4. 템플릿 가져오기 (새 식별자 생성)')
    const importResult = await client.importTemplate({
      jsonData: exportByIdResult.exportData,
      generateNewIdentifier: true,
      newIdentifierPrefix: 'imported',
    })

    const importData = importResult.data?.importTemplate
    if (!importData?.success || !importData.template) {
      console.error('❌ 템플릿 가져오기 실패:', importData?.errors || importResult.errors)
      return
    }

    console.log('✅ 템플릿 가져오기 완료')
    console.log(`📋 가져온 템플릿:`)
    console.log(`   - ID: ${importData.template.id}`)
    console.log(`   - 식별자: ${importData.template.identifier}`)
    console.log(`   - 이름: ${importData.template.name}`)

    if (importData.warnings && importData.warnings.length > 0) {
      console.log('⚠️ 경고사항:')
      importData.warnings.forEach((warning: string) => {
        console.log(`   - ${warning}`)
      })
    }

    // 5. 가져온 템플릿 실행 테스트
    console.log('\n🔄 5. 가져온 템플릿 실행 테스트')
    const executeResult = await client.executeTemplate({
      templateIdentifier: importData.template.identifier,
      variables: { limit: 3 },
    })

    if (!executeResult.success) {
      console.error('❌ 가져온 템플릿 실행 실패:', executeResult.errors)
      return
    }

    console.log('✅ 가져온 템플릿 실행 완료')
    console.log(
      `📊 실행 결과: ${executeResult.data ? Object.keys(executeResult.data).length : 0}개 필드`
    )

    // 6. 중복 가져오기 테스트 (덮어쓰기 없이)
    console.log('\n📥 6. 중복 가져오기 테스트 (덮어쓰기 없음)')
    const duplicateImportResult = await client.importTemplate({
      jsonData: exportByIdResult.exportData,
      overwriteExisting: false,
    })

    if (duplicateImportResult.success) {
      console.log('⚠️ 중복 가져오기가 성공했습니다 (예상과 다를 수 있음)')
    } else {
      console.log('✅ 중복 가져오기가 올바르게 차단되었습니다')
      console.log(`📋 오류: ${duplicateImportResult.errors[0]?.message || '알 수 없는 오류'}`)
    }

    // 7. 중복 가져오기 테스트 (덮어쓰기 허용)
    console.log('\n📥 7. 중복 가져오기 테스트 (덮어쓰기 허용)')
    const overwriteImportResult = await client.importTemplate({
      jsonData: exportByIdResult.exportData,
      overwriteExisting: true,
    })

    if (!overwriteImportResult.success) {
      console.error('❌ 덮어쓰기 가져오기 실패:', overwriteImportResult.errors)
      return
    }

    console.log('✅ 덮어쓰기 가져오기 완료')
    console.log(`📋 덮어쓴 템플릿: ${overwriteImportResult.template?.identifier}`)

    console.log('\n🎉 Import/Export 데모 완료!')
  } catch (error) {
    console.error('💥 데모 실행 중 오류:', error)
    throw error
  }
}
