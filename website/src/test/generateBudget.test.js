import { describe, it, expect } from 'vitest'
import { generateBudget } from '../utils/generateBudget.js'
import { createDefaultBudget } from '../utils/defaultBudget.js'

// ── generateBudget ────────────────────────────────────────────────────────────

describe('generateBudget', () => {
  it('returns a budget with required top-level fields', () => {
    const budget = generateBudget({ name: 'My Budget', year: 2026, selectedSections: [] })
    expect(budget.id).toBeTruthy()
    expect(budget.title).toBe('My Budget')
    expect(budget.year).toBe(2026)
    expect(budget.linkedSheetId).toBeNull()
  })

  it('falls back to "Budget {year}" when name is empty', () => {
    const budget = generateBudget({ name: '', year: 2026, selectedSections: [] })
    expect(budget.title).toBe('Budget 2026')
  })

  it('falls back to "Budget {year}" when name is whitespace', () => {
    const budget = generateBudget({ name: '   ', year: 2026, selectedSections: [] })
    expect(budget.title).toBe('Budget 2026')
  })

  it('always appends a summary section as the last section', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: ['income', 'fixed'] })
    const last = budget.sections[budget.sections.length - 1]
    expect(last.type).toBe('summary')
  })

  it('empty selectedSections produces only the summary section', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: [] })
    expect(budget.sections).toHaveLength(1)
    expect(budget.sections[0].type).toBe('summary')
  })

  it('creates correct number of sections for selectedSections', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: ['income', 'fixed'] })
    // income + fixed + summary = 3
    expect(budget.sections).toHaveLength(3)
  })

  it('each section has a unique id', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: ['income', 'fixed', 'variable'] })
    const ids = budget.sections.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each item has a unique id', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: ['income', 'fixed'] })
    const items = budget.sections.flatMap(s => s.items)
    const ids = items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses selectedItems to override default items', () => {
    const budget = generateBudget({
      name: 'B', year: 2026,
      selectedSections: ['income'],
      selectedItems: { income: ['Salary', 'Bonus'] },
    })
    const incomeSection = budget.sections.find(s => s.type === 'income')
    expect(incomeSection.items).toHaveLength(2)
    expect(incomeSection.items[0].name).toBe('Salary')
    expect(incomeSection.items[1].name).toBe('Bonus')
  })

  it('incomeItems overrides income section with correct monthlyValues', () => {
    const budget = generateBudget({
      name: 'B', year: 2026,
      selectedSections: ['income'],
      incomeItems: [{ name: 'Salary', monthly: 3000 }],
    })
    const incomeSection = budget.sections.find(s => s.type === 'income')
    expect(incomeSection.items).toHaveLength(1)
    expect(incomeSection.items[0].name).toBe('Salary')
    expect(incomeSection.items[0].monthlyValues).toEqual(Array(12).fill(3000))
  })

  it('all items have the correct default shape', () => {
    const budget = generateBudget({ name: 'B', year: 2026, selectedSections: ['fixed'] })
    const item = budget.sections[0].items[0]
    expect(item).toMatchObject({
      color: null,
      note: '',
      excluded: false,
      negative: false,
      savingsLink: null,
      savingsPercentage: null,
    })
    expect(item.monthlyValues).toHaveLength(12)
  })
})

// ── createDefaultBudget (Bug 1 fix verification) ─────────────────────────────

describe('createDefaultBudget', () => {
  it('returns a budget with an id', () => {
    const budget = createDefaultBudget()
    expect(budget.id).toBeTruthy()
    expect(typeof budget.id).toBe('string')
  })

  it('returns a budget with a title and year', () => {
    const budget = createDefaultBudget()
    expect(budget.title).toBeTruthy()
    expect(typeof budget.year).toBe('number')
  })
})
