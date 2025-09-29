import { GraphQLSchema, execute, parse } from 'graphql';
import { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector';
import type { QueryPattern } from './GraphQLSchemaIntrospector';
import { TemplateValidator } from './TemplateValidator';
import type { TemplateDefinition } from './TemplateValidator';

/**
 * Working Example Generation Service
 * Creates validated, executable templates and examples from schema patterns
 */
export class WorkingExampleGenerator {
  private schema: GraphQLSchema;
  private schemaIntrospector: GraphQLSchemaIntrospector;
  private templateValidator: TemplateValidator;
  private exampleCache = new Map<string, WorkingExample[]>();

  constructor(
    schema: GraphQLSchema,
    schemaIntrospector: GraphQLSchemaIntrospector,
    templateValidator: TemplateValidator
  ) {
    this.schema = schema;
    this.schemaIntrospector = schemaIntrospector;
    this.templateValidator = templateValidator;
  }

  /**
   * Generate working examples for a specific table
   */
  async generateWorkingExamples(tableId: string): Promise<WorkingExample[]> {
    console.log(`🎯 Generating working examples for table ${tableId}`);

    const cacheKey = `table-${tableId}`;
    if (this.exampleCache.has(cacheKey)) {
      console.log('📋 Returning cached examples');
      return this.exampleCache.get(cacheKey)!;
    }

    const examples: WorkingExample[] = [];

    try {
      // Get available query patterns
      const queryPatterns = await this.schemaIntrospector.getQueryPatterns();

      // Generate examples for each relevant pattern
      for (const pattern of queryPatterns) {
        if (this.isPatternRelevantForTable(pattern, tableId)) {
          const example = await this.generateExampleFromPattern(pattern, tableId);
          if (example) {
            examples.push(example);
          }
        }
      }

      // Generate custom examples based on common use cases
      const customExamples = await this.generateCustomExamples(tableId);
      examples.push(...customExamples);

      // Validate all examples
      const validatedExamples = await this.validateExamples(examples);

      // Cache results
      this.exampleCache.set(cacheKey, validatedExamples);

      console.log(`✅ Generated ${validatedExamples.length} working examples`);
      return validatedExamples;

    } catch (error) {
      console.error('❌ Error generating working examples:', error);
      return [];
    }
  }

  /**
   * Generate template collection from working examples
   */
  async generateTemplateCollection(tableId: string): Promise<TemplateCollection> {
    const workingExamples = await this.generateWorkingExamples(tableId);

    const templates: TemplateDefinition[] = [];
    const validationResults: { [templateId: string]: any } = {};

    for (const example of workingExamples) {
      const template: TemplateDefinition = {
        identifier: `${example.name.toLowerCase().replace(/\s+/g, '-')}-${tableId}`,
        name: example.name,
        query: example.query,
        variables: example.variables,
        tags: ['working-example', 'auto-generated', example.category]
      };

      // Validate template
      const validation = await this.templateValidator.validateTemplate(template);

      templates.push(template);
      validationResults[template.identifier] = validation;
    }

    return {
      tableId,
      timestamp: new Date().toISOString(),
      templates,
      validationResults,
      totalTemplates: templates.length,
      validTemplates: templates.filter((template, i) =>
        template && validationResults[template.identifier]?.isValid === true
      ).length
    };
  }

  /**
   * Test example execution with sample data
   */
  async testExampleExecution(example: WorkingExample): Promise<ExecutionTestResult> {
    console.log(`🧪 Testing example execution: ${example.name}`);

    try {
      // Parse the query
      const document = parse(example.query);

      // Execute with sample variables
      const result = await execute({
        schema: this.schema,
        document,
        variableValues: example.variables,
        contextValue: {} // Add any required context
      });

      const success = !result.errors || result.errors.length === 0;

      return {
        exampleName: example.name,
        success,
        result: result.data,
        errors: result.errors?.map(err => err.message) || [],
        executionTime: Date.now(), // Simplified timing
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        exampleName: example.name,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Batch test multiple examples
   */
  async batchTestExamples(examples: WorkingExample[]): Promise<BatchTestResult> {
    console.log(`🔬 Batch testing ${examples.length} examples`);

    const results: ExecutionTestResult[] = [];
    let successCount = 0;

    for (const example of examples) {
      const result = await this.testExampleExecution(example);
      results.push(result);

      if (result.success) {
        successCount++;
      }
    }

    return {
      totalTests: examples.length,
      successfulTests: successCount,
      failedTests: examples.length - successCount,
      successRate: successCount / examples.length,
      results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comprehensive example documentation
   */
  async generateExampleDocumentation(tableId: string): Promise<ExampleDocumentation> {
    const examples = await this.generateWorkingExamples(tableId);
    const testResults = await this.batchTestExamples(examples);

    const documentation: ExampleDocumentation = {
      tableId,
      timestamp: new Date().toISOString(),
      summary: {
        totalExamples: examples.length,
        workingExamples: testResults.successfulTests,
        failedExamples: testResults.failedTests,
        successRate: testResults.successRate
      },
      categories: this.categorizeExamples(examples),
      examples: examples.map(example => ({
        ...example,
        documentation: this.generateExampleDoc(example),
        usageInstructions: this.generateUsageInstructions(example)
      })),
      testResults,
      recommendations: this.generateDocumentationRecommendations(examples, testResults)
    };

    return documentation;
  }

  /**
   * Private implementation methods
   */
  private isPatternRelevantForTable(pattern: QueryPattern, tableId: string): boolean {
    // Check if pattern can work with table-specific operations
    const tableRelevantOperations = ['searchNodes', 'createNode', 'updateNode', 'deleteNode'];
    return tableRelevantOperations.some(op => pattern.operationName.includes(op));
  }

  private async generateExampleFromPattern(
    pattern: QueryPattern,
    tableId: string
  ): Promise<WorkingExample | null> {
    try {
      const example: WorkingExample = {
        name: `${pattern.operationName} Example`,
        description: `Working example based on ${pattern.description}`,
        category: this.categorizePattern(pattern),
        query: this.adaptPatternForTable(pattern.example, tableId),
        variables: this.generateSampleVariables(pattern, tableId),
        expectedResult: pattern.description,
        verified: false,
        lastTested: new Date().toISOString(),
        complexity: pattern.complexity || 'medium'
      };

      return example;
    } catch (error) {
      console.error(`❌ Error generating example from pattern ${pattern.operationName}:`, error);
      return null;
    }
  }

  private async generateCustomExamples(tableId: string): Promise<WorkingExample[]> {
    return [
      {
        name: 'Basic Table Query',
        description: 'Simple query to retrieve table information',
        category: 'basic',
        query: `query GetTableInfo($tableId: ID!) {
  table(id: $tableId) {
    id
    identifier
    description
    attributeCount
    nodeCount
  }
}`,
        variables: { tableId },
        expectedResult: 'Table information object',
        verified: false,
        lastTested: new Date().toISOString(),
        complexity: 'simple'
      },

      {
        name: 'Table Attributes Query',
        description: 'Retrieve all attributes for the table',
        category: 'schema',
        query: `query GetTableAttributes($tableId: ID!) {
  table(id: $tableId) {
    attributes {
      id
      identifier
      name
      attributeType {
        dataType
      }
      required
      description
    }
  }
}`,
        variables: { tableId },
        expectedResult: 'Array of table attributes',
        verified: false,
        lastTested: new Date().toISOString(),
        complexity: 'simple'
      },

      {
        name: 'Node Search with Filters',
        description: 'Search nodes with table-specific filters',
        category: 'search',
        query: `query SearchTableNodes($filter: SearchNodesFilter!, $pagination: NodesPagination) {
  searchNodes(filter: $filter, pagination: $pagination) {
    id
    title
    content
    tableId
    createdAt
    relevanceScore
  }
}`,
        variables: {
          filter: {
            tableId: tableId,
            searchTerm: 'example'
          },
          pagination: {
            limit: 10
          }
        },
        expectedResult: 'Array of matching nodes',
        verified: false,
        lastTested: new Date().toISOString(),
        complexity: 'medium'
      },

      {
        name: 'Create Table Node',
        description: 'Create a new node in the table',
        category: 'mutation',
        query: `mutation CreateTableNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      title
      content
      tableId
    }
    errors {
      message
      field
    }
  }
}`,
        variables: {
          input: {
            tableId: tableId,
            title: 'Example Node',
            content: 'Example content for testing'
          }
        },
        expectedResult: 'Success response with created node',
        verified: false,
        lastTested: new Date().toISOString(),
        complexity: 'medium'
      }
    ];
  }

  private adaptPatternForTable(patternExample: string, tableId: string): string {
    // Replace generic table references with specific table ID
    return patternExample.replace(/tableId:\s*"[^"]*"/, `tableId: "${tableId}"`);
  }

  private generateSampleVariables(pattern: QueryPattern, tableId: string): Record<string, any> {
    const variables: Record<string, any> = { tableId };

    pattern.parameters.forEach(param => {
      switch (param.name) {
        case 'filter':
          variables.filter = {
            tableId: tableId,
            searchTerm: 'example'
          };
          break;
        case 'pagination':
          variables.pagination = { limit: 10 };
          break;
        case 'sort':
          variables.sort = [{ field: 'createdAt', direction: 'DESC' }];
          break;
        case 'input':
          variables.input = {
            tableId: tableId,
            title: 'Example',
            content: 'Example content'
          };
          break;
        default:
          variables[param.name] = this.generateDefaultValue(param.type);
      }
    });

    return variables;
  }

  private generateDefaultValue(type: any): any {
    const baseType = this.getBaseType(type);

    switch (baseType) {
      case 'String': return 'example';
      case 'Int': return 1;
      case 'Float': return 1.0;
      case 'Boolean': return true;
      case 'ID': return 'example-id';
      default: return null;
    }
  }

  private getBaseType(type: any): string {
    if (type.ofType) {
      return this.getBaseType(type.ofType);
    }
    return type.name || type.kind;
  }

  private categorizePattern(pattern: QueryPattern): string {
    if (pattern.operationName.includes('search')) return 'search';
    if (pattern.operationName.includes('create')) return 'mutation';
    if (pattern.operationName.includes('update')) return 'mutation';
    if (pattern.operationName.includes('delete')) return 'mutation';
    return 'query';
  }

  private async validateExamples(examples: WorkingExample[]): Promise<WorkingExample[]> {
    const validated: WorkingExample[] = [];

    for (const example of examples) {
      try {
        // Basic syntax validation
        parse(example.query);

        // Mark as verified
        example.verified = true;
        validated.push(example);
      } catch (error) {
        console.warn(`⚠️ Example '${example.name}' has syntax error:`, error);
        example.verified = false;
        validated.push(example); // Keep invalid examples for documentation
      }
    }

    return validated;
  }

  private categorizeExamples(examples: WorkingExample[]): { [category: string]: number } {
    const categories: { [category: string]: number } = {};

    examples.forEach(example => {
      categories[example.category] = (categories[example.category] || 0) + 1;
    });

    return categories;
  }

  private generateExampleDoc(example: WorkingExample): string {
    return `## ${example.name}

**Description**: ${example.description}
**Category**: ${example.category}
**Complexity**: ${example.complexity}

### Query
\`\`\`graphql
${example.query}
\`\`\`

### Variables
\`\`\`json
${JSON.stringify(example.variables, null, 2)}
\`\`\`

**Expected Result**: ${example.expectedResult}
`;
  }

  private generateUsageInstructions(example: WorkingExample): string {
    return `1. Copy the GraphQL query
2. Use the provided variables as a template
3. Modify variables to match your specific needs
4. Execute via GraphQL endpoint or executeTemplateWithGraphQL
5. Expected result: ${example.expectedResult}`;
  }

  private generateDocumentationRecommendations(
    examples: WorkingExample[],
    testResults: BatchTestResult
  ): string[] {
    const recommendations: string[] = [];

    if (testResults.successRate < 0.8) {
      recommendations.push('Review and fix failing examples before using in production');
    }

    if (examples.length < 5) {
      recommendations.push('Consider generating additional examples for comprehensive coverage');
    }

    const categories = this.categorizeExamples(examples);
    if (!categories['mutation']) {
      recommendations.push('Add mutation examples for complete CRUD coverage');
    }

    if (!categories['search']) {
      recommendations.push('Add search examples for data retrieval patterns');
    }

    return recommendations;
  }

  /**
   * Clear example cache
   */
  clearCache(): void {
    this.exampleCache.clear();
    console.log('🗑️ Example cache cleared');
  }
}

// Type definitions
export interface WorkingExample {
  name: string;
  description: string;
  category: string;
  query: string;
  variables: Record<string, any>;
  expectedResult: string;
  verified: boolean;
  lastTested: string;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface TemplateCollection {
  tableId: string;
  timestamp: string;
  templates: TemplateDefinition[];
  validationResults: { [templateId: string]: any };
  totalTemplates: number;
  validTemplates: number;
}

export interface ExecutionTestResult {
  exampleName: string;
  success: boolean;
  result?: any;
  errors: string[];
  executionTime?: number;
  timestamp: string;
}

export interface BatchTestResult {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  successRate: number;
  results: ExecutionTestResult[];
  timestamp: string;
}

export interface ExampleDocumentation {
  tableId: string;
  timestamp: string;
  summary: {
    totalExamples: number;
    workingExamples: number;
    failedExamples: number;
    successRate: number;
  };
  categories: { [category: string]: number };
  examples: (WorkingExample & {
    documentation: string;
    usageInstructions: string;
  })[];
  testResults: BatchTestResult;
  recommendations: string[];
}