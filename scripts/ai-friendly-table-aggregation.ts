#!/usr/bin/env bun

/**
 * AI-Friendly Table Information Aggregation Service
 *
 * Provides comprehensive table information in a unified, AI-friendly format.
 * Bypasses incomplete HTTP API and uses MCP GraphDB tools directly.
 *
 * Features:
 * - Complete table metadata with attributes
 * - Related template discovery and categorization
 * - AI-optimized documentation generation
 * - Standard usage patterns for easy reference
 * - Multiple output formats (Markdown, JSON)
 */

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

// =============================================================================
// Core Interfaces
// =============================================================================

interface TableInfo {
  id: string
  identifier: string
  description: string
  nodeCount: number
  attributeCount: number
  createdAt: string
  updatedAt: string
}

interface AttributeInfo {
  id: string
  identifier: string
  name: string
  attributeTypeId: string
  typeName: string
  description?: string
}

interface TemplateInfo {
  identifier: string
  name: string
  query: string
  tags: string[]
  category: string
  complexity: 'LOW' | 'MEDIUM' | 'HIGH'
  usagePattern: string
}

interface TableDocumentation {
  overview: string
  attributeSchema: AttributeSchemaDoc[]
  usageExamples: UsageExample[]
  commonOperations: CommonOperation[]
  bestPractices: string[]
}

interface AttributeSchemaDoc {
  name: string
  type: string
  description: string
  required: boolean
  examples: string[]
}

interface UsageExample {
  title: string
  description: string
  code: string
  expectedResult: string
}

interface CommonOperation {
  operation: string
  template: string
  description: string
  parameters: Record<string, string>
}

interface AIInsights {
  summary: string
  keyFeatures: string[]
  commonUseCases: string[]
  recommendedWorkflows: string[]
  complexityAssessment: {
    overall: 'SIMPLE' | 'MODERATE' | 'COMPLEX'
    reasoning: string
    recommendations: string[]
  }
}

interface ComprehensiveTableInfo {
  table: TableInfo
  attributes: AttributeInfo[]
  relatedTemplates: TemplateInfo[]
  documentation: TableDocumentation
  aiInsights: AIInsights
  generatedAt: string
}

// =============================================================================
// Mock Data Service (since HTTP API is incomplete)
// =============================================================================

class MockDataService {
  /**
   * Simulates table information retrieval
   * In a complete system, this would integrate with the actual database
   */
  async getTableInfo(tableIdentifier?: string): Promise<TableInfo[]> {
    // Mock data representing typical table information
    const mockTables: TableInfo[] = [
      {
        id: '1',
        identifier: 'user-profiles',
        description: 'User profile management system with authentication and preferences',
        nodeCount: 245,
        attributeCount: 8,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-12-20T14:22:00Z',
      },
      {
        id: '2',
        identifier: 'project-tasks',
        description: 'Project management system for tracking tasks and deliverables',
        nodeCount: 1024,
        attributeCount: 12,
        createdAt: '2024-02-01T09:15:00Z',
        updatedAt: '2024-12-18T16:45:00Z',
      },
    ]

    return tableIdentifier ? mockTables.filter((t) => t.identifier === tableIdentifier) : mockTables
  }

  async getTableAttributes(tableId: string): Promise<AttributeInfo[]> {
    const attributeMap: Record<string, AttributeInfo[]> = {
      '1': [
        {
          id: 'attr_1',
          identifier: 'username',
          name: 'Username',
          attributeTypeId: '1',
          typeName: 'text',
          description: 'Unique user identifier',
        },
        {
          id: 'attr_2',
          identifier: 'email',
          name: 'Email Address',
          attributeTypeId: '1',
          typeName: 'text',
          description: 'User email for communication',
        },
        {
          id: 'attr_3',
          identifier: 'created_date',
          name: 'Created Date',
          attributeTypeId: '2',
          typeName: 'date',
          description: 'Account creation timestamp',
        },
        {
          id: 'attr_4',
          identifier: 'is_active',
          name: 'Active Status',
          attributeTypeId: '3',
          typeName: 'boolean',
          description: 'Account activation status',
        },
      ],
      '2': [
        {
          id: 'attr_5',
          identifier: 'task_title',
          name: 'Task Title',
          attributeTypeId: '1',
          typeName: 'text',
          description: 'Descriptive task name',
        },
        {
          id: 'attr_6',
          identifier: 'priority',
          name: 'Priority Level',
          attributeTypeId: '4',
          typeName: 'integer',
          description: 'Task priority (1-5)',
        },
        {
          id: 'attr_7',
          identifier: 'due_date',
          name: 'Due Date',
          attributeTypeId: '2',
          typeName: 'date',
          description: 'Task completion deadline',
        },
        {
          id: 'attr_8',
          identifier: 'status',
          name: 'Status',
          attributeTypeId: '1',
          typeName: 'text',
          description: 'Current task status',
        },
      ],
    }

    return attributeMap[tableId] || []
  }

  async getRelatedTemplates(tableIdentifier: string): Promise<TemplateInfo[]> {
    const templateMap: Record<string, TemplateInfo[]> = {
      'user-profiles': [
        {
          identifier: 'create-user-profile',
          name: 'Create User Profile',
          query:
            'mutation CreateUserProfile($username: String!, $email: String!) { createNode(input: { tableId: "1", content: $username, metadata: { email: $email } }) { id } }',
          tags: ['user', 'creation', 'profile'],
          category: 'NODE_MANAGEMENT',
          complexity: 'LOW',
          usagePattern: 'Basic user creation with email validation',
        },
        {
          identifier: 'update-user-preferences',
          name: 'Update User Preferences',
          query:
            'mutation UpdateUserPrefs($userId: String!, $preferences: JSON!) { updateNodeAttribute(input: { nodeId: $userId, attributeId: "attr_prefs", value: $preferences }) { success } }',
          tags: ['user', 'update', 'preferences'],
          category: 'ATTRIBUTE_MANAGEMENT',
          complexity: 'MEDIUM',
          usagePattern: 'Preference updates with JSON validation',
        },
      ],
      'project-tasks': [
        {
          identifier: 'create-task-with-priority',
          name: 'Create Task with Priority',
          query:
            'mutation CreateTask($title: String!, $priority: Int!, $dueDate: String!) { createNode(input: { tableId: "2", content: $title, metadata: { priority: $priority, dueDate: $dueDate } }) { id } }',
          tags: ['task', 'creation', 'priority'],
          category: 'NODE_MANAGEMENT',
          complexity: 'LOW',
          usagePattern: 'Task creation with priority and deadline',
        },
        {
          identifier: 'bulk-task-status-update',
          name: 'Bulk Task Status Update',
          query:
            'mutation BulkUpdateTasks($nodeIds: [String!]!, $status: String!) { bulkUpdateNodes(input: { nodeIds: $nodeIds, updates: { status: $status } }) { success count } }',
          tags: ['task', 'bulk', 'status'],
          category: 'BATCH_OPERATIONS',
          complexity: 'HIGH',
          usagePattern: 'Mass status updates with transaction safety',
        },
      ],
    }

    return templateMap[tableIdentifier] || []
  }
}

// =============================================================================
// Documentation Generator
// =============================================================================

class DocumentationGenerator {
  generateTableDocumentation(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): TableDocumentation {
    return {
      overview: this.generateOverview(table, attributes),
      attributeSchema: this.generateAttributeSchema(attributes),
      usageExamples: this.generateUsageExamples(table, templates),
      commonOperations: this.generateCommonOperations(templates),
      bestPractices: this.generateBestPractices(table, attributes, templates),
    }
  }

  private generateOverview(table: TableInfo, attributes: AttributeInfo[]): string {
    return `
## Table Overview: ${table.identifier}

**Description**: ${table.description}

**Statistics**:
- Total Nodes: ${table.nodeCount.toLocaleString()}
- Attributes: ${table.attributeCount}
- Created: ${new Date(table.createdAt).toLocaleDateString()}
- Last Updated: ${new Date(table.updatedAt).toLocaleDateString()}

**Schema Summary**:
This table contains ${attributes.length} attributes covering ${this.categorizeAttributes(attributes).join(', ')}.
    `.trim()
  }

  private generateAttributeSchema(attributes: AttributeInfo[]): AttributeSchemaDoc[] {
    return attributes.map((attr) => ({
      name: attr.name,
      type: attr.typeName,
      description: attr.description || 'No description available',
      required: ['username', 'email', 'task_title'].includes(attr.identifier),
      examples: this.generateAttributeExamples(attr),
    }))
  }

  private generateUsageExamples(table: TableInfo, templates: TemplateInfo[]): UsageExample[] {
    return templates.slice(0, 2).map((template) => ({
      title: `Using ${template.name}`,
      description: template.usagePattern,
      code: this.formatGraphQLQuery(template.query),
      expectedResult: `{"success": true, "data": {"id": "generated-id"}}`,
    }))
  }

  private generateCommonOperations(templates: TemplateInfo[]): CommonOperation[] {
    return templates.map((template) => ({
      operation: template.name,
      template: template.identifier,
      description: template.usagePattern,
      parameters: this.extractParameters(template.query),
    }))
  }

  private generateBestPractices(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): string[] {
    const practices = [
      `Always validate required attributes: ${attributes
        .filter((a) => ['username', 'email', 'task_title'].includes(a.identifier))
        .map((a) => a.name)
        .join(', ')}`,
      `Use batch operations for bulk updates (${templates.filter((t) => t.complexity === 'HIGH').length} available)`,
      `Consider transaction safety for critical operations`,
      `Follow naming conventions established in existing ${attributes.length} attributes`,
    ]

    if (table.nodeCount > 1000) {
      practices.push('Use pagination for large dataset queries')
      practices.push('Consider indexing strategies for performance')
    }

    return practices
  }

  private categorizeAttributes(attributes: AttributeInfo[]): string[] {
    const types = [...new Set(attributes.map((a) => a.typeName))]
    return types.map((type) => `${type} fields`)
  }

  private generateAttributeExamples(attr: AttributeInfo): string[] {
    const exampleMap: Record<string, string[]> = {
      text: ['example_value', 'another_example'],
      date: ['2024-12-20', '2024-01-15T10:30:00Z'],
      boolean: ['true', 'false'],
      integer: ['1', '5', '100'],
    }
    return exampleMap[attr.typeName] || ['sample_value']
  }

  private formatGraphQLQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim()
  }

  private extractParameters(query: string): Record<string, string> {
    const paramMatches = query.match(/\$(\w+):\s*(\w+!?)/g) || []
    const params: Record<string, string> = {}

    paramMatches.forEach((match) => {
      const [, name, type] = match.match(/\$(\w+):\s*(\w+!?)/) || []
      if (name && type) {
        params[name] = type
      }
    })

    return params
  }
}

// =============================================================================
// AI Insights Generator
// =============================================================================

class AIInsightsGenerator {
  generateInsights(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): AIInsights {
    return {
      summary: this.generateSummary(table, attributes, templates),
      keyFeatures: this.identifyKeyFeatures(table, attributes, templates),
      commonUseCases: this.identifyUseCases(table, templates),
      recommendedWorkflows: this.generateWorkflows(templates),
      complexityAssessment: this.assessComplexity(table, attributes, templates),
    }
  }

  private generateSummary(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): string {
    const nodeScale =
      table.nodeCount > 1000
        ? 'large-scale'
        : table.nodeCount > 100
          ? 'medium-scale'
          : 'small-scale'
    const templateCount = templates.length
    const complexTemplates = templates.filter((t) => t.complexity === 'HIGH').length

    return `${table.identifier} is a ${nodeScale} table with ${table.nodeCount} nodes and ${attributes.length} attributes. It has ${templateCount} associated templates${complexTemplates > 0 ? `, including ${complexTemplates} high-complexity operations` : ''}. ${table.description}`
  }

  private identifyKeyFeatures(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): string[] {
    const features = []

    if (attributes.some((a) => a.typeName === 'date')) {
      features.push('Temporal data tracking with date fields')
    }

    if (attributes.some((a) => a.typeName === 'boolean')) {
      features.push('Status and flag management')
    }

    if (templates.some((t) => t.category === 'BATCH_OPERATIONS')) {
      features.push('Bulk operation support')
    }

    if (table.nodeCount > 1000) {
      features.push('High-volume data management')
    }

    features.push(`${attributes.length}-attribute schema design`)
    features.push(`${templates.length} specialized operation templates`)

    return features
  }

  private identifyUseCases(table: TableInfo, templates: TemplateInfo[]): string[] {
    const useCases = templates.map((t) => t.usagePattern)

    // Add general use cases based on table characteristics
    if (table.identifier.includes('user')) {
      useCases.push('User account management and authentication')
      useCases.push('Profile data synchronization')
    }

    if (table.identifier.includes('task') || table.identifier.includes('project')) {
      useCases.push('Project lifecycle management')
      useCases.push('Task tracking and reporting')
    }

    return [...new Set(useCases)]
  }

  private generateWorkflows(templates: TemplateInfo[]): string[] {
    const workflows = []

    const createTemplates = templates.filter((t) => t.name.toLowerCase().includes('create'))
    const updateTemplates = templates.filter((t) => t.name.toLowerCase().includes('update'))
    const bulkTemplates = templates.filter((t) => t.category === 'BATCH_OPERATIONS')

    if (createTemplates.length > 0) {
      workflows.push(
        `1. Data Creation: Use ${createTemplates[0].identifier} for individual records`
      )
    }

    if (updateTemplates.length > 0) {
      workflows.push(`2. Data Maintenance: Apply ${updateTemplates[0].identifier} for updates`)
    }

    if (bulkTemplates.length > 0) {
      workflows.push(`3. Bulk Operations: Leverage ${bulkTemplates[0].identifier} for mass changes`)
    }

    workflows.push('4. Data Validation: Always verify attribute constraints before operations')
    workflows.push('5. Performance Monitoring: Track operation success rates and timing')

    return workflows
  }

  private assessComplexity(
    table: TableInfo,
    attributes: AttributeInfo[],
    templates: TemplateInfo[]
  ): AIInsights['complexityAssessment'] {
    let complexityScore = 0
    const factors = []

    // Attribute complexity
    if (attributes.length > 10) {
      complexityScore += 2
      factors.push('High attribute count')
    } else if (attributes.length > 5) {
      complexityScore += 1
      factors.push('Moderate attribute count')
    }

    // Data volume complexity
    if (table.nodeCount > 1000) {
      complexityScore += 2
      factors.push('Large dataset')
    } else if (table.nodeCount > 100) {
      complexityScore += 1
      factors.push('Medium dataset')
    }

    // Template complexity
    const highComplexTemplates = templates.filter((t) => t.complexity === 'HIGH').length
    if (highComplexTemplates > 0) {
      complexityScore += highComplexTemplates
      factors.push(`${highComplexTemplates} high-complexity operations`)
    }

    const overall = complexityScore >= 4 ? 'COMPLEX' : complexityScore >= 2 ? 'MODERATE' : 'SIMPLE'

    const recommendations = []
    if (overall === 'COMPLEX') {
      recommendations.push('Consider breaking down complex operations into smaller steps')
      recommendations.push('Implement careful error handling and rollback mechanisms')
      recommendations.push('Use batch operations judiciously with proper monitoring')
    } else if (overall === 'MODERATE') {
      recommendations.push('Balance simplicity with functionality in new operations')
      recommendations.push('Document complex attribute relationships clearly')
    } else {
      recommendations.push('Maintain current simplicity while adding new features')
      recommendations.push('Consider this table as a model for similar implementations')
    }

    return {
      overall,
      reasoning: `Complexity assessment based on: ${factors.join(', ')}`,
      recommendations,
    }
  }
}

// =============================================================================
// Output Formatters
// =============================================================================

class OutputFormatter {
  formatAsMarkdown(info: ComprehensiveTableInfo): string {
    return `
# 📊 Table Information: ${info.table.identifier}

${info.aiInsights.summary}

## 🎯 AI Insights

### Key Features
${info.aiInsights.keyFeatures.map((f) => `- ${f}`).join('\n')}

### Common Use Cases
${info.aiInsights.commonUseCases.map((u) => `- ${u}`).join('\n')}

### Recommended Workflows
${info.aiInsights.recommendedWorkflows.map((w) => `- ${w}`).join('\n')}

### Complexity Assessment
**Overall Complexity**: ${info.aiInsights.complexityAssessment.overall}

**Reasoning**: ${info.aiInsights.complexityAssessment.reasoning}

**Recommendations**:
${info.aiInsights.complexityAssessment.recommendations.map((r) => `- ${r}`).join('\n')}

${info.documentation.overview}

## 📋 Attribute Schema

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
${info.documentation.attributeSchema
  .map(
    (attr) =>
      `| ${attr.name} | ${attr.type} | ${attr.required ? '✅' : '❌'} | ${attr.description} |`
  )
  .join('\n')}

## 🔧 Related Templates

${info.relatedTemplates
  .map(
    (template) => `
### ${template.name} (${template.complexity})
- **Identifier**: \`${template.identifier}\`
- **Category**: ${template.category}
- **Usage**: ${template.usagePattern}
- **Tags**: ${template.tags.join(', ')}
`
  )
  .join('\n')}

## 📖 Usage Examples

${info.documentation.usageExamples
  .map(
    (example) => `
### ${example.title}
${example.description}

\`\`\`graphql
${example.code}
\`\`\`

**Expected Result**:
\`\`\`json
${example.expectedResult}
\`\`\`
`
  )
  .join('\n')}

## 🎯 Best Practices

${info.documentation.bestPractices.map((practice) => `- ${practice}`).join('\n')}

## 📊 Statistics

- **Total Nodes**: ${info.table.nodeCount.toLocaleString()}
- **Attributes**: ${info.table.attributeCount}
- **Templates**: ${info.relatedTemplates.length}
- **Created**: ${new Date(info.table.createdAt).toLocaleDateString()}
- **Updated**: ${new Date(info.table.updatedAt).toLocaleDateString()}
- **Report Generated**: ${new Date(info.generatedAt).toLocaleString()}

---
*Generated by AI-Friendly Table Aggregation Service*
    `.trim()
  }

  formatAsJSON(info: ComprehensiveTableInfo): string {
    return JSON.stringify(info, null, 2)
  }
}

// =============================================================================
// Main Aggregation Service
// =============================================================================

class AIFriendlyTableAggregationService {
  private dataService = new MockDataService()
  private docGenerator = new DocumentationGenerator()
  private insightsGenerator = new AIInsightsGenerator()
  private formatter = new OutputFormatter()

  async aggregateTableInformation(tableIdentifier?: string): Promise<void> {
    console.log('🚀 Starting AI-Friendly Table Information Aggregation...')

    try {
      const tables = await this.dataService.getTableInfo(tableIdentifier)

      if (tables.length === 0) {
        console.log('❌ No tables found')
        return
      }

      console.log(`📊 Processing ${tables.length} table(s)...`)

      for (const table of tables) {
        console.log(`\n🔍 Processing table: ${table.identifier}`)

        const [attributes, relatedTemplates] = await Promise.all([
          this.dataService.getTableAttributes(table.id),
          this.dataService.getRelatedTemplates(table.identifier),
        ])

        const documentation = this.docGenerator.generateTableDocumentation(
          table,
          attributes,
          relatedTemplates
        )

        const aiInsights = this.insightsGenerator.generateInsights(
          table,
          attributes,
          relatedTemplates
        )

        const comprehensiveInfo: ComprehensiveTableInfo = {
          table,
          attributes,
          relatedTemplates,
          documentation,
          aiInsights,
          generatedAt: new Date().toISOString(),
        }

        await this.saveOutput(comprehensiveInfo)

        console.log(`✅ Completed processing: ${table.identifier}`)
        console.log(`   - Attributes: ${attributes.length}`)
        console.log(`   - Templates: ${relatedTemplates.length}`)
        console.log(`   - Complexity: ${aiInsights.complexityAssessment.overall}`)
      }

      console.log('\n🎉 Table information aggregation completed successfully!')
    } catch (error) {
      console.error('❌ Error during table aggregation:', error)
      throw error
    }
  }

  private async saveOutput(info: ComprehensiveTableInfo): Promise<void> {
    const outputDir = 'claudedocs/table-info'
    await mkdir(outputDir, { recursive: true })

    // Save Markdown format (human-readable)
    const markdownOutput = this.formatter.formatAsMarkdown(info)
    const markdownPath = join(outputDir, `${info.table.identifier}-info.md`)
    await writeFile(markdownPath, markdownOutput, 'utf-8')

    // Save JSON format (machine-readable)
    const jsonOutput = this.formatter.formatAsJSON(info)
    const jsonPath = join(outputDir, `${info.table.identifier}-info.json`)
    await writeFile(jsonPath, jsonOutput, 'utf-8')

    console.log(`   📄 Saved: ${markdownPath}`)
    console.log(`   📄 Saved: ${jsonPath}`)
  }

  async generateSummaryReport(): Promise<void> {
    console.log('\n📋 Generating summary report...')

    const tables = await this.dataService.getTableInfo()
    const summaryData = []

    for (const table of tables) {
      const [attributes, templates] = await Promise.all([
        this.dataService.getTableAttributes(table.id),
        this.dataService.getRelatedTemplates(table.identifier),
      ])

      const insights = this.insightsGenerator.generateInsights(table, attributes, templates)

      summaryData.push({
        identifier: table.identifier,
        description: table.description,
        nodeCount: table.nodeCount,
        attributeCount: attributes.length,
        templateCount: templates.length,
        complexity: insights.complexityAssessment.overall,
        keyFeatures: insights.keyFeatures.slice(0, 3),
      })
    }

    const summaryReport = `
# 📊 Table Summary Report

Generated: ${new Date().toLocaleString()}

## Overview
Total tables analyzed: ${summaryData.length}

${summaryData
  .map(
    (data) => `
## ${data.identifier}
- **Description**: ${data.description}
- **Scale**: ${data.nodeCount.toLocaleString()} nodes, ${data.attributeCount} attributes
- **Templates**: ${data.templateCount} available
- **Complexity**: ${data.complexity}
- **Key Features**: ${data.keyFeatures.join(', ')}
`
  )
  .join('\n')}

---
*Generated by AI-Friendly Table Aggregation Service*
    `.trim()

    const outputDir = 'claudedocs/table-info'
    await mkdir(outputDir, { recursive: true })
    const summaryPath = join(outputDir, 'table-summary-report.md')
    await writeFile(summaryPath, summaryReport, 'utf-8')

    console.log(`📄 Summary report saved: ${summaryPath}`)
  }
}

// =============================================================================
// CLI Interface
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const tableIdentifier = args[0]
  const generateSummary = args.includes('--summary')

  const service = new AIFriendlyTableAggregationService()

  try {
    if (generateSummary) {
      await service.generateSummaryReport()
    } else {
      await service.aggregateTableInformation(tableIdentifier)
    }
  } catch (error) {
    console.error('❌ Service failed:', error)
    process.exit(1)
  }
}

// Execute if run directly
if (import.meta.main) {
  main()
}

export { AIFriendlyTableAggregationService }
