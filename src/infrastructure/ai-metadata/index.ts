/**
 * Enhanced AI Metadata System
 * Integration point for all AI metadata enhancement components
 */

export { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector';
export type {
  SchemaIntrospectionResult,
  QueryFieldDefinition,
  MutationFieldDefinition,
  ArgumentDefinition,
  TypeInfo,
  TypeDefinition,
  FieldDefinition,
  InputFieldDefinition,
  EnumValueDefinition,
  QueryPattern
} from './GraphQLSchemaIntrospector';

export { EnhancedAIMetadataGenerator } from './EnhancedAIMetadataGenerator';
export type {
  EnhancedAIMetadata,
  CommonQuery,
  TemplateRecommendation,
  ParameterDefinition,
  AttributeInfo,
  TableAttributeProvider,
  TableAttribute
} from './EnhancedAIMetadataGenerator';

export { TemplateValidator } from './TemplateValidator';
export type {
  TemplateDefinition,
  ValidationResult,
  ValidationError,
  Correction,
  CorrectedTemplate,
  AITemplateRequest,
  ValidatedTemplate
} from './TemplateValidator';

export { SchemaSyncPipeline } from './SchemaSyncPipeline';
export type {
  SyncResult,
  SchemaDriftAnalysis,
  DriftIssue,
  ValidationReport,
  AITemplateValidationResult,
  SchemaCompliantTemplateResult,
  SyncStatus
} from './SchemaSyncPipeline';

export { SchemaDriftMonitor, SchemaDriftMonitorFactory } from './SchemaDriftMonitor';
export type {
  DriftDetectionResult,
  DriftAnalysis,
  MonitoringStatus,
  DriftCallback
} from './SchemaDriftMonitor';

export { WorkingExampleGenerator } from './WorkingExampleGenerator';
export type {
  WorkingExample,
  TemplateCollection,
  ExecutionTestResult,
  BatchTestResult,
  ExampleDocumentation
} from './WorkingExampleGenerator';

export { LegacyAIMetadataAdapter } from './LegacyAIMetadataAdapter';