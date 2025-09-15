#!/usr/bin/env bun

import {
  cleanupExportedFiles,
  runFileImportExportDemo,
} from './template-queries/file-import-export-demo.js'
import { DemoRunner, parseCliArgs } from './utils/demo-runner.js'

async function main() {
  const args = parseCliArgs()
  const runner = new DemoRunner(args)

  // 명령줄 인수 처리
  const shouldCleanup = process.argv.includes('--cleanup')
  const skipCleanup = process.argv.includes('--no-cleanup')

  try {
    console.log(`🚀 서버 ${args.serverUrl}에 연결하여 파일 기반 Import/Export 데모를 실행합니다`)

    // 정리 명령인 경우
    if (shouldCleanup) {
      console.log('\n🧹 이전 Export 파일들을 정리합니다...')
      await cleanupExportedFiles()
      return
    }

    // 데모 실행
    await runFileImportExportDemo(runner)

    // 자동 정리 (--no-cleanup 플래그가 없는 경우)
    if (!skipCleanup) {
      console.log('\n🤔 Export된 파일들을 유지하시겠습니까?')
      console.log('   - 파일 유지: 아무것도 하지 않고 종료')
      console.log('   - 파일 정리: --cleanup 플래그로 다시 실행')
      console.log('   - 예시: bun run demo/run-file-import-export-demo.ts --cleanup')
    }
  } catch (error) {
    console.error('💥 데모 실행 중 오류 발생:', error)
    process.exit(1)
  }
}

main()
