import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLSchema } from 'graphql'
import type { GraphQLParent, GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'

export class TemplateMutations {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    private readonly logger: ILogger,
    private readonly schema?: GraphQLSchema
  ) {}

  async createTemplate(_: GraphQLParent, args: { input: any }) {
    try {
      this.logger.info('Creating template', { input: args.input })
      
      const template = QueryTemplate.create(
        args.input.identifier,
        args.input.name,
        args.input.queryText,
        args.input.tags || ['general'],
        {
          description: args.input.description,
          variablesSchema: args.input.variablesSchema,
          defaultVariables: args.input.defaultVariables,
          applicableTables: args.input.applicableTables,
          templateType: args.input.templateType,
          complexityScore: args.input.complexityScore,
          version: args.input.version
        }
      )
      
      const result = await this.queryTemplateRepository.create(template)

      return {
        success: !!result,
        template: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating template', { error, input: args.input })
      return {
        success: false,
        template: null,
        errors: [{ message: error.message, code: 'CREATE_TEMPLATE_ERROR' }]
      }
    }
  }

  async updateTemplate(_: GraphQLParent, args: { id: string; input: any }) {
    try {
      this.logger.info('Updating template', { id: args.id, input: args.input })
      
      const existingTemplate = await this.queryTemplateRepository.findById(args.id)
      if (!existingTemplate) {
        return {
          success: false,
          template: null,
          errors: [{ message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }]
        }
      }

      const updatedTemplate = await this.queryTemplateRepository.update(args.id, {
        name: args.input.name,
        description: args.input.description,
        queryText: args.input.queryText,
        variablesSchema: args.input.variablesSchema,
        defaultVariables: args.input.defaultVariables,
        applicableTables: args.input.applicableTables,
        templateType: args.input.templateType,
        complexityScore: args.input.complexityScore,
        version: args.input.version,
        isActive: args.input.isActive,
        tags: args.input.tags
      })

      return {
        success: !!updatedTemplate,
        template: updatedTemplate,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error updating template', { error, id: args.id, input: args.input })
      return {
        success: false,
        template: null,
        errors: [{ message: error.message, code: 'UPDATE_TEMPLATE_ERROR' }]
      }
    }
  }

  async deleteTemplate(_: GraphQLParent, args: { id: string }) {
    try {
      this.logger.info('Deleting template', { id: args.id })
      
      const existingTemplate = await this.queryTemplateRepository.findById(args.id)
      if (!existingTemplate) {
        return {
          success: false,
          errors: [{ message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }]
        }
      }

      await this.queryTemplateRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error deleting template', { error, id: args.id })
      return {
        success: false,
        errors: [{ message: error.message, code: 'DELETE_TEMPLATE_ERROR' }]
      }
    }
  }

  async activateTemplate(_: GraphQLParent, args: { id: string }) {
    try {
      this.logger.info('Activating template', { id: args.id })
      
      const result = await this.queryTemplateRepository.updateStatus(args.id, true)
      return result
    } catch (error) {
      this.logger.error('Error activating template', { error, id: args.id })
      throw error
    }
  }

  async deactivateTemplate(_: GraphQLParent, args: { id: string }) {
    try {
      this.logger.info('Deactivating template', { id: args.id })
      
      const result = await this.queryTemplateRepository.updateStatus(args.id, false)
      return result
    } catch (error) {
      this.logger.error('Error deactivating template', { error, id: args.id })
      throw error
    }
  }

  async executeTemplate(_: GraphQLParent, args: { 
    templateIdentifier: string
    variables?: Record<string, unknown>
    trackUsage?: boolean
  }, context: GraphQLContext) {
    try {
      this.logger.info('Executing template', { templateIdentifier: args.templateIdentifier })

      const result = await this.executeQueryTemplateUseCase.execute({
        templateIdentifier: args.templateIdentifier,
        variables: args.variables,
        trackUsage: args.trackUsage
      })

      return {
        queryText: result.queryText,
        processedVariables: result.processedVariables,
        metadata: result.metadata
      }
    } catch (error) {
      this.logger.error('Error executing template', { error, args })
      throw error
    }
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}