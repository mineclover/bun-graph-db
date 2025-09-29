import { GraphQLSchema } from 'graphql';
import { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector';
import type { SchemaIntrospectionResult } from './GraphQLSchemaIntrospector';
import { EnhancedAIMetadataGenerator } from './EnhancedAIMetadataGenerator';
import type { EnhancedAIMetadata, TableAttributeProvider } from './EnhancedAIMetadataGenerator';
import { TemplateValidator } from './TemplateValidator';
import type { TemplateDefinition, ValidationResult, ValidatedTemplate } from './TemplateValidator';

/**
 * Schema-to-Metadata Synchronization Pipeline
 * Coordinates schema introspection, AI metadata enhancement, and template validation
 */
export class SchemaSyncPipeline {
  private schemaIntrospector: GraphQLSchemaIntrospector;
  private metadataGenerator: EnhancedAIMetadataGenerator;
  private templateValidator: TemplateValidator;
  private schema: GraphQLSchema;
  private lastSyncTime: Date | null = null;
  private syncInProgress = false;

  constructor(
    schema: GraphQLSchema,
    tableAttributeProvider: TableAttributeProvider
  ) {
    this.schema = schema;
    this.schemaIntrospector = new GraphQLSchemaIntrospector(schema);
    this.metadataGenerator = new EnhancedAIMetadataGenerator(this.schemaIntrospector, tableAttributeProvider);
    this.templateValidator = new TemplateValidator(this.schemaIntrospector, schema);
  }

  /**
   * Full synchronization pipeline: introspect → generate → validate
   */
  async runFullSync(tableId: string): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Synchronization already in progress');
    }

    this.syncInProgress = true;
    const startTime = new Date();

    try {
      console.log(`🔄 Starting full schema synchronization for table ${tableId}`);

      // 1. Schema Introspection
      console.log('📊 Step 1: Schema introspection...');
      const schemaIntrospection = await this.schemaIntrospector.getSchemaIntrospection();

      // 2. Enhanced Metadata Generation
      console.log('🤖 Step 2: Enhanced AI metadata generation...');
      const enhancedMetadata = await this.metadataGenerator.generateEnhancedMetadata(tableId);

      // 3. Schema Drift Detection
      console.log('🔍 Step 3: Schema drift detection...');
      const driftAnalysis = await this.detectSchemaDrift(enhancedMetadata, schemaIntrospection);

      // 4. Validation Report
      console.log('✅ Step 4: Generating validation report...');
      const validationReport = await this.generateValidationReport(tableId, enhancedMetadata);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.lastSyncTime = endTime;

      const result: SyncResult = {
        tableId,
        timestamp: endTime.toISOString(),
        duration,
        schemaIntrospection,
        enhancedMetadata,
        driftAnalysis,
        validationReport,
        success: true,
        recommendations: this.generateRecommendations(driftAnalysis, validationReport)
      };

      console.log(`✅ Synchronization completed in ${duration}ms`);
      return result;

    } catch (error) {
      console.error('❌ Synchronization failed:', error);
      return {
        tableId,
        timestamp: new Date().toISOString(),
        duration: new Date().getTime() - startTime.getTime(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: []
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Validate AI-generated template using the pipeline
   */
  async validateAITemplate(template: TemplateDefinition): Promise<AITemplateValidationResult> {
    console.log(`🔍 Validating AI template: ${template.identifier}`);

    // 1. Basic template validation
    const validation = await this.templateValidator.validateTemplate(template);

    // 2. If validation fails, attempt auto-correction
    let correctedTemplate = null;
    let correctionAttempted = false;

    if (!validation.isValid && validation.corrections.length > 0) {
      console.log('🔧 Attempting auto-correction...');
      correctionAttempted = true;
      const correctionResult = await this.templateValidator.applyCorrections(template, validation.corrections);
      correctedTemplate = correctionResult;

      // Re-validate corrected template
      const correctedValidation = await this.templateValidator.validateTemplate(correctionResult.correctedTemplate);

      return {
        originalTemplate: template,
        validation,
        correctedTemplate: correctionResult,
        correctedValidation,
        success: correctedValidation.isValid,
        recommendations: this.generateTemplateRecommendations(validation, correctionResult),
        timestamp: new Date().toISOString()
      };
    }

    return {
      originalTemplate: template,
      validation,
      success: validation.isValid,
      recommendations: this.generateTemplateRecommendations(validation),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate schema-compliant template from AI suggestion
   */
  async generateSchemaCompliantTemplate(aiRequest: {
    tableId: string;
    operationType: string;
    intent: string;
    variables?: Record<string, any>;
  }): Promise<SchemaCompliantTemplateResult> {
    console.log(`🎯 Generating schema-compliant template for: ${aiRequest.intent}`);

    try {
      // 1. Get enhanced metadata for context
      const enhancedMetadata = await this.metadataGenerator.generateEnhancedMetadata(aiRequest.tableId);

      // 2. Find matching query patterns
      const queryPatterns = await this.schemaIntrospector.getQueryPatterns();
      const matchingPattern = queryPatterns.find(pattern =>
        pattern.operationName === aiRequest.operationType ||
        pattern.description.toLowerCase().includes(aiRequest.intent.toLowerCase())
      );

      if (!matchingPattern) {
        throw new Error(`No schema pattern found for operation: ${aiRequest.operationType}`);
      }

      // 3. Generate template using validator
      const validatedTemplate = await this.templateValidator.generateSchemaCompliantTemplate({
        identifier: `ai-generated-${aiRequest.operationType}-${Date.now()}`,
        name: `AI Generated: ${aiRequest.intent}`,
        operationType: aiRequest.operationType,
        intent: aiRequest.intent,
        variables: aiRequest.variables,
        tags: ['ai-generated', 'schema-compliant']
      });

      // 4. Final validation
      const finalValidation = await this.templateValidator.validateTemplate(validatedTemplate.template);

      return {
        template: validatedTemplate.template,
        validation: finalValidation,
        schemaPattern: matchingPattern,
        enhancedMetadata: enhancedMetadata.schemaInfo,
        success: finalValidation.isValid,
        confidence: finalValidation.confidence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Detect schema drift between AI metadata and actual schema
   */
  private async detectSchemaDrift(
    enhancedMetadata: EnhancedAIMetadata,
    schemaIntrospection: SchemaIntrospectionResult
  ): Promise<SchemaDriftAnalysis> {
    const driftIssues: DriftIssue[] = [];

    // 1. Compare parameter structures
    const aiQueryExamples = enhancedMetadata.usagePatterns.commonQueries;
    const schemaQueries = schemaIntrospection.queries;

    for (const aiQuery of aiQueryExamples) {
      const schemaQuery = schemaQueries.find(q => aiQuery.example.includes(q.name));

      if (schemaQuery) {
        // Check parameter compatibility
        const aiParams = this.extractParametersFromExample(aiQuery.example);
        const schemaParams = schemaQuery.args.map(arg => arg.name);

        const missingParams = schemaParams.filter(param => !aiParams.includes(param));
        const extraParams = aiParams.filter(param => !schemaParams.includes(param));

        if (missingParams.length > 0 || extraParams.length > 0) {
          driftIssues.push({
            type: 'PARAMETER_MISMATCH',
            severity: 'HIGH',
            operation: schemaQuery.name,
            description: `AI metadata suggests different parameters than schema`,
            aiSuggestion: aiParams.join(', '),
            schemaTruth: schemaParams.join(', '),
            impact: 'Template generation will fail'
          });
        }
      }
    }

    // 2. Check for schema version compatibility
    const lastSchemaSync = new Date(enhancedMetadata.validationInfo.lastSchemaSync);
    const schemaLastUpdated = new Date(schemaIntrospection.lastUpdated);
    const timeDrift = schemaLastUpdated.getTime() - lastSchemaSync.getTime();

    if (timeDrift > 24 * 60 * 60 * 1000) { // 24 hours
      driftIssues.push({
        type: 'VERSION_DRIFT',
        severity: 'MEDIUM',
        description: `AI metadata outdated by ${Math.floor(timeDrift / (60 * 60 * 1000))} hours`,
        impact: 'Potential parameter and type mismatches'
      });
    }

    // 3. Compatibility score analysis
    if (enhancedMetadata.validationInfo.compatibilityScore < 0.8) {
      driftIssues.push({
        type: 'LOW_COMPATIBILITY',
        severity: 'HIGH',
        description: `Low compatibility score: ${enhancedMetadata.validationInfo.compatibilityScore}`,
        impact: 'High likelihood of template validation failures'
      });
    }

    return {
      driftDetected: driftIssues.length > 0,
      severity: this.calculateOverallSeverity(driftIssues),
      issues: driftIssues,
      compatibilityScore: enhancedMetadata.validationInfo.compatibilityScore,
      recommendations: this.generateDriftRecommendations(driftIssues)
    };
  }

  /**
   * Generate validation report for table
   */
  private async generateValidationReport(
    tableId: string,
    enhancedMetadata: EnhancedAIMetadata
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      tableId,
      timestamp: new Date().toISOString(),
      schemaCompliance: {
        score: enhancedMetadata.validationInfo.compatibilityScore,
        status: enhancedMetadata.validationInfo.compatibilityScore > 0.8 ? 'GOOD' :
               enhancedMetadata.validationInfo.compatibilityScore > 0.6 ? 'FAIR' : 'POOR'
      },
      templateCompatibility: {
        workingExamples: enhancedMetadata.usagePatterns.validExamples.length,
        totalExamples: enhancedMetadata.usagePatterns.commonQueries.length,
        successRate: enhancedMetadata.usagePatterns.validExamples.length /
                    Math.max(enhancedMetadata.usagePatterns.commonQueries.length, 1)
      },
      schemaInfo: {
        version: enhancedMetadata.validationInfo.schemaVersion,
        lastSync: enhancedMetadata.validationInfo.lastSchemaSync,
        queryCount: enhancedMetadata.schemaInfo.graphqlSchema.queries.length,
        mutationCount: enhancedMetadata.schemaInfo.graphqlSchema.mutations.length
      }
    };

    return report;
  }

  /**
   * Helper methods
   */
  private extractParametersFromExample(example: string): string[] {
    const matches = example.match(/\$(\w+)/g);
    return matches ? matches.map(match => match.slice(1)) : [];
  }

  private calculateOverallSeverity(issues: DriftIssue[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (issues.some(issue => issue.severity === 'HIGH')) return 'HIGH';
    if (issues.some(issue => issue.severity === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private generateDriftRecommendations(issues: DriftIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === 'PARAMETER_MISMATCH')) {
      recommendations.push('Update AI metadata parameter mappings to match current schema');
    }

    if (issues.some(issue => issue.type === 'VERSION_DRIFT')) {
      recommendations.push('Refresh AI metadata generation from current schema introspection');
    }

    if (issues.some(issue => issue.type === 'LOW_COMPATIBILITY')) {
      recommendations.push('Implement real-time schema synchronization for AI metadata');
    }

    return recommendations;
  }

  private generateRecommendations(
    driftAnalysis: SchemaDriftAnalysis,
    validationReport: ValidationReport
  ): string[] {
    const recommendations: string[] = [];

    if (driftAnalysis.driftDetected) {
      recommendations.push(...driftAnalysis.recommendations);
    }

    if (validationReport.templateCompatibility.successRate < 0.8) {
      recommendations.push('Review and update template generation patterns');
    }

    if (validationReport.schemaCompliance.status === 'POOR') {
      recommendations.push('Implement automated schema validation pipeline');
    }

    return recommendations;
  }

  private generateTemplateRecommendations(
    validation: ValidationResult,
    correctionResult?: any
  ): string[] {
    const recommendations: string[] = [];

    if (!validation.isValid) {
      recommendations.push('Template requires manual review and correction');
    }

    if (validation.confidence < 0.8) {
      recommendations.push('Low confidence - validate with schema documentation');
    }

    if (correctionResult && correctionResult.confidence < 0.9) {
      recommendations.push('Auto-corrections applied - verify before production use');
    }

    return recommendations;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      lastSyncTime: this.lastSyncTime?.toISOString() || null,
      syncInProgress: this.syncInProgress,
      isReady: this.lastSyncTime !== null
    };
  }
}

// Type definitions
export interface SyncResult {
  tableId: string;
  timestamp: string;
  duration: number;
  schemaIntrospection?: SchemaIntrospectionResult;
  enhancedMetadata?: EnhancedAIMetadata;
  driftAnalysis?: SchemaDriftAnalysis;
  validationReport?: ValidationReport;
  success: boolean;
  error?: string;
  recommendations: string[];
}

export interface SchemaDriftAnalysis {
  driftDetected: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  issues: DriftIssue[];
  compatibilityScore: number;
  recommendations: string[];
}

export interface DriftIssue {
  type: 'PARAMETER_MISMATCH' | 'VERSION_DRIFT' | 'LOW_COMPATIBILITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  operation?: string;
  description: string;
  aiSuggestion?: string;
  schemaTruth?: string;
  impact: string;
}

export interface ValidationReport {
  tableId: string;
  timestamp: string;
  schemaCompliance: {
    score: number;
    status: 'GOOD' | 'FAIR' | 'POOR';
  };
  templateCompatibility: {
    workingExamples: number;
    totalExamples: number;
    successRate: number;
  };
  schemaInfo: {
    version: string;
    lastSync: string;
    queryCount: number;
    mutationCount: number;
  };
}

export interface AITemplateValidationResult {
  originalTemplate: TemplateDefinition;
  validation: ValidationResult;
  correctedTemplate?: any;
  correctedValidation?: ValidationResult;
  success: boolean;
  recommendations: string[];
  timestamp: string;
}

export interface SchemaCompliantTemplateResult {
  template?: TemplateDefinition;
  validation?: ValidationResult;
  schemaPattern?: any;
  enhancedMetadata?: any;
  success: boolean;
  confidence?: number;
  error?: string;
  timestamp: string;
}

export interface SyncStatus {
  lastSyncTime: string | null;
  syncInProgress: boolean;
  isReady: boolean;
}