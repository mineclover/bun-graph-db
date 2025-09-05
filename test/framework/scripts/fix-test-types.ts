#!/usr/bin/env bun

/**
 * Automated Test Type Fixing Script
 * 기존 테스트 파일들의 타입 에러를 자동으로 수정하는 스크립트
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'

interface TypeFixRule {
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  description: string
}

class TestTypeFixScript {
  private fixRules: TypeFixRule[] = [
    // Fix Mock type declarations
    {
      pattern: /let mock(\w+): I(\w+)/g,
      replacement: 'let mock$1: jest.Mocked<I$2>',
      description: 'Fix mock type declarations to use jest.Mocked<T>'
    },
    
    // Fix Partial<Node> usage
    {
      pattern: /const mock(\w+): Partial<(\w+)>/g,
      replacement: 'const mock$1Dto = TestFramework.TypeMapper.createMock$2Dto',
      description: 'Replace Partial<Entity> with TypeMapper factory'
    },
    
    // Fix mockNode as Node casting
    {
      pattern: /mockNode as Node/g,
      replacement: 'mockNodeDto',
      description: 'Replace unsafe Entity casting with DTO usage'
    },
    
    // Fix GraphQL response structure
    {
      pattern: /\{\s*items: \[(.*?)\],\s*total: (\d+),\s*hasNextPage: (.*?),\s*hasPreviousPage: (.*?)\s*\}/g,
      replacement: (match, items, total, hasNext, hasPrev) => 
        `TestFramework.TypeMapper.createPaginatedResult([${items}], ${total}, ${hasNext}, ${hasPrev})`,
      description: 'Replace manual pagination object with TypeMapper factory'
    },

    // Fix string | undefined issues
    {
      pattern: /if \((\w+)\) \{[\s\S]*?\}/g,
      replacement: (match, variable) => 
        match.replace(variable, `testContext.errorHandler.assertNonNull(${variable}, '${variable} is required')`),
      description: 'Add null safety assertions'
    },

    // Fix unknown type issues
    {
      pattern: /(\w+) is of type 'unknown'/g,
      replacement: 'testContext.errorHandler.safeUnwrap<ExpectedType>($1)',
      description: 'Use safe unwrapping for unknown types'
    },

    // Add framework imports
    {
      pattern: /^(import.*from 'bun:test')$/m,
      replacement: `$1
import { 
  createTestContext, 
  TestFramework, 
  type NodeDto, 
  type TableDto, 
  type PaginatedResult,
  type StandardMutationResult
} from '../../framework/TestFramework.js'`,
      description: 'Add TestFramework imports'
    }
  ]

  async fixTestFiles(): Promise<void> {
    console.log('🔧 Starting automated test type fixing...')
    
    const testFiles = await this.findTestFiles()
    console.log(`📁 Found ${testFiles.length} test files`)

    let fixedCount = 0
    let errorCount = 0

    for (const filePath of testFiles) {
      try {
        const fixed = await this.fixFile(filePath)
        if (fixed) {
          fixedCount++
          console.log(`✅ Fixed: ${filePath}`)
        }
      } catch (error) {
        errorCount++
        console.error(`❌ Error fixing ${filePath}:`, error)
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`  • Files processed: ${testFiles.length}`)
    console.log(`  • Files fixed: ${fixedCount}`)
    console.log(`  • Errors: ${errorCount}`)
  }

  private async findTestFiles(): Promise<string[]> {
    const patterns = [
      'test/**/*.test.ts',
      'test/**/test-*.ts',
      'test/**/*Test.ts'
    ]

    const files: string[] = []
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: process.cwd() })
      files.push(...matches)
    }

    return [...new Set(files)] // Remove duplicates
  }

  private async fixFile(filePath: string): Promise<boolean> {
    if (!existsSync(filePath)) {
      return false
    }

    let content = readFileSync(filePath, 'utf-8')
    const originalContent = content
    let changesApplied = 0

    // Apply fix rules
    for (const rule of this.fixRules) {
      const before = content
      if (typeof rule.replacement === 'string') {
        content = content.replace(rule.pattern, rule.replacement)
      } else {
        content = content.replace(rule.pattern, rule.replacement)
      }
      
      if (content !== before) {
        changesApplied++
        console.log(`    → Applied: ${rule.description}`)
      }
    }

    // Add test context setup if not present
    if (content.includes('describe(') && !content.includes('createTestContext')) {
      const describeMatch = content.match(/describe\('([^']+)'/)
      if (describeMatch) {
        const testName = describeMatch[1].toLowerCase().replace(/\s+/g, '-')
        const contextLine = `  const testContext = createTestContext('${testName}')\n`
        
        content = content.replace(
          /describe\('([^']+)', \(\) => \{/,
          `describe('$1', () => {\n${contextLine}`
        )
        changesApplied++
      }
    }

    // Write file if changes were made
    if (content !== originalContent) {
      writeFileSync(filePath, content)
      return true
    }

    return false
  }

  async validateFixes(): Promise<void> {
    console.log('\n🔍 Validating type fixes...')
    
    try {
      const { execSync } = await import('child_process')
      execSync('bun typecheck', { stdio: 'pipe' })
      console.log('✅ Type checking passed!')
    } catch (error) {
      console.log('⚠️  Some type errors remain - manual review needed')
      // Don't throw - some errors might be expected
    }
  }
}

// CLI interface
if (import.meta.main) {
  const script = new TestTypeFixScript()
  
  const args = process.argv.slice(2)
  const shouldValidate = args.includes('--validate')
  
  try {
    await script.fixTestFiles()
    
    if (shouldValidate) {
      await script.validateFixes()
    }
    
    console.log('\n🎉 Test type fixing completed!')
    process.exit(0)
  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}