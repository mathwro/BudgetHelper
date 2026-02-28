import React, { useState, useEffect, useRef } from 'react'
import { getAccessToken, clearTokenCache } from '../services/googleAuth.js'
import { listBudgetSheets, createBudgetSheet, trashSheet, listFolders } from '../services/googleDrive.js'
import { clearRange, batchUpdateValues, batchUpdateFormatting, getSpreadsheetInfo, getValues, getRowBackgroundColors } from '../services/googleSheets.js'
import { generateSheetsPayload } from '../utils/formulaGenerator.js'
import { parseSheetData, summarizeChanges } from '../utils/sheetParser.js'

const PUSH_STEPS = [
  'Fetching spreadsheet info…',
  'Clearing existing data…',
  'Writing values and formulas…',
  'Applying formatting…',
  'Done!',
]

const PULL_STEPS = [
  'Fetching spreadsheet info…',
  'Reading sheet data…',
  'Comparing with local budget…',
  'Done!',
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getOtherBudgetLinkedSheets() {
  // Returns a map of sheetId → budget title for budgets OTHER than the active one
  try {
    const raw = localStorage.getItem('budgetStore')
    if (!raw) return {}
    const store = JSON.parse(raw)
    const result = {}
    for (const b of Object.values(store.budgets)) {
      if (b.linkedSheetId && b.id !== store.activeId) {
        result[b.linkedSheetId] = b.title
      }
    }
    return result
  } catch {
    return {}
  }
}

function formatValue(val) {
  return (Number(val) || 0).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function GoogleSyncModal({ budget, dispatch, onClose }) {
  const [phase, setPhase] = useState('selection')
  const [syncDirection, setSyncDirection] = useState('push') // 'push' or 'pull'
  const [otherLinkedSheets] = useState(() => getOtherBudgetLinkedSheets())

  // Phase 1 — auth + sheet list
  const [authState, setAuthState] = useState('connecting')
  const [authError, setAuthError] = useState(null)
  const [token, setToken] = useState(null)
  const [sheets, setSheets] = useState([])
  const [selectedSheetId, setSelectedSheetId] = useState(budget.linkedSheetId ?? null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Create-sheet form
  const [newSheetName, setNewSheetName] = useState(null)  // null = hidden
  const [creating, setCreating] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState(null)  // { id, name } or null = root
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [folderSearch, setFolderSearch] = useState('')
  const [folders, setFolders] = useState([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const folderSearchTimer = useRef(null)

  // Phase 2 — sync progress
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [done, setDone] = useState(false)
  const [sheetUrl, setSheetUrl] = useState(null)

  // Pull-specific state
  const [pullChanges, setPullChanges] = useState(null)        // { changes, updatedBudget, summary }
  const [pullApplied, setPullApplied] = useState(false)

  useEffect(() => { loadSheets() }, [])

  async function loadSheets() {
    setAuthState('connecting')
    setAuthError(null)
    try {
      const t = await getAccessToken()
      setToken(t)
      const list = await listBudgetSheets(t)
      setSheets(list)
      if (budget.linkedSheetId && !list.find(s => s.id === budget.linkedSheetId)) {
        setSelectedSheetId(null)
      }
      setAuthState('ready')
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
      setAuthState('error')
    }
  }

  async function handleRetry() {
    clearTokenCache()
    await loadSheets()
  }

  async function handleTrashSheet(sheetId) {
    try {
      const t = token ?? await getAccessToken()
      await trashSheet(sheetId, t)
      setSheets(prev => prev.filter(s => s.id !== sheetId))
      if (selectedSheetId === sheetId) setSelectedSheetId(null)
      setConfirmDeleteId(null)
    } catch (err) {
      setAuthError(err.message || 'Failed to delete sheet')
      setConfirmDeleteId(null)
    }
  }

  async function loadFolders(search) {
    setLoadingFolders(true)
    try {
      const t = token ?? await getAccessToken()
      setFolders(await listFolders(t, search))
    } catch {
      setFolders([])
    } finally {
      setLoadingFolders(false)
    }
  }

  function handleFolderSearch(value) {
    setFolderSearch(value)
    clearTimeout(folderSearchTimer.current)
    folderSearchTimer.current = setTimeout(() => loadFolders(value), 300)
  }

  function openFolderPicker() {
    setShowFolderPicker(true)
    loadFolders('')
  }

  function cancelCreateForm() {
    setNewSheetName(null)
    setSelectedFolder(null)
    setShowFolderPicker(false)
    setFolderSearch('')
  }

  async function handleCreateSheet() {
    const name = (newSheetName ?? '').trim() || budget.title
    setCreating(true)
    try {
      const t = token ?? await getAccessToken()
      const newSheet = await createBudgetSheet(name, t, selectedFolder?.id ?? null)
      setSheets(prev => [newSheet, ...prev])
      setSelectedSheetId(newSheet.id)
      cancelCreateForm()
    } catch (err) {
      setAuthError(err.message || 'Failed to create sheet')
    } finally {
      setCreating(false)
    }
  }

  function handleRequestSync() {
    setPhase('confirm')
  }

  // ── Push (app → Sheets) ──────────────────────────────────────────────────

  async function handleStartPush() {
    setPhase('sync')
    setRunning(true)
    setSyncError(null)
    setStep(0)
    try {
      const t = token ?? await getAccessToken()

      setStep(0)
      const info = await getSpreadsheetInfo(selectedSheetId, t)
      const firstSheetId = info.sheets?.[0]?.properties?.sheetId ?? 0

      setStep(1)
      await clearRange(selectedSheetId, 'A:Q', t)

      const { valueRanges, formatRequests } = generateSheetsPayload(budget, firstSheetId)

      setStep(2)
      await batchUpdateValues(selectedSheetId, valueRanges, t)

      setStep(3)
      await batchUpdateFormatting(selectedSheetId, formatRequests, t)

      setStep(4)
      setDone(true)
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${selectedSheetId}/edit`)
      dispatch({ type: 'SET_LINKED_SHEET', sheetId: selectedSheetId })
    } catch (err) {
      setSyncError(err.message || 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  // ── Pull (Sheets → app) ──────────────────────────────────────────────────

  async function handleStartPull() {
    setPhase('sync')
    setRunning(true)
    setSyncError(null)
    setStep(0)
    setPullChanges(null)
    setPullApplied(false)
    try {
      const t = token ?? await getAccessToken()

      setStep(0)
      await getSpreadsheetInfo(selectedSheetId, t)

      setStep(1)
      const sheetRows = await getValues(selectedSheetId, 'A:Q', t)
      const rowColors = await getRowBackgroundColors(selectedSheetId, t)

      setStep(2)
      const { updatedBudget, changes } = parseSheetData(budget, sheetRows, rowColors)
      const summary = summarizeChanges(changes)

      setPullChanges({ changes, updatedBudget, summary })

      setStep(3)
      setDone(true)
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${selectedSheetId}/edit`)
    } catch (err) {
      setSyncError(err.message || 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  function handleApplyPull() {
    if (!pullChanges) return
    dispatch({ type: 'SET_BUDGET', budget: pullChanges.updatedBudget })
    dispatch({ type: 'SET_LINKED_SHEET', sheetId: selectedSheetId })
    setPullApplied(true)
  }

  function handleStartSync() {
    if (syncDirection === 'pull') {
      handleStartPull()
    } else {
      handleStartPush()
    }
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const canSync = authState === 'ready' && selectedSheetId !== null
  const syncSteps = syncDirection === 'pull' ? PULL_STEPS : PUSH_STEPS

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !running && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Google Sheets Sync</h2>
            <p className="sync-budget-name">{budget.title}</p>
          </div>
          {!running && <button className="btn-icon" onClick={onClose}>✕</button>}
        </div>

        <div className="modal-body">
          {phase === 'selection' && (
            <>
              {authState === 'connecting' && (
                <div className="sync-connecting">
                  <span className="step-icon" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  <span>Connecting to Google…</span>
                </div>
              )}

              {authState === 'error' && (
                <div className="sync-error">
                  <strong>Error:</strong> {authError}
                  <br />
                  <button className="btn btn-outline" style={{ marginTop: '0.75rem' }} onClick={handleRetry}>
                    Retry
                  </button>
                </div>
              )}

              {authState === 'ready' && (
                <>
                  {/* Direction toggle */}
                  <div className="sync-direction-toggle">
                    <button
                      className={`sync-direction-btn${syncDirection === 'push' ? ' active' : ''}`}
                      onClick={() => setSyncDirection('push')}
                    >
                      <span className="sync-direction-icon">↑</span>
                      <span className="sync-direction-label">Push to Sheets</span>
                      <span className="sync-direction-hint">App → Google Sheets</span>
                    </button>
                    <button
                      className={`sync-direction-btn${syncDirection === 'pull' ? ' active' : ''}`}
                      onClick={() => setSyncDirection('pull')}
                    >
                      <span className="sync-direction-icon">↓</span>
                      <span className="sync-direction-label">Pull from Sheets</span>
                      <span className="sync-direction-hint">Google Sheets → App</span>
                    </button>
                  </div>

                  {sheets.length === 0 ? (
                    <div className="sync-no-sheets">
                      <p>No BudgetHelper sheets found.</p>
                      <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        Create a new sheet below to get started.
                      </p>
                    </div>
                  ) : (
                    <ul className="sheet-list">
                      {sheets.map(sheet => (
                        <li
                          key={sheet.id}
                          className={`sheet-list-item${selectedSheetId === sheet.id ? ' selected' : ''}${confirmDeleteId === sheet.id ? ' confirming-delete' : ''}`}
                          onClick={() => confirmDeleteId !== sheet.id && setSelectedSheetId(sheet.id)}
                        >
                          {confirmDeleteId === sheet.id ? (
                            <div className="sheet-confirm-delete">
                              <span className="sheet-confirm-text">Move &quot;{sheet.name}&quot; to trash?</span>
                              <button
                                className="btn btn-outline btn-danger-outline"
                                onClick={e => { e.stopPropagation(); handleTrashSheet(sheet.id) }}
                              >
                                Delete
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="sheet-name">{sheet.name}</span>
                              <span className="sheet-modified">{formatDate(sheet.modifiedTime)}</span>
                              {sheet.id === budget.linkedSheetId && (
                                <span className="sheet-badge">last synced</span>
                              )}
                              {otherLinkedSheets[sheet.id] && (
                                <span className="sheet-badge sheet-badge-warning" title={`This sheet is linked to "${otherLinkedSheets[sheet.id]}"`}>
                                  {otherLinkedSheets[sheet.id]}
                                </span>
                              )}
                              <button
                                className="btn-icon btn-delete sheet-delete-btn"
                                onClick={e => { e.stopPropagation(); setConfirmDeleteId(sheet.id) }}
                                title="Move to trash"
                              >
                                🗑
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="field-hint" style={{ marginTop: '0.6rem' }}>
                    Only sheets created by BudgetHelper are shown.
                  </p>

                  {syncDirection === 'push' && (
                    <>
                      {newSheetName === null ? (
                        <button
                          className="btn btn-outline"
                          style={{ marginTop: '0.75rem' }}
                          onClick={() => setNewSheetName(budget.title)}
                        >
                          + Create new sheet
                        </button>
                      ) : (
                        <div className="create-sheet-form">
                          <input
                            type="text"
                            className="create-sheet-input"
                            value={newSheetName}
                            onChange={e => setNewSheetName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !showFolderPicker) handleCreateSheet()
                              if (e.key === 'Escape') cancelCreateForm()
                            }}
                            autoFocus
                            placeholder="Sheet name"
                            disabled={creating}
                          />

                          <button
                            type="button"
                            className="folder-picker-toggle"
                            onClick={() => showFolderPicker ? setShowFolderPicker(false) : openFolderPicker()}
                            disabled={creating}
                          >
                            <span>📁</span>
                            <span>{selectedFolder ? selectedFolder.name : 'My Drive'}</span>
                            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: '0.7rem' }}>▾</span>
                          </button>

                          {showFolderPicker && (
                            <div className="folder-dropdown">
                              <input
                                type="text"
                                className="folder-search-input"
                                placeholder="Search folders…"
                                value={folderSearch}
                                onChange={e => handleFolderSearch(e.target.value)}
                                autoFocus
                              />
                              <ul className="folder-list">
                                <li
                                  className={`folder-item${selectedFolder === null ? ' active' : ''}`}
                                  onClick={() => { setSelectedFolder(null); setShowFolderPicker(false) }}
                                >
                                  <span>🏠</span> My Drive (root)
                                </li>
                                {loadingFolders && (
                                  <li className="folder-item" style={{ color: 'var(--text-dim)' }}>Loading…</li>
                                )}
                                {!loadingFolders && folders.map(f => (
                                  <li
                                    key={f.id}
                                    className={`folder-item${selectedFolder?.id === f.id ? ' active' : ''}`}
                                    onClick={() => { setSelectedFolder(f); setShowFolderPicker(false) }}
                                  >
                                    <span>📁</span> {f.name}
                                  </li>
                                ))}
                                {!loadingFolders && folders.length === 0 && folderSearch && (
                                  <li className="folder-item" style={{ color: 'var(--text-dim)' }}>No folders found</li>
                                )}
                              </ul>
                            </div>
                          )}

                          <div className="create-sheet-actions">
                            <button
                              className="btn btn-primary"
                              onClick={handleCreateSheet}
                              disabled={creating || !newSheetName.trim()}
                            >
                              {creating ? 'Creating…' : 'Create'}
                            </button>
                            <button className="btn btn-outline" onClick={cancelCreateForm} disabled={creating}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {phase === 'confirm' && syncDirection === 'push' && (() => {
            const sheet = sheets.find(s => s.id === selectedSheetId)
            const isOtherBudgetSheet = !!otherLinkedSheets[selectedSheetId]
            return (
              <div className="sync-confirm">
                <p className="sync-confirm-text">
                  This will <strong>overwrite all data</strong> in:
                </p>
                <div className="sync-confirm-sheet">
                  <span className="sync-confirm-sheet-name">{sheet?.name ?? selectedSheetId}</span>
                </div>
                <p className="sync-confirm-text">with the contents of <strong>{budget.title}</strong>.</p>
                {isOtherBudgetSheet && (
                  <div className="sync-confirm-warning">
                    <strong>Warning:</strong> this sheet is already linked to &quot;{otherLinkedSheets[selectedSheetId]}&quot;.
                    Syncing will overwrite that budget&apos;s data.
                  </div>
                )}
              </div>
            )
          })()}

          {phase === 'confirm' && syncDirection === 'pull' && (() => {
            const sheet = sheets.find(s => s.id === selectedSheetId)
            return (
              <div className="sync-confirm">
                <p className="sync-confirm-text">
                  This will <strong>read data</strong> from:
                </p>
                <div className="sync-confirm-sheet">
                  <span className="sync-confirm-sheet-name">{sheet?.name ?? selectedSheetId}</span>
                </div>
                <p className="sync-confirm-text">
                  and update <strong>{budget.title}</strong> with any changes found in the sheet.
                </p>
                <p className="sync-confirm-text" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                  You&apos;ll be able to review changes before applying them.
                </p>
              </div>
            )
          })()}

          {phase === 'sync' && (
            <>
              <div className="sync-progress">
                {syncSteps.map((label, i) => (
                  <div
                    key={i}
                    className={`progress-step ${
                      i < step || (i === step && done) ? 'done' : i === step ? 'active' : 'pending'
                    }`}
                  >
                    <span className="step-icon">
                      {i < step || (i === step && done) ? '✓' : i === step ? '⟳' : '○'}
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Push complete */}
              {done && syncDirection === 'push' && (
                <div className="sync-success">
                  <p>Sync complete!</p>
                  {sheetUrl && (
                    <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                      Open spreadsheet
                    </a>
                  )}
                </div>
              )}

              {/* Pull complete — show changes */}
              {done && syncDirection === 'pull' && pullChanges && !pullApplied && (
                <div className="pull-results">
                  {pullChanges.summary.totalChanges === 0 ? (
                    <div className="sync-success">
                      <p>No changes found</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        The sheet data matches your local budget.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="pull-summary">
                        <p className="pull-summary-text">
                          Found <strong>{pullChanges.summary.summary}</strong>
                        </p>
                      </div>
                      <div className="pull-changes-list">
                        {Object.entries(pullChanges.summary.bySection).map(([sectionName, sectionChanges]) => (
                          <div key={sectionName} className="pull-section-group">
                            <h4 className="pull-section-name">{sectionName}</h4>
                            <ul className="pull-change-items">
                              {sectionChanges.map((change, i) => (
                                <li key={i} className="pull-change-item">
                                  {change.type === 'value' && (
                                    <span>
                                      <span className="pull-change-label">{change.itemName}</span>
                                      <span className="pull-change-detail">
                                        {MONTH_NAMES[change.monthIndex]}: {formatValue(change.oldValue)} → {formatValue(change.newValue)}
                                      </span>
                                    </span>
                                  )}
                                  {change.type === 'name' && (
                                    <span>
                                      <span className="pull-change-label">Name changed</span>
                                      <span className="pull-change-detail">
                                        &quot;{change.oldValue}&quot; → &quot;{change.newValue}&quot;
                                      </span>
                                    </span>
                                  )}
                                  {change.type === 'note' && (
                                    <span>
                                      <span className="pull-change-label">{change.itemName}</span>
                                      <span className="pull-change-detail">
                                        Note: &quot;{change.oldValue || '(empty)'}&quot; → &quot;{change.newValue || '(empty)'}&quot;
                                      </span>
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Pull applied */}
              {done && syncDirection === 'pull' && pullApplied && (
                <div className="sync-success">
                  <p>Changes applied!</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Your budget has been updated with data from the sheet.
                  </p>
                </div>
              )}

              {syncError && (
                <div className="sync-error">
                  <strong>Error:</strong> {syncError}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {phase === 'selection' && (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRequestSync} disabled={!canSync}>
                {syncDirection === 'push' ? 'Push to selected sheet' : 'Pull from selected sheet'}
              </button>
            </>
          )}
          {phase === 'confirm' && (
            <>
              <button className="btn btn-outline" onClick={() => setPhase('selection')}>← Back</button>
              <button className="btn btn-primary" onClick={handleStartSync}>
                {syncDirection === 'push' ? 'Confirm push' : 'Confirm pull'}
              </button>
            </>
          )}
          {phase === 'sync' && running && (
            <>
              <button className="btn btn-outline" disabled>Cancel</button>
              <button className="btn btn-primary" disabled>
                {syncDirection === 'push' ? 'Pushing…' : 'Pulling…'}
              </button>
            </>
          )}
          {phase === 'sync' && !running && done && syncDirection === 'push' && (
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          )}
          {phase === 'sync' && !running && done && syncDirection === 'pull' && !pullApplied && (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              {pullChanges?.summary.totalChanges > 0 && (
                <button className="btn btn-primary" onClick={handleApplyPull}>
                  Apply {pullChanges.summary.totalChanges} change{pullChanges.summary.totalChanges > 1 ? 's' : ''}
                </button>
              )}
              {pullChanges?.summary.totalChanges === 0 && (
                <button className="btn btn-primary" onClick={onClose}>Close</button>
              )}
            </>
          )}
          {phase === 'sync' && !running && done && syncDirection === 'pull' && pullApplied && (
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          )}
          {phase === 'sync' && !running && !done && (
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
