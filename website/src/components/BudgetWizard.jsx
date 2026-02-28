import React, { useState } from 'react'
import { generateBudget, SECTION_TEMPLATES } from '../utils/generateBudget.js'

const SECTION_OPTIONS = [
  {
    key: 'income',
    label: 'Income',
    description: 'Salary, freelance, dividends…',
  },
  {
    key: 'fixed',
    label: 'Fixed expenses',
    description: 'Rent, subscriptions, insurance…',
  },
  {
    key: 'variable',
    label: 'Variable expenses',
    description: 'Groceries, dining, shopping…',
  },
  {
    key: 'savings',
    label: 'Savings goals',
    description: 'Emergency fund, travel, etc.',
  },
]

const ITEM_PRESETS = {
  income: [
    { name: 'Salary', checked: true },
    { name: 'Freelance income', checked: false },
    { name: 'Dividends', checked: false },
    { name: 'Rental income', checked: false },
  ],
  fixed: [
    { name: 'Rent / Mortgage', checked: true },
    { name: 'Electricity', checked: true },
    { name: 'Internet', checked: true },
    { name: 'Mobile / Phone', checked: true },
    { name: 'Car insurance', checked: true },
    { name: 'Streaming services', checked: true },
    { name: 'Gas / Heating', checked: false },
    { name: 'Water', checked: false },
    { name: 'Property tax', checked: false },
    { name: 'Home insurance', checked: false },
    { name: 'Gym membership', checked: false },
    { name: 'Car loan', checked: false },
  ],
  variable: [
    { name: 'Groceries', checked: true },
    { name: 'Dining out', checked: true },
    { name: 'Clothing & shoes', checked: true },
    { name: 'Health & pharmacy', checked: true },
    { name: 'Leisure & hobbies', checked: false },
    { name: 'Gifts', checked: false },
    { name: 'Travel & holidays', checked: false },
    { name: 'Home maintenance', checked: false },
  ],
  savings: [
    { name: 'Emergency fund', checked: true },
    { name: 'Travel fund', checked: false },
    { name: 'Home purchase', checked: false },
    { name: 'Retirement', checked: false },
  ],
}

export default function BudgetWizard({ canClose, onComplete, onClose, onCreateBlank, onPullFromGoogle }) {
  const currentYear = new Date().getFullYear()
  const [step, setStep] = useState(1)

  // Step 1
  const [budgetName, setBudgetName] = useState('')
  const [budgetYear, setBudgetYear] = useState(currentYear)

  // Step 2
  const [selectedSections, setSelectedSections] = useState(['income', 'fixed', 'variable'])

  // Step 3
  const [sectionItems, setSectionItems] = useState({})
  const [customInputs, setCustomInputs] = useState({})

  // Step 4
  const [incomeRows, setIncomeRows] = useState([{ name: 'Salary', monthly: '' }])

  const hasIncome = selectedSections.includes('income')

  function toggleSection(key) {
    setSelectedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function initItemsStep() {
    setSectionItems(prev => {
      const next = {}
      for (const key of selectedSections) {
        next[key] = prev[key] ?? (ITEM_PRESETS[key] ?? []).map(p => ({ ...p }))
      }
      return next
    })
    setCustomInputs(prev => {
      const next = {}
      for (const key of selectedSections) {
        next[key] = prev[key] ?? ''
      }
      return next
    })
  }

  function toggleItem(sectionKey, index) {
    setSectionItems(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      ),
    }))
  }

  function addCustomItem(sectionKey) {
    const val = (customInputs[sectionKey] ?? '').trim()
    if (!val) return
    setSectionItems(prev => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] ?? []), { name: val, checked: true }],
    }))
    setCustomInputs(prev => ({ ...prev, [sectionKey]: '' }))
  }

  function handleNext() {
    if (step === 1) {
      setStep(2)
    } else if (step === 2) {
      initItemsStep()
      setStep(3)
    } else if (step === 3) {
      if (hasIncome) {
        setStep(4)
      } else {
        create([])
      }
    }
  }

  function handleBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) setStep(3)
  }

  function create(incomeItems) {
    const selectedItemNames = {}
    for (const key of selectedSections) {
      const items = sectionItems[key]
      if (items) {
        selectedItemNames[key] = items.filter(i => i.checked).map(i => i.name)
      }
    }
    const budget = generateBudget({
      name: budgetName,
      year: budgetYear,
      selectedSections,
      selectedItems: selectedItemNames,
      incomeItems,
    })
    onComplete(budget)
  }

  function handleCreate() {
    create(incomeRows.filter(r => r.name.trim()))
  }

  function handleSkip() {
    create([])
  }

  function addIncomeRow() {
    setIncomeRows(prev => [...prev, { name: '', monthly: '' }])
  }

  function removeIncomeRow(index) {
    setIncomeRows(prev => prev.filter((_, i) => i !== index))
  }

  function updateIncomeRow(index, field, value) {
    setIncomeRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  return (
    <div className="modal-overlay wizard-overlay">
      <div className="modal wizard-modal">
        <div className="wizard-header">
          {canClose && (
            <button className="btn-icon wizard-close" onClick={onClose} title="Close">×</button>
          )}
          <div className="wizard-steps">
            <span className={`wizard-step-label${step === 1 ? ' active' : step > 1 ? ' done' : ''}`}>1 — Name</span>
            <span className="wizard-step-sep">·</span>
            <span className={`wizard-step-label${step === 2 ? ' active' : step > 2 ? ' done' : ''}`}>2 — Sections</span>
            <span className="wizard-step-sep">·</span>
            <span className={`wizard-step-label${step === 3 ? ' active' : step > 3 ? ' done' : ''}`}>3 — Items</span>
            {hasIncome && (
              <>
                <span className="wizard-step-sep">·</span>
                <span className={`wizard-step-label${step === 4 ? ' active' : ''}`}>4 — Income</span>
              </>
            )}
          </div>
          <h2 className="wizard-title">
            {step === 1 && 'New budget'}
            {step === 2 && 'Choose sections'}
            {step === 3 && 'Choose items'}
            {step === 4 && 'Income sources'}
          </h2>
        </div>

        <div className="wizard-body">
          {step === 1 && (
            <div className="wizard-step">
              <div className="form-row">
                <div className="form-field">
                  <label>Budget name</label>
                  <input
                    type="text"
                    value={budgetName}
                    onChange={e => setBudgetName(e.target.value)}
                    placeholder={`Budget ${budgetYear}`}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                  />
                </div>
                <div className="form-field">
                  <label>Year</label>
                  <input
                    type="number"
                    value={budgetYear}
                    min="2020"
                    max="2099"
                    onChange={e => setBudgetYear(parseInt(e.target.value) || currentYear)}
                  />
                </div>
              </div>
              {(onCreateBlank || onPullFromGoogle) && (
                <div className="wizard-quick-actions">
                  {onCreateBlank && (
                    <button
                      className="btn btn-outline"
                      onClick={() => onCreateBlank({ name: budgetName, year: budgetYear })}
                    >
                      Create blank budget
                    </button>
                  )}
                  {onPullFromGoogle && (
                    <button
                      className="btn btn-outline"
                      onClick={() => onPullFromGoogle({ name: budgetName, year: budgetYear })}
                    >
                      Pull from Google Sheet
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <p className="wizard-step-hint">Which sections do you want to track?</p>
              <div className="wizard-section-list">
                {SECTION_OPTIONS.map(opt => (
                  <label key={opt.key} className={`wizard-section-option${selectedSections.includes(opt.key) ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(opt.key)}
                      onChange={() => toggleSection(opt.key)}
                    />
                    <div className="wizard-section-text">
                      <strong>{opt.label}</strong>
                      <span>{opt.description}</span>
                    </div>
                  </label>
                ))}
              </div>
              <p className="wizard-note">A "Remaining" summary row is always included.</p>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step">
              <p className="wizard-step-hint">Choose which items to include in each section.</p>
              <div className="wizard-items-groups">
                {selectedSections.filter(k => k !== 'summary').map(key => (
                  <div key={key} className="wizard-items-group">
                    <div className="wizard-items-group-label">
                      {SECTION_TEMPLATES[key]?.name ?? key}
                    </div>
                    {(sectionItems[key] ?? []).map((item, i) => (
                      <label
                        key={i}
                        className={`wizard-item-option${item.checked ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(key, i)}
                        />
                        <span>{item.name}</span>
                      </label>
                    ))}
                    <div className="wizard-custom-add">
                      <input
                        type="text"
                        value={customInputs[key] ?? ''}
                        onChange={e => setCustomInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addCustomItem(key)}
                        placeholder="Add custom item…"
                        className="wizard-custom-input"
                      />
                      <button className="btn btn-ghost" onClick={() => addCustomItem(key)}>Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-step">
              <p className="wizard-step-hint">Add your income sources (optional — you can skip)</p>
              <div className="wizard-income-list">
                {incomeRows.map((row, i) => (
                  <div key={i} className="wizard-income-row">
                    <input
                      type="text"
                      className="wizard-income-name"
                      value={row.name}
                      onChange={e => updateIncomeRow(i, 'name', e.target.value)}
                      placeholder="Source name"
                    />
                    <input
                      type="number"
                      className="wizard-income-amount"
                      value={row.monthly}
                      onChange={e => updateIncomeRow(i, 'monthly', e.target.value)}
                      placeholder="monthly"
                      min="0"
                    />
                    {incomeRows.length > 1 && (
                      <button className="btn-icon btn-delete" onClick={() => removeIncomeRow(i)}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost wizard-add-source" onClick={addIncomeRow}>
                + Add source
              </button>
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <div className="wizard-footer-left">
            {step > 1 && (
              <button className="btn btn-outline" onClick={handleBack}>← Back</button>
            )}
          </div>
          <div className="wizard-footer-right">
            {step === 4 ? (
              <>
                <button className="btn btn-outline" onClick={handleSkip}>Skip</button>
                <button className="btn btn-primary" onClick={handleCreate}>Create budget</button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={step === 2 && selectedSections.length === 0}
              >
                {step === 3 && !hasIncome ? 'Create budget' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
