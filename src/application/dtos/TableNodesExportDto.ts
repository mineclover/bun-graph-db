export interface TableNodesExportInput {
  tableId: string
  format: 'csv' | 'json' | 'excel' | 'xml' | 'yaml'
  includeAttributes?: boolean
  includeMetadata?: boolean
  attributeFormat?: 'columns' | 'nested' | 'keyvalue'
  dateFormat?: 'iso' | 'timestamp' | 'readable'
  limit?: number
  offset?: number
  compression?: boolean
  prettyPrint?: boolean
  saveToFile?: boolean
  outputDirectory?: string
  filename?: string
}

export interface TableNodesExportOutput {
  success: boolean
  format: string
  data?: string
  binaryData?: string // Base64 encoded for binary formats
  filePath?: string
  metadata: {
    exportedAt: string
    tableId: string
    tableIdentifier: string
    totalNodes: number
    exportedNodes: number
    format: string
    checksum?: string
    fileSize?: string
    filePath?: string
  }
  errors?: string[]
}

export function createDefaultExportOptions(format: string): Partial<TableNodesExportInput> {
  const normalizedFormat: TableNodesExportInput['format'] =
    format === 'csv' || format === 'json' || format === 'excel' || format === 'xml' || format === 'yaml'
      ? format
      : 'json'

  return {
    format: normalizedFormat,
    includeAttributes: true,
    includeMetadata: true,
    attributeFormat: 'nested',
    dateFormat: 'iso',
    compression: false,
    prettyPrint: true,
  }
}

export function validateExportInput(input: TableNodesExportInput): string[] {
  const errors: string[] = []

  if (!input.tableId?.trim()) {
    errors.push('Table ID is required')
  }

  if (!input.format) {
    errors.push('Export format is required')
  }

  const validFormats = ['csv', 'json', 'excel', 'xml', 'yaml']
  if (input.format && !validFormats.includes(input.format)) {
    errors.push(`Invalid format. Must be one of: ${validFormats.join(', ')}`)
  }

  const validAttributeFormats = ['columns', 'nested', 'keyvalue']
  if (input.attributeFormat && !validAttributeFormats.includes(input.attributeFormat)) {
    errors.push(`Invalid attribute format. Must be one of: ${validAttributeFormats.join(', ')}`)
  }

  const validDateFormats = ['iso', 'timestamp', 'readable']
  if (input.dateFormat && !validDateFormats.includes(input.dateFormat)) {
    errors.push(`Invalid date format. Must be one of: ${validDateFormats.join(', ')}`)
  }

  if (input.limit !== undefined && (input.limit < 1 || input.limit > 100000)) {
    errors.push('Limit must be between 1 and 100,000')
  }

  if (input.offset !== undefined && input.offset < 0) {
    errors.push('Offset must be non-negative')
  }

  return errors
}
