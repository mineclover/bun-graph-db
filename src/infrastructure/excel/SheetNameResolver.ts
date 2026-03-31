const INVALID_SHEET_NAME_PATTERN = /[\\/?*:[\]]/g
const MAX_SHEET_NAME_LENGTH = 100

export interface ResolveSheetNameInput {
  tableIdentifier: string
  explicitSheetName?: string
  sheetNameTemplate?: string
}

export class SheetNameResolver {
  resolve(input: ResolveSheetNameInput): string {
    const rawName =
      input.explicitSheetName ||
      this.applyTemplate(input.sheetNameTemplate, input.tableIdentifier) ||
      input.tableIdentifier

    return this.sanitize(rawName)
  }

  sanitize(name: string): string {
    const normalized = name.trim().replace(INVALID_SHEET_NAME_PATTERN, '-')
    const collapsedWhitespace = normalized.replace(/\s+/g, ' ')
    const truncated = collapsedWhitespace.slice(0, MAX_SHEET_NAME_LENGTH)
    return truncated || 'sheet'
  }

  private applyTemplate(
    template: string | undefined,
    tableIdentifier: string,
  ): string | null {
    if (!template) {
      return null
    }

    return template.replaceAll('{table}', tableIdentifier)
  }
}
