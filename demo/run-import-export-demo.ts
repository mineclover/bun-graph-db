#!/usr/bin/env bun

import { runImportExportDemo } from './template-queries/import-export-demo.js'
import { DemoRunner, parseCliArgs } from './utils/demo-runner.js'

async function main() {
  const args = parseCliArgs()
  const runner = new DemoRunner(args)

  try {
    console.log(`🚀 서버 ${args.serverUrl}에 연결하여 Import/Export 데모를 실행합니다`)
    await runImportExportDemo(runner)
  } catch (error) {
    console.error('💥 데모 실행 중 오류 발생:', error)
    process.exit(1)
  }
}

main()
