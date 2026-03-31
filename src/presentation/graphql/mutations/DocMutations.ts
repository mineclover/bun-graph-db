import type { ILogger } from '@/application/ports/ILogger.js'
import type { ActivateDocUseCase } from '@/application/use-cases/docs/ActivateDoc.js'
import type { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import type { DeleteDocUseCase } from '@/application/use-cases/docs/DeleteDoc.js'
import type { UpdateDocUseCase } from '@/application/use-cases/docs/UpdateDoc.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { DocCategory } from '@/domain/entities/Doc.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { BaseResolver } from '../base/BaseResolver.js'

interface CreateDocArgs {
  input: {
    tableId: string
    category: DocCategory
    content: string
    version?: number
  }
}

interface UpdateDocArgs {
  id: DocId
  input: {
    content: string
  }
}

interface DeleteDocArgs {
  id: DocId
}

interface ActivateDocArgs {
  id: DocId
}

interface CreateDocVersionArgs {
  input: {
    tableId: string
    category: DocCategory
    content: string
  }
}

export class DocMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createDocUseCase: CreateDocUseCase,
    private readonly updateDocUseCase: UpdateDocUseCase,
    private readonly deleteDocUseCase: DeleteDocUseCase,
    private readonly activateDocUseCase: ActivateDocUseCase,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  private getErrorCode(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
      return error.code
    }

    return fallback
  }

  async createDoc(_: GraphQLParent, args: CreateDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('input', 'Create doc input'),
        BaseResolver.validationRules.required('input.tableId', 'Table ID'),
        BaseResolver.validationRules.required('input.category', 'Doc category'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('input.category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'createDoc',
    )

    try {
      this.logger.info('Executing mutation: createDoc', { input: args.input })

      const result = await this.createDocUseCase.execute({
        tableId: args.input.tableId,
        category: args.input.category,
        content: args.input.content,
        version: args.input.version,
      })

      this.logger.info('Mutation completed: createDoc', { input: args.input })

      return {
        success: !!result,
        doc: result ? result.doc : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createDoc', { input: args.input, ...toErrorMeta(error) })

      const errorCode = this.getErrorCode(error, 'CREATE_DOC_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        doc: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async updateDoc(_: GraphQLParent, args: UpdateDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.required('input', 'Update doc input'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'updateDoc',
    )

    try {
      this.logger.info('Executing mutation: updateDoc', { id: args.id, input: args.input })

      const result = await this.updateDocUseCase.execute(args.id, {
        content: args.input.content,
      })

      this.logger.info('Mutation completed: updateDoc', { id: args.id, input: args.input })

      return {
        success: !!result,
        doc: result ? result.doc : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateDoc', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      const errorCode = this.getErrorCode(error, 'UPDATE_DOC_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        doc: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async deleteDoc(_: GraphQLParent, args: DeleteDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [BaseResolver.validationRules.required('id', 'Doc ID'), BaseResolver.validationRules.nonEmpty('id', 'Doc ID')],
      'deleteDoc',
    )

    try {
      this.logger.info('Executing mutation: deleteDoc', { id: args.id })

      await this.deleteDocUseCase.execute(args.id)

      this.logger.info('Mutation completed: deleteDoc', { id: args.id })

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteDoc', { id: args.id, ...toErrorMeta(error) })

      const errorCode = this.getErrorCode(error, 'DELETE_DOC_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async activateDoc(_: GraphQLParent, args: ActivateDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [BaseResolver.validationRules.required('id', 'Doc ID'), BaseResolver.validationRules.nonEmpty('id', 'Doc ID')],
      'activateDoc',
    )

    try {
      this.logger.info('Executing mutation: activateDoc', { id: args.id })

      const result = await this.activateDocUseCase.execute(args.id)

      this.logger.info('Mutation completed: activateDoc', { id: args.id })

      return {
        success: !!result,
        doc: result ? result.doc : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: activateDoc', { id: args.id, ...toErrorMeta(error) })

      const errorCode = this.getErrorCode(error, 'ACTIVATE_DOC_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        doc: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async createDocVersion(_: GraphQLParent, args: CreateDocVersionArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('input', 'Create doc version input'),
        BaseResolver.validationRules.required('input.tableId', 'Table ID'),
        BaseResolver.validationRules.required('input.category', 'Doc category'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('input.category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'createDocVersion',
    )

    try {
      this.logger.info('Executing mutation: createDocVersion', { input: args.input })

      const result = await this.createDocUseCase.execute({
        tableId: args.input.tableId,
        category: args.input.category,
        content: args.input.content,
      })

      this.logger.info('Mutation completed: createDocVersion', { input: args.input })

      return {
        success: !!result,
        doc: result ? result.doc : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createDocVersion', {
        input: args.input,
        ...toErrorMeta(error),
      })

      const errorCode = this.getErrorCode(error, 'CREATE_DOC_VERSION_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        doc: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }
}
