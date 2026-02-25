/**
 * Thin wrapper over Google Sheets REST API v4.
 */

import { apiFetch } from './apiFetch'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

/**
 * Clear a range in the spreadsheet.
 */
export async function clearRange(spreadsheetId, range, accessToken) {
  return apiFetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: 'POST' },
    accessToken
  )
}

/**
 * Write values/formulas (pass 1).
 * valueInputOption: "USER_ENTERED" so formulas are interpreted.
 */
export async function batchUpdateValues(spreadsheetId, valueRanges, accessToken) {
  return apiFetch(
    `${BASE}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges,
      }),
    },
    accessToken
  )
}

/**
 * Apply formatting (pass 2).
 */
export async function batchUpdateFormatting(spreadsheetId, requests, accessToken) {
  return apiFetch(
    `${BASE}/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    },
    accessToken
  )
}

/**
 * Get spreadsheet metadata (to verify it exists and get sheet names).
 */
export async function getSpreadsheetInfo(spreadsheetId, accessToken) {
  return apiFetch(
    `${BASE}/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`,
    { method: 'GET' },
    accessToken
  )
}

/**
 * Read all values from a range.
 * Returns a 2D array of cell values (rows × cols).
 * Empty trailing rows/cols may be omitted by the API.
 */
export async function getValues(spreadsheetId, range, accessToken) {
  const data = await apiFetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
    { method: 'GET' },
    accessToken
  )
  return data.values || []
}
