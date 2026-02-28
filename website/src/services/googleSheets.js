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

/**
 * Read effective background colors for rows in the first sheet.
 * Returns a map: { [rowIndex1Based]: '#rrggbb' }.
 */
export async function getRowBackgroundColors(spreadsheetId, accessToken) {
  const data = await apiFetch(
    `${BASE}/${spreadsheetId}?ranges=A:P&includeGridData=true&fields=sheets(data.rowData.values.effectiveFormat.backgroundColor)`,
    { method: 'GET' },
    accessToken
  )

  const rowData = data?.sheets?.[0]?.data?.[0]?.rowData || []
  const colors = {}

  function toHex(v) {
    const n = Math.max(0, Math.min(255, Math.round((v ?? 1) * 255)))
    return n.toString(16).padStart(2, '0')
  }

  for (let i = 0; i < rowData.length; i++) {
    const bg = rowData[i]?.values?.[0]?.effectiveFormat?.backgroundColor
    if (!bg) continue
    const hex = `#${toHex(bg.red)}${toHex(bg.green)}${toHex(bg.blue)}`
    colors[i + 1] = hex
  }

  return colors
}
