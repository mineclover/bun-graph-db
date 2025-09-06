/**
 * File-based Template Import/Export Demo
 * 
 * 실제 JSON 파일을 저장하고 불러와서 Import/Export 기능을 테스트하는 데모
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import type { DemoRunner } from '../utils/demo-runner.js'
import { createDefaultClient } from '../utils/graphql-client.js'

const EXPORT_DIR = join(process.cwd(), 'demo', 'exported-templates')

export async function runFileImportExportDemo(runner: DemoRunner) {
  const client = createDefaultClient(runner.config.serverUrl)
  
  console.log('\n🎯 파일 기반 Template Import/Export 데모 시작\n')
  
  try {
    // Export 디렉토리 생성
    await ensureExportDirectory()
    
    // 1. 테스트용 템플릿들 생성
    console.log('📝 1. 테스트용 템플릿들 생성')
    const templates = await createTestTemplates(client)
    
    // 2. 템플릿들을 파일로 Export
    console.log('\n📤 2. 템플릿들을 JSON 파일로 내보내기')
    const exportedFiles = await exportTemplatesToFiles(client, templates)
    
    // 3. 파일 목록 확인
    console.log('\n📂 3. 내보낸 파일 목록 확인')
    await listExportedFiles()
    
    // 4. 파일에서 템플릿 읽어서 Import 테스트
    console.log('\n📥 4. JSON 파일에서 템플릿 가져오기 테스트')
    await importTemplatesFromFiles(client, exportedFiles)
    
    // 5. 배치 Export/Import 테스트
    console.log('\n📦 5. 배치 Export/Import 테스트')
    await testBatchOperations(client, templates)
    
    // 6. 백업 및 복원 시나리오
    console.log('\n💾 6. 백업 및 복원 시나리오 테스트')
    await testBackupRestore(client, templates)
    
    console.log('\n🎉 파일 기반 Import/Export 데모 완료!')
    console.log(`📂 내보낸 파일들: ${EXPORT_DIR}`)
    
  } catch (error) {
    console.error('💥 데모 실행 중 오류:', error)
    throw error
  }
}

async function ensureExportDirectory() {
  try {
    await fs.access(EXPORT_DIR)
  } catch {
    await fs.mkdir(EXPORT_DIR, { recursive: true })
    console.log(`📁 Export 디렉토리 생성: ${EXPORT_DIR}`)
  }
}

async function createTestTemplates(client: any) {
  const timestamp = Date.now()
  const templates = []
  
  const testTemplateSpecs = [
    {
      identifier: `health-check-v1-${timestamp}`,
      name: 'Health Check Template',
      description: '서버 상태를 확인하는 기본 템플릿 (v1.0)',
      query: 'query HealthCheck { health { status timestamp version } }',
    },
    {
      identifier: `list-templates-v1-${timestamp}`,
      name: 'List Templates',
      description: '모든 템플릿 목록을 조회하는 템플릿 (v1.0)',
      query: 'query ListTemplates($limit: Int = 10) { searchTemplates(first: $limit) { nodes { id identifier name isActive } totalCount } }',
      variables: { limit: 20 },
    },
    {
      identifier: `search-nodes-v2-${timestamp}`,
      name: 'Search Nodes Template',
      description: '노드를 검색하는 복잡한 템플릿 (v2.0 - 향상된 필터링)',
      query: 'query SearchNodes($filter: String, $limit: Int = 5) { searchNodes(filter: $filter, limit: $limit) { nodes { id content } totalFound } }',
      variables: { filter: '', limit: 5 },
    }
  ]
  
  for (const spec of testTemplateSpecs) {
    const response = await client.createTemplate(spec)
    if (response.data?.createTemplate?.success) {
      const template = response.data.createTemplate.template
      templates.push(template)
      console.log(`✅ 생성됨: ${template.identifier} (ID: ${template.id})`)
    } else {
      console.error(`❌ 생성 실패: ${spec.identifier}`, response.data?.createTemplate?.errors)
    }
  }
  
  return templates
}

async function exportTemplatesToFiles(client: any, templates: any[]) {
  const exportedFiles = []
  
  for (const template of templates) {
    try {
      const exportResponse = await client.exportTemplate({
        templateId: template.id,
        includeStatistics: true,
      })
      
      if (exportResponse.data?.exportTemplate?.success) {
        const exportResult = exportResponse.data.exportTemplate
        const exportData = JSON.parse(exportResult.exportData)
        const templateData = exportData.template
        
        // 버전 기반 파일명 생성 (타임스탬프 제거, 점을 하이픈으로 변경)
        const version = (templateData.version || '1-0-0').replace(/\./g, '-')
        const cleanIdentifier = template.identifier.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-\d+$/, '')
        const filename = `${cleanIdentifier}_v${version}.json`
        const filepath = join(EXPORT_DIR, filename)
        
        // JSON 데이터를 파일로 저장
        await fs.writeFile(filepath, exportResult.exportData)
        
        exportedFiles.push({
          template,
          filename,
          filepath,
          size: exportResult.exportData.length,
        })
        
        console.log(`💾 저장됨: ${filename} (${exportResult.exportData.length}자)`)
      } else {
        console.error(`❌ Export 실패: ${template.identifier}`, exportResponse.data?.exportTemplate?.errors)
      }
    } catch (error) {
      console.error(`💥 Export 오류 (${template.identifier}):`, error)
    }
  }
  
  return exportedFiles
}

async function listExportedFiles() {
  try {
    const files = await fs.readdir(EXPORT_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    console.log(`📂 총 ${jsonFiles.length}개 파일 발견:`)
    
    for (const filename of jsonFiles) {
      const filepath = join(EXPORT_DIR, filename)
      const stats = await fs.stat(filepath)
      const content = await fs.readFile(filepath, 'utf8')
      
      try {
        const parsed = JSON.parse(content)
        console.log(`   📄 ${filename}`)
        console.log(`      - 크기: ${stats.size}바이트`)
        console.log(`      - 템플릿: ${parsed.template?.name || 'Unknown'}`)
        console.log(`      - 식별자: ${parsed.template?.identifier || 'Unknown'}`)
        console.log(`      - 수정일: ${stats.mtime.toISOString()}`)
      } catch (parseError) {
        console.log(`   ❌ ${filename} (파싱 오류)`)
      }
    }
  } catch (error) {
    console.error('📂 파일 목록 조회 실패:', error)
  }
}

async function importTemplatesFromFiles(client: any, exportedFiles: any[]) {
  for (const fileInfo of exportedFiles) {
    try {
      console.log(`\n📥 파일에서 가져오기: ${fileInfo.filename}`)
      
      // 파일에서 JSON 데이터 읽기
      const jsonData = await fs.readFile(fileInfo.filepath, 'utf8')
      
      // JSON 유효성 검사
      try {
        JSON.parse(jsonData)
        console.log('✅ JSON 형식 유효성 검사 통과')
      } catch (parseError) {
        console.error('❌ 잘못된 JSON 형식:', parseError)
        continue
      }
      
      // 새 식별자로 Import
      const importResponse = await client.importTemplate({
        jsonData,
        generateNewIdentifier: true,
        newIdentifierPrefix: 'file-imported',
      })
      
      if (importResponse.data?.importTemplate?.success) {
        const importResult = importResponse.data.importTemplate
        console.log(`✅ Import 성공: ${importResult.template?.identifier}`)
        console.log(`   - 새 ID: ${importResult.template?.id}`)
        console.log(`   - 이름: ${importResult.template?.name}`)
        
        if (importResult.warnings?.length > 0) {
          console.log('⚠️  경고사항:')
          importResult.warnings.forEach((warning: string) => {
            console.log(`   - ${warning}`)
          })
        }
        
        // Import된 템플릿 실행 테스트
        await testImportedTemplate(client, importResult.template)
        
      } else {
        console.error('❌ Import 실패:', importResponse.data?.importTemplate?.errors)
      }
    } catch (error) {
      console.error(`💥 Import 오류 (${fileInfo.filename}):`, error)
    }
  }
}

async function testImportedTemplate(client: any, template: any) {
  try {
    console.log(`🔄 Import된 템플릿 실행 테스트: ${template.identifier}`)
    
    const executeResponse = await client.executeTemplate({
      templateIdentifier: template.identifier,
    })
    
    if (executeResponse.data?.executeTemplate?.success) {
      console.log('✅ 실행 성공')
      const data = executeResponse.data.executeTemplate.data
      if (data) {
        const keys = Object.keys(data)
        console.log(`   - 응답 필드: ${keys.join(', ')}`)
      }
    } else {
      console.log('❌ 실행 실패:', executeResponse.data?.executeTemplate?.errors)
    }
  } catch (error) {
    console.error(`💥 실행 테스트 오류:`, error)
  }
}

async function testBatchOperations(client: any, templates: any[]) {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const batchFilename = `batch-export_${templates.length}-templates_${date}.json`
  const batchFilepath = join(EXPORT_DIR, batchFilename)
  
  console.log('📦 배치 Export 시작...')
  
  // 모든 템플릿을 하나의 배치 파일로 Export
  const batchData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    description: 'Batch export of multiple templates',
    templates: [],
  }
  
  for (const template of templates) {
    try {
      const exportResponse = await client.exportTemplate({
        templateId: template.id,
        includeStatistics: true,
      })
      
      if (exportResponse.data?.exportTemplate?.success) {
        const exportData = JSON.parse(exportResponse.data.exportTemplate.exportData)
        batchData.templates.push(exportData)
      }
    } catch (error) {
      console.error(`배치 Export 오류 (${template.identifier}):`, error)
    }
  }
  
  // 배치 파일 저장
  await fs.writeFile(batchFilepath, JSON.stringify(batchData, null, 2))
  console.log(`💾 배치 파일 저장됨: ${batchFilename}`)
  console.log(`   - 템플릿 수: ${batchData.templates.length}개`)
  
  // 배치 Import 테스트
  console.log('📥 배치 Import 테스트...')
  const batchContent = await fs.readFile(batchFilepath, 'utf8')
  const batchParsed = JSON.parse(batchContent)
  
  let successCount = 0
  let failCount = 0
  
  for (const templateData of batchParsed.templates) {
    try {
      const importResponse = await client.importTemplate({
        jsonData: JSON.stringify(templateData),
        generateNewIdentifier: true,
        newIdentifierPrefix: 'batch-imported',
      })
      
      if (importResponse.data?.importTemplate?.success) {
        successCount++
        console.log(`✅ 배치 Import 성공: ${importResponse.data.importTemplate.template?.identifier}`)
      } else {
        failCount++
        console.error(`❌ 배치 Import 실패: ${templateData.template?.identifier}`)
      }
    } catch (error) {
      failCount++
      console.error(`💥 배치 Import 오류:`, error)
    }
  }
  
  console.log(`📊 배치 Import 결과: 성공 ${successCount}개, 실패 ${failCount}개`)
}

async function testBackupRestore(client: any, templates: any[]) {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '') // HHMMSS
  const backupFilename = `backup_full_${templates.length}-templates_${date}_${time}.json`
  const backupFilepath = join(EXPORT_DIR, backupFilename)
  
  console.log('💾 백업 생성 중...')
  
  // 전체 백업 생성
  const backup = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    description: 'Complete template backup',
    metadata: {
      totalTemplates: templates.length,
      backupType: 'full',
      source: 'demo-test',
    },
    templates: [],
  }
  
  for (const template of templates) {
    try {
      const exportResponse = await client.exportTemplate({
        templateId: template.id,
        includeStatistics: true,
      })
      
      if (exportResponse.data?.exportTemplate?.success) {
        const exportData = JSON.parse(exportResponse.data.exportTemplate.exportData)
        backup.templates.push({
          ...exportData,
          backupMetadata: {
            originalId: template.id,
            backedUpAt: new Date().toISOString(),
          }
        })
      }
    } catch (error) {
      console.error(`백업 오류 (${template.identifier}):`, error)
    }
  }
  
  await fs.writeFile(backupFilepath, JSON.stringify(backup, null, 2))
  console.log(`✅ 백업 완료: ${backupFilename}`)
  console.log(`   - 백업된 템플릿: ${backup.templates.length}개`)
  
  // 백업 파일 유효성 검사
  console.log('🔍 백업 파일 유효성 검사...')
  const backupContent = await fs.readFile(backupFilepath, 'utf8')
  
  try {
    const backupParsed = JSON.parse(backupContent)
    console.log('✅ 백업 파일 JSON 형식 유효')
    console.log(`   - 버전: ${backupParsed.version}`)
    console.log(`   - 생성일: ${backupParsed.createdAt}`)
    console.log(`   - 템플릿 수: ${backupParsed.templates?.length || 0}개`)
    
    // 복원 시뮬레이션 (실제로는 Import하지 않고 검증만)
    console.log('🔄 복원 시뮬레이션 (검증만)...')
    let validTemplates = 0
    
    for (const templateData of backupParsed.templates) {
      if (templateData.template?.identifier && templateData.template?.query) {
        validTemplates++
      }
    }
    
    console.log(`✅ 복원 가능한 템플릿: ${validTemplates}개`)
    
    if (validTemplates === backup.templates.length) {
      console.log('🎉 백업 무결성 검증 완료!')
    } else {
      console.warn('⚠️  일부 템플릿에 문제가 있을 수 있습니다.')
    }
    
  } catch (parseError) {
    console.error('❌ 백업 파일 손상:', parseError)
  }
}

// 파일 정리 유틸리티 함수
export async function cleanupExportedFiles() {
  try {
    const files = await fs.readdir(EXPORT_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    console.log(`🧹 ${jsonFiles.length}개 파일 정리 중...`)
    
    for (const filename of jsonFiles) {
      await fs.unlink(join(EXPORT_DIR, filename))
      console.log(`🗑️  삭제됨: ${filename}`)
    }
    
    console.log('✅ 파일 정리 완료')
  } catch (error) {
    console.error('❌ 파일 정리 실패:', error)
  }
}