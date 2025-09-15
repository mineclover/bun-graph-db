import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

type QueryTemplateParent = QueryTemplate

export class QueryTemplateFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(logger: ILogger) {
    super()
    this.logger = logger
  }

  async query(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string> {
    try {
      return parent.getQueryText()
    } catch (error) {
      this.logger.error('Failed to resolve query field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async queryName(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string[]> {
    try {
      return parent.getQueryName()
    } catch (error) {
      this.logger.error('Failed to resolve queryName field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async operationType(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string> {
    try {
      return parent.getOperationType().toUpperCase()
    } catch (error) {
      this.logger.error('Failed to resolve operationType field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async variables(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<Record<string, unknown> | null> {
    try {
      return parent.getDefaultVariables()
    } catch (error) {
      this.logger.error('Failed to resolve variables field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async variablesSchema(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<Record<string, unknown> | null> {
    try {
      return parent.getVariablesSchema()
    } catch (error) {
      this.logger.error('Failed to resolve variablesSchema field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async defaultVariables(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<Record<string, unknown> | null> {
    try {
      return parent.getDefaultVariables()
    } catch (error) {
      this.logger.error('Failed to resolve defaultVariables field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async applicableTables(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string[] | null> {
    try {
      return parent.getApplicableTables()
    } catch (error) {
      this.logger.error('Failed to resolve applicableTables field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async complexityScore(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<number> {
    try {
      return parent.getComplexityScore()
    } catch (error) {
      this.logger.error('Failed to resolve complexityScore field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async usageCount(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<number> {
    try {
      return parent.getUsageCount()
    } catch (error) {
      this.logger.error('Failed to resolve usageCount field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async lastUsedAt(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string | null> {
    try {
      const lastUsed = parent.getLastUsedAt()
      return lastUsed ? lastUsed.toISOString() : null
    } catch (error) {
      this.logger.error('Failed to resolve lastUsedAt field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async avgExecutionTimeMs(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<number> {
    try {
      return parent.getAvgExecutionTimeMs()
    } catch (error) {
      this.logger.error('Failed to resolve avgExecutionTimeMs field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  async version(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string> {
    try {
      return parent.getVersion()
    } catch (error) {
      this.logger.error('Failed to resolve version field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async isActive(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<boolean> {
    try {
      return parent.getIsActive()
    } catch (error) {
      this.logger.error('Failed to resolve isActive field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async tags(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string[]> {
    try {
      return parent.getTags()
    } catch (error) {
      this.logger.error('Failed to resolve tags field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async createdBy(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string | null> {
    try {
      return null // Not tracked in current implementation
    } catch (error) {
      this.logger.error('Failed to resolve createdBy field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async createdAt(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string> {
    try {
      return parent.getCreatedAt().toISOString()
    } catch (error) {
      this.logger.error('Failed to resolve createdAt field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async updatedAt(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string> {
    try {
      return parent.getUpdatedAt().toISOString()
    } catch (error) {
      this.logger.error('Failed to resolve updatedAt field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async isValid(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<boolean> {
    try {
      return this.validateQuery(parent.getQueryText())
    } catch (error) {
      this.logger.error('Failed to resolve isValid field', { templateId: parent.getId(), error })
      throw error
    }
  }

  async validationErrors(
    parent: QueryTemplateParent,
    _args?: any,
    _context?: GraphQLContext
  ): Promise<string[]> {
    try {
      const errors: string[] = []

      if (!parent.getQueryText() || parent.getQueryText().trim().length === 0) {
        errors.push('Query text cannot be empty')
      }

      if (!parent.getName() || parent.getName().trim().length === 0) {
        errors.push('Template name cannot be empty')
      }

      if (!parent.getIdentifier() || parent.getIdentifier().trim().length === 0) {
        errors.push('Template identifier cannot be empty')
      }

      if (parent.getTags().length === 0) {
        errors.push('At least one tag is required')
      }

      return errors
    } catch (error) {
      this.logger.error('Failed to resolve validationErrors field', {
        templateId: parent.getId(),
        error,
      })
      throw error
    }
  }

  private validateQuery(queryText: string): boolean {
    if (!queryText || queryText.trim().length === 0) return false

    try {
      const trimmed = queryText.trim()
      const hasValidStart = /^(query|mutation|subscription|\{)/.test(trimmed.toLowerCase())
      const hasMatchingBraces = this.validateBraces(trimmed)

      return hasValidStart && hasMatchingBraces
    } catch {
      return false
    }
  }

  private validateBraces(query: string): boolean {
    let braceCount = 0
    for (const char of query) {
      if (char === '{') braceCount++
      if (char === '}') braceCount--
      if (braceCount < 0) return false
    }
    return braceCount === 0
  }
}
