#!/usr/bin/env bun

/**
 * 스크립트 및 package.json 정리 도구
 * 불필요하거나 동작하지 않는 스크립트들을 식별하고 정리합니다
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

interface ScriptAnalysis {
  name: string
  path: string
  exists: boolean
  category: 'core' | 'deprecated' | 'duplicate' | 'test' | 'dev-tool' | 'unknown'
  usage: 'high' | 'medium' | 'low' | 'none'
  recommendation: 'keep' | 'archive' | 'remove'
  reason: string
}

interface PackageScriptAnalysis {
  name: string
  command: string
  targetFile: string
  exists: boolean
  category: 'core' | 'deprecated' | 'duplicate' | 'test' | 'dev-tool' | 'unknown'
  recommendation: 'keep' | 'archive' | 'remove'
  reason: string
}

async function main() {
  console.log('🧹 스크립트 및 package.json 정리 시작')

  const args = process.argv.slice(2)
  const executeMode = args.includes('--execute')
  const dryRun = args.includes('--dry-run')

  try {
    // 1. scripts/ 디렉토리 분석
    const scriptAnalysis = await analyzeScripts()
    console.log(`📁 ${scriptAnalysis.length}개 스크립트 파일 분석 완료`)

    // 2. package.json 스크립트 분석
    const packageScriptAnalysis = await analyzePackageScripts()
    console.log(`📦 ${packageScriptAnalysis.length}개 npm 스크립트 분석 완료`)

    // 3. 정리 계획 생성
    await generateCleanupPlan(scriptAnalysis, packageScriptAnalysis)

    // 4. 정리 실행 또는 옵션 제시
    if (executeMode) {
      await executeCleanup(scriptAnalysis, packageScriptAnalysis)
    } else if (dryRun) {
      await dryRunCleanup(scriptAnalysis, packageScriptAnalysis)
    } else {
      await presentCleanupOptions(scriptAnalysis, packageScriptAnalysis)
    }

  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error)
    process.exit(1)
  }
}

async function analyzeScripts(): Promise<ScriptAnalysis[]> {
  const scriptsDir = join(process.cwd(), 'scripts')
  const files = await fs.readdir(scriptsDir)
  const tsFiles = files.filter(f => f.endsWith('.ts'))

  const analyses: ScriptAnalysis[] = []

  for (const file of tsFiles) {
    const filePath = join(scriptsDir, file)
    const content = await fs.readFile(filePath, 'utf8')

    const analysis: ScriptAnalysis = {
      name: file,
      path: filePath,
      exists: true,
      category: categorizeScript(file, content),
      usage: assessUsage(file, content),
      recommendation: 'keep',
      reason: ''
    }

    // 권장사항 결정
    if (analysis.category === 'deprecated' || analysis.usage === 'none') {
      analysis.recommendation = 'remove'
      analysis.reason = '더 이상 사용되지 않거나 중복된 기능'
    } else if (analysis.category === 'duplicate') {
      analysis.recommendation = 'archive'
      analysis.reason = '기능이 중복되는 스크립트'
    } else if (analysis.category === 'core' || analysis.usage === 'high') {
      analysis.recommendation = 'keep'
      analysis.reason = '핵심 기능 또는 높은 사용률'
    } else {
      analysis.recommendation = 'archive'
      analysis.reason = '필요시 복원 가능한 보조 기능'
    }

    analyses.push(analysis)
  }

  return analyses
}

function categorizeScript(filename: string, content: string): ScriptAnalysis['category'] {
  // 최신 템플릿 관리 스크립트들 (핵심)
  const coreScripts = [
    'test-templates.ts',
    'fix-simple-templates.ts',
    'recreate-complex-templates.ts',
    'improve-node-templates.ts',
    'delete-todo-templates.ts',
    'simple-export-fixed.ts'
  ]

  // 테스트 관련
  if (filename.includes('test-') || content.includes('test runner') || content.includes('test framework')) {
    return 'test'
  }

  // 핵심 스크립트
  if (coreScripts.includes(filename)) {
    return 'core'
  }

  // 중복 기능 (여러 export/import 스크립트들)
  if (filename.includes('export-all-templates') && filename !== 'export-all-templates-fixed.ts') {
    return 'duplicate'
  }

  // TODO 관련 (삭제된 카테고리)
  if (filename.includes('todo-') || filename.includes('create-') && content.includes('todo')) {
    return 'deprecated'
  }

  // 관계 템플릿 생성 (중복)
  if (filename.includes('create-') && filename.includes('relation')) {
    return 'duplicate'
  }

  // 개발 도구
  if (filename.includes('generate-') || filename.includes('analyzer') || filename.includes('cleanup')) {
    return 'dev-tool'
  }

  return 'unknown'
}

function assessUsage(filename: string, content: string): ScriptAnalysis['usage'] {
  // 핵심 기능
  if (['test-templates.ts', 'simple-export-fixed.ts'].includes(filename)) {
    return 'high'
  }

  // 최근 생성된 템플릿 관리 스크립트들
  if (['fix-simple-templates.ts', 'recreate-complex-templates.ts', 'improve-node-templates.ts'].includes(filename)) {
    return 'high'
  }

  // 테스트 스크립트들
  if (filename.includes('test-')) {
    return 'medium'
  }

  // 폐기된 기능들
  if (filename.includes('todo-') || filename.includes('relation-')) {
    return 'none'
  }

  return 'low'
}

async function analyzePackageScripts(): Promise<PackageScriptAnalysis[]> {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
  const scripts = packageJson.scripts

  const analyses: PackageScriptAnalysis[] = []

  for (const [name, command] of Object.entries(scripts) as [string, string][]) {
    const targetFile = extractTargetFile(command)
    const exists = targetFile ? existsSync(targetFile) : true

    const analysis: PackageScriptAnalysis = {
      name,
      command,
      targetFile: targetFile || '',
      exists,
      category: categorizePackageScript(name, command),
      recommendation: 'keep',
      reason: ''
    }

    // 권장사항 결정
    if (!exists && targetFile) {
      analysis.recommendation = 'remove'
      analysis.reason = '대상 파일이 존재하지 않음'
    } else if (analysis.category === 'deprecated') {
      analysis.recommendation = 'remove'
      analysis.reason = '더 이상 사용되지 않는 기능'
    } else if (analysis.category === 'duplicate') {
      analysis.recommendation = 'archive'
      analysis.reason = '중복된 기능'
    } else if (analysis.category === 'core') {
      analysis.recommendation = 'keep'
      analysis.reason = '핵심 기능'
    } else {
      analysis.recommendation = 'archive'
      analysis.reason = '보조 기능'
    }

    analyses.push(analysis)
  }

  return analyses
}

function extractTargetFile(command: string): string | null {
  const match = command.match(/bun\s+(.+?\.ts)/)
  return match ? match[1] : null
}

function categorizePackageScript(name: string, command: string): PackageScriptAnalysis['category'] {
  // 절대 핵심 스크립트들 (실제 파일 존재 여부와 관계없이 유지)
  const absoluteCoreScripts = ['start', 'lint', 'format', 'check', 'typecheck', 'codegen', 'schema:generate', 'schema:update']

  // 유용한 테스트 스크립트들
  const usefulTestScripts = ['test:templates', 'test:bun']

  // 유용한 export/import 스크립트들
  const usefulDataScripts = ['export:fixed', 'import:final', 'table:export', 'table:import']

  if (absoluteCoreScripts.includes(name) || usefulTestScripts.includes(name) || usefulDataScripts.includes(name)) {
    return 'core'
  }

  // dev, build, test는 파일이 있어야 core로 인정
  if (['dev', 'build', 'test'].includes(name)) {
    return 'core'
  }

  // 중복된 테스트 스크립트들
  if (name.startsWith('test:') && name.includes('old')) {
    return 'deprecated'
  }

  // 존재하지 않는 파일을 가리키는 테스트 스크립트들
  if (name.startsWith('test:') && !usefulTestScripts.includes(name)) {
    return 'duplicate'
  }

  // 폐기된 기능들
  if (name.includes('todo') || name.includes('relation')) {
    return 'deprecated'
  }

  // 개발 도구
  if (name.includes('demo') || name.includes('pipeline') || name.includes('batch') || name.includes('logs:')) {
    return 'dev-tool'
  }

  return 'unknown'
}

async function generateCleanupPlan(
  scriptAnalysis: ScriptAnalysis[],
  packageScriptAnalysis: PackageScriptAnalysis[]
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  const plan = {
    timestamp,
    scripts: {
      total: scriptAnalysis.length,
      toRemove: scriptAnalysis.filter(s => s.recommendation === 'remove'),
      toArchive: scriptAnalysis.filter(s => s.recommendation === 'archive'),
      toKeep: scriptAnalysis.filter(s => s.recommendation === 'keep')
    },
    packageScripts: {
      total: packageScriptAnalysis.length,
      toRemove: packageScriptAnalysis.filter(s => s.recommendation === 'remove'),
      toArchive: packageScriptAnalysis.filter(s => s.recommendation === 'archive'),
      toKeep: packageScriptAnalysis.filter(s => s.recommendation === 'keep')
    }
  }

  await fs.writeFile(
    `cleanup-plan-${timestamp}.json`,
    JSON.stringify(plan, null, 2)
  )

  console.log(`📋 정리 계획 생성: cleanup-plan-${timestamp}.json`)
}

async function presentCleanupOptions(
  scriptAnalysis: ScriptAnalysis[],
  packageScriptAnalysis: PackageScriptAnalysis[]
) {
  console.log('\n📊 정리 요약:')

  console.log('\n🗂️ 스크립트 파일:')
  console.log(`  📁 전체: ${scriptAnalysis.length}개`)
  console.log(`  ✅ 유지: ${scriptAnalysis.filter(s => s.recommendation === 'keep').length}개`)
  console.log(`  📦 보관: ${scriptAnalysis.filter(s => s.recommendation === 'archive').length}개`)
  console.log(`  🗑️ 삭제: ${scriptAnalysis.filter(s => s.recommendation === 'remove').length}개`)

  console.log('\n📦 package.json 스크립트:')
  console.log(`  📁 전체: ${packageScriptAnalysis.length}개`)
  console.log(`  ✅ 유지: ${packageScriptAnalysis.filter(s => s.recommendation === 'keep').length}개`)
  console.log(`  📦 보관: ${packageScriptAnalysis.filter(s => s.recommendation === 'archive').length}개`)
  console.log(`  🗑️ 삭제: ${packageScriptAnalysis.filter(s => s.recommendation === 'remove').length}개`)

  console.log('\n🗑️ 삭제 권장 파일들:')
  scriptAnalysis
    .filter(s => s.recommendation === 'remove')
    .forEach(s => console.log(`  - ${s.name}: ${s.reason}`))

  console.log('\n🗑️ 삭제 권장 npm 스크립트들:')
  packageScriptAnalysis
    .filter(s => s.recommendation === 'remove')
    .forEach(s => console.log(`  - ${s.name}: ${s.reason}`))

  console.log('\n📦 보관 권장 파일들:')
  scriptAnalysis
    .filter(s => s.recommendation === 'archive')
    .forEach(s => console.log(`  - ${s.name}: ${s.reason}`))

  console.log('\n💡 정리 실행:')
  console.log('  bun scripts/cleanup-scripts.ts --execute  # 실제 정리 실행')
  console.log('  bun scripts/cleanup-scripts.ts --dry-run  # 시뮬레이션만')
}

async function executeCleanup(
  scriptAnalysis: ScriptAnalysis[],
  packageScriptAnalysis: PackageScriptAnalysis[]
) {
  console.log('\n🚀 정리 실행 중...')

  // 1. 보관 디렉토리 생성
  const archiveDir = join(process.cwd(), 'scripts-archive')
  await fs.mkdir(archiveDir, { recursive: true })

  // 2. 스크립트 파일 정리
  const filesToRemove = scriptAnalysis.filter(s => s.recommendation === 'remove')
  const filesToArchive = scriptAnalysis.filter(s => s.recommendation === 'archive')

  console.log(`\n📁 스크립트 파일 정리: ${filesToRemove.length}개 삭제, ${filesToArchive.length}개 보관`)

  // 삭제
  for (const file of filesToRemove) {
    await fs.unlink(file.path)
    console.log(`  🗑️ 삭제: ${file.name}`)
  }

  // 보관
  for (const file of filesToArchive) {
    const archivePath = join(archiveDir, file.name)
    await fs.rename(file.path, archivePath)
    console.log(`  📦 보관: ${file.name}`)
  }

  // 3. package.json 정리
  await cleanupPackageJson(packageScriptAnalysis)

  console.log('\n✅ 정리 완료!')
}

async function dryRunCleanup(
  scriptAnalysis: ScriptAnalysis[],
  packageScriptAnalysis: PackageScriptAnalysis[]
) {
  console.log('\n🔍 정리 시뮬레이션 (실제 변경 없음):')

  const filesToRemove = scriptAnalysis.filter(s => s.recommendation === 'remove')
  const filesToArchive = scriptAnalysis.filter(s => s.recommendation === 'archive')
  const scriptsToRemove = packageScriptAnalysis.filter(s => s.recommendation === 'remove')

  console.log(`\n📁 스크립트 파일 변경:`)
  console.log(`  🗑️ 삭제 예정: ${filesToRemove.length}개`)
  filesToRemove.forEach(f => console.log(`    - ${f.name}`))

  console.log(`  📦 보관 예정: ${filesToArchive.length}개`)
  filesToArchive.forEach(f => console.log(`    - ${f.name}`))

  console.log(`\n📦 package.json 스크립트 변경:`)
  console.log(`  🗑️ 삭제 예정: ${scriptsToRemove.length}개`)
  scriptsToRemove.forEach(s => console.log(`    - ${s.name}`))

  console.log('\n💡 실제 정리를 원하면: bun scripts/cleanup-scripts.ts --execute')
}

async function cleanupPackageJson(packageScriptAnalysis: PackageScriptAnalysis[]) {
  console.log('\n📦 package.json 스크립트 정리 중...')

  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
  const scriptsToRemove = packageScriptAnalysis.filter(s => s.recommendation === 'remove')

  console.log(`  🗑️ ${scriptsToRemove.length}개 스크립트 삭제`)

  for (const script of scriptsToRemove) {
    delete packageJson.scripts[script.name]
    console.log(`    - ${script.name}`)
  }

  // 정리된 package.json 저장
  await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2) + '\n')
  console.log('  ✅ package.json 업데이트 완료')
}

if (import.meta.main) {
  main()
}