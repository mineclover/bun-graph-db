import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditCanonicalDocuments } from '../../scripts/check-docs.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('canonical documentation audit', () => {
  test('checks source/test provenance and local links, excluding code examples and URLs', () => {
    const root = fixture()
    writeFileSync(join(root, 'implementation.ts'), '')
    writeFileSync(join(root, 'behavior.test.ts'), '')
    writeFileSync(join(root, 'docs', 'reference.md'), header +
      'sources: [implementation.ts]\ntests: [behavior.test.ts]\n---\n' +
      '[source](../implementation.ts#L1) [web](https://example.com/a) [route](/graphql)\n' +
      '```md\n[sample](./not-a-real-file.md)\n```\n')
    expect(auditCanonicalDocuments(root)).toEqual({ checked: 1, issues: [] })
  })

  test('reports missing implementation, test and local documentation targets', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs', 'reference.md'), header +
      'sources: [missing.ts]\ntests: [missing.test.ts]\n---\n[other](./missing.md)\n')
    const audit = auditCanonicalDocuments(root)
    expect(audit.checked).toBe(1)
    expect(audit.issues).toHaveLength(3)
    expect(audit.issues.join('\n')).toContain('missing sources target missing.ts')
    expect(audit.issues.join('\n')).toContain('missing tests target missing.test.ts')
    expect(audit.issues.join('\n')).toContain('missing local link ./missing.md')
  })

  test('rejects invalid verification dates, missing document types and empty provenance lists', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs', 'reference.md'),
      '---\ncanonical: true\nlastVerified: "2026-02-30"\nsources: []\ntests: wrong\n---\n')
    expect(auditCanonicalDocuments(root).issues).toHaveLength(5)
  })

  test('does not count historical reports or noncanonical pages as verified docs', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs', 'history.md'), '# Old passing badge\n[old](missing.md)\n')
    writeFileSync(join(root, 'docs', 'draft.md'), '---\ncanonical: false\n---\n')
    expect(auditCanonicalDocuments(root)).toEqual({ checked: 0, issues: ['No canonical documents found under docs/'] })
  })

  test('reports malformed frontmatter and continues checking other canonical pages', () => {
    const root = fixture()
    writeFileSync(join(root, 'docs', 'bad.md'), '---\ncanonical: [broken\n---\n')
    writeFileSync(join(root, 'docs', 'good.md'), `${header}---\n`)
    const audit = auditCanonicalDocuments(root)
    expect(audit.checked).toBe(1)
    expect(audit.issues).toEqual(['docs/bad.md: invalid YAML metadata'])
  })
})

const header = '---\ndocType: reference\nsourceLocale: ko\ncanonical: true\nlastVerified: "2026-10-27"\n'

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'bun-graph-docs-'))
  roots.push(root)
  mkdirSync(join(root, 'docs'))
  return root
}
