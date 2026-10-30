#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { parse } from 'yaml'

export interface DocumentationAudit {
  checked: number
  issues: string[]
}

/** Checks curated canonical docs; legacy reports are not promoted automatically. */
export function auditCanonicalDocuments(root: string): DocumentationAudit {
  const audit: DocumentationAudit = { checked: 0, issues: [] }
  for (const file of markdownFiles(resolve(root, 'docs'))) {
    const text = readFileSync(file, 'utf8')
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
    if (header === null) continue
    const label = relative(root, file)
    let metadata: unknown
    try {
      metadata = parse(header[1] ?? '')
    } catch {
      audit.issues.push(`${label}: invalid YAML metadata`)
      continue
    }
    if (!isRecord(metadata) || metadata.canonical !== true) continue
    audit.checked += 1

    for (const field of ['docType', 'sourceLocale']) {
      if (typeof metadata[field] !== 'string' || !metadata[field].trim()) {
        audit.issues.push(`${label}: canonical document requires ${field}`)
      }
    }
    const verified = metadata.lastVerified
    if (typeof verified !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(verified) ||
      !Number.isFinite(Date.parse(verified)) || new Date(verified).toISOString().slice(0, 10) !== verified) {
      audit.issues.push(`${label}: lastVerified must be a real YYYY-MM-DD date`)
    }

    for (const field of ['sources', 'tests']) {
      const paths = metadata[field]
      if (paths === undefined) continue
      if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => typeof path !== 'string' || !path.trim())) {
        audit.issues.push(`${label}: ${field} must be a non-empty list of repository-relative paths`)
        continue
      }
      for (const path of paths as string[]) {
        if (!existsSync(resolve(root, path))) audit.issues.push(`${label}: missing ${field} target ${path}`)
      }
    }

    // Exclude fenced code samples; route URLs and anchors are not filesystem links.
    const prose = text.slice(header[0].length).replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    for (const match of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1] ?? ''
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(target)) continue
      const path = target.split('#')[0]?.split('?')[0] ?? ''
      if (path && !existsSync(resolve(dirname(file), path))) audit.issues.push(`${label}: missing local link ${target}`)
    }
  }
  if (audit.checked === 0) audit.issues.push('No canonical documents found under docs/')
  return audit
}

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? markdownFiles(path) : entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

if (import.meta.main) {
  const audit = auditCanonicalDocuments(resolve(import.meta.dir, '..'))
  for (const issue of audit.issues) console.error(issue)
  console.log(`Canonical docs: ${audit.checked} checked; ${audit.issues.length} issues`)
  if (audit.issues.length > 0) process.exitCode = 1
}
