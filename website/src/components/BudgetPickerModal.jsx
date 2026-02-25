import React from 'react'

export default function BudgetPickerModal({ budgets, onSelect, onNew, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Open budget</h2>
          <button className="btn-icon" onClick={onClose} title="Continue with current budget">✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {budgets.map(meta => (
            <div
              key={meta.id}
              className="budget-dropdown-item"
              style={{ padding: '12px 20px', cursor: 'pointer' }}
              onClick={() => onSelect(meta.id)}
            >
              <span className="budget-dropdown-name">{meta.title}</span>
              <span className="budget-dropdown-year">{meta.year}</span>
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-outline" onClick={onNew}>+ New budget</button>
          <button className="btn btn-outline" onClick={onClose}>Continue with current</button>
        </div>
      </div>
    </div>
  )
}
