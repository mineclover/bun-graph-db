export function sanitizeTextContent(value: string | null | undefined): string | null | undefined {
  if (value == null) {
    return value
  }

  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
