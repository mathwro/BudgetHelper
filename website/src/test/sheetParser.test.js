import { describe, it, expect } from 'vitest'
import { parseSheetData, summarizeChanges } from '../utils/sheetParser.js'
import { buildRowLayout } from '../utils/formulaGenerator.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(id, overrides = {}) {
  return {
    id,
    name: 'Item ' + id,
    monthlyValues: Array(12).fill(0),
    excluded: false,
    negative: false,
    savingsLink: null,
    savingsPercentage: null,
    note: '',
    color: null,
    ...overrides,
  }
}

function makeSection(id, type, items = [], overrides = {}) {
  return {
    id,
    name: 'Section ' + id,
    type,
    color: '#ffffff',
    showTotal: true,
    totalLabel: 'Total ' + id,
    items,
    ...overrides,
  }
}

function simpleBudget() {
  return {
    id: 'b1',
    title: 'Test',
    year: 2026,
    sections: [
      makeSection('inc', 'income', [
        makeItem('i1', { name: 'Salary', monthlyValues: Array(12).fill(50000) }),
      ]),
      makeSection('exp', 'expense', [
        makeItem('i2', { name: 'Rent', monthlyValues: Array(12).fill(15000) }),
        makeItem('i3', { name: 'Food', monthlyValues: Array(12).fill(5000) }),
      ]),
      makeSection('sum', 'summary', [], { showTotal: false }),
    ],
  }
}

/**
 * Build a mock sheet data array matching the budget layout.
 * Fills item rows with the given budget's data, other rows with placeholders.
 */
function buildMockSheetRows(budget, overrides = {}) {
  const { rowLayout, itemRowMap } = buildRowLayout(budget)
  const lastRow = rowLayout[rowLayout.length - 1]?.rowIndex || 10
  const rows = Array.from({ length: lastRow }, () => Array(16).fill(''))

  // Fill header row
  rows[0] = ['', 'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'December',
    'Total', 'Gns./måned', 'Noter']

  // Fill item rows from budget data
  for (const section of budget.sections) {
    for (const item of section.items) {
      const rowIndex = itemRowMap[item.id]
      if (rowIndex == null) continue
      const row = rows[rowIndex - 1]
      row[0] = item.name
      for (let m = 0; m < 12; m++) {
        row[1 + m] = Number(item.monthlyValues[m]) || 0
      }
      row[13] = 0 // total formula result placeholder
      row[14] = 0 // avg formula result placeholder
      row[15] = item.note || ''
    }
  }

  // Apply any overrides (rowIndex is 1-based, same as sheet)
  for (const [rowIdx, rowData] of Object.entries(overrides)) {
    const idx = Number(rowIdx) - 1
    if (idx >= 0 && idx < rows.length) {
      for (const [col, val] of Object.entries(rowData)) {
        rows[idx][Number(col)] = val
      }
    }
  }

  return rows
}

// ── parseSheetData — no changes ──────────────────────────────────────────────

describe('parseSheetData — no changes', () => {
  it('returns empty changes when sheet matches budget', () => {
    const budget = simpleBudget()
    const sheetRows = buildMockSheetRows(budget)
    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    expect(changes).toHaveLength(0)
    // Budget should be structurally identical
    expect(updatedBudget.sections[0].items[0].name).toBe('Salary')
    expect(updatedBudget.sections[0].items[0].monthlyValues).toEqual(Array(12).fill(50000))
  })

  it('does not mutate the original budget', () => {
    const budget = simpleBudget()
    const original = JSON.parse(JSON.stringify(budget))
    const sheetRows = buildMockSheetRows(budget, {
      2: { 1: 99999 }, // Change Salary Jan value
    })
    parseSheetData(budget, sheetRows)
    expect(budget).toEqual(original)
  })
})

// ── parseSheetData — value changes ───────────────────────────────────────────

describe('parseSheetData — value changes', () => {
  it('detects changed monthly values', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)
    const salaryRow = itemRowMap['i1']

    const sheetRows = buildMockSheetRows(budget, {
      [salaryRow]: { 1: 55000, 2: 55000 }, // Jan and Feb changed
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    const valueChanges = changes.filter(c => c.type === 'value')
    expect(valueChanges.length).toBe(2)
    expect(valueChanges[0].oldValue).toBe(50000)
    expect(valueChanges[0].newValue).toBe(55000)

    expect(updatedBudget.sections[0].items[0].monthlyValues[0]).toBe(55000)
    expect(updatedBudget.sections[0].items[0].monthlyValues[1]).toBe(55000)
    // Unchanged months stay the same
    expect(updatedBudget.sections[0].items[0].monthlyValues[2]).toBe(50000)
  })

  it('handles zero values correctly', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)
    const salaryRow = itemRowMap['i1']

    const sheetRows = buildMockSheetRows(budget, {
      [salaryRow]: { 1: 0 }, // Jan set to 0
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    const valueChanges = changes.filter(c => c.type === 'value')
    expect(valueChanges.length).toBe(1)
    expect(updatedBudget.sections[0].items[0].monthlyValues[0]).toBe(0)
  })

  it('detects changes across multiple items', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)

    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['i1']]: { 1: 55000 },  // Salary Jan
      [itemRowMap['i2']]: { 3: 16000 },  // Rent Mar
      [itemRowMap['i3']]: { 6: 6000 },   // Food Jun
    })

    const { changes } = parseSheetData(budget, sheetRows)
    const valueChanges = changes.filter(c => c.type === 'value')
    expect(valueChanges.length).toBe(3)
  })
})

// ── parseSheetData — name changes ────────────────────────────────────────────

describe('parseSheetData — name changes', () => {
  it('detects changed item name', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)

    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['i1']]: { 0: 'Løn - brutto' },
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    const nameChanges = changes.filter(c => c.type === 'name')
    expect(nameChanges.length).toBe(1)
    expect(nameChanges[0].oldValue).toBe('Salary')
    expect(nameChanges[0].newValue).toBe('Løn - brutto')
    expect(updatedBudget.sections[0].items[0].name).toBe('Løn - brutto')
  })

  it('ignores whitespace-only name differences', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)

    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['i1']]: { 0: '  Salary  ' },  // Extra whitespace
    })

    const { changes } = parseSheetData(budget, sheetRows)
    const nameChanges = changes.filter(c => c.type === 'name')
    expect(nameChanges.length).toBe(0)
  })
})

// ── parseSheetData — note changes ────────────────────────────────────────────

describe('parseSheetData — note changes', () => {
  it('detects added note', () => {
    const budget = simpleBudget()
    const { itemRowMap } = buildRowLayout(budget)

    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['i1']]: { 15: 'Before tax' },
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    const noteChanges = changes.filter(c => c.type === 'note')
    expect(noteChanges.length).toBe(1)
    expect(noteChanges[0].newValue).toBe('Before tax')
    expect(updatedBudget.sections[0].items[0].note).toBe('Before tax')
  })

  it('detects removed note', () => {
    const budget = {
      ...simpleBudget(),
      sections: [
        makeSection('inc', 'income', [
          makeItem('i1', { name: 'Salary', monthlyValues: Array(12).fill(50000), note: 'Old note' }),
        ]),
        makeSection('exp', 'expense', [
          makeItem('i2', { name: 'Rent', monthlyValues: Array(12).fill(15000) }),
          makeItem('i3', { name: 'Food', monthlyValues: Array(12).fill(5000) }),
        ]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }

    const sheetRows = buildMockSheetRows(budget, {
      2: { 15: '' },  // Note cleared
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)

    const noteChanges = changes.filter(c => c.type === 'note')
    expect(noteChanges.length).toBe(1)
    expect(noteChanges[0].oldValue).toBe('Old note')
    expect(noteChanges[0].newValue).toBe('')
    expect(updatedBudget.sections[0].items[0].note).toBe('')
  })
})

// ── parseSheetData — savings sections ────────────────────────────────────────

describe('parseSheetData — savings sections', () => {
  it('skips savings items with savingsPercentage (formula-computed)', () => {
    const budget = {
      id: 'b2',
      title: 'Test Savings',
      year: 2026,
      sections: [
        makeSection('inc', 'income', [
          makeItem('i1', { name: 'Salary', monthlyValues: Array(12).fill(50000) }),
        ]),
        makeSection('exp', 'expense', [
          makeItem('i2', { name: 'Rent', monthlyValues: Array(12).fill(15000), savingsLink: 'sav' }),
        ]),
        makeSection('sum', 'summary', [], { showTotal: false }),
        makeSection('sav', 'savings', [
          makeItem('s1', { name: 'Emergency fund', savingsPercentage: 10, monthlyValues: Array(12).fill(0) }),
          makeItem('s2', { name: 'Manual savings', monthlyValues: Array(12).fill(1000) }),
        ]),
      ],
    }

    const { itemRowMap } = buildRowLayout(budget)
    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['s1']]: { 1: 9999 },  // Changed value on percentage item — should be ignored
      [itemRowMap['s2']]: { 1: 2000 },  // Changed value on manual item — should be detected
    })

    const { changes } = parseSheetData(budget, sheetRows)
    const valueChanges = changes.filter(c => c.type === 'value')

    // Only s2 change should be detected, not s1
    const s1Changes = valueChanges.filter(c => c.itemId === 's1')
    const s2Changes = valueChanges.filter(c => c.itemId === 's2')
    expect(s1Changes.length).toBe(0)
    expect(s2Changes.length).toBe(1)
  })

  it('reads normal savings items (no savingsPercentage)', () => {
    const budget = {
      id: 'b3',
      title: 'Test',
      year: 2026,
      sections: [
        makeSection('inc', 'income', [makeItem('i1')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
        makeSection('sav', 'savings', [
          makeItem('s1', { name: 'Vacation fund', monthlyValues: Array(12).fill(500) }),
        ]),
      ],
    }

    const { itemRowMap } = buildRowLayout(budget)
    const sheetRows = buildMockSheetRows(budget, {
      [itemRowMap['s1']]: { 1: 750 },
    })

    const { updatedBudget, changes } = parseSheetData(budget, sheetRows)
    expect(changes.filter(c => c.type === 'value').length).toBe(1)
    expect(updatedBudget.sections[2].items[0].monthlyValues[0]).toBe(750)
  })
})

// ── parseSheetData — edge cases ──────────────────────────────────────────────

describe('parseSheetData — edge cases', () => {
  it('handles missing sheet rows gracefully', () => {
    const budget = simpleBudget()
    const sheetRows = [] // Empty sheet

    const { changes } = parseSheetData(budget, sheetRows)
    // No crashes, but all values become 0
    expect(changes).toBeDefined()
  })

  it('handles short rows (fewer columns than expected)', () => {
    const budget = simpleBudget()
    const sheetRows = buildMockSheetRows(budget)
    // Truncate row to only have label + 3 months
    const { itemRowMap } = buildRowLayout(budget)
    sheetRows[itemRowMap['i1'] - 1] = ['Salary', 50000, 50000, 50000]

    const { updatedBudget } = parseSheetData(budget, sheetRows)
    // Months 0-2 should have values, rest should be 0
    expect(updatedBudget.sections[0].items[0].monthlyValues[0]).toBe(50000)
    expect(updatedBudget.sections[0].items[0].monthlyValues[3]).toBe(0)
    expect(updatedBudget.sections[0].items[0].monthlyValues[11]).toBe(0)
  })

  it('preserves budget structure (IDs, types, colors, flags)', () => {
    const budget = simpleBudget()
    budget.sections[1].items[0].excluded = true
    budget.sections[1].items[0].negative = true
    budget.sections[1].items[0].color = '#ff0000'

    const sheetRows = buildMockSheetRows(budget)
    const { updatedBudget } = parseSheetData(budget, sheetRows)

    const item = updatedBudget.sections[1].items[0]
    expect(item.id).toBe('i2')
    expect(item.excluded).toBe(true)
    expect(item.negative).toBe(true)
    expect(item.color).toBe('#ff0000')
  })

  it('skips summary sections entirely', () => {
    const budget = simpleBudget()
    const sheetRows = buildMockSheetRows(budget)

    const { changes } = parseSheetData(budget, sheetRows)
    const summaryChanges = changes.filter(c => c.sectionName === 'Section sum')
    expect(summaryChanges.length).toBe(0)
  })
})

// ── summarizeChanges ─────────────────────────────────────────────────────────

describe('summarizeChanges', () => {
  it('returns "No changes detected" for empty changes', () => {
    const result = summarizeChanges([])
    expect(result.totalChanges).toBe(0)
    expect(result.summary).toBe('No changes detected')
  })

  it('counts changes by type', () => {
    const changes = [
      { type: 'value', sectionName: 'Income', itemId: 'i1' },
      { type: 'value', sectionName: 'Income', itemId: 'i1' },
      { type: 'name', sectionName: 'Expense', itemId: 'i2' },
      { type: 'note', sectionName: 'Expense', itemId: 'i2' },
    ]
    const result = summarizeChanges(changes)
    expect(result.totalChanges).toBe(4)
    expect(result.summary).toBe('2 values, 1 name, 1 note changed')
  })

  it('groups changes by section', () => {
    const changes = [
      { type: 'value', sectionName: 'Income', itemId: 'i1' },
      { type: 'value', sectionName: 'Expense', itemId: 'i2' },
      { type: 'value', sectionName: 'Expense', itemId: 'i3' },
    ]
    const result = summarizeChanges(changes)
    expect(Object.keys(result.bySection)).toHaveLength(2)
    expect(result.bySection['Income']).toHaveLength(1)
    expect(result.bySection['Expense']).toHaveLength(2)
  })
})
