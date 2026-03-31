export function resolveGoogleSpreadsheetId(input: {
  spreadsheetId?: string
  spreadsheetUrl?: string
}): string | null {
  if (input.spreadsheetId) {
    return input.spreadsheetId
  }

  if (!input.spreadsheetUrl) {
    return null
  }

  const match = input.spreadsheetUrl.match(
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  )

  return match?.[1] || null
}
