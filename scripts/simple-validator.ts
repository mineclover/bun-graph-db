#!/usr/bin/env bun

/**
 * 간단한 템플릿 검증 도구
 */

import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient('http://localhost:4000/graphql');

async function validateTemplate(templateIdentifier: string) {
  console.log(`🔍 템플릿 검증: ${templateIdentifier}`);
  
  try {
    // 1. 템플릿 정보 조회
    const templateQuery = `
      query GetTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
          identifier
          name
          query
          variables
        }
      }
    `;
    
    const templateResult = await client.request(templateQuery, { identifier: templateIdentifier });
    const template = templateResult.getTemplateByIdentifier;
    
    if (!template) {
      console.log(`❌ 템플릿을 찾을 수 없음: ${templateIdentifier}`);
      return false;
    }
    
    console.log(`✅ 템플릿 발견: ${template.name}`);
    
    // 2. 실행 테스트
    const testQuery = `
      mutation TestTemplate($templateIdentifier: String!, $variables: JSON) {
        executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
          success
          data
        }
      }
    `;
    
    const testResult = await client.request(testQuery, {
      templateIdentifier,
      variables: {}
    });
    
    const execution = testResult.executeTemplateWithGraphQL;
    
    if (execution.success) {
      console.log(`✅ 실행 테스트 통과`);
      
      // 3. Export 실행
      const exportQuery = `
        mutation ExportTemplate($templateIdentifier: String!) {
          exportTemplate(templateIdentifier: $templateIdentifier) {
            success
            exportData
            filename
          }
        }
      `;
      
      const exportResult = await client.request(exportQuery, { templateIdentifier });
      
      if (exportResult.exportTemplate.success) {
        // 파일 저장
        const fs = require('fs');
        const path = require('path');
        
        const outputPath = path.join('./demo/templates', `${templateIdentifier}_v1-0-0.json`);
        fs.writeFileSync(outputPath, exportResult.exportTemplate.exportData);
        
        console.log(`📁 Export 완료: ${outputPath}`);
        return true;
      } else {
        console.log(`❌ Export 실패`);
        return false;
      }
    } else {
      console.log(`❌ 실행 테스트 실패`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 오류: ${error}`);
    return false;
  }
}

// CLI 실행
if (import.meta.main) {
  const templateIdentifier = process.argv[2];
  
  if (!templateIdentifier) {
    console.log('사용법: bun simple-validator.ts <template-identifier>');
    process.exit(1);
  }
  
  validateTemplate(templateIdentifier)
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('실행 실패:', error);
      process.exit(1);
    });
}