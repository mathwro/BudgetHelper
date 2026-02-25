/**
 * Shared fetch wrapper for Google API calls.
 * Adds Authorization header and handles error responses.
 */
export async function apiFetch(url, options, accessToken) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      message = body?.error?.message || message
    } catch {}
    throw new Error(message)
  }

  return response.json()
}
