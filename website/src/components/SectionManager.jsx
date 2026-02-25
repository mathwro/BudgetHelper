import React, { useState } from 'react'

const SECTION_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
  { value: 'summary', label: 'Summary' },
]

const PRESET_COLORS = [
  '#2d8050', // green
  '#b37520', // amber
  '#b03020', // red
  '#2560a0', // blue
  '#6030a0', // purple
  '#1a8090', // teal
  '#b05520', // orange
  '#a01858', // rose
  '#5a8018', // olive
  '#1a7095', // sky blue
]

export default function SectionManager({ budget, dispatch, onClose }) {
  const [editingId, setEditingId] = useState(null)

  function handleAdd() {
    dispatch({ type: 'ADD_SECTION' })
  }

  function handleDelete(sectionId) {
    const section = budget.sections.find(s => s.id === sectionId)
    if (!section) return
    if (confirm(`Delete section "${section.name}" and all its items?`)) {
      dispatch({ type: 'DELETE_SECTION', sectionId })
    }
  }

  function handleMove(fromIndex, dir) {
    const toIndex = fromIndex + dir
    if (toIndex < 0 || toIndex >= budget.sections.length) return
    dispatch({ type: 'MOVE_SECTION', fromIndex, toIndex })
  }

  function handleUpdate(sectionId, updates) {
    dispatch({ type: 'UPDATE_SECTION', sectionId, updates })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Manage sections</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="sections-list">
            {budget.sections.map((section, index) => (
              <div
                key={section.id}
                className={`section-card ${editingId === section.id ? 'editing' : ''}`}
                style={{ borderLeft: `4px solid ${section.color || '#c8a96e'}` }}
              >
                <div
                  className="section-card-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setEditingId(editingId === section.id ? null : section.id)}
                >
                  <div className="section-card-title">
                    <span className={`collapse-icon${editingId === section.id ? '' : ' closed'}`}>▼</span>
                    <span
                      className="section-color-dot"
                      style={{ backgroundColor: section.color }}
                    />
                    <strong>{section.name}</strong>
                    <span className="section-type-badge">
                      {SECTION_TYPES.find(t => t.value === section.type)?.label}
                    </span>
                  </div>
                  <div className="section-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" onClick={() => handleMove(index, -1)} disabled={index === 0} title="Move up">↑</button>
                    <button className="btn-icon" onClick={() => handleMove(index, 1)} disabled={index === budget.sections.length - 1} title="Move down">↓</button>
                    <button className="btn-icon btn-delete" onClick={() => handleDelete(section.id)} title="Delete">✕</button>
                  </div>
                </div>

                <div className={`section-edit-collapse${editingId === section.id ? ' open' : ''}`}>
                <div className="section-edit-form">
                    <div className="form-row">
                      <div className="form-field">
                        <label>Name</label>
                        <input
                          type="text"
                          value={section.name}
                          onChange={e => handleUpdate(section.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="form-field">
                        <label>Type</label>
                        <select
                          value={section.type}
                          onChange={e => handleUpdate(section.id, { type: e.target.value })}
                        >
                          {SECTION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Total row label</label>
                      <input
                        type="text"
                        value={section.totalLabel || ''}
                        onChange={e => handleUpdate(section.id, { totalLabel: e.target.value })}
                        placeholder={`Total ${section.name}`}
                      />
                    </div>

                    <div className="form-field">
                      <label>Color</label>
                      <div className="color-swatches">
                        {PRESET_COLORS.map((c, i) => (
                          <button
                            key={i}
                            className={`color-swatch ${section.color === c ? 'selected' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => handleUpdate(section.id, { color: c })}
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={section.color || '#111215'}
                          onChange={e => handleUpdate(section.id, { color: e.target.value })}
                          title="Custom color"
                        />
                      </div>
                    </div>

                    <div className="form-field checkbox-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={section.showTotal}
                          onChange={e => handleUpdate(section.id, { showTotal: e.target.checked })}
                        />
                        Show total row
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-outline" onClick={handleAdd} style={{ marginTop: '1rem' }}>
            + Add section
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
