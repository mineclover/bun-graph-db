import type { GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { McpDataValidator, McpSchemaValidator } from '@/presentation/mcp/schema/SchemaMapper.js'

export class TemplateQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    logger: ILogger,
    private schema?: GraphQLSchema,
  ) {
    super()
    this.logger = logger
  }

  async getTemplate(_: GraphQLParent, args: { id: string }, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'getTemplate',
    )

    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findById(args.id)
      },
      'findTemplateById',
      { id: args.id },
    )
  }

  async getTemplateByIdentifier(_: GraphQLParent, args: { identifier: string }, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('identifier', 'Template Identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Template Identifier'),
      ],
      'getTemplateByIdentifier',
    )

    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findByIdentifier(args.identifier)
      },
      'findTemplateByIdentifier',
      { identifier: args.identifier },
    )
  }

  async searchTemplates(
    _: GraphQLParent,
    args: {
      filter?: {
        search?: string
        isActive?: boolean
        createdBy?: string
        createdAfter?: string
        createdBefore?: string
        tags?: string[]
        tagMatchMode?: 'ANY' | 'ALL'
        applicableToTable?: string
        includeUniversal?: boolean
        templateType?: string
      }
      pagination?: {
        limit?: number
        offset?: number
      }
      sort?: Array<{
        field: string
        direction: 'ASC' | 'DESC'
      }>
    },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => {
        // Extract pagination parameters
        const limit = args.pagination?.limit || 10
        const offset = args.pagination?.offset || 0

        // Extract filter parameters
        const filter = args.filter || {}

        // Extract sort parameters (use first sort or default)
        const sort = args.sort?.[0]

        const result = await this.queryTemplateRepository.search({
          tags: filter.tags,
          tagMatchMode: filter.tagMatchMode,
          applicableToTable: filter.applicableToTable,
          includeUniversal: filter.includeUniversal,
          templateType: filter.templateType,
          isActive: filter.isActive,
          orderBy: sort?.field,
          orderDirection: sort?.direction,
          limit,
          offset,
        })

        return {
          templates: result.items,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'searchTemplates',
      { args },
    )
  }

  async getPopularTemplates(_: GraphQLParent, args: { limit?: number }, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.queryTemplateRepository.findPopular(args.limit || 10)
        return result
      },
      'findPopularTemplates',
      { limit: args.limit },
    )
  }

  async templatesByTable(
    _: GraphQLParent,
    args: { input: { tableName: string; includeUniversal?: boolean } },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Input'),
        BaseResolver.validationRules.required('input.tableName', 'Table Name'),
        BaseResolver.validationRules.nonEmpty('input.tableName', 'Table Name'),
      ],
      'templatesByTable',
    )

    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findByApplicableTable(
          args.input.tableName,
          args.input.includeUniversal ?? true,
        )
      },
      'findTemplatesByTable',
      { tableName: args.input.tableName, includeUniversal: args.input.includeUniversal },
    )
  }

  async templatesWithTableDependencies(_: GraphQLParent, _args: Record<string, never>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findTemplatesWithTableDependencies()
      },
      'findTemplatesWithTableDependencies',
      {},
    )
  }

  async tableDependencyTemplates(_: GraphQLParent, _args: Record<string, never>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const templates = await this.queryTemplateRepository.findTemplatesWithTableDependencies()

        // 테이블별로 그룹화
        const groupedByTable = new Map<string, QueryTemplate[]>()

        templates.forEach((template) => {
          const applicableTables = template.getApplicableTables() || []
          applicableTables.forEach((tableName) => {
            if (!groupedByTable.has(tableName)) {
              groupedByTable.set(tableName, [])
            }
            groupedByTable.get(tableName)?.push(template)
          })
        })

        // 결과 변환
        return Array.from(groupedByTable.entries()).map(([tableName, tableTemplates]) => ({
          tableName,
          templates: tableTemplates,
          totalCount: tableTemplates.length,
        }))
      },
      'getTableDependencyTemplates',
      {},
    )
  }

  setSchema(schema: GraphQLSchema) {
    this.schema = schema
  }

  /**
   * Validate JSON Schema for MCP inputSchema compatibility
   */
  async validateInputSchema(_: GraphQLParent, args: { input: { schema: unknown } }, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const { schema } = args.input

        // Validate the schema
        const validationResult = McpSchemaValidator.validateMcpInputSchema(schema)
        const formattedResult = McpSchemaValidator.formatValidationResult(validationResult)

        return {
          success: validationResult.valid,
          validation: {
            valid: validationResult.valid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            formattedResult,
          },
          errors: validationResult.valid
            ? []
            : [
                {
                  message: `Schema validation failed with ${validationResult.errors.length} error(s)`,
                },
              ],
        }
      },
      'validateInputSchema',
      { schemaType: typeof args.input?.schema },
    )
  }

  /**
   * Validate runtime data against a JSON Schema
   */
  async validateData(
    _: GraphQLParent,
    args: { input: { data: unknown; schema: unknown } },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => {
        const { data, schema } = args.input

        // Validate the data against the schema
        const validationResult = McpDataValidator.validate(data, schema)
        const formattedResult = McpDataValidator.formatValidationResult(validationResult)

        return {
          success: validationResult.valid,
          validation: {
            valid: validationResult.valid,
            errors: validationResult.errors,
            coercedData: validationResult.coercedData,
            formattedResult,
          },
          errors: validationResult.valid
            ? []
            : [
                {
                  message: `Data validation failed with ${validationResult.errors.length} error(s)`,
                },
              ],
        }
      },
      'validateData',
      { dataType: typeof args.input?.data, schemaType: typeof args.input?.schema },
    )
  }
}
