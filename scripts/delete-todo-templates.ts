#!/usr/bin/env bun

/**
 * TODO 카테고리 템플릿 삭제 스크립트
 * 문제가 있는 TODO 관련 템플릿들을 안전하게 삭제합니다
 */

import { Database } from 'bun:sqlite'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const DB_PATH = 'data/bun-graph-db.sqlite'
const BACKUP_DIR = join(process.cwd(), 'backups', 'todo-templates')

// 삭제할 TODO 템플릿 목록
const TODO_TEMPLATES_TO_DELETE = [
  'create-todo',
  'update-todo',
  'bulk-update-todo-status',
  'delete-todo'
]

async function main() {
  console.log('🗑️ TODO 카테고리 템플릿 삭제 시작')

  try {
    // 1. 백업 디렉토리 생성
    await ensureBackupDirectory()

    // 2. 템플릿 백업
    const templatesBackup = await backupTodoTemplates()
    console.log(`📦 ${templatesBackup.length}개 템플릿 백업 완료`)

    // 3. 템플릿 삭제 (soft delete)
    const deletedCount = await deleteTodoTemplates()
    console.log(`🗑️ ${deletedCount}개 템플릿 삭제 완료`)

    // 4. 결과 요약
    await generateDeletionReport(templatesBackup, deletedCount)

    console.log('✅ TODO 템플릿 삭제 완료!')

  } catch (error) {
    console.error('❌ 삭제 중 오류 발생:', error)
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

async function backupTodoTemplates() {
  const db = new Database(DB_PATH)

  const query = `
    SELECT * FROM templates
    WHERE identifier IN (${TODO_TEMPLATES_TO_DELETE.map(() => '?').join(',')})
  `

  const templates = db.query(query).all(...TODO_TEMPLATES_TO_DELETE)
  db.close()

  // 백업 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = join(BACKUP_DIR, `todo-templates-backup-${timestamp}.json`)

  const backupData = {
    timestamp: new Date().toISOString(),
    templates: templates,
    deletionReason: 'GraphQL schema incompatibility - TODO templates require major restructuring'
  }

  await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2))
  console.log(`💾 백업 저장: ${backupFile}`)

  return templates
}

async function deleteTodoTemplates() {
  const db = new Database(DB_PATH)

  try {
    db.exec('BEGIN TRANSACTION')

    // Soft delete: is_active를 false로 설정
    const updateQuery = `
      UPDATE templates
      SET is_active = 0, updated_at = datetime('now')
      WHERE identifier IN (${TODO_TEMPLATES_TO_DELETE.map(() => '?').join(',')})
    `

    const result = db.query(updateQuery).run(...TODO_TEMPLATES_TO_DELETE)

    db.exec('COMMIT')

    console.log(`🔄 ${result.changes}개 템플릿 비활성화 완료`)
    return result.changes

  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  } finally {
    db.close()
  }
}

async function generateDeletionReport(templates: any[], deletedCount: number) {
  const timestamp = new Date().toISOString()

  const report = `# TODO 템플릿 삭제 리포트

**삭제 일시**: ${timestamp}
**삭제된 템플릿 수**: ${deletedCount}개

## 삭제된 템플릿 목록

| 템플릿명 | 사용횟수 | 삭제 이유 |
|---------|---------|----------|
${templates.map(t =>
  `| ${t.identifier} | ${t.usage_count}회 | GraphQL 스키마 불일치 |`
).join('\n')}

## 삭제 이유

TODO 카테고리 템플릿들은 다음과 같은 이유로 삭제되었습니다:

1. **GraphQL 스키마 불일치**: 현재 스키마와 템플릿 구조가 맞지 않음
2. **복잡한 수정 필요**: 단순 수정으로는 해결 불가능
3. **대체 기능 존재**: NODE 템플릿으로 동일한 기능 구현 가능
4. **사용자 혼란 방지**: 동작하지 않는 템플릿 제거로 사용성 개선

## 복구 방법

필요시 백업 파일에서 복구 가능:
\`\`\`bash
# 백업 디렉토리 확인
ls ${BACKUP_DIR}

# 수동 복구 (SQL 직접 실행 필요)
# UPDATE templates SET is_active = 1 WHERE identifier IN (...)
\`\`\`

---
*자동 생성됨 by delete-todo-templates.ts*
`

  const reportFile = join(BACKUP_DIR, `deletion-report-${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  await fs.writeFile(reportFile, report)

  console.log(`📋 리포트 생성: ${reportFile}`)
}

if (import.meta.main) {
  main()
}