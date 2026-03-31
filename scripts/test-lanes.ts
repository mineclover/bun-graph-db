#!/usr/bin/env bun

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'bun'

type Lane = 'parallel-safe' | 'serial-only'

interface TestFile {
  path: string
  lane: Lane
}

interface RunResult {
  path: string
  success: boolean
  durationMs: number
  output: string
}

const ROOT = process.cwd()
const TEST_DIR = join(ROOT, 'tests')

function collectTestFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...collectTestFiles(fullPath))
      continue
    }

    if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function classify(path: string): Lane {
  const relative = path.replace(`${ROOT}/`, '')

  if (relative.startsWith('tests/unit/')) {
    return 'parallel-safe'
  }

  if (
    relative.startsWith('tests/template-indexing/') ||
    relative.startsWith('tests/system-queries/') ||
    relative.endsWith('-isolated.test.ts') ||
    relative.startsWith('tests/contract/')
  ) {
    return 'serial-only'
  }

  return 'serial-only'
}

function serialPriority(path: string): number {
  const relative = path.replace(`${ROOT}/`, '')

  const priorityPatterns = [
    'tests/integration/mcp-rest-proxy-improved.test.ts',
    'tests/integration/server-independence-validation.test.ts',
    'tests/comprehensive/graphql-api-comprehensive.test.ts',
    'tests/e2e/doc-system-e2e.test.ts',
    'tests/contract/table-isolation-contract.test.ts',
    'tests/integration/mcp-table-integration.test.ts',
  ]

  const matchedIndex = priorityPatterns.indexOf(relative)
  return matchedIndex === -1 ? Number.MAX_SAFE_INTEGER : matchedIndex
}

async function runCommand(args: string[], label: string): Promise<RunResult> {
  const started = Date.now()
  const proc = spawn(args, {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  await proc.exited

  return {
    path: label,
    success: proc.exitCode === 0,
    durationMs: Date.now() - started,
    output: `${stdout}${stderr}`.trim(),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const laneFilter = args.includes('--lane') ? (args[args.indexOf('--lane') + 1] as Lane | undefined) : undefined
  const matchFilter = args.includes('--match') ? args[args.indexOf('--match') + 1] : undefined

  const files = collectTestFiles(TEST_DIR)
  const classified: TestFile[] = files
    .filter((path) => !matchFilter || path.includes(matchFilter))
    .map((path) => ({ path, lane: classify(path) }))

  const parallelSafe =
    laneFilter && laneFilter !== 'parallel-safe'
      ? []
      : classified.filter((file) => file.lane === 'parallel-safe').map((file) => file.path)
  const serialOnly =
    laneFilter && laneFilter !== 'serial-only'
      ? []
      : classified
          .filter((file) => file.lane === 'serial-only')
          .sort((a, b) => {
            const priorityDiff = serialPriority(a.path) - serialPriority(b.path)
            if (priorityDiff !== 0) {
              return priorityDiff
            }
            return a.path.localeCompare(b.path)
          })
          .map((file) => file.path)

  console.log(`Discovered ${files.length} test files`)
  console.log(`Parallel-safe: ${parallelSafe.length}`)
  console.log(`Serial-only: ${serialOnly.length}`)

  const results: RunResult[] = []

  if (parallelSafe.length > 0) {
    console.log('\nRunning parallel-safe lane...')
    results.push(await runCommand(['bun', 'test', ...parallelSafe], 'parallel-safe'))
  }

  if (serialOnly.length > 0) {
    console.log('\nRunning serial-only lane...')
    for (const file of serialOnly) {
      const relative = file.replace(`${ROOT}/`, '')
      console.log(` - ${relative}`)
      results.push(await runCommand(['bun', 'test', file], relative))
    }
  }

  const failed = results.filter((result) => !result.success)

  console.log('\nLane summary')
  for (const result of results) {
    console.log(`${result.success ? 'PASS' : 'FAIL'} ${result.path} (${result.durationMs}ms)`)
  }

  if (failed.length > 0) {
    console.log('\nFailures')
    for (const result of failed) {
      console.log(`\n# ${result.path}`)
      console.log(result.output)
    }
    process.exit(1)
  }
}

await main()
