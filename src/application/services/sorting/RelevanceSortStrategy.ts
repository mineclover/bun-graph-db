import {
  type EnhancedSortOption,
  type SortContext,
  SortDirection,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export interface RelevanceParameters {
  searchTerms?: string[]
  algorithm?: 'levenshtein' | 'tf-idf' | 'simple-match' | 'fuzzy'
  weights?: Record<string, number>
  boostFactors?: Record<string, number>
}

export class RelevanceSortStrategy extends SortStrategy {
  canHandle(field: string, _dataType: string): boolean {
    return field === '_relevance' || field.startsWith('_relevance_')
  }

  buildSortClause(_field: string, direction: 'asc' | 'desc', _context: SortContext): SortResult {
    // For basic relevance, just fall back to simple text matching
    return {
      sqlClause: `LENGTH(n.content) ${direction.toUpperCase()}`,
      parameters: [],
    }
  }

  override buildEnhancedSortClause(sortOption: EnhancedSortOption, context: SortContext): SortResult {
    const _field = sortOption.field
    const direction = sortOption.direction
    const params = this.parseRelevanceParameters(sortOption)

    // Build relevance scoring SQL based on algorithm
    switch (params.algorithm) {
      case 'levenshtein':
        return this.buildLevenshteinRelevance(params.searchTerms || [], direction, context)

      case 'simple-match':
        return this.buildSimpleMatchRelevance(params.searchTerms || [], direction, context)

      case 'fuzzy':
        return this.buildFuzzyRelevance(params.searchTerms || [], direction, context)
      default:
        return this.buildTfIdfRelevance(params.searchTerms || [], direction, context)
    }
  }

  getPriority(): number {
    return 80 // High priority for relevance fields
  }

  private parseRelevanceParameters(sortOption: EnhancedSortOption): RelevanceParameters {
    // Try to parse parameters from customComparator field
    if (sortOption.customComparator) {
      try {
        return JSON.parse(sortOption.customComparator) as RelevanceParameters
      } catch {
        // Fall back to defaults if parsing fails
      }
    }

    return {
      algorithm: 'simple-match',
      searchTerms: [],
      weights: { content: 1.0, title: 1.5 },
      boostFactors: {},
    }
  }

  private buildLevenshteinRelevance(
    searchTerms: string[],
    direction: 'asc' | 'desc',
    _context: SortContext,
  ): SortResult {
    if (searchTerms.length === 0) {
      return { sqlClause: '', parameters: [] }
    }

    const searchTerm = searchTerms[0] || ''
    const parameters = [searchTerm.toLowerCase(), searchTerm]

    // SQLite doesn't have built-in Levenshtein, so we use a simple text distance approximation
    const sqlClause = `
      (
        CASE
          WHEN LOWER(n.content) LIKE LOWER(?) THEN 100
          WHEN LOWER(n.title) LIKE LOWER(?) THEN 90
          ELSE
            (LENGTH(n.content) - LENGTH(REPLACE(LOWER(n.content), LOWER(?), ''))) /
            LENGTH(?) * 10
        END
      ) ${direction.toUpperCase()}`

    parameters.push(searchTerm.toLowerCase(), searchTerm)

    return {
      sqlClause,
      parameters,
    }
  }

  private buildSimpleMatchRelevance(
    searchTerms: string[],
    direction: 'asc' | 'desc',
    _context: SortContext,
  ): SortResult {
    if (searchTerms.length === 0) {
      return { sqlClause: '', parameters: [] }
    }

    const parameters: unknown[] = []
    const matchCases: string[] = []

    searchTerms.forEach((term) => {
      const lowerTerm = term.toLowerCase()

      // Exact match in title gets highest score
      matchCases.push(`WHEN LOWER(n.title) = ? THEN 100`)
      parameters.push(lowerTerm)

      // Contains in title gets high score
      matchCases.push(`WHEN LOWER(n.title) LIKE ? THEN 80`)
      parameters.push(`%${lowerTerm}%`)

      // Exact match in content gets medium score
      matchCases.push(`WHEN LOWER(n.content) = ? THEN 60`)
      parameters.push(lowerTerm)

      // Contains in content gets lower score
      matchCases.push(`WHEN LOWER(n.content) LIKE ? THEN 40`)
      parameters.push(`%${lowerTerm}%`)
    })

    const sqlClause = `
      (
        CASE
          ${matchCases.join(' ')}
          ELSE 0
        END
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildFuzzyRelevance(searchTerms: string[], direction: 'asc' | 'desc', _context: SortContext): SortResult {
    if (searchTerms.length === 0) {
      return { sqlClause: '', parameters: [] }
    }

    const parameters: unknown[] = []
    const fuzzyScores: string[] = []

    searchTerms.forEach((term) => {
      const lowerTerm = term.toLowerCase()

      // Generate fuzzy match patterns (simple approach)
      const patterns = this.generateFuzzyPatterns(lowerTerm)

      patterns.forEach((pattern, index) => {
        const score = 100 - index * 10 // Decreasing scores for less exact matches
        fuzzyScores.push(`WHEN LOWER(n.content) LIKE ? THEN ${score}`)
        parameters.push(pattern)
      })
    })

    const sqlClause = `
      (
        CASE
          ${fuzzyScores.join(' ')}
          ELSE 0
        END
      ) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private buildTfIdfRelevance(searchTerms: string[], direction: 'asc' | 'desc', _context: SortContext): SortResult {
    if (searchTerms.length === 0) {
      return { sqlClause: '', parameters: [] }
    }

    // Simplified TF-IDF approach using SQLite functions
    const parameters: unknown[] = []
    const termScores: string[] = []

    searchTerms.forEach((term) => {
      const lowerTerm = term.toLowerCase()

      // Term frequency calculation (simplified)
      termScores.push(`
        (
          (LENGTH(LOWER(n.content)) - LENGTH(REPLACE(LOWER(n.content), ?, ''))) / LENGTH(?) +
          (LENGTH(LOWER(n.title)) - LENGTH(REPLACE(LOWER(n.title), ?, ''))) / LENGTH(?) * 1.5
        )
      `)

      parameters.push(lowerTerm, lowerTerm, lowerTerm, lowerTerm)
    })

    const sqlClause = `
      (${termScores.join(' + ')}) ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters,
    }
  }

  private generateFuzzyPatterns(term: string): string[] {
    const patterns: string[] = []

    // Exact match
    patterns.push(`%${term}%`)

    // Single character substitution patterns (simplified)
    if (term.length > 2) {
      for (let i = 0; i < term.length; i++) {
        const pattern = `${term.substring(0, i)}_${term.substring(i + 1)}`
        patterns.push(`%${pattern}%`)
      }
    }

    // Missing character patterns
    if (term.length > 3) {
      for (let i = 0; i < term.length; i++) {
        const pattern = term.substring(0, i) + term.substring(i + 1)
        patterns.push(`%${pattern}%`)
      }
    }

    return patterns.slice(0, 5) // Limit to prevent query explosion
  }

  /**
   * Static helper to create relevance sort option
   */
  static createRelevanceSort(
    searchTerms: string[],
    algorithm: 'levenshtein' | 'tf-idf' | 'simple-match' | 'fuzzy' = 'simple-match',
    direction: SortDirection = SortDirection.DESC,
  ): EnhancedSortOption {
    const parameters: RelevanceParameters = {
      searchTerms,
      algorithm,
      weights: { content: 1.0, title: 1.5 },
      boostFactors: {},
    }

    return {
      field: '_relevance',
      direction,
      dataType: 'string',
      customComparator: JSON.stringify(parameters),
    }
  }
}
