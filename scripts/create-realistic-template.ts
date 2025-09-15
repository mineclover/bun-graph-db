#!/usr/bin/env bun
/**
 * Realistic Template Creator
 *
 * 현재 시스템에 실제로 맞는 템플릿을 생성합니다.
 */

import { TemplateRegistrationManager } from './template-registration.js'

class RealisticTemplateCreator {
  private registrationManager = new TemplateRegistrationManager()

  async createTemplateLifecycleManagement(): Promise<void> {
    console.log('🔄 Creating template lifecycle management template...')

    const template = {
      identifier: 'template-lifecycle-management',
      name: 'Template Lifecycle Management',
      description: '템플릿의 생성부터 삭제까지 전체 생명주기 관리 및 버전 관리',
      query: `query TemplateLifecycleManagement($templateId: ID, $operation: LifecycleOperation!) {
  templateLifecycle(templateId: $templateId, operation: $operation) {
    template {
      id
      identifier
      name
      version
      status
      createdAt
      updatedAt
      lastUsedAt
      usageCount
    }
    lifecycle {
      currentStage
      possibleTransitions
      history {
        stage
        timestamp
        performedBy
        reason
      }
    }
    dependencies {
      dependsOn {
        id
        identifier
        name
        relationship
      }
      dependentTemplates {
        id
        identifier
        name
        relationship
      }
    }
    analytics {
      usageStats {
        totalExecutions
        successRate
        avgExecutionTime
        lastWeekUsage
        popularVariables
      }
      performance {
        complexity
        executionTrend
        errorPatterns
      }
    }
    recommendations {
      optimization
      archiving
      deprecation
      migration
    }
  }
}`,
      tags: ['lifecycle', 'management', 'versioning', 'analytics'],
      priority: 'medium',
      variables: {
        templateId: '',
        operation: 'GET_STATUS',
      },
    }

    const result = await this.registrationManager.registerTemplate(template)

    if (result.success) {
      console.log('✅ Template lifecycle management template created successfully!')
      console.log(`   Template ID: ${result.templateId}`)
    } else {
      console.log(`❌ Failed to create template: ${result.message}`)
      result.errors.forEach((error) => console.log(`   - ${error}`))
    }

    return
  }

  async createNodeRelationshipAnalysis(): Promise<void> {
    console.log('🔗 Creating node relationship analysis template...')

    const template = {
      identifier: 'node-relationship-analysis',
      name: 'Node Relationship Analysis',
      description: '노드 간의 관계를 분석하고 연결 패턴을 식별하는 템플릿',
      query: `query NodeRelationshipAnalysis($nodeId: ID!, $analysisDepth: Int = 3) {
  nodeRelationshipAnalysis(nodeId: $nodeId, depth: $analysisDepth) {
    sourceNode {
      id
      title
      content
      table { identifier }
    }
    relationships {
      direct {
        targetNode {
          id
          title
          table { identifier }
        }
        relation {
          type
          strength
          confidence
          metadata
        }
        distance
      }
      indirect {
        targetNode {
          id
          title
          table { identifier }
        }
        path {
          nodeId
          title
          relationType
        }
        distance
        pathStrength
      }
    }
    patterns {
      hubNodes {
        nodeId
        title
        connectionCount
        influence
      }
      clusters {
        nodes
        density
        commonAttributes
      }
      isolated {
        nodeId
        title
        reason
      }
    }
    metrics {
      totalConnections
      avgDistance
      networkDensity
      clusteringCoefficient
    }
  }
}`,
      tags: ['relationships', 'analysis', 'network', 'patterns'],
      priority: 'medium',
      variables: {
        nodeId: '',
        analysisDepth: 3,
      },
    }

    const result = await this.registrationManager.registerTemplate(template)

    if (result.success) {
      console.log('✅ Node relationship analysis template created successfully!')
      console.log(`   Template ID: ${result.templateId}`)
    } else {
      console.log(`❌ Failed to create template: ${result.message}`)
      result.errors.forEach((error) => console.log(`   - ${error}`))
    }
  }

  async createTableSchemaEvolution(): Promise<void> {
    console.log('📊 Creating table schema evolution template...')

    const template = {
      identifier: 'table-schema-evolution',
      name: 'Table Schema Evolution',
      description: '테이블 스키마의 변화를 추적하고 진화 패턴을 분석하는 템플릿',
      query: `query TableSchemaEvolution($tableId: ID!) {
  tableSchemaEvolution(tableId: $tableId) {
    table {
      id
      identifier
      description
      createdAt
      updatedAt
    }
    currentSchema {
      attributes {
        name
        type
        constraints
        addedAt
        modifiedAt
      }
      relationships {
        type
        targetTable
        establishedAt
      }
    }
    evolution {
      schemaChanges {
        timestamp
        changeType
        element
        oldValue
        newValue
        reason
      }
      attributeHistory {
        attributeName
        versions {
          type
          constraints
          validFrom
          validTo
        }
      }
      relationshipHistory {
        relationType
        targetTable
        establishedAt
        modifiedAt
        status
      }
    }
    analytics {
      stability {
        changeFrequency
        lastStableVersion
        volatilityScore
      }
      growth {
        attributeGrowthRate
        relationshipGrowthRate
        complexityTrend
      }
      patterns {
        commonChanges
        migrationPatterns
        riskFactors
      }
    }
    recommendations {
      stabilization
      optimization
      migration
      monitoring
    }
  }
}`,
      tags: ['schema', 'evolution', 'tracking', 'analytics'],
      priority: 'medium',
      variables: {
        tableId: '',
      },
    }

    const result = await this.registrationManager.registerTemplate(template)

    if (result.success) {
      console.log('✅ Table schema evolution template created successfully!')
      console.log(`   Template ID: ${result.templateId}`)
    } else {
      console.log(`❌ Failed to create template: ${result.message}`)
      result.errors.forEach((error) => console.log(`   - ${error}`))
    }
  }

  async createAllRealisticTemplates(): Promise<void> {
    console.log('🎯 Creating realistic templates based on current system capabilities...\n')

    await this.createTemplateLifecycleManagement()
    console.log()
    await this.createNodeRelationshipAnalysis()
    console.log()
    await this.createTableSchemaEvolution()

    console.log('\n✅ All realistic templates created!')
  }
}

// CLI 인터페이스
async function main() {
  const creator = new RealisticTemplateCreator()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'all':
      await creator.createAllRealisticTemplates()
      break
    case 'lifecycle':
      await creator.createTemplateLifecycleManagement()
      break
    case 'relationships':
      await creator.createNodeRelationshipAnalysis()
      break
    case 'schema':
      await creator.createTableSchemaEvolution()
      break
    default:
      console.log(`
🔧 Realistic Template Creator

Usage:
  all           Create all realistic templates
  lifecycle     Create template lifecycle management
  relationships Create node relationship analysis
  schema        Create table schema evolution

Example:
  bun create-realistic-template.ts all
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { RealisticTemplateCreator }
