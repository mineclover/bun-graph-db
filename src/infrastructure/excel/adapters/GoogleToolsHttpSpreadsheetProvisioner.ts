export interface CreateGoogleToolsHttpSpreadsheetInput {
  baseUrl: string
  title: string
}

export interface CreatedGoogleToolsHttpSpreadsheet {
  spreadsheetId: string
  name?: string
  webViewLink?: string
}

export async function createGoogleToolsHttpSpreadsheet(
  input: CreateGoogleToolsHttpSpreadsheetInput,
): Promise<CreatedGoogleToolsHttpSpreadsheet> {
  const url = new URL('/drive/spreadsheets', input.baseUrl)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: input.title,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `google-tools HTTP spreadsheet creation failed with status ${response.status}`,
    )
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string
      name?: string
      webViewLink?: string
    }
  }

  if (!payload.data?.id) {
    throw new Error('google-tools HTTP spreadsheet creation returned no id')
  }

  return {
    spreadsheetId: payload.data.id,
    name: payload.data.name,
    webViewLink: payload.data.webViewLink,
  }
}
