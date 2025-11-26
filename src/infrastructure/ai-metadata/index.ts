/**
 * Enhanced AI Metadata System
 * Integration point for all AI metadata enhancement components
 */

export type {
  AttributeInfo,
  CommonQuery,
  EnhancedAIMetadata,
  ParameterDefinition,
  TableAttribute,
  TableAttributeProvider,
  TemplateRecommendation,
} from './EnhancedAIMetadataGenerator'
export { EnhancedAIMetadataGenerator } from './EnhancedAIMetadataGenerator'
export type {
  ArgumentDefinition,
  EnumValueDefinition,
  FieldDefinition,
  InputFieldDefinition,
  MutationFieldDefinition,
  QueryFieldDefinition,
  QueryPattern,
  SchemaIntrospectionResult,
  TypeDefinition,
  TypeInfo,
} from './GraphQLSchemaIntrospector'
export { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector'
export { LegacyAIMetadataAdapter } from './LegacyAIMetadataAdapter'
export type {
  DriftAnalysis,
  DriftCallback,
  DriftDetectionResult,
  MonitoringStatus,
} from './SchemaDriftMonitor'
export { SchemaDriftMonitor, SchemaDriftMonitorFactory } from './SchemaDriftMonitor'
export type {
  AITemplateValidationResult,
  DriftIssue,
  SchemaCompliantTemplateResult,
  SchemaDriftAnalysis,
  SyncResult,
  SyncStatus,
  ValidationReport,
} from './SchemaSyncPipeline'
export { SchemaSyncPipeline } from './SchemaSyncPipeline'
export type {
  AITemplateRequest,
  CorrectedTemplate,
  Correction,
  TemplateDefinition,
  ValidatedTemplate,
  ValidationError,
  ValidationResult,
} from './TemplateValidator'
export { TemplateValidator } from './TemplateValidator'
export type {
  BatchTestResult,
  ExampleDocumentation,
  ExecutionTestResult,
  TemplateCollection,
  WorkingExample,
} from './WorkingExampleGenerator'
export { WorkingExampleGenerator } from './WorkingExampleGenerator'
