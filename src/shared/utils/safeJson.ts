export type SafeJsonValue =
  | string
  | number
  | boolean
  | null
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue }

const UNSAFE_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function containsUnsafeJsonKeys(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafeJsonKeys(item))
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_JSON_KEYS.has(key) || containsUnsafeJsonKeys(nestedValue)) {
        return true
      }
    }
  }

  return false
}

export function sanitizeJsonValue(value: unknown): SafeJsonValue {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item))
  }

  if (typeof value === 'object') {
    const sanitized = Object.create(null) as Record<string, SafeJsonValue>

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_JSON_KEYS.has(key)) {
        continue
      }

      sanitized[key] = sanitizeJsonValue(nestedValue)
    }

    return sanitized
  }

  throw new Error('Value must be valid JSON data')
}

export function stringifySafeJson(value: unknown): string | null {
  if (value === undefined) {
    return null
  }

  return JSON.stringify(sanitizeJsonValue(value))
}

export function parseSafeJson(value: string | null | undefined): SafeJsonValue | null {
  if (!value) {
    return null
  }

  return sanitizeJsonValue(JSON.parse(value))
}
