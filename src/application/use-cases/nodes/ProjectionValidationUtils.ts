import type {
  ProjectionValidationError,
  TableSchemaProjection,
} from '@/core/schema/TableSchemaProjection.js'
import { containsUnsafeJsonKeys } from '@/shared/utils/safeJson.js'

export function projectionDiagnosticErrors(
  projection: TableSchemaProjection,
): ProjectionValidationError[] {
  return projection.diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => ({
      path: '#/projection/diagnostics',
      code: diagnostic.code,
      message: diagnostic.message,
      source: diagnostic.source,
    }))
}

export function unsafeProjectedAttributeValueErrors(
  attributes: Record<string, unknown>,
): ProjectionValidationError[] {
  return Object.entries(attributes)
    .filter(([, value]) => containsUnsafeJsonKeys(value))
    .map(([identifier]) => ({
      path: `#/attributes/${escapePointer(identifier)}`,
      code: 'unsafe-json-key',
      message: `Attribute '${identifier}' contains unsafe JSON object keys`,
    }))
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}
