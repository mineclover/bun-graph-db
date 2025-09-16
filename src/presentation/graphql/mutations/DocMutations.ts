import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import type { UpdateDocUseCase } from '@/application/use-cases/docs/UpdateDoc.js'
import type { DeleteDocUseCase } from '@/application/use-cases/docs/DeleteDoc.js'
import type { ActivateDocUseCase } from '@/application/use-cases/docs/ActivateDoc.js'
import type {
  GraphQLContext,
  GraphQLParent,
} from '@/core/types/GraphQLTypes.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { DocCategory } from '@/domain/entities/Doc.js'
import { DocDto } from '@/application/dtos/DocDto.js'
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
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createDoc(_: GraphQLParent, args: CreateDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('input', 'Create doc input'),
        BaseResolver.validationRules.required('input.tableId', 'Table ID'),
        BaseResolver.validationRules.required('input.category', 'Doc category'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('input.category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'createDoc'
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
        doc: result ? DocDto.fromEntity(result) : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createDoc', { error, input: args.input })

      const errorCode = (error as any).code || 'CREATE_DOC_ERROR'
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
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.required('input', 'Update doc input'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'updateDoc'
    )

    try {
      this.logger.info('Executing mutation: updateDoc', { id: args.id, input: args.input })

      const result = await this.updateDocUseCase.execute({
        id: args.id,
        content: args.input.content,
      })

      this.logger.info('Mutation completed: updateDoc', { id: args.id, input: args.input })

      return {
        success: !!result,
        doc: result ? DocDto.fromEntity(result) : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateDoc', { error, id: args.id, input: args.input })

      const errorCode = (error as any).code || 'UPDATE_DOC_ERROR'
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
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'deleteDoc'
    )

    try {
      this.logger.info('Executing mutation: deleteDoc', { id: args.id })

      await this.deleteDocUseCase.execute({ id: args.id })

      this.logger.info('Mutation completed: deleteDoc', { id: args.id })

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteDoc', { error, id: args.id })

      const errorCode = (error as any).code || 'DELETE_DOC_ERROR'
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async activateDoc(_: GraphQLParent, args: ActivateDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'activateDoc'
    )

    try {
      this.logger.info('Executing mutation: activateDoc', { id: args.id })

      const result = await this.activateDocUseCase.execute({ id: args.id })

      this.logger.info('Mutation completed: activateDoc', { id: args.id })

      return {
        success: !!result,
        doc: result ? DocDto.fromEntity(result) : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: activateDoc', { error, id: args.id })

      const errorCode = (error as any).code || 'ACTIVATE_DOC_ERROR'
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
      args as any,
      [
        BaseResolver.validationRules.required('input', 'Create doc version input'),
        BaseResolver.validationRules.required('input.tableId', 'Table ID'),
        BaseResolver.validationRules.required('input.category', 'Doc category'),
        BaseResolver.validationRules.required('input.content', 'Doc content'),
        BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('input.category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('input.content', 'Doc content'),
      ],
      'createDocVersion'
    )

    try {
      this.logger.info('Executing mutation: createDocVersion', { input: args.input })

      const result = await this.createDocUseCase.execute({
        tableId: args.input.tableId,
        category: args.input.category,
        content: args.input.content,
        createAsNewVersion: true,
      })

      this.logger.info('Mutation completed: createDocVersion', { input: args.input })

      return {
        success: !!result,
        doc: result ? DocDto.fromEntity(result) : null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createDocVersion', { error, input: args.input })

      const errorCode = (error as any).code || 'CREATE_DOC_VERSION_ERROR'
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        doc: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }
}