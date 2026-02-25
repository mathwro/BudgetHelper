/**
 * Google Identity Services token flow.
 * Client ID is read from VITE_GOOGLE_CLIENT_ID env var.
 * Token is cached in memory for ~1 hour.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
].join(' ')

let _cache = null  // { token, expiresAt }
let _tokenClient = null

function isTokenValid() {
  return _cache !== null && Date.now() < _cache.expiresAt
}

function requestNewToken() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in .env'))
      return
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script not loaded'))
      return
    }
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        // Verify granted scope matches what was requested
        if (response.scope) {
          const granted = new Set(response.scope.split(' '))
          const requested = SCOPES.split(' ')
          const missing = requested.filter(s => !granted.has(s))
          if (missing.length > 0) {
            reject(new Error(`Missing required scopes: ${missing.join(', ')}`))
            return
          }
        }
        const expiresIn = response.expires_in ?? 3600
        _cache = {
          token: response.access_token,
          expiresAt: Date.now() + (expiresIn - 60) * 1000,
        }
        resolve(_cache.token)
      },
    })
    _tokenClient.requestAccessToken({ prompt: '' })
  })
}

export async function getAccessToken() {
  if (isTokenValid()) return _cache.token
  return requestNewToken()
}

export function clearTokenCache() {
  if (_cache?.token) {
    try {
      window.google?.accounts?.oauth2?.revoke(_cache.token, () => {})
    } catch {}
  }
  _cache = null
}
