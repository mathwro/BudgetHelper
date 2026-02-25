import React, { useState } from 'react'

export default function DuplicateBudgetModal({ source, onConfirm, onClose }) {
  const currentYear = new Date().getFullYear()
  const suggestedYear = (source.year || currentYear) + 1
  const baseName = source.title.replace(/\s*\d{4}$/, '').trim()
  const suggestedName = source.year === currentYear
    ? baseName + ' ' + suggestedYear
    : baseName + ' copy'
  const [name, setName] = useState(suggestedName)
  const [year, setYear] = useState(suggestedYear)
  const [keepValues, setKeepValues] = useState(false)

  function handleConfirm() {
    onConfirm({ name: name.trim() || suggestedName, year, keepValues })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>Duplicate budget</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label>New budget name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Year</label>
            <input
              type="number"
              value={year}
              min="2020"
              max="2099"
              onChange={e => setYear(parseInt(e.target.value) || suggestedYear)}
            />
          </div>
          <div className="form-field">
            <label>Values</label>
            <div className="duplicate-values-toggle">
              <button
                className={`duplicate-toggle-btn${!keepValues ? ' active' : ''}`}
                onClick={() => setKeepValues(false)}
              >
                Zero out values
              </button>
              <button
                className={`duplicate-toggle-btn${keepValues ? ' active' : ''}`}
                onClick={() => setKeepValues(true)}
              >
                Keep values
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Duplicate</button>
        </div>
      </div>
    </div>
  )
}
