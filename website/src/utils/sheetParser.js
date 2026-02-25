/**
 * Parses Google Sheets data back into the budget model.
 *
 * Strategy: use the existing budget + buildRowLayout() to know exactly
 * which sheet row corresponds to each item. Then read values from those
 * rows to produce an updated budget.
 *
 * This avoids fragile heuristic parsing — we leverage the same layout
 * logic used to write the sheet.
 */

import { buildRowLayout } from './formulaGenerator.js'

const COL_LABEL = 0   // A
const COL_JAN = 1     // B
// COL_DEC = 12 (M) — not used directly, months iterated via COL_JAN + m
const COL_NOTES = 15  // P

/**
 * Parse sheet data back into budget items using the existing budget as a template.
 *
 * @param {Object} budget - The current budget state (used for structure/IDs)
 * @param {Array[]} sheetRows - 2D array from Sheets API (row 0 = sheet row 1)
 * @returns {{ updatedBudget: Object, changes: Array }} - Updated budget and list of changes detected
 */
export function parseSheetData(budget, sheetRows) {
  const { itemRowMap } = buildRowLayout(budget)
  const changes = []

  // Deep clone the budget so we don't mutate the original
  const updated = JSON.parse(JSON.stringify(budget))

  for (const section of updated.sections) {
    if (section.type === 'summary') continue

    for (const item of section.items) {
      const rowIndex = itemRowMap[item.id]
      if (rowIndex == null) continue

      // Sheet rows are 1-based, array is 0-based
      const sheetRow = sheetRows[rowIndex - 1]
      if (!sheetRow) continue

      // Skip savings items with savingsPercentage — they are formula-computed
      if (item.savingsPercentage != null && section.type === 'savings') continue

      // Read name from col A
      const sheetName = String(sheetRow[COL_LABEL] ?? '').trim()
      if (sheetName && sheetName !== item.name) {
        changes.push({
          type: 'name',
          sectionName: section.name,
          itemId: item.id,
          field: 'name',
          oldValue: item.name,
          newValue: sheetName,
        })
        item.name = sheetName
      }

      // Read monthly values from cols B–M
      for (let m = 0; m < 12; m++) {
        const sheetVal = Number(sheetRow[COL_JAN + m]) || 0
        const localVal = Number(item.monthlyValues[m]) || 0
        if (Math.abs(sheetVal - localVal) > 0.001) {
          changes.push({
            type: 'value',
            sectionName: section.name,
            itemId: item.id,
            itemName: item.name,
            field: `month_${m}`,
            monthIndex: m,
            oldValue: localVal,
            newValue: sheetVal,
          })
        }
        item.monthlyValues[m] = sheetVal
      }

      // Read note from col P
      const sheetNote = String(sheetRow[COL_NOTES] ?? '').trim()
      const localNote = (item.note || '').trim()
      if (sheetNote !== localNote) {
        changes.push({
          type: 'note',
          sectionName: section.name,
          itemId: item.id,
          itemName: item.name,
          field: 'note',
          oldValue: localNote,
          newValue: sheetNote,
        })
        item.note = sheetNote
      }
    }
  }

  return { updatedBudget: updated, changes }
}

/**
 * Summarize changes for display in the UI.
 *
 * @param {Array} changes - Array of change objects from parseSheetData
 * @returns {{ totalChanges: number, summary: string, bySection: Object }}
 */
export function summarizeChanges(changes) {
  const bySection = {}

  for (const change of changes) {
    if (!bySection[change.sectionName]) {
      bySection[change.sectionName] = []
    }
    bySection[change.sectionName].push(change)
  }

  const valueChanges = changes.filter(c => c.type === 'value').length
  const nameChanges = changes.filter(c => c.type === 'name').length
  const noteChanges = changes.filter(c => c.type === 'note').length

  const parts = []
  if (valueChanges > 0) parts.push(`${valueChanges} value${valueChanges > 1 ? 's' : ''}`)
  if (nameChanges > 0) parts.push(`${nameChanges} name${nameChanges > 1 ? 's' : ''}`)
  if (noteChanges > 0) parts.push(`${noteChanges} note${noteChanges > 1 ? 's' : ''}`)

  const summary = parts.length > 0
    ? `${parts.join(', ')} changed`
    : 'No changes detected'

  return {
    totalChanges: changes.length,
    summary,
    bySection,
  }
}
