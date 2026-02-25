import { describe, it, expect } from 'vitest'
import {
  findSavingsLinkedItem,
  computeSectionTotals,
  computeBudgetSummary,
  computeAnnualTotal,
  computeRunningBalance,
} from '../utils/budgetCalculator.js'

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    name: 'Test',
    monthlyValues: Array(12).fill(0),
    excluded: false,
    negative: false,
    savingsLink: null,
    savingsPercentage: null,
    ...overrides,
  }
}

function makeSection(overrides = {}) {
  return {
    id: 'sec-1',
    name: 'Test',
    type: 'expense',
    showTotal: true,
    items: [],
    ...overrides,
  }
}

// ── findSavingsLinkedItem ──────────────────────────────────────────────────────

describe('findSavingsLinkedItem', () => {
  it('returns the expense item whose savingsLink matches the savings section id', () => {
    const item = makeItem({ id: 'i1', savingsLink: 'sav-1' })
    const sections = [makeSection({ type: 'expense', items: [item] })]
    expect(findSavingsLinkedItem(sections, 'sav-1')).toBe(item)
  })

  it('returns null when no item has a matching savingsLink', () => {
    const item = makeItem({ id: 'i1', savingsLink: 'other' })
    const sections = [makeSection({ type: 'expense', items: [item] })]
    expect(findSavingsLinkedItem(sections, 'sav-1')).toBeNull()
  })

  it('skips savings and summary sections', () => {
    const item = makeItem({ id: 'i1', savingsLink: 'sav-1' })
    const sections = [
      makeSection({ type: 'savings', items: [item] }),
      makeSection({ type: 'summary', items: [item] }),
    ]
    expect(findSavingsLinkedItem(sections, 'sav-1')).toBeNull()
  })

  it('finds item in income sections', () => {
    const item = makeItem({ id: 'i1', savingsLink: 'sav-1' })
    const sections = [makeSection({ type: 'income', items: [item] })]
    expect(findSavingsLinkedItem(sections, 'sav-1')).toBe(item)
  })
})

// ── computeSectionTotals ──────────────────────────────────────────────────────

describe('computeSectionTotals', () => {
  it('sums monthlyValues across all items', () => {
    const section = makeSection({
      items: [
        makeItem({ id: 'i1', monthlyValues: Array(12).fill(100) }),
        makeItem({ id: 'i2', monthlyValues: Array(12).fill(50) }),
      ],
    })
    const totals = computeSectionTotals(section)
    expect(totals).toHaveLength(12)
    expect(totals[0]).toBe(150)
    expect(totals[11]).toBe(150)
  })

  it('excludes items with excluded: true', () => {
    const section = makeSection({
      items: [
        makeItem({ id: 'i1', monthlyValues: Array(12).fill(100) }),
        makeItem({ id: 'i2', monthlyValues: Array(12).fill(50), excluded: true }),
      ],
    })
    expect(computeSectionTotals(section)[0]).toBe(100)
  })

  it('subtracts items with negative: true', () => {
    const section = makeSection({
      items: [
        makeItem({ id: 'i1', monthlyValues: Array(12).fill(100) }),
        makeItem({ id: 'i2', monthlyValues: Array(12).fill(30), negative: true }),
      ],
    })
    expect(computeSectionTotals(section)[0]).toBe(70)
  })

  it('returns zero array for empty section', () => {
    const totals = computeSectionTotals(makeSection({ items: [] }))
    expect(totals.every(v => v === 0)).toBe(true)
  })

  it('handles non-savings sections without allSections', () => {
    const section = makeSection({
      type: 'expense',
      items: [makeItem({ monthlyValues: Array(12).fill(200) })],
    })
    expect(() => computeSectionTotals(section)).not.toThrow()
  })

  it('computes savingsPercentage items as linkedItem * pct/100', () => {
    const linkedItem = makeItem({ id: 'exp-item', monthlyValues: Array(12).fill(1000), savingsLink: 'sav-1' })
    const savingsItem = makeItem({ id: 'sav-item', savingsPercentage: 10 })
    const expenseSection = makeSection({ id: 'exp-1', type: 'expense', items: [linkedItem] })
    const savingsSection = makeSection({ id: 'sav-1', type: 'savings', items: [savingsItem] })
    const totals = computeSectionTotals(savingsSection, [expenseSection, savingsSection])
    expect(totals[0]).toBeCloseTo(100)
  })
})

// ── computeBudgetSummary ──────────────────────────────────────────────────────

describe('computeBudgetSummary', () => {
  it('sums income sections into incomeTotals', () => {
    const sections = [
      makeSection({ type: 'income', items: [makeItem({ monthlyValues: Array(12).fill(2000) })] }),
    ]
    expect(computeBudgetSummary(sections).incomeTotals[0]).toBe(2000)
  })

  it('sums expense sections into expenseTotals', () => {
    const sections = [
      makeSection({ type: 'expense', items: [makeItem({ monthlyValues: Array(12).fill(800) })] }),
    ]
    expect(computeBudgetSummary(sections).expenseTotals[0]).toBe(800)
  })

  it('excludes savings sections from both totals', () => {
    const sections = [
      makeSection({ type: 'savings', items: [makeItem({ monthlyValues: Array(12).fill(500) })] }),
    ]
    const { incomeTotals, expenseTotals } = computeBudgetSummary(sections)
    expect(incomeTotals[0]).toBe(0)
    expect(expenseTotals[0]).toBe(0)
  })

  it('remaining = income - expense for each month', () => {
    const sections = [
      makeSection({ type: 'income', items: [makeItem({ monthlyValues: Array(12).fill(3000) })] }),
      makeSection({ type: 'expense', items: [makeItem({ monthlyValues: Array(12).fill(1200) })] }),
    ]
    expect(computeBudgetSummary(sections).remainingTotals[0]).toBeCloseTo(1800)
  })

  it('works with no income sections (remaining = 0 - expenses)', () => {
    const sections = [
      makeSection({ type: 'expense', items: [makeItem({ monthlyValues: Array(12).fill(500) })] }),
    ]
    expect(computeBudgetSummary(sections).remainingTotals[0]).toBe(-500)
  })

  it('works with no expense sections (remaining = income)', () => {
    const sections = [
      makeSection({ type: 'income', items: [makeItem({ monthlyValues: Array(12).fill(1500) })] }),
    ]
    expect(computeBudgetSummary(sections).remainingTotals[0]).toBe(1500)
  })
})

// ── computeAnnualTotal ────────────────────────────────────────────────────────

describe('computeAnnualTotal', () => {
  it('sums all 12 values', () => {
    expect(computeAnnualTotal(Array(12).fill(100))).toBe(1200)
  })

  it('coerces non-numeric values to 0', () => {
    expect(computeAnnualTotal(['', null, undefined, ...Array(9).fill(100)])).toBe(900)
  })
})

// ── computeRunningBalance ─────────────────────────────────────────────────────

describe('computeRunningBalance', () => {
  it('returns cumulative remaining totals month by month', () => {
    const sections = [
      makeSection({ type: 'income', items: [makeItem({ monthlyValues: Array(12).fill(3000) })] }),
      makeSection({ type: 'expense', items: [makeItem({ monthlyValues: Array(12).fill(1000) })] }),
    ]
    // remaining = 2000 each month, running = 2000, 4000, 6000, ..., 24000
    const running = computeRunningBalance(sections)
    expect(running).toHaveLength(12)
    expect(running[0]).toBe(2000)
    expect(running[1]).toBe(4000)
    expect(running[5]).toBe(12000)
    expect(running[11]).toBe(24000)
  })

  it('accumulates negative remaining months', () => {
    // Jan: +500, Feb-Dec: -100 each month
    const incValues = [500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const expValues = [0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
    const sections = [
      makeSection({ type: 'income', items: [makeItem({ monthlyValues: incValues })] }),
      makeSection({ type: 'expense', items: [makeItem({ monthlyValues: expValues })] }),
    ]
    const running = computeRunningBalance(sections)
    expect(running[0]).toBe(500)    // Jan: 500 - 0
    expect(running[1]).toBe(400)    // 500 + (0 - 100)
    expect(running[2]).toBe(300)    // 400 + (0 - 100)
    expect(running[11]).toBe(-600)  // 500 - 11*100
  })

  it('returns zero array when no income or expense sections', () => {
    const running = computeRunningBalance([])
    expect(running.every(v => v === 0)).toBe(true)
  })
})
