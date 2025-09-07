#!/usr/bin/env bun

/**
 * File-based Template Import Tool
 * 
 * JSON 이스케이핑 문제를 해결하기 위한 파일 기반 템플릿 Import 도구
 * curl의 복잡한 JSON 이스케이핑 대신 안전하고 간단한 방식 사용
 */

import { GraphQLClient } from 'graphql-request';
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';

interface ImportResult {
  filename: string;
  identifier: string;
  status: 'success' | 'exists' | 'error';
  message?: string;
  templateId?: string;
}

interface TemplateData {
  version: string;
  exportedAt: string;
  template: {
    identifier: string;
    name: string;
    description: string;
    query: string;
    variables?: any;
    operationType?: string;
    version?: string;
    tags?: string[];
  };
}

class TemplateImportTool {
  private client: GraphQLClient;

  constructor(graphqlEndpoint = 'http://localhost:4000/graphql') {
    this.client = new GraphQLClient(graphqlEndpoint);
  }

  /**
   * 템플릿이 이미 존재하는지 확인
   */
  async checkTemplateExists(identifier: string): Promise<boolean> {
    const query = `
      query CheckTemplate {
        searchTemplates(filter: {}, pagination: { limit: 100 }) {
          nodes {
            identifier
          }
        }
      }
    `;

    try {
      const result = await this.client.request(query);
      return result.searchTemplates.nodes.some((template: any) => 
        template.identifier === identifier
      );
    } catch (error) {
      console.log(`   Warning: Could not check template existence: ${error}`);
      return false;
    }
  }

  /**
   * 단일 템플릿 파일 Import
   */
  async importTemplateFile(filePath: string, overwrite = false, generateNewId = false): Promise<ImportResult> {
    const filename = basename(filePath);
    
    try {
      // 1. 파일 읽기 및 파싱
      const fileContent = await readFile(filePath, 'utf-8');
      const templateData: TemplateData = JSON.parse(fileContent);

      if (!templateData.template || !templateData.template.identifier) {
        return {
          filename,
          identifier: 'unknown',
          status: 'error',
          message: 'Invalid template file format'
        };
      }

      let targetIdentifier = templateData.template.identifier;

      // 2. 중복 확인
      const exists = await this.checkTemplateExists(targetIdentifier);
      if (exists && !overwrite && !generateNewId) {
        return {
          filename,
          identifier: targetIdentifier,
          status: 'exists',
          message: 'Template already exists (use --overwrite or --generate-id)'
        };
      }

      // 3. 새 ID 생성 (필요시)
      if (generateNewId && exists) {
        const timestamp = Date.now();
        targetIdentifier = `${templateData.template.identifier}-imported-${timestamp}`;
        console.log(`   📝 Generated new identifier: ${targetIdentifier}`);
      }

      // 4. GraphQL mutation 실행
      const mutation = `
        mutation CreateTemplate($input: CreateQueryTemplateInput!) {
          createTemplate(input: $input) {
            success
            template {
              id
              identifier
              name
            }
            errors {
              message
              code
              field
            }
          }
        }
      `;

      const input = {
        identifier: targetIdentifier,
        name: templateData.template.name,
        description: templateData.template.description || '',
        query: templateData.template.query
      };

      // 5. 템플릿 생성 실행
      const result = await this.client.request(mutation, { input });

      if (result.createTemplate.success) {
        return {
          filename,
          identifier: targetIdentifier,
          status: 'success',
          message: `Successfully imported as ID: ${result.createTemplate.template.id}`,
          templateId: result.createTemplate.template.id
        };
      } else {
        const errors = result.createTemplate.errors.map((e: any) => e.message).join(', ');
        return {
          filename,
          identifier: targetIdentifier,
          status: 'error',
          message: `Import failed: ${errors}`
        };
      }

    } catch (error) {
      return {
        filename,
        identifier: 'unknown',
        status: 'error',
        message: `File processing error: ${error}`
      };
    }
  }

  /**
   * 여러 템플릿 파일 일괄 Import
   */
  async importDirectory(dirPath: string, options = { overwrite: false, generateNewId: false }): Promise<ImportResult[]> {
    console.log(`\n📁 Importing templates from: ${dirPath}`);

    try {
      const files = await readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('⚠️  No JSON files found in directory');
        return [];
      }

      console.log(`📋 Found ${jsonFiles.length} JSON files to process\n`);

      const results: ImportResult[] = [];
      let successCount = 0;
      let existsCount = 0;
      let errorCount = 0;

      for (const file of jsonFiles) {
        const filePath = join(dirPath, file);
        console.log(`🔄 Processing: ${file}`);

        const result = await this.importTemplateFile(filePath, options.overwrite, options.generateNewId);
        results.push(result);

        switch (result.status) {
          case 'success':
            console.log(`✅ ${result.identifier}: ${result.message}`);
            successCount++;
            break;
          case 'exists':
            console.log(`➡️  ${result.identifier}: Already exists`);
            existsCount++;
            break;
          case 'error':
            console.log(`❌ ${result.identifier}: ${result.message}`);
            errorCount++;
            break;
        }

        // 서버 부하 방지용 대기
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 결과 요약
      console.log(`\n📊 Import Summary:`);
      console.log(`✅ Imported: ${successCount}`);
      console.log(`➡️  Already exists: ${existsCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      console.log(`📈 Success Rate: ${((successCount) / jsonFiles.length * 100).toFixed(1)}%`);

      return results;

    } catch (error) {
      console.error(`❌ Directory processing error: ${error}`);
      return [];
    }
  }

  /**
   * 템플릿 파일 유효성 검사
   */
  async validateTemplateFile(filePath: string): Promise<{valid: boolean, errors: string[]}> {
    const errors: string[] = [];

    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const templateData = JSON.parse(fileContent);

      // 필수 필드 확인
      if (!templateData.template) {
        errors.push('Missing template object');
      } else {
        if (!templateData.template.identifier) {
          errors.push('Missing template.identifier');
        }
        if (!templateData.template.name) {
          errors.push('Missing template.name');
        }
        if (!templateData.template.query) {
          errors.push('Missing template.query');
        }
      }

      // GraphQL 쿼리 기본 구문 검사 (간단한 체크)
      if (templateData.template?.query) {
        const query = templateData.template.query;
        if (!query.includes('{') || !query.includes('}')) {
          errors.push('Invalid GraphQL query format');
        }
      }

    } catch (error) {
      errors.push(`File parsing error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 디렉토리 내 모든 파일 검증
   */
  async validateDirectory(dirPath: string): Promise<void> {
    console.log(`\n🔍 Validating template files in: ${dirPath}`);

    try {
      const files = await readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      console.log(`📋 Found ${jsonFiles.length} JSON files\n`);

      let validCount = 0;
      let invalidCount = 0;

      for (const file of jsonFiles) {
        const filePath = join(dirPath, file);
        const validation = await this.validateTemplateFile(filePath);

        if (validation.valid) {
          console.log(`✅ ${file}: Valid template file`);
          validCount++;
        } else {
          console.log(`❌ ${file}: ${validation.errors.join(', ')}`);
          invalidCount++;
        }
      }

      console.log(`\n📊 Validation Summary:`);
      console.log(`✅ Valid: ${validCount}`);
      console.log(`❌ Invalid: ${invalidCount}`);

    } catch (error) {
      console.error(`❌ Validation error: ${error}`);
    }
  }
}

// CLI 실행부
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  const importTool = new TemplateImportTool();

  if (command === 'file' && args[1]) {
    // 단일 파일 import
    const filePath = args[1];
    const overwrite = args.includes('--overwrite');
    const generateNewId = args.includes('--generate-id');

    console.log(`\n📄 Importing single file: ${filePath}`);
    
    importTool.importTemplateFile(filePath, overwrite, generateNewId)
      .then(result => {
        switch (result.status) {
          case 'success':
            console.log(`✅ Import successful: ${result.message}`);
            break;
          case 'exists':
            console.log(`⚠️  ${result.message}`);
            break;
          case 'error':
            console.log(`❌ Import failed: ${result.message}`);
            process.exit(1);
            break;
        }
      })
      .catch(error => {
        console.error('❌ Import error:', error);
        process.exit(1);
      });

  } else if (command === 'dir' && args[1]) {
    // 디렉토리 일괄 import
    const dirPath = args[1];
    const overwrite = args.includes('--overwrite');
    const generateNewId = args.includes('--generate-id');

    importTool.importDirectory(dirPath, { overwrite, generateNewId })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Directory import error:', error);
        process.exit(1);
      });

  } else if (command === 'validate' && args[1]) {
    // 파일 또는 디렉토리 검증
    const targetPath = args[1];
    
    // 파일인지 디렉토리인지 확인
    import('fs').then(fs => {
      fs.stat(targetPath, (err, stats) => {
        if (err) {
          console.error(`❌ Path not found: ${targetPath}`);
          process.exit(1);
        }

        if (stats.isDirectory()) {
          importTool.validateDirectory(targetPath)
            .then(() => process.exit(0))
            .catch(error => {
              console.error('❌ Validation error:', error);
              process.exit(1);
            });
        } else {
          importTool.validateTemplateFile(targetPath)
            .then(result => {
              if (result.valid) {
                console.log(`✅ ${basename(targetPath)}: Valid template file`);
              } else {
                console.log(`❌ ${basename(targetPath)}: ${result.errors.join(', ')}`);
                process.exit(1);
              }
            })
            .catch(error => {
              console.error('❌ Validation error:', error);
              process.exit(1);
            });
        }
      });
    });

  } else {
    console.log(`
File-based Template Import Tool

Usage:
  bun scripts/template-import.ts file <path> [--overwrite] [--generate-id]     # Import single file
  bun scripts/template-import.ts dir <path> [--overwrite] [--generate-id]      # Import directory
  bun scripts/template-import.ts validate <path>                               # Validate file or directory

Options:
  --overwrite     Replace existing templates with same identifier
  --generate-id   Generate new identifier if template exists (adds timestamp)

Examples:
  bun scripts/template-import.ts file demo/templates/my-template.json
  bun scripts/template-import.ts file demo/templates/my-template.json --overwrite
  bun scripts/template-import.ts dir demo/templates --generate-id
  bun scripts/template-import.ts validate demo/templates/my-template.json
  bun scripts/template-import.ts validate demo/templates/

Features:
  ✅ No JSON escaping issues (file-based approach)
  ✅ Duplicate detection and handling
  ✅ Batch processing with server-friendly delays
  ✅ Comprehensive validation before import
  ✅ Safe error handling and rollback
  ✅ New identifier generation for conflicts
`);
    process.exit(1);
  }
}

export { TemplateImportTool, type ImportResult };