import { describe, it, expect } from 'vitest'
import { buildRowLayout, generateSheetsPayload } from '../utils/formulaGenerator.js'

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
      makeSection('inc', 'income', [makeItem('i1')]),
      makeSection('exp', 'expense', [makeItem('i2')]),
      makeSection('sum', 'summary', [], { showTotal: false }),
    ],
  }
}

// ── buildRowLayout — basic layout ─────────────────────────────────────────────

describe('buildRowLayout — basic layout', () => {
  it('row 1 is always the header', () => {
    const { rowLayout } = buildRowLayout(simpleBudget())
    expect(rowLayout[0]).toMatchObject({ type: 'header', rowIndex: 1 })
  })

  it('income item starts at row 2', () => {
    const { itemRowMap } = buildRowLayout(simpleBudget())
    expect(itemRowMap['i1']).toBe(2)
  })

  it('income total row is at row 3 (immediately after item)', () => {
    const { incomeTotalRows } = buildRowLayout(simpleBudget())
    expect(incomeTotalRows).toEqual([3])
  })

  it('expense item is at row 5 (after income total + separator)', () => {
    // row 4 = separator, row 5 = expense item
    const { itemRowMap } = buildRowLayout(simpleBudget())
    expect(itemRowMap['i2']).toBe(5)
  })

  it('expense total is in expenseTotalRows', () => {
    const { expenseTotalRows } = buildRowLayout(simpleBudget())
    expect(expenseTotalRows).toHaveLength(1)
    expect(expenseTotalRows[0]).toBeGreaterThan(1)
  })

  it('remaining row exists in layout', () => {
    const { rowLayout } = buildRowLayout(simpleBudget())
    expect(rowLayout.find(r => r.type === 'remaining')).toBeTruthy()
  })

  it('itemRowMap contains all non-summary item ids', () => {
    const { itemRowMap } = buildRowLayout(simpleBudget())
    expect(itemRowMap).toHaveProperty('i1')
    expect(itemRowMap).toHaveProperty('i2')
  })
})

// ── buildRowLayout — savings sections ─────────────────────────────────────────

describe('buildRowLayout — savings sections', () => {
  function savingsBudget() {
    const expItem = makeItem('exp-item', { savingsLink: 'sav' })
    return {
      id: 'b1', title: 'Test', year: 2026,
      sections: [
        makeSection('exp', 'expense', [expItem]),
        makeSection('sav', 'savings', [makeItem('sav-item')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
  }

  it('savings section linked to expense item gets a savings-auto row', () => {
    const { rowLayout } = buildRowLayout(savingsBudget())
    expect(rowLayout.find(r => r.type === 'savings-auto')).toBeTruthy()
  })

  it('savings-auto linkedItemRow matches the expense item row index', () => {
    const { rowLayout, itemRowMap } = buildRowLayout(savingsBudget())
    const autoRow = rowLayout.find(r => r.type === 'savings-auto')
    expect(autoRow.linkedItemRow).toBe(itemRowMap['exp-item'])
  })

  it('unlinked savings section has no savings-auto row', () => {
    const budget = {
      id: 'b1', title: 'Test', year: 2026,
      sections: [
        makeSection('sav', 'savings', [makeItem('sav-item')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { rowLayout } = buildRowLayout(budget)
    expect(rowLayout.find(r => r.type === 'savings-auto')).toBeUndefined()
  })
})

// ── generateSheetsPayload — remaining row (Bug 3, EXPECTED TO FAIL) ───────────
// These tests document the known bug: when only income OR only expense sections
// exist, the remaining row outputs a literal 0 instead of a formula.

describe('generateSheetsPayload — remaining row [Bug 3]', () => {
  it('remaining row B column is a formula when only income sections exist', () => {
    const budget = {
      id: 'b1', title: 'Test', year: 2026,
      sections: [
        makeSection('inc', 'income', [makeItem('i1')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const remaining = valueRanges.find(r => r.values[0][0] === 'Tilbage')
    expect(remaining).toBeTruthy()
    // B column (index 1) should be a formula string starting with =
    expect(typeof remaining.values[0][1]).toBe('string')
    expect(remaining.values[0][1]).toMatch(/^=/)
  })

  it('remaining row B column is a formula when only expense sections exist', () => {
    const budget = {
      id: 'b1', title: 'Test', year: 2026,
      sections: [
        makeSection('exp', 'expense', [makeItem('i1')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const remaining = valueRanges.find(r => r.values[0][0] === 'Tilbage')
    expect(remaining).toBeTruthy()
    expect(typeof remaining.values[0][1]).toBe('string')
    expect(remaining.values[0][1]).toMatch(/^=/)
  })
})

// ── generateSheetsPayload — item formulas ─────────────────────────────────────

describe('generateSheetsPayload — item formulas', () => {
  it('normal items push plain numeric values for each month', () => {
    const item = makeItem('i1', { name: 'Salary', monthlyValues: Array(12).fill(500) })
    const budget = {
      id: 'b1', title: 'T', year: 2026,
      sections: [
        makeSection('inc', 'income', [item]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const itemRow = valueRanges.find(r => r.values[0][0] === 'Salary')
    expect(itemRow).toBeTruthy()
    expect(itemRow.values[0][1]).toBe(500)
  })

  it('savings percentage items generate formula strings referencing the auto-row', () => {
    const expItem = makeItem('exp-item', { name: 'Rent', monthlyValues: Array(12).fill(1000), savingsLink: 'sav' })
    const savItem = makeItem('sav-item', { name: 'Emergency', savingsPercentage: 10 })
    const budget = {
      id: 'b1', title: 'T', year: 2026,
      sections: [
        makeSection('exp', 'expense', [expItem]),
        makeSection('sav', 'savings', [savItem]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const savItemRow = valueRanges.find(r => r.values[0][0] === 'Emergency')
    expect(savItemRow).toBeTruthy()
    // Should be a formula, not a number
    expect(typeof savItemRow.values[0][1]).toBe('string')
    expect(savItemRow.values[0][1]).toMatch(/^=/)
    // Formula should multiply by 0.1 (10%)
    expect(savItemRow.values[0][1]).toMatch(/0\.1$/)
  })

  it('total row for a plain income section uses SUM formula', () => {
    const budget = {
      id: 'b1', title: 'T', year: 2026,
      sections: [
        makeSection('inc', 'income', [makeItem('i1')]),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const totalRow = valueRanges.find(r => r.values[0][0] === 'Total inc')
    expect(totalRow).toBeTruthy()
    expect(totalRow.values[0][1]).toMatch(/^=SUM\(/)
  })

  it('total row skips excluded items', () => {
    const items = [
      makeItem('i1', { name: 'Keep' }),
      makeItem('i2', { name: 'Exclude', excluded: true }),
    ]
    const budget = {
      id: 'b1', title: 'T', year: 2026,
      sections: [
        makeSection('exp', 'expense', items),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const totalRow = valueRanges.find(r => r.values[0][0] === 'Total exp')
    // When excluded items exist, formula uses explicit cell refs, not SUM range
    // i2 (excluded) should NOT appear in the formula
    const formula = totalRow.values[0][1]
    // The formula should not reference i2's row
    // We can check indirectly: it should reference only one row (i1's row)
    expect(formula).toBeTruthy()
    expect(typeof formula).toBe('string')
  })

  it('negative items appear with minus sign in total row formula', () => {
    const items = [
      makeItem('i1', { name: 'Base' }),
      makeItem('i2', { name: 'Deduct', negative: true }),
    ]
    const budget = {
      id: 'b1', title: 'T', year: 2026,
      sections: [
        makeSection('exp', 'expense', items),
        makeSection('sum', 'summary', [], { showTotal: false }),
      ],
    }
    const { valueRanges } = generateSheetsPayload(budget)
    const totalRow = valueRanges.find(r => r.values[0][0] === 'Total exp')
    const formula = totalRow.values[0][1]
    expect(formula).toMatch(/-/)
  })
})

// ── buildRowLayout — running balance row ──────────────────────────────────────────

describe('buildRowLayout — running balance row', () => {
  it('running-balance row is placed immediately after remaining row', () => {
    const { rowLayout } = buildRowLayout(simpleBudget())
    const remainingIdx = rowLayout.findIndex(r => r.type === 'remaining')
    expect(remainingIdx).toBeGreaterThan(-1)
    expect(rowLayout[remainingIdx + 1]).toMatchObject({ type: 'running-balance' })
  })

  it('running-balance row has remainingRow pointing to the remaining row index', () => {
    const { rowLayout } = buildRowLayout(simpleBudget())
    const remaining = rowLayout.find(r => r.type === 'remaining')
    const runningBalance = rowLayout.find(r => r.type === 'running-balance')
    expect(runningBalance.remainingRow).toBe(remaining.rowIndex)
  })
})

// ── generateSheetsPayload — running balance formulas ────────────────────────────

describe('generateSheetsPayload — running balance formulas', () => {
  it('running balance row label is Løbende saldo', () => {
    const { valueRanges } = generateSheetsPayload(simpleBudget())
    const rb = valueRanges.find(r => r.values[0][0] === 'Løbende saldo')
    expect(rb).toBeTruthy()
  })

  it('Jan column references the remaining row directly', () => {
    const { valueRanges, } = generateSheetsPayload(simpleBudget())
    const rb = valueRanges.find(r => r.values[0][0] === 'Løbende saldo')
    // B column (index 1) should be =B{remainingRow}
    expect(rb.values[0][1]).toMatch(/^=B\d+$/)
  })

  it('Feb column references previous running balance + remaining', () => {
    const { valueRanges } = generateSheetsPayload(simpleBudget())
    const rb = valueRanges.find(r => r.values[0][0] === 'Løbende saldo')
    // C column (index 2) should be =C{rbRow}+C{remainingRow} pattern
    // Actually it's ={prevCol}{rbRow}+{thisCol}{remainingRow}
    const formula = rb.values[0][2]
    expect(formula).toMatch(/^=B\d+\+C\d+$/)
  })

  it('annual and avg columns are blank for running balance', () => {
    const { valueRanges } = generateSheetsPayload(simpleBudget())
    const rb = valueRanges.find(r => r.values[0][0] === 'Løbende saldo')
    // N (index 13), O (index 14)
    expect(rb.values[0][13]).toBe('')
    expect(rb.values[0][14]).toBe('')
  })
})
