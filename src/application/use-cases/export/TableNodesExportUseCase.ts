import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface TableNodesExportOptions {
  format: 'csv' | 'json' | 'excel' | 'xml' | 'yaml'
  includeAttributes: boolean
  includeMetadata: boolean
  attributeFormat: 'columns' | 'nested' | 'keyvalue'
  dateFormat: 'iso' | 'timestamp' | 'readable'
  limit?: number
  offset?: number
  compression?: boolean
  prettyPrint?: boolean
  saveToFile?: boolean
  outputDirectory?: string
  filename?: string
}

export interface ExportedNodeData {
  id: string
  title?: string
  content: string
  description?: string
  attributes: Record<string, unknown>
  metadata?: {
    createdAt: string
    updatedAt: string
    tableId: string
  }
}

export interface TableNodesExportResult {
  success: boolean
  format: string
  data?: string | Buffer
  filePath?: string
  metadata: {
    exportedAt: string
    tableId: string
    tableIdentifier: string
    totalNodes: number
    exportedNodes: number
    format: string
    options: TableNodesExportOptions
    checksum?: string
    fileSize?: string
    filePath?: string
  }
  errors?: string[]
}

export class TableNodesExportUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(tableId: string, options: TableNodesExportOptions): Promise<TableNodesExportResult> {
    const startTime = Date.now()

    try {
      this.logger.info('Starting table nodes export', { tableId, options })

      // Validate input
      this.validateInput(tableId, options)

      // Check if table exists
      const table = await this.tableRepository.findById(tableId as TableId)
      if (!table) {
        throw new NotFoundException(`Table with id '${tableId}' not found`)
      }

      // Get table attributes for schema information
      await this.attributeRepository.findByTableId(tableId as TableId)

      // Get nodes with pagination
      const nodesResult = await this.nodeRepository.findByTableId(tableId as TableId, {
        limit: options.limit || 10000,
        offset: options.offset || 0,
      })
      const nodes = nodesResult.data || []

      // Prepare export data
      const exportData: ExportedNodeData[] = []

      for (const node of nodes) {
        const nodeData: ExportedNodeData = {
          id: node.getId(),
          title: node.getTitle() || undefined,
          content: node.getContent(),
          description: node.getDescription() || undefined,
          attributes: {},
        }

        // Add metadata if requested
        if (options.includeMetadata) {
          nodeData.metadata = {
            createdAt: this.formatDate(node.getCreatedAt(), options.dateFormat),
            updatedAt: this.formatDate(node.getUpdatedAt(), options.dateFormat),
            tableId: tableId,
          }
        }

        // Add attributes if requested
        if (options.includeAttributes) {
          // Get node attributes (this would need to be implemented in repository)
          // For now, we'll use empty attributes object
          nodeData.attributes = await this.getNodeAttributes(node.getId())
        }

        exportData.push(nodeData)
      }

      // Generate export based on format
      let exportedData: string | Buffer
      let fileSize: string = '0 B'

      switch (options.format) {
        case 'csv': {
          // CSV는 기본적으로 columns 형태로 출력
          const csvOptions = { ...options, attributeFormat: 'columns' as const }
          exportedData = this.exportToCSV(exportData, csvOptions)
          break
        }
        case 'json': {
          // JSON도 attributes가 개별 컬럼으로 펼쳐지도록 columns 형태로 출력
          const jsonOptions = { ...options, attributeFormat: 'columns' as const }
          exportedData = this.exportToJSON(exportData, jsonOptions)
          break
        }
        case 'excel':
          exportedData = await this.exportToExcel(exportData, options)
          break
        case 'xml':
          exportedData = this.exportToXML(exportData, options)
          break
        case 'yaml':
          exportedData = this.exportToYAML(exportData, options)
          break
        default:
          throw new ValidationException(`Unsupported export format: ${options.format}`)
      }

      // Calculate file size
      fileSize = this.calculateFileSize(exportedData)

      // Calculate checksum for integrity
      const checksum = this.calculateChecksum(exportedData)

      const executionTime = Date.now() - startTime
      this.logger.info('Table nodes export completed', {
        tableId,
        format: options.format,
        exportedNodes: exportData.length,
        fileSize,
        executionTime,
      })

      // Save to file if requested
      let filePath: string | undefined
      if (options.saveToFile) {
        try {
          filePath = await this.saveToFile(exportedData, options, table.identifier)
          this.logger.info('Export file saved', { filePath })
        } catch (fileError) {
          this.logger.warn('Failed to save export file', { error: fileError })
        }
      }

      return {
        success: true,
        format: options.format,
        data: exportedData,
        filePath,
        metadata: {
          exportedAt: new Date().toISOString(),
          tableId,
          tableIdentifier: table.identifier,
          totalNodes: nodesResult.total || 0,
          exportedNodes: exportData.length,
          format: options.format,
          options,
          checksum,
          fileSize,
          filePath,
        },
      }
    } catch (error) {
      this.logger.error('Failed to export table nodes', {
        tableId,
        options,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        format: options.format,
        metadata: {
          exportedAt: new Date().toISOString(),
          tableId,
          tableIdentifier: 'unknown',
          totalNodes: 0,
          exportedNodes: 0,
          format: options.format,
          options,
        },
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  private validateInput(tableId: string, options: TableNodesExportOptions): void {
    if (!tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!options.format) {
      throw new ValidationException('Export format is required')
    }

    const validFormats = ['csv', 'json', 'excel', 'xml', 'yaml']
    if (!validFormats.includes(options.format)) {
      throw new ValidationException(`Invalid format. Must be one of: ${validFormats.join(', ')}`)
    }

    if (options.limit !== undefined && (options.limit < 1 || options.limit > 100000)) {
      throw new ValidationException('Limit must be between 1 and 100,000')
    }

    if (options.offset !== undefined && options.offset < 0) {
      throw new ValidationException('Offset must be non-negative')
    }
  }

  private formatDate(date: Date, format: 'iso' | 'timestamp' | 'readable'): string {
    switch (format) {
      case 'iso':
        return date.toISOString()
      case 'timestamp':
        return date.getTime().toString()
      case 'readable':
        return date.toLocaleString()
      default:
        return date.toISOString()
    }
  }

  private async getNodeAttributes(nodeId: string): Promise<Record<string, unknown>> {
    try {
      const nodeAttributesResult = await this.nodeAttributeRepository.findByNodeId(nodeId)
      // The result IS the array, not wrapped in a data property
      const nodeAttributes = Array.isArray(nodeAttributesResult) ? nodeAttributesResult : []

      const attributeMap: Record<string, unknown> = {}

      for (const nodeAttr of nodeAttributes) {
        // Get the attribute ID and look up the attribute to get the identifier
        const attributeId = nodeAttr.getAttributeId()
        const attributeResult = await this.attributeRepository.findById(attributeId)

        if (attributeResult) {
          const attributeIdentifier = attributeResult.getIdentifier()
          const value = nodeAttr.getValue()
          attributeMap[attributeIdentifier] = value
        } else {
          this.logger.warn('Attribute not found for node attribute', { nodeId, attributeId })
        }
      }

      return attributeMap
    } catch (error) {
      this.logger.warn('Failed to get node attributes', { nodeId, error: toErrorMeta(error) })
      return {}
    }
  }

  private exportToCSV(data: ExportedNodeData[], options: TableNodesExportOptions): string {
    if (data.length === 0) {
      return 'No data to export'
    }

    const rows: string[] = []

    // Determine columns based on attributeFormat
    const headers: string[] = ['id', 'title', 'content', 'description']

    if (options.includeMetadata) {
      headers.push('createdAt', 'updatedAt', 'tableId')
    }

    if (options.includeAttributes) {
      if (options.attributeFormat === 'columns') {
        // Add each attribute as a separate column
        const allAttributeKeys = new Set<string>()
        for (const node of data) {
          for (const key of Object.keys(node.attributes)) {
            allAttributeKeys.add(key)
          }
        }
        headers.push(...Array.from(allAttributeKeys))
      } else {
        headers.push('attributes')
      }
    }

    rows.push(headers.join(','))

    // Collect all attribute keys once for column format
    const allAttributeKeys = new Set<string>()
    if (options.includeAttributes && options.attributeFormat === 'columns') {
      for (const node of data) {
        for (const key of Object.keys(node.attributes)) {
          allAttributeKeys.add(key)
        }
      }
    }
    const attributeKeyArray = Array.from(allAttributeKeys)

    // Add data rows
    for (const node of data) {
      const row: string[] = []

      // Basic fields
      row.push(this.escapeCsvValue(node.id))
      row.push(this.escapeCsvValue(node.title || ''))
      row.push(this.escapeCsvValue(node.content))
      row.push(this.escapeCsvValue(node.description || ''))

      // Metadata
      if (options.includeMetadata && node.metadata) {
        row.push(this.escapeCsvValue(node.metadata.createdAt))
        row.push(this.escapeCsvValue(node.metadata.updatedAt))
        row.push(this.escapeCsvValue(node.metadata.tableId))
      }

      // Attributes
      if (options.includeAttributes) {
        if (options.attributeFormat === 'columns') {
          for (const key of attributeKeyArray) {
            row.push(this.escapeCsvValue(String(node.attributes[key] ?? '')))
          }
        } else {
          row.push(this.escapeCsvValue(JSON.stringify(node.attributes)))
        }
      }

      rows.push(row.join(','))
    }

    // Add UTF-8 BOM for proper encoding
    const csvContent = rows.join('\n')
    return `\uFEFF${csvContent}`
  }

  private exportToJSON(data: ExportedNodeData[], options: TableNodesExportOptions): string {
    // attributeFormat에 따라 속성 처리 방식 결정
    const transformedNodes = data.map((node) => {
      if (options.attributeFormat === 'columns') {
        // columns 형태: 속성을 개별 필드로 펼쳐서 출력
        const { attributes, ...nodeWithoutAttributes } = node
        return {
          ...nodeWithoutAttributes,
          ...attributes, // 속성들을 개별 필드로 펼침
        }
      } else {
        // nested 형태: 속성을 key-value 배열로 변환
        return {
          ...node,
          attributes: Object.entries(node.attributes).map(([key, value]) => ({
            key,
            value,
          })),
        }
      }
    })

    const exportObject = {
      nodes: transformedNodes,
      metadata: {
        exportedAt: new Date().toISOString(),
        totalNodes: data.length,
        format: 'json',
        options,
      },
    }

    return options.prettyPrint ? JSON.stringify(exportObject, null, 2) : JSON.stringify(exportObject)
  }

  private async exportToExcel(data: ExportedNodeData[], options: TableNodesExportOptions): Promise<Buffer> {
    // This would require a library like 'xlsx' or 'exceljs'
    // For now, return JSON as buffer
    const jsonData = this.exportToJSON(data, options)
    return Buffer.from(jsonData, 'utf8')
  }

  private exportToXML(data: ExportedNodeData[], options: TableNodesExportOptions): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<export>\n'
    xml += `  <metadata>\n`
    xml += `    <exportedAt>${new Date().toISOString()}</exportedAt>\n`
    xml += `    <totalNodes>${data.length}</totalNodes>\n`
    xml += `    <format>xml</format>\n`
    xml += `  </metadata>\n`
    xml += '  <nodes>\n'

    data.forEach((node) => {
      xml += '    <node>\n'
      xml += `      <id>${this.escapeXml(node.id)}</id>\n`
      xml += `      <title>${this.escapeXml(node.title || '')}</title>\n`
      xml += `      <content>${this.escapeXml(node.content)}</content>\n`
      xml += `      <description>${this.escapeXml(node.description || '')}</description>\n`

      if (options.includeAttributes && Object.keys(node.attributes).length > 0) {
        xml += '      <attributes>\n'
        Object.entries(node.attributes).forEach(([key, value]) => {
          xml += `        <${key}>${this.escapeXml(String(value))}</${key}>\n`
        })
        xml += '      </attributes>\n'
      }

      if (options.includeMetadata && node.metadata) {
        xml += '      <metadata>\n'
        xml += `        <createdAt>${node.metadata.createdAt}</createdAt>\n`
        xml += `        <updatedAt>${node.metadata.updatedAt}</updatedAt>\n`
        xml += `        <tableId>${node.metadata.tableId}</tableId>\n`
        xml += '      </metadata>\n'
      }

      xml += '    </node>\n'
    })

    xml += '  </nodes>\n'
    xml += '</export>'

    return xml
  }

  private exportToYAML(data: ExportedNodeData[], options: TableNodesExportOptions): string {
    // This would require a library like 'js-yaml'
    // For now, create a simple YAML-like format
    let yaml = 'export:\n'
    yaml += '  metadata:\n'
    yaml += `    exportedAt: "${new Date().toISOString()}"\n`
    yaml += `    totalNodes: ${data.length}\n`
    yaml += `    format: "yaml"\n`
    yaml += '  nodes:\n'

    data.forEach((node) => {
      yaml += `    - id: "${node.id}"\n`
      yaml += `      title: "${node.title || ''}"\n`
      yaml += `      content: "${node.content.replace(/"/g, '\\"')}"\n`
      yaml += `      description: "${node.description || ''}"\n`

      if (options.includeAttributes && Object.keys(node.attributes).length > 0) {
        yaml += '      attributes:\n'
        Object.entries(node.attributes).forEach(([key, value]) => {
          yaml += `        ${key}: "${String(value).replace(/"/g, '\\"')}"\n`
        })
      }

      if (options.includeMetadata && node.metadata) {
        yaml += '      metadata:\n'
        yaml += `        createdAt: "${node.metadata.createdAt}"\n`
        yaml += `        updatedAt: "${node.metadata.updatedAt}"\n`
        yaml += `        tableId: "${node.metadata.tableId}"\n`
      }
    })

    return yaml
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private calculateFileSize(data: string | Buffer): string {
    const sizeInBytes =
      typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength

    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`
    } else {
      return `${(sizeInBytes / 1024 / 1024).toFixed(1)} MB`
    }
  }

  private calculateChecksum(data: string | Buffer): string {
    const content = typeof data === 'string' ? data : data.toString()

    // Simple hash function for checksum
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16)
  }

  private async saveToFile(
    data: string | Buffer,
    options: TableNodesExportOptions,
    tableIdentifier: string,
  ): Promise<string> {
    const fs = await import('node:fs')
    const path = await import('node:path')
    // Create output directory if it doesn't exist
    const outputDir = options.outputDirectory || './exports'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = options.filename || `${tableIdentifier}_export_${timestamp}.${options.format}`
    const fullPath = path.join(outputDir, filename)

    // Write file based on data type
    if (data instanceof Uint8Array) {
      fs.writeFileSync(fullPath, data)
    } else {
      fs.writeFileSync(fullPath, data, 'utf8')
    }

    return path.resolve(fullPath)
  }
}
