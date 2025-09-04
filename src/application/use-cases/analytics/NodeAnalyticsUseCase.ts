import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ValidationException, NotFoundException } from '@/shared/exceptions/DomainException.js'
import type { TableId, NodeId } from '@/shared/types/common.js'
import type { RelationDirection } from '@/domain/value-objects/RelationQuery.js'

export interface NodeAnalyticsInput {
  tableId: string
  nodeFilters?: Record<string, any>
  relationFilters?: Array<{
    relationTypes?: string[]
    direction?: RelationDirection
  }>
  timeRange?: {
    startDate?: Date
    endDate?: Date
  }
}

export interface NodeMetrics {
  nodeId: string
  incomingCount: number
  outgoingCount: number
  totalRelations: number
  centrality: number
  clustering: number
  pageRank: number
  createdAt: Date
  lastActivity: Date
}

export interface RelationshipMetrics {
  relationTypeId: string
  relationTypeName: string
  totalCount: number
  averageStrength: number
  distributionByStrength: Array<{
    range: string
    count: number
  }>
}

export interface TableAnalytics {
  nodeCount: number
  relationCount: number
  relationTypeCount: number
  averageNodeDegree: number
  maxNodeDegree: number
  minNodeDegree: number
  networkDensity: number
  componentCount: number
  topCentralNodes: NodeMetrics[]
  relationshipBreakdown: RelationshipMetrics[]
  growthTrends: Array<{
    date: string
    nodeCount: number
    relationCount: number
  }>
}

export interface NodeAnalyticsOutput {
  tableAnalytics: TableAnalytics
  nodeMetrics: NodeMetrics[]
  qualityScores: Array<{
    metric: string
    score: number
    description: string
  }>
  recommendations: Array<{
    type: 'optimization' | 'quality' | 'structure'
    message: string
    priority: 'high' | 'medium' | 'low'
  }>
}

export class NodeAnalyticsUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: NodeAnalyticsInput): Promise<NodeAnalyticsOutput> {
    this.logger.info('Starting node analytics analysis', {
      tableId: input.tableId,
      hasNodeFilters: !!input.nodeFilters,
      hasRelationFilters: !!input.relationFilters
    })

    // Validate input
    this.validateInput(input)

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    try {
      // Get all nodes in the table
      const nodesResult = await this.nodeRepository.findByTableId(
        input.tableId as TableId, 
        { limit: 10000, offset: 0 }
      )
      const nodes = nodesResult.data

      // Get all relations for the table
      const relationsResult = await this.relationRepository.findByTableId(
        input.tableId as TableId,
        { limit: 10000, offset: 0 }
      )
      const relations = relationsResult.data

      // Calculate node metrics
      const nodeMetrics = await this.calculateNodeMetrics(nodes, relations)

      // Calculate relationship metrics
      const relationshipMetrics = await this.calculateRelationshipMetrics(relations)

      // Calculate table-level analytics
      const tableAnalytics = this.calculateTableAnalytics(
        nodes,
        relations,
        nodeMetrics,
        relationshipMetrics
      )

      // Calculate quality scores
      const qualityScores = this.calculateQualityScores(
        tableAnalytics,
        nodeMetrics,
        relationshipMetrics
      )

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        tableAnalytics,
        qualityScores,
        nodeMetrics
      )

      this.logger.info('Node analytics analysis completed', {
        tableId: input.tableId,
        nodeCount: nodes.length,
        relationCount: relations.length,
        qualityScore: qualityScores.find(q => q.metric === 'overall')?.score || 0
      })

      return {
        tableAnalytics,
        nodeMetrics,
        qualityScores,
        recommendations
      }
    } catch (error) {
      this.logger.error('Failed to perform node analytics', {
        input,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  private async calculateNodeMetrics(nodes: any[], relations: any[]): Promise<NodeMetrics[]> {
    const nodeMetrics: NodeMetrics[] = []

    for (const node of nodes) {
      const incomingRelations = relations.filter(r => r.targetNodeId === node.id)
      const outgoingRelations = relations.filter(r => r.sourceNodeId === node.id)
      
      const incomingCount = incomingRelations.length
      const outgoingCount = outgoingRelations.length
      const totalRelations = incomingCount + outgoingCount

      // Simple centrality calculation (degree centrality)
      const centrality = totalRelations / Math.max(nodes.length - 1, 1)

      // Simple clustering coefficient (placeholder)
      const clustering = this.calculateClusteringCoefficient(node.id, relations)

      // Simple PageRank approximation
      const pageRank = this.calculateSimplePageRank(node.id, relations, nodes.length)

      nodeMetrics.push({
        nodeId: node.id,
        incomingCount,
        outgoingCount,
        totalRelations,
        centrality,
        clustering,
        pageRank,
        createdAt: node.createdAt,
        lastActivity: node.updatedAt
      })
    }

    return nodeMetrics.sort((a, b) => b.centrality - a.centrality)
  }

  private calculateClusteringCoefficient(nodeId: string, relations: any[]): number {
    // Simplified clustering coefficient calculation
    const neighbors = new Set<string>()
    
    relations.forEach(rel => {
      if (rel.sourceNodeId === nodeId) neighbors.add(rel.targetNodeId)
      if (rel.targetNodeId === nodeId) neighbors.add(rel.sourceNodeId)
    })

    if (neighbors.size < 2) return 0

    let connections = 0
    const neighborArray = Array.from(neighbors)
    
    for (let i = 0; i < neighborArray.length; i++) {
      for (let j = i + 1; j < neighborArray.length; j++) {
        const hasConnection = relations.some(rel => 
          (rel.sourceNodeId === neighborArray[i] && rel.targetNodeId === neighborArray[j]) ||
          (rel.sourceNodeId === neighborArray[j] && rel.targetNodeId === neighborArray[i])
        )
        if (hasConnection) connections++
      }
    }

    const possibleConnections = (neighbors.size * (neighbors.size - 1)) / 2
    return connections / possibleConnections
  }

  private calculateSimplePageRank(nodeId: string, relations: any[], totalNodes: number): number {
    // Simplified PageRank calculation
    const dampingFactor = 0.85
    const baseRank = (1 - dampingFactor) / totalNodes
    
    const incomingRelations = relations.filter(r => r.targetNodeId === nodeId)
    let linkContribution = 0

    incomingRelations.forEach(rel => {
      const sourceOutgoingCount = relations.filter(r => r.sourceNodeId === rel.sourceNodeId).length
      linkContribution += dampingFactor / Math.max(sourceOutgoingCount, 1)
    })

    return baseRank + linkContribution
  }

  private async calculateRelationshipMetrics(relations: any[]): Promise<RelationshipMetrics[]> {
    const relationshipMap = new Map<string, {
      count: number
      strengths: number[]
      typeName: string
    }>()

    relations.forEach(rel => {
      if (!relationshipMap.has(rel.relationTypeId)) {
        relationshipMap.set(rel.relationTypeId, {
          count: 0,
          strengths: [],
          typeName: rel.relationTypeId // TODO: Get actual relation type name
        })
      }

      const metrics = relationshipMap.get(rel.relationTypeId)!
      metrics.count++
      if (rel.strength !== null) {
        metrics.strengths.push(rel.strength)
      }
    })

    const relationshipMetrics: RelationshipMetrics[] = []

    relationshipMap.forEach((metrics, relationTypeId) => {
      const averageStrength = metrics.strengths.length > 0
        ? metrics.strengths.reduce((sum, s) => sum + s, 0) / metrics.strengths.length
        : 0

      // Create strength distribution
      const distributionByStrength = this.createStrengthDistribution(metrics.strengths)

      relationshipMetrics.push({
        relationTypeId,
        relationTypeName: metrics.typeName,
        totalCount: metrics.count,
        averageStrength,
        distributionByStrength
      })
    })

    return relationshipMetrics.sort((a, b) => b.totalCount - a.totalCount)
  }

  private createStrengthDistribution(strengths: number[]): Array<{ range: string; count: number }> {
    const ranges = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 }
    ]

    strengths.forEach(strength => {
      const range = ranges.find(r => strength >= r.min && strength <= r.max)
      if (range) range.count++
    })

    return ranges.map(r => ({ range: r.range, count: r.count }))
  }

  private calculateTableAnalytics(
    nodes: any[],
    relations: any[],
    nodeMetrics: NodeMetrics[],
    relationshipMetrics: RelationshipMetrics[]
  ): TableAnalytics {
    const nodeCount = nodes.length
    const relationCount = relations.length
    const relationTypeCount = new Set(relations.map(r => r.relationTypeId)).size

    // Calculate degree statistics
    const degrees = nodeMetrics.map(n => n.totalRelations)
    const averageNodeDegree = degrees.length > 0
      ? degrees.reduce((sum, d) => sum + d, 0) / degrees.length
      : 0
    const maxNodeDegree = degrees.length > 0 ? Math.max(...degrees) : 0
    const minNodeDegree = degrees.length > 0 ? Math.min(...degrees) : 0

    // Calculate network density
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2
    const networkDensity = maxPossibleEdges > 0 ? relationCount / maxPossibleEdges : 0

    // Estimate component count (simplified)
    const componentCount = this.estimateComponentCount(nodes, relations)

    // Get top 10 central nodes
    const topCentralNodes = nodeMetrics.slice(0, 10)

    // Generate growth trends (simplified - would need historical data)
    const growthTrends = this.generateGrowthTrends(nodes, relations)

    return {
      nodeCount,
      relationCount,
      relationTypeCount,
      averageNodeDegree,
      maxNodeDegree,
      minNodeDegree,
      networkDensity,
      componentCount,
      topCentralNodes,
      relationshipBreakdown: relationshipMetrics,
      growthTrends
    }
  }

  private estimateComponentCount(nodes: any[], relations: any[]): number {
    // Simplified connected components estimation
    const visited = new Set<string>()
    let componentCount = 0

    const getNeighbors = (nodeId: string): string[] => {
      const neighbors: string[] = []
      relations.forEach(rel => {
        if (rel.sourceNodeId === nodeId) neighbors.push(rel.targetNodeId)
        if (rel.targetNodeId === nodeId) neighbors.push(rel.sourceNodeId)
      })
      return neighbors
    }

    const dfs = (nodeId: string) => {
      visited.add(nodeId)
      const neighbors = getNeighbors(nodeId)
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          dfs(neighbor)
        }
      })
    }

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id)
        componentCount++
      }
    })

    return componentCount
  }

  private generateGrowthTrends(nodes: any[], relations: any[]): Array<{
    date: string
    nodeCount: number
    relationCount: number
  }> {
    // Simplified growth trends based on creation dates
    const trends: Map<string, { nodeCount: number; relationCount: number }> = new Map()

    // Group by day
    nodes.forEach(node => {
      const date = new Date(node.createdAt).toISOString().split('T')[0]
      if (!trends.has(date)) {
        trends.set(date, { nodeCount: 0, relationCount: 0 })
      }
      trends.get(date)!.nodeCount++
    })

    relations.forEach(relation => {
      const date = new Date(relation.createdAt).toISOString().split('T')[0]
      if (!trends.has(date)) {
        trends.set(date, { nodeCount: 0, relationCount: 0 })
      }
      trends.get(date)!.relationCount++
    })

    return Array.from(trends.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // Last 30 days
      .map(([date, counts]) => ({
        date,
        nodeCount: counts.nodeCount,
        relationCount: counts.relationCount
      }))
  }

  private calculateQualityScores(
    tableAnalytics: TableAnalytics,
    nodeMetrics: NodeMetrics[],
    relationshipMetrics: RelationshipMetrics[]
  ): Array<{ metric: string; score: number; description: string }> {
    const scores = []

    // Connectivity score
    const connectivityScore = Math.min(tableAnalytics.averageNodeDegree / 5 * 100, 100)
    scores.push({
      metric: 'connectivity',
      score: connectivityScore,
      description: 'Measures how well nodes are connected in the graph'
    })

    // Density score
    const densityScore = Math.min(tableAnalytics.networkDensity * 100, 100)
    scores.push({
      metric: 'density',
      score: densityScore,
      description: 'Measures the proportion of actual to possible connections'
    })

    // Balance score (based on degree distribution)
    const degrees = nodeMetrics.map(n => n.totalRelations)
    const variance = this.calculateVariance(degrees)
    const balanceScore = Math.max(100 - variance / 10, 0)
    scores.push({
      metric: 'balance',
      score: balanceScore,
      description: 'Measures how evenly connections are distributed'
    })

    // Activity score (based on recent updates)
    const recentActivity = nodeMetrics.filter(n => {
      const daysSinceUpdate = (Date.now() - new Date(n.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceUpdate < 7
    }).length
    const activityScore = (recentActivity / Math.max(nodeMetrics.length, 1)) * 100
    scores.push({
      metric: 'activity',
      score: activityScore,
      description: 'Measures recent activity and updates in the graph'
    })

    // Overall score (weighted average)
    const overallScore = (
      connectivityScore * 0.3 +
      densityScore * 0.2 +
      balanceScore * 0.3 +
      activityScore * 0.2
    )
    scores.push({
      metric: 'overall',
      score: overallScore,
      description: 'Overall graph quality and health score'
    })

    return scores
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0
    
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    const squaredDifferences = numbers.map(n => Math.pow(n - mean, 2))
    return squaredDifferences.reduce((sum, sq) => sum + sq, 0) / numbers.length
  }

  private generateRecommendations(
    tableAnalytics: TableAnalytics,
    qualityScores: Array<{ metric: string; score: number; description: string }>,
    nodeMetrics: NodeMetrics[]
  ): Array<{ type: 'optimization' | 'quality' | 'structure'; message: string; priority: 'high' | 'medium' | 'low' }> {
    const recommendations = []

    // Low connectivity recommendations
    const connectivityScore = qualityScores.find(q => q.metric === 'connectivity')?.score || 0
    if (connectivityScore < 50) {
      recommendations.push({
        type: 'structure' as const,
        message: 'Consider adding more connections between isolated nodes to improve graph connectivity',
        priority: 'high' as const
      })
    }

    // High centralization recommendations
    const topNode = nodeMetrics[0]
    const averageDegree = tableAnalytics.averageNodeDegree
    if (topNode && topNode.totalRelations > averageDegree * 3) {
      recommendations.push({
        type: 'optimization' as const,
        message: `Node "${topNode.nodeId}" has unusually high centrality. Consider distributing connections more evenly`,
        priority: 'medium' as const
      })
    }

    // Low activity recommendations
    const activityScore = qualityScores.find(q => q.metric === 'activity')?.score || 0
    if (activityScore < 30) {
      recommendations.push({
        type: 'quality' as const,
        message: 'Low recent activity detected. Consider updating stale nodes or adding new content',
        priority: 'medium' as const
      })
    }

    // Component fragmentation recommendations
    if (tableAnalytics.componentCount > 3) {
      recommendations.push({
        type: 'structure' as const,
        message: `Graph has ${tableAnalytics.componentCount} disconnected components. Consider adding bridge connections`,
        priority: 'medium' as const
      })
    }

    // Orphaned nodes recommendations
    const orphanedNodes = nodeMetrics.filter(n => n.totalRelations === 0).length
    if (orphanedNodes > 0) {
      recommendations.push({
        type: 'quality' as const,
        message: `${orphanedNodes} nodes have no connections. Consider connecting them or removing if obsolete`,
        priority: 'low' as const
      })
    }

    return recommendations
  }

  private validateInput(input: NodeAnalyticsInput): void {
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (input.timeRange?.startDate && input.timeRange?.endDate) {
      if (input.timeRange.startDate >= input.timeRange.endDate) {
        throw new ValidationException('Start date must be before end date')
      }
    }
  }
}