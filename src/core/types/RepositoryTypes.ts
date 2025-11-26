/**
 * Base repository interfaces for standardized data access patterns
 * Provides common CRUD operations and query methods
 */

import type { PaginatedResult, PaginationOptions } from './CommonTypes.js'

/**
 * Base repository interface with common CRUD operations
 * All entity repositories should extend this interface
 *
 * @typeParam TEntity - The domain entity type
 * @typeParam TId - The entity's ID type (e.g., TableId, NodeId)
 */
export interface IBaseRepository<TEntity, TId> {
  /**
   * Save a new entity or update an existing one
   * @param entity - The entity to save
   * @returns The saved entity (may include generated fields like ID)
   */
  save(entity: TEntity): Promise<TEntity | void>

  /**
   * Find an entity by its unique ID
   * @param id - The entity's ID
   * @returns The entity if found, null otherwise
   */
  findById(id: TId): Promise<TEntity | null>

  /**
   * Find all entities with optional pagination and filtering
   * @param options - Pagination and search options
   * @returns Paginated result with entities and metadata
   */
  findAll(options?: PaginationOptions): Promise<PaginatedResult<TEntity>>

  /**
   * Delete an entity by its ID
   * @param id - The entity's ID to delete
   * @returns Promise that resolves when deletion is complete
   */
  delete(id: TId): Promise<void>

  /**
   * Count total number of entities
   * @returns Total count of entities
   */
  count(): Promise<number>
}

/**
 * Extended repository interface with identifier-based operations
 * For entities that have a human-readable identifier field
 */
export interface IRepositoryWithIdentifier<TEntity, TId> extends IBaseRepository<TEntity, TId> {
  /**
   * Find an entity by its unique identifier string
   * @param identifier - The entity's identifier (e.g., "user_profile", "post_comments")
   * @returns The entity if found, null otherwise
   */
  findByIdentifier(identifier: string): Promise<TEntity | null>

  /**
   * Check if an entity with the given identifier exists
   * @param identifier - The identifier to check
   * @returns True if exists, false otherwise
   */
  exists(identifier: string): Promise<boolean>
}

/**
 * Extended repository interface with batch operations support
 * For repositories that need to handle bulk operations efficiently
 */
export interface IRepositoryWithBatchOperations<TEntity, TId>
  extends IBaseRepository<TEntity, TId> {
  /**
   * Save multiple entities in a single operation
   * @param entities - Array of entities to save
   * @returns Promise that resolves when all entities are saved
   */
  saveMany(entities: TEntity[]): Promise<void>

  /**
   * Find multiple entities by their IDs
   * @param ids - Array of entity IDs to retrieve
   * @returns Array of found entities (may be less than requested if some don't exist)
   */
  findByIds(ids: TId[]): Promise<TEntity[]>

  /**
   * Delete multiple entities by their IDs
   * @param ids - Array of entity IDs to delete
   * @returns Promise that resolves when all entities are deleted
   */
  deleteMany(ids: TId[]): Promise<void>
}

/**
 * Extended repository interface with partial update support
 * For entities that support field-level updates
 *
 * @typeParam TUpdateData - The type defining which fields can be updated
 */
export interface IRepositoryWithUpdate<TEntity, TId, TUpdateData = Partial<TEntity>>
  extends IBaseRepository<TEntity, TId> {
  /**
   * Update specific fields of an entity
   * @param id - The entity's ID
   * @param updates - Partial entity data to update
   * @returns The updated entity
   */
  update(id: TId, updates: TUpdateData): Promise<TEntity>
}

/**
 * Full-featured repository interface combining all common patterns
 * Suitable for most entity repositories
 */
export interface IFullRepository<TEntity, TId, TUpdateData = Partial<TEntity>>
  extends IRepositoryWithIdentifier<TEntity, TId>,
    IRepositoryWithBatchOperations<TEntity, TId>,
    IRepositoryWithUpdate<TEntity, TId, TUpdateData> {}

/**
 * Repository interface for child entities (entities belonging to a parent)
 * Examples: Attributes belong to Tables, Nodes belong to Tables
 *
 * @typeParam TEntity - The child entity type
 * @typeParam TId - The child entity's ID type
 * @typeParam TParentId - The parent entity's ID type
 */
export interface IChildRepository<TEntity, TId, TParentId> extends IBaseRepository<TEntity, TId> {
  /**
   * Find all child entities belonging to a parent
   * @param parentId - The parent entity's ID
   * @param options - Pagination options
   * @returns Paginated result of child entities
   */
  findByParentId(
    parentId: TParentId,
    options?: PaginationOptions
  ): Promise<PaginatedResult<TEntity>>

  /**
   * Count child entities belonging to a parent
   * @param parentId - The parent entity's ID
   * @returns Count of child entities
   */
  countByParentId(parentId: TParentId): Promise<number>

  /**
   * Delete all child entities belonging to a parent
   * @param parentId - The parent entity's ID
   * @returns Promise that resolves when all children are deleted
   */
  deleteByParentId(parentId: TParentId): Promise<void>
}

/**
 * Type alias for standard table-scoped repositories
 * Most entities in this system are scoped to a table
 */
export type ITableScopedRepository<TEntity, TId> = IChildRepository<
  TEntity,
  TId,
  string // TableId
>

/**
 * Query builder interface for complex search operations
 * Can be extended by repositories that need advanced querying
 */
export interface IQueryBuilder<TEntity> {
  /**
   * Add a filter condition to the query
   * @param field - The field to filter on
   * @param operator - The comparison operator
   * @param value - The value to compare against
   * @returns The query builder for method chaining
   */
  where(field: keyof TEntity, operator: string, value: unknown): this

  /**
   * Add an OR condition to the query
   * @param conditions - Array of filter conditions
   * @returns The query builder for method chaining
   */
  orWhere(conditions: Array<{ field: keyof TEntity; operator: string; value: unknown }>): this

  /**
   * Add sorting to the query
   * @param field - The field to sort by
   * @param direction - Sort direction (ASC or DESC)
   * @returns The query builder for method chaining
   */
  orderBy(field: keyof TEntity, direction: 'ASC' | 'DESC'): this

  /**
   * Set pagination for the query
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns The query builder for method chaining
   */
  paginate(limit: number, offset: number): this

  /**
   * Execute the query and return results
   * @returns Paginated result of entities matching the query
   */
  execute(): Promise<PaginatedResult<TEntity>>
}

/**
 * Repository health check interface
 * For monitoring and debugging repository connections
 */
export interface IRepositoryHealth {
  /**
   * Check if the repository is healthy and can perform operations
   * @returns True if healthy, false if there are issues
   */
  isHealthy(): Promise<boolean>

  /**
   * Get detailed health information about the repository
   * @returns Object containing health metrics and status
   */
  getHealthInfo(): Promise<{
    connected: boolean
    latency?: number
    lastError?: string
    metadata?: Record<string, unknown>
  }>
}

/**
 * Repository transaction support interface
 * For repositories that need to support atomic operations
 */
export interface IRepositoryWithTransaction {
  /**
   * Begin a new transaction
   * @returns Transaction context that should be passed to other methods
   */
  beginTransaction(): Promise<unknown>

  /**
   * Commit the current transaction
   * @param transaction - The transaction context to commit
   */
  commitTransaction(transaction: unknown): Promise<void>

  /**
   * Rollback the current transaction
   * @param transaction - The transaction context to rollback
   */
  rollbackTransaction(transaction: unknown): Promise<void>

  /**
   * Execute a function within a transaction
   * Automatically commits on success or rolls back on error
   * @param fn - The function to execute within the transaction
   * @returns The result of the function
   */
  withTransaction<T>(fn: (transaction: unknown) => Promise<T>): Promise<T>
}
