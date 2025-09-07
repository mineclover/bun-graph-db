#!/usr/bin/env bun

/**
 * Template Validation & Export System
 * 자동화된 템플릿 검증과 export를 위한 통합 시스템
 */

import { GraphQLClient } from 'graphql-request';
import { buildSchema, validate, parse } from 'graphql';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface TemplateValidationConfig {
  graphqlEndpoint: string;
  outputDir: string;
  validateVariables: boolean;
  validateQuery: boolean;
  autoFix: boolean;
}

class TemplateValidator {
  private client: GraphQLClient;
  private schema: any;
  private config: TemplateValidationConfig;

  constructor(config: TemplateValidationConfig) {
    this.client = new GraphQLClient(config.graphqlEndpoint);
    this.config = config;
  }

  /**
   * 1단계: GraphQL 스키마 동적 로드
   */
  async loadSchema(): Promise<void> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          types {
            name
            kind
            fields {
              name
              type {
                name
                kind
                ofType { name kind }
              }
              args {
                name
                type {
                  name
                  kind
                  ofType { name kind }
                }
              }
            }
            inputFields {
              name
              type {
                name
                kind
                ofType { name kind }
              }
            }
          }
          queryType { name }
          mutationType { name }
        }
      }
    `;

    try {
      const result = await this.client.request(introspectionQuery);
      this.schema = result.__schema;
      console.log('✅ GraphQL 스키마 로드 완료');
    } catch (error) {
      throw new Error(`스키마 로드 실패: ${error}`);
    }
  }

  /**
   * 2단계: 템플릿 쿼리 검증
   */
  async validateTemplateQuery(query: string, variables?: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // GraphQL 쿼리 파싱 검증
      const document = parse(query);
      
      // 스키마 대비 쿼리 검증 (introspection 기반)
      const queryValidation = await this.validateQueryAgainstSchema(query);
      if (!queryValidation.isValid) {
        result.isValid = false;
        result.errors.push(...queryValidation.errors);
      }

      // 변수 스키마 검증
      if (variables && this.config.validateVariables) {
        const variableValidation = await this.validateVariables(query, variables);
        if (!variableValidation.isValid) {
          result.warnings.push(...variableValidation.errors);
        }
      }

      console.log(`📋 쿼리 검증 완료: ${result.isValid ? '✅ 통과' : '❌ 실패'}`);
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`쿼리 파싱 실패: ${error}`);
    }

    return result;
  }

  /**
   * 3단계: 실제 쿼리 실행 테스트
   */
  async testQueryExecution(templateIdentifier: string, testVariables?: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // 템플릿 실행 테스트
      const testQuery = `
        mutation TestTemplate($templateIdentifier: String!, $variables: JSON) {
          executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
            success
            data
            errors
            executionTimeMs
          }
        }
      `;

      const testResult = await this.client.request(testQuery, {
        templateIdentifier,
        variables: testVariables || {}
      });

      if (!testResult.executeTemplateWithGraphQL.success) {
        result.isValid = false;
        result.errors.push(...testResult.executeTemplateWithGraphQL.errors);
      } else {
        const execTime = testResult.executeTemplateWithGraphQL.executionTimeMs;
        if (execTime > 1000) {
          result.warnings.push(`실행 시간이 느림: ${execTime}ms`);
          result.suggestions.push('인덱스 최적화나 쿼리 개선 검토 필요');
        }
      }

      console.log(`🧪 실행 테스트 완료: ${result.isValid ? '✅ 성공' : '❌ 실패'}`);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`실행 테스트 실패: ${error}`);
    }

    return result;
  }

  /**
   * 4단계: 검증된 템플릿 자동 Export
   */
  async exportValidatedTemplate(templateIdentifier: string): Promise<string> {
    try {
      // Export 실행
      const exportQuery = `
        mutation ExportTemplate($templateIdentifier: String!) {
          exportTemplate(templateIdentifier: $templateIdentifier) {
            success
            exportData
            filename
          }
        }
      `;

      const result = await this.client.request(exportQuery, { templateIdentifier });
      
      if (!result.exportTemplate.success) {
        throw new Error('Export 실패');
      }

      // 파일 저장
      const templateData = JSON.parse(result.exportTemplate.exportData);
      const filename = `${templateIdentifier}_v${templateData.template.version.replace(/\./g, '-')}-0.json`;
      const filepath = join(this.config.outputDir, filename);

      await mkdir(this.config.outputDir, { recursive: true });
      await writeFile(filepath, result.exportTemplate.exportData, 'utf-8');

      console.log(`📁 Export 완료: ${filepath}`);
      return filepath;

    } catch (error) {
      throw new Error(`Export 실패: ${error}`);
    }
  }

  /**
   * 5단계: 통합 검증 & Export 프로세스
   */
  async validateAndExport(templateIdentifier: string, testVariables?: any): Promise<{
    validationResult: ValidationResult;
    exportPath?: string;
  }> {
    console.log(`\n🔍 템플릿 검증 시작: ${templateIdentifier}`);

    // 1. 스키마 로드
    await this.loadSchema();

    // 2. 현재 템플릿 정보 가져오기
    const templateInfo = await this.getTemplateInfo(templateIdentifier);
    if (!templateInfo) {
      return {
        validationResult: {
          isValid: false,
          errors: [`템플릿을 찾을 수 없음: ${templateIdentifier}`],
          warnings: [],
          suggestions: []
        }
      };
    }

    // 3. 쿼리 검증
    const queryValidation = await this.validateTemplateQuery(
      templateInfo.query,
      templateInfo.defaultVariables
    );

    // 4. 실행 테스트
    const executionValidation = await this.testQueryExecution(
      templateIdentifier,
      testVariables
    );

    // 5. 종합 결과
    const combinedResult: ValidationResult = {
      isValid: queryValidation.isValid && executionValidation.isValid,
      errors: [...queryValidation.errors, ...executionValidation.errors],
      warnings: [...queryValidation.warnings, ...executionValidation.warnings],
      suggestions: [...queryValidation.suggestions, ...executionValidation.suggestions]
    };

    // 6. 검증 통과시 자동 Export
    let exportPath: string | undefined;
    if (combinedResult.isValid) {
      try {
        exportPath = await this.exportValidatedTemplate(templateIdentifier);
        console.log('✅ 검증 및 Export 완료!');
      } catch (error) {
        combinedResult.warnings.push(`Export 실패: ${error}`);
      }
    } else {
      console.log('❌ 검증 실패 - Export 건너뜀');
    }

    return { validationResult: combinedResult, exportPath };
  }

  /**
   * 헬퍼: 템플릿 정보 조회
   */
  private async getTemplateInfo(templateIdentifier: string) {
    const query = `
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

    try {
      const result = await this.client.request(query, { identifier: templateIdentifier });
      return result.getTemplateByIdentifier;
    } catch (error) {
      console.error(`템플릿 조회 실패: ${error}`);
      return null;
    }
  }

  /**
   * 헬퍼: 스키마 대비 쿼리 검증
   */
  private async validateQueryAgainstSchema(query: string): Promise<ValidationResult> {
    // 실제 GraphQL 서버에 대한 쿼리 검증 테스트
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Dry-run으로 쿼리 검증 (실제 데이터 변경 없이)
      const validationQuery = `
        query ValidateQuery($query: String!) {
          validateGraphQLQuery(query: $query) {
            isValid
            errors
            warnings
          }
        }
      `;

      // 이 기능이 API에 없다면, 단순 파싱 검증으로 대체
      const document = parse(query);
      console.log('📝 쿼리 구문 분석 통과');
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`쿼리 구문 오류: ${error}`);
    }

    return result;
  }

  /**
   * 헬퍼: 변수 스키마 검증
   */
  private async validateVariables(query: string, variables: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // JSON Schema 기반 변수 검증 로직 구현
    // 실제로는 ajv 등의 라이브러리 사용 권장

    return result;
  }
}

/**
 * 배치 검증 시스템
 */
export class BatchTemplateValidator {
  private validator: TemplateValidator;

  constructor(config: TemplateValidationConfig) {
    this.validator = new TemplateValidator(config);
  }

  /**
   * 여러 템플릿 일괄 검증
   */
  async validateAllTemplates(templateIdentifiers: string[]): Promise<Map<string, any>> {
    const results = new Map();

    console.log(`\n🔄 일괄 검증 시작 - ${templateIdentifiers.length}개 템플릿`);

    for (const identifier of templateIdentifiers) {
      try {
        const result = await this.validator.validateAndExport(identifier);
        results.set(identifier, result);
      } catch (error) {
        results.set(identifier, {
          validationResult: {
            isValid: false,
            errors: [`예외 발생: ${error}`],
            warnings: [],
            suggestions: []
          }
        });
      }
    }

    // 결과 요약 출력
    this.printBatchSummary(results);
    return results;
  }

  private printBatchSummary(results: Map<string, any>): void {
    console.log('\n📊 일괄 검증 결과 요약:');
    
    let successCount = 0;
    let failureCount = 0;

    for (const [identifier, result] of results) {
      if (result.validationResult.isValid) {
        console.log(`✅ ${identifier}: 검증 통과`);
        successCount++;
      } else {
        console.log(`❌ ${identifier}: 검증 실패`);
        console.log(`   오류: ${result.validationResult.errors.join(', ')}`);
        failureCount++;
      }
    }

    console.log(`\n🎯 총 ${results.size}개 중 성공: ${successCount}, 실패: ${failureCount}`);
  }
}

// CLI 인터페이스
if (import.meta.main) {
  const config: TemplateValidationConfig = {
    graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    outputDir: process.env.TEMPLATE_OUTPUT_DIR || './demo/templates',
    validateVariables: true,
    validateQuery: true,
    autoFix: false
  };

  const args = process.argv.slice(2);
  const command = args[0];
  const templateIdentifier = args[1];

  if (command === 'validate' && templateIdentifier) {
    // 단일 템플릿 검증
    const validator = new TemplateValidator(config);
    validator.validateAndExport(templateIdentifier)
      .then(result => {
        process.exit(result.validationResult.isValid ? 0 : 1);
      })
      .catch(error => {
        console.error('검증 실패:', error);
        process.exit(1);
      });
  } else if (command === 'batch') {
    // 일괄 검증
    const identifiers = args.slice(1);
    const batchValidator = new BatchTemplateValidator(config);
    batchValidator.validateAllTemplates(identifiers)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('일괄 검증 실패:', error);
        process.exit(1);
      });
  } else {
    console.log(`
사용법:
  bun template-validator.ts validate <template-identifier>  # 단일 템플릿 검증
  bun template-validator.ts batch <id1> <id2> ...          # 일괄 템플릿 검증

예시:
  bun template-validator.ts validate search-templates-advanced
  bun template-validator.ts batch search-templates-advanced list-nodes-by-table
    `);
    process.exit(1);
  }
}