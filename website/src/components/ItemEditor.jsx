import React, { useState } from 'react'
import { findSavingsLinkedItem } from '../utils/budgetCalculator.js'

const PRESET_COLORS = [
  null,       // inherit from section
  '#2d8050',  // green
  '#b37520',  // amber
  '#b03020',  // red
  '#2560a0',  // blue
  '#6030a0',  // purple
  '#1a8090',  // teal
  '#b05520',  // orange
  '#a01858',  // rose
  '#5a8018',  // olive
  '#1a7095',  // sky blue
]

function parseVal(str) {
  const cleaned = String(str).replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function fmt(n) {
  if (n === 0) return '0'
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export default function ItemEditor({ sectionId, item, dispatch, onClose, onCancel, section, sections }) {
  const [name, setName] = useState(item.name)
  const [color, setColor] = useState(item.color)
  const [note, setNote] = useState(item.note || '')
  const [excluded, setExcluded] = useState(item.excluded || false)
  const [negative, setNegative] = useState(item.negative || false)
  const [bulkValue, setBulkValue] = useState('')
  // Expense items: which savings section this item feeds
  const [savingsLink, setSavingsLink] = useState(item.savingsLink || null)
  // Savings items: percentage mode
  const [percentageMode, setPercentageMode] = useState(item.savingsPercentage != null)
  const [savingsPct, setSavingsPct] = useState(
    item.savingsPercentage != null ? String(item.savingsPercentage).replace('.', ',') : ''
  )
  const [monthDrafts, setMonthDrafts] = useState({})

  const isSavingsSection = section?.type === 'savings'
  const isExpenseSection = section?.type === 'expense' || section?.type === 'income'
  const savingsSections = sections ? sections.filter(s => s.type === 'savings') : []

  // For savings items: find the linked expense item (if any) so we can show percentage preview
  const linkedItemForSavings = isSavingsSection && sections
    ? findSavingsLinkedItem(sections, section.id)
    : null

  function handleSave() {
    const updates = { name: name.trim(), color, note }

    if (isSavingsSection) {
      updates.savingsPercentage = percentageMode && savingsPct !== '' ? parseVal(savingsPct) : null
    } else {
      updates.excluded = excluded
      updates.negative = negative
      if (isExpenseSection) {
        updates.savingsLink = savingsLink || null
      }
    }

    dispatch({
      type: 'UPDATE_ITEM',
      sectionId,
      itemId: item.id,
      updates,
    })
    onClose()
  }

  function handleBulkFill() {
    const value = parseVal(bulkValue)
    dispatch({
      type: 'UPDATE_ITEM',
      sectionId,
      itemId: item.id,
      updates: { monthlyValues: Array(12).fill(value) },
    })
    setBulkValue('')
  }

  function handleMonthChange(index, raw) {
    setMonthDrafts(prev => ({ ...prev, [index]: raw }))
  }

  function commitMonthChange(index, raw) {
    const value = parseVal(raw)
    const newValues = [...item.monthlyValues]
    newValues[index] = value
    dispatch({
      type: 'UPDATE_ITEM',
      sectionId,
      itemId: item.id,
      updates: { monthlyValues: newValues },
    })
    setMonthDrafts(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (onCancel ?? onClose)()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit item</h2>
          <button className="btn-icon" onClick={onCancel ?? onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Note</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note…"
            />
          </div>

          <div className="form-field">
            <label>Color (inherits section color if not set)</label>
            <div className="color-swatches">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={i}
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c || '#1a1b1f', border: c === null ? '2px dashed #444' : undefined }}
                  onClick={() => setColor(c)}
                  title={c === null ? 'Inherit from section' : c}
                />
              ))}
              <input
                type="color"
                value={color || '#111215'}
                onChange={e => setColor(e.target.value)}
                title="Custom color"
              />
            </div>
          </div>

          {/* Behaviour flags — only for non-savings sections */}
          {!isSavingsSection && (
            <div className="form-field">
              <label>Behaviour</label>
              <div className="item-flag-options">
                <button
                  type="button"
                  className={`item-flag-option${excluded ? ' active excluded' : ''}`}
                  onClick={() => setExcluded(v => !v)}
                >
                  <span className="item-flag-option-icon">∅</span>
                  <span className="item-flag-option-text">
                    <strong>Exclude from totals</strong>
                    <span>Row is visible but ignored in all calculations</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`item-flag-option${negative ? ' active negative' : ''}`}
                  onClick={() => setNegative(v => !v)}
                >
                  <span className="item-flag-option-icon">−</span>
                  <span className="item-flag-option-text">
                    <strong>Negative</strong>
                    <span>Subtracted from the section total</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Savings contribution — only for expense/income items */}
          {isExpenseSection && savingsSections.length > 0 && (
            <div className="form-field">
              <label>Savings contribution</label>
              <select
                value={savingsLink || ''}
                onChange={e => setSavingsLink(e.target.value || null)}
              >
                <option value="">None</option>
                {savingsSections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Value mode — only for savings section items */}
          {isSavingsSection && (
            <div className="form-field">
              <label>Value mode</label>
              {linkedItemForSavings ? (
                <div className="item-flag-options">
                  <button
                    type="button"
                    className={`item-flag-option${!percentageMode ? ' active' : ''}`}
                    onClick={() => setPercentageMode(false)}
                  >
                    <span className="item-flag-option-icon">123</span>
                    <span className="item-flag-option-text">
                      <strong>Static amount</strong>
                      <span>Enter a fixed amount for each month</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`item-flag-option${percentageMode ? ' active' : ''}`}
                    onClick={() => setPercentageMode(true)}
                  >
                    <span className="item-flag-option-icon">%</span>
                    <span className="item-flag-option-text">
                      <strong>% of {linkedItemForSavings.name}</strong>
                      <span>Computed from the linked expense row</span>
                    </span>
                  </button>
                </div>
              ) : (
                <p className="form-hint">Connect an expense row to this savings section to enable percentage mode.</p>
              )}
            </div>
          )}

          {/* Percentage input + preview — savings items in percentage mode */}
          {isSavingsSection && percentageMode && linkedItemForSavings && (
            <>
              <div className="form-field">
                <label>Percentage of {linkedItemForSavings.name}</label>
                <div className="bulk-fill-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={savingsPct}
                    onChange={e => setSavingsPct(e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <span className="savings-rate-pct-sign">%</span>
                </div>
              </div>
              <div className="form-field">
                <label>Preview (computed monthly values)</label>
                <div className="monthly-grid">
                  {months.map((m, i) => {
                    const base = Number(linkedItemForSavings.monthlyValues[i]) || 0
                    const computed = base * parseVal(savingsPct) / 100
                    return (
                      <div key={i} className="month-input-cell">
                        <span className="month-label">{m}</span>
                        <span className="savings-pct-preview">{fmt(computed)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Static monthly inputs — hidden when in percentage mode */}
          {!percentageMode && (
            <>
              <div className="form-field">
                <label>Fill all months with the same value</label>
                <div className="bulk-fill-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkValue}
                    onChange={e => setBulkValue(e.target.value)}
                    placeholder="Amount…"
                    onKeyDown={e => e.key === 'Enter' && handleBulkFill()}
                  />
                  <button className="btn btn-outline" onClick={handleBulkFill}>
                    Fill all
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Monthly values</label>
                <div className="monthly-grid">
                  {months.map((m, i) => (
                    <div key={i} className="month-input-cell">
                      <span className="month-label">{m}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={monthDrafts[i] ?? (item.monthlyValues[i] === 0 ? '' : String(item.monthlyValues[i]).replace('.', ','))}
                        onChange={e => handleMonthChange(i, e.target.value)}
                        onBlur={e => commitMonthChange(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitMonthChange(i, e.currentTarget.value)
                            e.currentTarget.blur()
                          }
                        }}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel ?? onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
