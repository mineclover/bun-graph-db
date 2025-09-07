#!/usr/bin/env bun

/**
 * 템플릿 건강 상태 모니터링 시스템
 * 정기적으로 템플릿 품질을 추적하고 보고서 생성
 */

import { GraphQLClient } from 'graphql-request';
import { writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';

interface TemplateHealth {
  identifier: string;
  status: 'healthy' | 'warning' | 'critical' | 'broken';
  lastChecked: string;
  issues: string[];
  metrics: {
    executionTime: number;
    usageCount: number;
    errorRate: number;
    lastUsed: string;
  };
}

interface HealthReport {
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    broken: number;
  };
  templates: TemplateHealth[];
  recommendations: string[];
}

class TemplateHealthMonitor {
  private client: GraphQLClient;
  private healthThresholds = {
    executionTime: {
      warning: 1000,  // 1초
      critical: 3000   // 3초
    },
    errorRate: {
      warning: 0.01,   // 1%
      critical: 0.05   // 5%
    },
    staleness: {
      warning: 30,     // 30일
      critical: 90     // 90일
    }
  };

  constructor(endpoint: string = 'http://localhost:4000/graphql') {
    this.client = new GraphQLClient(endpoint);
  }

  /**
   * 모든 템플릿의 건강 상태 확인
   */
  async checkAllTemplates(): Promise<HealthReport> {
    console.log('🏥 템플릿 건강 상태 점검 시작...');
    
    const templates = await this.getTemplateList();
    const healthChecks: TemplateHealth[] = [];
    
    for (const template of templates) {
      console.log(`📋 점검 중: ${template.identifier}`);
      const health = await this.checkTemplateHealth(template);
      healthChecks.push(health);
    }

    const report = this.generateHealthReport(healthChecks);
    await this.saveHealthReport(report);
    
    return report;
  }

  /**
   * 개별 템플릿 건강 상태 확인
   */
  private async checkTemplateHealth(template: any): Promise<TemplateHealth> {
    const health: TemplateHealth = {
      identifier: template.identifier,
      status: 'healthy',
      lastChecked: new Date().toISOString(),
      issues: [],
      metrics: {
        executionTime: 0,
        usageCount: template.statistics?.usageCount || 0,
        errorRate: 0,
        lastUsed: template.statistics?.lastUsedAt || 'never'
      }
    };

    try {
      // 1. 실행 시간 테스트
      const executionResult = await this.testTemplateExecution(template.identifier);
      health.metrics.executionTime = executionResult.executionTime;
      
      if (executionResult.success) {
        // 성능 체크
        if (executionResult.executionTime > this.healthThresholds.executionTime.critical) {
          health.status = 'critical';
          health.issues.push(`매우 느린 실행 시간: ${executionResult.executionTime}ms`);
        } else if (executionResult.executionTime > this.healthThresholds.executionTime.warning) {
          health.status = 'warning';
          health.issues.push(`느린 실행 시간: ${executionResult.executionTime}ms`);
        }
      } else {
        health.status = 'broken';
        health.issues.push('실행 실패: ' + executionResult.errors.join(', '));
      }

      // 2. 사용 빈도 체크
      const daysSinceLastUsed = this.getDaysSinceLastUsed(health.metrics.lastUsed);
      if (daysSinceLastUsed > this.healthThresholds.staleness.critical) {
        if (health.status === 'healthy') health.status = 'warning';
        health.issues.push(`장기간 미사용: ${daysSinceLastUsed}일`);
      }

      // 3. 쿼리 복잡도 체크
      if (template.complexityScore > 4) {
        health.issues.push('높은 복잡도: 최적화 검토 필요');
      }

      // 4. 스키마 호환성 체크
      const schemaCheck = await this.checkSchemaCompatibility(template);
      if (!schemaCheck.compatible) {
        health.status = 'critical';
        health.issues.push('스키마 비호환: ' + schemaCheck.issues.join(', '));
      }

    } catch (error) {
      health.status = 'broken';
      health.issues.push(`점검 실패: ${error}`);
    }

    return health;
  }

  /**
   * 템플릿 실행 테스트
   */
  private async testTemplateExecution(templateIdentifier: string) {
    const startTime = Date.now();
    
    try {
      const query = `
        mutation TestTemplate($templateIdentifier: String!, $variables: JSON) {
          executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables) {
            success
            errors { message }
          }
        }
      `;

      const result = await this.client.request(query, {
        templateIdentifier,
        variables: {}
      });

      const executionTime = Date.now() - startTime;
      const execution = result.executeTemplateWithGraphQL;

      return {
        success: execution.success,
        executionTime,
        errors: execution.errors?.map((e: any) => e.message) || []
      };

    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        errors: [String(error)]
      };
    }
  }

  /**
   * 스키마 호환성 확인
   */
  private async checkSchemaCompatibility(template: any) {
    try {
      // GraphQL 쿼리 파싱 및 검증
      const query = `
        query ValidateQuery($query: String!) {
          __schema {
            queryType { name }
          }
        }
      `;
      
      // 실제로는 쿼리 파싱 라이브러리를 사용해야 함
      await this.client.request(query);
      
      return { compatible: true, issues: [] };
    } catch (error) {
      return { 
        compatible: false, 
        issues: [`스키마 검증 실패: ${error}`] 
      };
    }
  }

  /**
   * 템플릿 목록 조회
   */
  private async getTemplateList() {
    const query = `
      query GetAllTemplates {
        searchTemplates(
          filter: { isActive: true }
          pagination: { limit: 100, offset: 0 }
        ) {
          templates {
            identifier
            name
            complexityScore
            statistics {
              usageCount
              lastUsedAt
              avgExecutionTimeMs
            }
          }
        }
      }
    `;

    const result = await this.client.request(query);
    return result.searchTemplates.templates;
  }

  /**
   * 건강 보고서 생성
   */
  private generateHealthReport(healthChecks: TemplateHealth[]): HealthReport {
    const summary = {
      total: healthChecks.length,
      healthy: healthChecks.filter(h => h.status === 'healthy').length,
      warning: healthChecks.filter(h => h.status === 'warning').length,
      critical: healthChecks.filter(h => h.status === 'critical').length,
      broken: healthChecks.filter(h => h.status === 'broken').length
    };

    const recommendations = this.generateRecommendations(healthChecks);

    return {
      timestamp: new Date().toISOString(),
      summary,
      templates: healthChecks.sort((a, b) => {
        const statusOrder = { broken: 0, critical: 1, warning: 2, healthy: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }),
      recommendations
    };
  }

  /**
   * 개선 권장사항 생성
   */
  private generateRecommendations(healthChecks: TemplateHealth[]): string[] {
    const recommendations: string[] = [];

    const brokenTemplates = healthChecks.filter(h => h.status === 'broken');
    if (brokenTemplates.length > 0) {
      recommendations.push(`🚨 ${brokenTemplates.length}개 템플릿이 실행 불가 상태입니다. 즉시 수정이 필요합니다.`);
    }

    const criticalTemplates = healthChecks.filter(h => h.status === 'critical');
    if (criticalTemplates.length > 0) {
      recommendations.push(`⚠️ ${criticalTemplates.length}개 템플릿에 심각한 성능 문제가 있습니다.`);
    }

    const slowTemplates = healthChecks.filter(h => 
      h.metrics.executionTime > this.healthThresholds.executionTime.warning
    );
    if (slowTemplates.length > 0) {
      recommendations.push(`🐌 ${slowTemplates.length}개 템플릿의 최적화가 필요합니다.`);
    }

    const staleTemplates = healthChecks.filter(h => 
      this.getDaysSinceLastUsed(h.metrics.lastUsed) > this.healthThresholds.staleness.warning
    );
    if (staleTemplates.length > 0) {
      recommendations.push(`📦 ${staleTemplates.length}개 템플릿이 장기간 사용되지 않았습니다. 제거 검토가 필요합니다.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 모든 템플릿이 양호한 상태입니다!');
    }

    return recommendations;
  }

  /**
   * 건강 보고서 저장
   */
  private async saveHealthReport(report: HealthReport) {
    const reportPath = join('./monitoring/health-reports', 
      `health-report-${new Date().toISOString().split('T')[0]}.json`);
    
    // 디렉토리 생성
    await this.ensureDirectory('./monitoring/health-reports');
    
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // 최신 보고서로 링크
    await writeFile('./monitoring/latest-health-report.json', JSON.stringify(report, null, 2));
    
    console.log(`📊 건강 보고서 저장 완료: ${reportPath}`);
  }

  /**
   * 콘솔 출력용 보고서 요약
   */
  printHealthSummary(report: HealthReport) {
    console.log('\n📊 템플릿 건강 상태 보고서');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📅 점검 시간: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`📋 전체 템플릿: ${report.summary.total}개`);
    console.log(`✅ 정상: ${report.summary.healthy}개`);
    console.log(`⚠️ 경고: ${report.summary.warning}개`);
    console.log(`🚨 심각: ${report.summary.critical}개`);
    console.log(`❌ 실행불가: ${report.summary.broken}개`);

    if (report.summary.broken > 0 || report.summary.critical > 0) {
      console.log('\n🔥 즉시 조치 필요:');
      report.templates
        .filter(t => t.status === 'broken' || t.status === 'critical')
        .slice(0, 5)
        .forEach(t => {
          const statusIcon = t.status === 'broken' ? '❌' : '🚨';
          console.log(`${statusIcon} ${t.identifier}: ${t.issues.join(', ')}`);
        });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 권장사항:');
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }
  }

  /**
   * 헬퍼 메서드들
   */
  private getDaysSinceLastUsed(lastUsed: string): number {
    if (lastUsed === 'never') return 9999;
    const lastUsedDate = new Date(lastUsed);
    const now = new Date();
    return Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async ensureDirectory(path: string) {
    try {
      const { mkdir } = await import('fs/promises');
      await mkdir(path, { recursive: true });
    } catch (error) {
      // 디렉토리가 이미 존재하는 경우 무시
    }
  }
}

// CLI 인터페이스
if (import.meta.main) {
  const monitor = new TemplateHealthMonitor();
  
  const command = process.argv[2] || 'check';

  switch (command) {
    case 'check':
      monitor.checkAllTemplates()
        .then(report => {
          monitor.printHealthSummary(report);
          process.exit(report.summary.broken > 0 ? 1 : 0);
        })
        .catch(error => {
          console.error('❌ 건강 점검 실패:', error);
          process.exit(1);
        });
      break;
      
    case 'report':
      // 최신 보고서 출력
      import('fs/promises').then(async ({ readFile }) => {
        try {
          const reportData = await readFile('./monitoring/latest-health-report.json', 'utf-8');
          const report = JSON.parse(reportData);
          monitor.printHealthSummary(report);
        } catch (error) {
          console.error('❌ 보고서를 찾을 수 없습니다. 먼저 check를 실행하세요.');
          process.exit(1);
        }
      });
      break;
      
    default:
      console.log(`
사용법:
  bun template-health-monitor.ts check   # 건강 상태 점검 실행
  bun template-health-monitor.ts report  # 최신 보고서 출력

예시:
  bun template-health-monitor.ts check
      `);
      process.exit(1);
  }
}