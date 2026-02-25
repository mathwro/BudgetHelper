import React, { useRef, useState, useEffect } from 'react'

export default function Header({
  budget,
  dispatch,
  onExport,
  onImport,
  onOpenSync,
  onOpenSections,
  showCharts,
  onToggleCharts,
  allBudgetsMeta,
  activeBudgetId,
  onSwitchBudget,
  onDeleteBudget,
  onNewBudget,
  onDuplicateBudget,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  const importRef = useRef()
  const dropdownRef = useRef()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e) {
      if (!dropdownRef.current?.contains(e.target)) {
        setDropdownOpen(false)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  function handleSwitch(id) {
    if (id !== activeBudgetId) onSwitchBudget(id)
    setDropdownOpen(false)
    setConfirmDeleteId(null)
  }

  function handleDeleteClick(e, id) {
    e.stopPropagation()
    if (allBudgetsMeta.length <= 1) return
    if (confirmDeleteId === id) {
      onDeleteBudget(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  function handleDuplicateClick(e, id) {
    e.stopPropagation()
    setDropdownOpen(false)
    setConfirmDeleteId(null)
    onDuplicateBudget(id)
  }

  function handleNewBudget() {
    setDropdownOpen(false)
    onNewBudget()
  }

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="header-left">
          <div className="budget-switcher" ref={dropdownRef}>
            <button
              className="budget-switcher-btn"
              onClick={() => { setDropdownOpen(v => !v); setConfirmDeleteId(null) }}
              title="Switch budget"
            >
              <span
                className="budget-switcher-title"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => dispatch({ type: 'SET_TITLE', title: e.target.textContent.trim() })}
                onClick={e => e.stopPropagation()}
              >
                {budget.title}
              </span>
              <span className="budget-switcher-chevron">{dropdownOpen ? '▲' : '▼'}</span>
            </button>

            {dropdownOpen && (
              <div className="budget-dropdown">
                {allBudgetsMeta.map(meta => (
                  <div
                    key={meta.id}
                    className={`budget-dropdown-item${meta.id === activeBudgetId ? ' active' : ''}`}
                    onClick={() => handleSwitch(meta.id)}
                  >
                    <span className="budget-dropdown-check">
                      {meta.id === activeBudgetId ? '✓' : ''}
                    </span>
                    <span className="budget-dropdown-name">{meta.title}</span>
                    <span className="budget-dropdown-year">{meta.year}</span>
                    <button
                      className="budget-dropdown-dup"
                      onClick={e => handleDuplicateClick(e, meta.id)}
                      title="Duplicate budget"
                    >
                      ⎘
                    </button>
                    {confirmDeleteId === meta.id ? (
                      <button
                        className="budget-dropdown-del confirming"
                        onClick={e => handleDeleteClick(e, meta.id)}
                        title="Confirm delete"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        className="budget-dropdown-del"
                        onClick={e => handleDeleteClick(e, meta.id)}
                        disabled={allBudgetsMeta.length <= 1}
                        title="Delete budget"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <div className="budget-dropdown-new" onClick={handleNewBudget}>
                  + New budget
                </div>
              </div>
            )}
          </div>

          <div className="year-selector">
            <label>Year</label>
            <input
              type="number"
              value={budget.year}
              min="2020"
              max="2099"
              onChange={e => dispatch({ type: 'SET_YEAR', year: parseInt(e.target.value) || budget.year })}
            />
          </div>
        </div>

          <div className="undo-redo">
            <button
              className="btn-icon undo-redo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↩
            </button>
            <button
              className="btn-icon undo-redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪
            </button>
          </div>
        <div className="header-actions">
          <button
            className={`btn btn-outline${showCharts ? ' active' : ''}`}
            onClick={onToggleCharts}
            title="Toggle charts"
          >
            {showCharts ? 'Hide Charts' : 'Show Charts'}
          </button>
          <button className="btn btn-outline" onClick={onOpenSections} title="Manage sections">
            Sections
          </button>
          <button className="btn btn-outline" onClick={onExport} title="Export as JSON">
            Export JSON
          </button>
          <button className="btn btn-outline" onClick={() => importRef.current?.click()} title="Import from JSON">
            Import JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={onImport}
          />
          <button className="btn btn-primary" onClick={onOpenSync}>
            Sync to Sheets
          </button>
        </div>
      </div>
    </header>
  )
}
