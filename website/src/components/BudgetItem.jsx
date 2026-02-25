import React, { useState, useRef } from 'react'
import { computeAnnualTotal, computeMonthlyAverage } from '../utils/budgetCalculator.js'

function fmt(n) {
  if (n === 0) return ''
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function parseVal(str) {
  // Accept Danish-formatted numbers: strips dots (thousands separators) then converts comma to decimal point
  // e.g. "1.234,56" → "1234.56". Note: bare English decimals like "1234.56" lose their dot — enter Danish style.
  const cleaned = String(str).replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export default function BudgetItem({
  item, section, dispatch, onEdit,
  dragging, isCollapsed, onDragStart, onDragOver, onDrop, onDragEnd,
  savingsSectionName, displayValues, readOnly,
}) {
  const [editingMonth, setEditingMonth] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [flashMonth, setFlashMonth] = useState(null)
  const [flashAnnual, setFlashAnnual] = useState(false)
  const inputRef = useRef()

  const activeValues = displayValues ?? item.monthlyValues
  const annualTotal = computeAnnualTotal(activeValues)
  const avg = computeMonthlyAverage(annualTotal)

  function startEdit(monthIndex, currentValue) {
    if (readOnly) return
    setEditingMonth(monthIndex)
    setEditValue(currentValue === 0 ? '' : String(currentValue).replace('.', ','))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit(monthIndex) {
    const value = parseVal(editValue)
    dispatch({
      type: 'UPDATE_CELL',
      sectionId: section.id,
      itemId: item.id,
      monthIndex,
      value,
    })
    setEditingMonth(null)
    setFlashMonth(monthIndex)
    setFlashAnnual(true)
    setTimeout(() => { setFlashMonth(null); setFlashAnnual(false) }, 600)
  }

  function handleKeyDown(e, monthIndex) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit(monthIndex)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit(monthIndex)
      const nextMonth = e.shiftKey ? monthIndex - 1 : monthIndex + 1
      if (nextMonth >= 0 && nextMonth < 12) {
        startEdit(nextMonth, item.monthlyValues[nextMonth])
      }
    }
    if (e.key === 'Escape') {
      setEditingMonth(null)
    }
  }

  function handleDelete() {
    if (confirm(`Delete "${item.name}"?`)) {
      dispatch({ type: 'DELETE_ITEM', sectionId: section.id, itemId: item.id })
    }
  }

  return (
    <tr
      className={`item-row${isCollapsed ? ' row-collapsed' : ''} ${dragging ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <td className="col-label drag-handle" title="Drag to reorder" style={item.excluded ? { opacity: 0.4 } : undefined}>
        <div className="cell-wrap cell-flex">
          <span className="drag-icon">⠿</span>
          {item.negative && !item.excluded && <span className="item-flag item-flag-negative" title="Subtracted from total">−</span>}
          {item.excluded && <span className="item-flag item-flag-excluded" title="Excluded from totals">∅</span>}
          <span className={`item-name${item.excluded ? ' item-name-excluded' : ''}`} onClick={onEdit} title="Edit item">{item.name}</span>
          {item.savingsPercentage != null && (
            <span className="item-flag item-flag-savings-pct" title={`${item.savingsPercentage}% of savings pool`}>{item.savingsPercentage}%</span>
          )}
          {item.savingsLink && savingsSectionName && (
            <span className="item-flag item-flag-savings-link" title={`Feeds savings: ${savingsSectionName}`}>🏦</span>
          )}
          {item.note && <span className="item-note-indicator" title={item.note} />}
        </div>
      </td>

      {activeValues.map((val, monthIndex) => (
        <td
          key={monthIndex}
          className={`col-month number${readOnly ? ' savings-auto-cell' : ' cell-editable'}${flashMonth === monthIndex ? ' cell-flash' : ''}`}
          onClick={() => startEdit(monthIndex, val)}
        >
          <div className="cell-wrap">
            <span style={!readOnly && editingMonth === monthIndex ? { visibility: 'hidden' } : undefined}>{fmt(val)}</span>
            {!readOnly && editingMonth === monthIndex && (
              <input
                ref={inputRef}
                className="cell-input"
                type="text"
                inputMode="decimal"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitEdit(monthIndex)}
                onKeyDown={e => handleKeyDown(e, monthIndex)}
              />
            )}
          </div>
        </td>
      ))}

      <td className={`col-annual number bold${flashAnnual ? ' cell-flash' : ''}`}>
        <div className="cell-wrap">{fmt(annualTotal)}</div>
      </td>
      <td className={`col-avg number${flashAnnual ? ' cell-flash' : ''}`}>
        <div className="cell-wrap">{fmt(avg)}</div>
      </td>
      <td className="col-notes">
        <div className="cell-wrap">
          {item.note && <span className="note-text" title={item.note}>{item.note}</span>}
        </div>
      </td>
      <td className="col-actions">
        <div className="cell-wrap cell-flex">
          <button className="btn-icon" onClick={onEdit} title="Edit">✎</button>
          <button className="btn-icon btn-delete" onClick={handleDelete} title="Delete">✕</button>
        </div>
      </td>
    </tr>
  )
}
