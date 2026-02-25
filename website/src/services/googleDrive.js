/**
 * Thin wrapper over Google Drive REST API v3.
 * Only lists/creates files the app itself created (drive.file scope).
 */

import { apiFetch } from './apiFetch'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files'

/**
 * List spreadsheets tagged appProperties.budgethelper='1', newest first.
 * @returns {Promise<Array<{id, name, modifiedTime}>>}
 */
export async function listBudgetSheets(accessToken) {
  const q = encodeURIComponent(
    `appProperties has { key='budgethelper' and value='1' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )
  const fields = encodeURIComponent('files(id,name,modifiedTime)')
  const data = await apiFetch(
    `${DRIVE_BASE}?q=${q}&fields=${fields}&orderBy=modifiedTime+desc`,
    { method: 'GET' },
    accessToken
  )
  return data.files ?? []
}

/**
 * Create a new spreadsheet tagged as a BudgetHelper sheet.
 * @returns {Promise<{id, name}>}
 */
export async function createBudgetSheet(title, accessToken, folderId = null) {
  const body = {
    name: title,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    appProperties: { budgethelper: '1' },
  }
  if (folderId) body.parents = [folderId]
  return apiFetch(DRIVE_BASE, { method: 'POST', body: JSON.stringify(body) }, accessToken)
}

/**
 * Move a file to trash.
 */
export async function trashSheet(fileId, accessToken) {
  return apiFetch(
    `${DRIVE_BASE}/${fileId}`,
    { method: 'PATCH', body: JSON.stringify({ trashed: true }) },
    accessToken
  )
}

/**
 * List Drive folders (requires drive.metadata.readonly scope).
 * @returns {Promise<Array<{id, name}>>}
 */
export async function listFolders(accessToken, search = '') {
  let q = `mimeType='application/vnd.google-apps.folder' and trashed=false`
  if (search) q += ` and name contains '${search.replace(/'/g, "\\'")}'`
  const data = await apiFetch(
    `${DRIVE_BASE}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name)')}&orderBy=name&pageSize=30`,
    { method: 'GET' },
    accessToken
  )
  return data.files ?? []
}
