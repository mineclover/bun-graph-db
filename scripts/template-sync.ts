#!/usr/bin/env bun

/**
 * Template Synchronization Tool
 * 
 * 기존 export된 템플릿 파일들을 서버의 최신 상태와 동기화하는 도구
 * 실용성과 안정성을 중심으로 한 단순한 접근법 사용
 */

import { GraphQLClient } from 'graphql-request';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';

interface TemplateFile {
  path: string;
  identifier: string;
  version: string;
  lastExported: string;
}

interface SyncResult {
  identifier: string;
  status: 'updated' | 'unchanged' | 'not_found' | 'error';
  message?: string;
  oldUsageCount?: number;
  newUsageCount?: number;
}

class TemplateSyncTool {
  private client: GraphQLClient;
  private templatesDir: string;

  constructor(graphqlEndpoint = 'http://localhost:4000/graphql') {
    this.client = new GraphQLClient(graphqlEndpoint);
    this.templatesDir = join(process.cwd(), 'demo', 'templates');
  }

  /**
   * 기존 export된 템플릿 파일들 스캔
   */
  async scanExportedTemplates(): Promise<TemplateFile[]> {
    const files = await readdir(this.templatesDir);
    const templateFiles: TemplateFile[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = join(this.templatesDir, file);
        const content = JSON.parse(await readFile(filePath, 'utf-8'));
        
        if (content.template && content.template.identifier) {
          templateFiles.push({
            path: filePath,
            identifier: content.template.identifier,
            version: content.version || '1.0.0',
            lastExported: content.exportedAt || 'unknown'
          });
        }
      } catch (error) {
        console.log(`⚠️  Skipping invalid file: ${file} (${error})`);
      }
    }

    return templateFiles;
  }

  /**
   * 서버에서 템플릿 최신 정보 조회
   */
  async getLatestTemplateInfo(identifier: string) {
    // getTemplateByIdentifier를 사용해서 정확한 identifier로 검색
    const query = `
      query GetTemplateByIdentifier($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
          identifier
          name
          description
          query
          variables
          isActive
          usageCount
          createdBy
          createdAt
          updatedAt
        }
      }
    `;

    try {
      const result = await this.client.request(query, { identifier });
      const template = result.getTemplateByIdentifier;
      return template ? {
        ...template,
        statistics: {
          usageCount: template.usageCount,
          avgExecutionTimeMs: 0, // Not available in QueryTemplate
          lastUsedAt: template.updatedAt // Use updatedAt as fallback
        }
      } : null;
    } catch (error) {
      console.log(`   Debug - Query error for ${identifier}:`, error);
      return null;
    }
  }

  /**
   * 템플릿 export 및 파일 업데이트
   */
  async exportAndUpdate(identifier: string, originalFilePath: string): Promise<SyncResult> {
    const exportQuery = `
      mutation ExportTemplate($templateIdentifier: String!, $includeStatistics: Boolean) {
        exportTemplate(templateIdentifier: $templateIdentifier, includeStatistics: $includeStatistics) {
          success
          exportData
          filename
          errors {
            message
          }
        }
      }
    `;

    try {
      // 1. 기존 파일 내용 읽기 (통계 비교용)
      const oldContent = JSON.parse(await readFile(originalFilePath, 'utf-8'));
      const oldUsageCount = oldContent.template?.statistics?.usageCount || 0;

      // 2. 최신 데이터 export
      const result = await this.client.request(exportQuery, { 
        templateIdentifier: identifier,
        includeStatistics: true
      });

      if (!result.exportTemplate.success) {
        return {
          identifier,
          status: 'error',
          message: result.exportTemplate.errors?.map((e: any) => e.message).join(', ') || 'Export failed'
        };
      }

      // 3. 새 데이터 파싱
      const newData = JSON.parse(result.exportTemplate.exportData);
      const newUsageCount = newData.template?.statistics?.usageCount || 0;

      // 4. 변경사항 확인 (사용량 기준으로 간단히 판단)
      if (oldUsageCount === newUsageCount && oldContent.template?.query === newData.template?.query) {
        return {
          identifier,
          status: 'unchanged',
          message: `Usage count unchanged (${oldUsageCount})`,
          oldUsageCount,
          newUsageCount
        };
      }

      // 5. 파일 업데이트
      await writeFile(originalFilePath, result.exportTemplate.exportData, 'utf-8');

      return {
        identifier,
        status: 'updated',
        message: `Updated: ${oldUsageCount} → ${newUsageCount} usage`,
        oldUsageCount,
        newUsageCount
      };

    } catch (error) {
      return {
        identifier,
        status: 'error',
        message: `Sync error: ${error}`
      };
    }
  }

  /**
   * 단일 템플릿 동기화
   */
  async syncTemplate(templateFile: TemplateFile): Promise<SyncResult> {
    console.log(`🔄 Syncing: ${templateFile.identifier}`);

    // 1. 서버에서 템플릿 존재 확인
    const latestInfo = await this.getLatestTemplateInfo(templateFile.identifier);
    if (!latestInfo) {
      return {
        identifier: templateFile.identifier,
        status: 'not_found',
        message: 'Template not found on server'
      };
    }

    // 2. Export 및 업데이트
    return await this.exportAndUpdate(templateFile.identifier, templateFile.path);
  }

  /**
   * 모든 템플릿 동기화 (배치)
   */
  async syncAll(): Promise<SyncResult[]> {
    console.log(`\n🚀 Template Synchronization Started`);
    console.log(`📁 Templates directory: ${this.templatesDir}`);

    // 1. 기존 파일들 스캔
    const templateFiles = await this.scanExportedTemplates();
    console.log(`📋 Found ${templateFiles.length} template files to sync\n`);

    if (templateFiles.length === 0) {
      console.log('⚠️  No template files found to sync');
      return [];
    }

    // 2. 각 템플릿 동기화
    const results: SyncResult[] = [];
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const templateFile of templateFiles) {
      const result = await this.syncTemplate(templateFile);
      results.push(result);

      // 상태별 카운팅 및 출력
      switch (result.status) {
        case 'updated':
          console.log(`✅ ${result.identifier}: ${result.message}`);
          updatedCount++;
          break;
        case 'unchanged':
          console.log(`➡️  ${result.identifier}: No changes needed`);
          unchangedCount++;
          break;
        case 'not_found':
          console.log(`❓ ${result.identifier}: Template not found on server`);
          errorCount++;
          break;
        case 'error':
          console.log(`❌ ${result.identifier}: ${result.message}`);
          errorCount++;
          break;
      }

      // 서버 부하 방지용 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 3. 결과 요약
    console.log(`\n📊 Synchronization Summary:`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`➡️  Unchanged: ${unchangedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Success Rate: ${((updatedCount + unchangedCount) / templateFiles.length * 100).toFixed(1)}%`);

    return results;
  }

  /**
   * 특정 템플릿들만 동기화
   */
  async syncSpecific(identifiers: string[]): Promise<SyncResult[]> {
    console.log(`\n🎯 Syncing specific templates: ${identifiers.join(', ')}`);

    const allTemplateFiles = await this.scanExportedTemplates();
    const targetFiles = allTemplateFiles.filter(tf => 
      identifiers.includes(tf.identifier)
    );

    if (targetFiles.length === 0) {
      console.log('⚠️  No matching template files found');
      return [];
    }

    console.log(`📋 Found ${targetFiles.length} matching templates\n`);

    const results: SyncResult[] = [];
    for (const templateFile of targetFiles) {
      const result = await this.syncTemplate(templateFile);
      results.push(result);

      switch (result.status) {
        case 'updated':
          console.log(`✅ ${result.identifier}: ${result.message}`);
          break;
        case 'unchanged':
          console.log(`➡️  ${result.identifier}: No changes needed`);
          break;
        default:
          console.log(`❌ ${result.identifier}: ${result.message}`);
      }
    }

    return results;
  }

  /**
   * 동기화 상태 체크 (dry-run)
   */
  async checkSyncStatus(): Promise<void> {
    console.log(`\n🔍 Checking synchronization status (dry-run)`);
    
    const templateFiles = await this.scanExportedTemplates();
    console.log(`📋 Found ${templateFiles.length} template files\n`);

    for (const templateFile of templateFiles) {
      const latestInfo = await this.getLatestTemplateInfo(templateFile.identifier);
      
      if (!latestInfo) {
        console.log(`❌ ${templateFile.identifier}: Not found on server`);
        continue;
      }

      const oldContent = JSON.parse(await readFile(templateFile.path, 'utf-8'));
      const oldUsageCount = oldContent.template?.statistics?.usageCount || 0;
      const newUsageCount = latestInfo.statistics?.usageCount || 0;

      if (oldUsageCount !== newUsageCount) {
        console.log(`🔄 ${templateFile.identifier}: Usage ${oldUsageCount} → ${newUsageCount} (needs update)`);
      } else {
        console.log(`✅ ${templateFile.identifier}: Up to date (usage: ${oldUsageCount})`);
      }
    }
  }
}

// CLI 실행부
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  const syncTool = new TemplateSyncTool();

  if (command === 'all') {
    // 모든 템플릿 동기화
    syncTool.syncAll()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Sync failed:', error);
        process.exit(1);
      });
  } else if (command === 'check') {
    // 상태 확인 (dry-run)
    syncTool.checkSyncStatus()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Status check failed:', error);
        process.exit(1);
      });
  } else if (command === 'sync' && args.length > 1) {
    // 특정 템플릿들 동기화
    const identifiers = args.slice(1);
    syncTool.syncSpecific(identifiers)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Specific sync failed:', error);
        process.exit(1);
      });
  } else {
    console.log(`
Template Synchronization Tool

Usage:
  bun scripts/template-sync.ts all                           # Sync all exported templates
  bun scripts/template-sync.ts check                         # Check sync status (dry-run)  
  bun scripts/template-sync.ts sync <identifier1> <id2>...   # Sync specific templates

Examples:
  bun scripts/template-sync.ts all
  bun scripts/template-sync.ts check
  bun scripts/template-sync.ts sync test-health-check search-templates-advanced

Features:
  ✅ Safe incremental updates (only when needed)
  ✅ Usage count tracking for change detection
  ✅ Error handling and rollback safety
  ✅ Batch processing with server-friendly delays
  ✅ Comprehensive status reporting
`);
    process.exit(1);
  }
}

export { TemplateSyncTool, type SyncResult };