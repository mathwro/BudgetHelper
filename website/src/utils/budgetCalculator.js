/**
 * Computes live totals for display in the UI.
 * Mirrors the logic in formulaGenerator.js but in plain JS.
 */

/**
 * Finds the expense/income item that has savingsLink pointing to a given savings section.
 */
export function findSavingsLinkedItem(sections, savingsSectionId) {
  for (const s of sections) {
    if (s.type !== 'expense' && s.type !== 'income') continue
    for (const item of s.items) {
      if (item.savingsLink === savingsSectionId) return item
    }
  }
  return null
}

export function computeSectionTotals(section, allSections = null) {
  const monthlyTotals = Array(12).fill(0)

  // For savings sections: items with savingsPercentage use linked expense × pct/100
  let linkedItem = null
  if (section.type === 'savings' && allSections) {
    linkedItem = findSavingsLinkedItem(allSections, section.id)
  }

  for (const item of section.items) {
    if (item.excluded) continue
    const sign = item.negative ? -1 : 1
    for (let m = 0; m < 12; m++) {
      const value = (item.savingsPercentage != null && linkedItem)
        ? (Number(linkedItem.monthlyValues[m]) || 0) * item.savingsPercentage / 100
        : Number(item.monthlyValues[m]) || 0
      monthlyTotals[m] += sign * value
    }
  }
  return monthlyTotals
}

export function computeAnnualTotal(monthlyValues) {
  return monthlyValues.reduce((sum, v) => sum + (Number(v) || 0), 0)
}

export function computeMonthlyAverage(annualTotal) {
  return annualTotal / 12
}

/**
 * Returns { incomeTotals, expenseTotals, remainingTotals }
 * where each is an Array[12] of monthly values.
 */
export function computeBudgetSummary(sections) {
  const incomeTotals = Array(12).fill(0)
  const expenseTotals = Array(12).fill(0)

  for (const section of sections) {
    if (section.type === 'income') {
      const totals = computeSectionTotals(section)
      for (let m = 0; m < 12; m++) incomeTotals[m] += totals[m]
    } else if (section.type === 'expense') {
      const totals = computeSectionTotals(section)
      for (let m = 0; m < 12; m++) expenseTotals[m] += totals[m]
    }
  }

  const remainingTotals = incomeTotals.map((inc, m) => inc - expenseTotals[m])
  return { incomeTotals, expenseTotals, remainingTotals }
}

/**
 * Returns an Array[12] of cumulative running balance values.
 * runningBalance[0] = remaining[0]
 * runningBalance[m] = runningBalance[m-1] + remaining[m]
 */
export function computeRunningBalance(sections) {
  const { remainingTotals } = computeBudgetSummary(sections)
  const running = Array(12).fill(0)
  running[0] = remainingTotals[0]
  for (let m = 1; m < 12; m++) {
    running[m] = running[m - 1] + remainingTotals[m]
  }
  return running
}
