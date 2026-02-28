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

import { v4 as uuidv4 } from 'uuid'

const COL_LABEL = 0   // A
const COL_JAN = 1     // B
// COL_DEC = 12 (M) — not used directly, months iterated via COL_JAN + m
const COL_NOTES = 15  // P
const COL_META = 16   // Q
const SECTION_MARKER_PREFIX = '__BH_SECTION__:'
const TOTAL_MARKER_PREFIX = '__BH_TOTAL__:'

function rowLabel(row) {
  return String(row?.[COL_LABEL] ?? '').trim()
}

function hasMonthData(row) {
  for (let m = 0; m < 12; m++) {
    const v = row?.[COL_JAN + m]
    if (typeof v === 'number') return true
    if (typeof v === 'string' && v.trim() !== '') return true
  }
  return false
}

function matchesAnyLabel(row, labels) {
  const label = rowLabel(row).toLowerCase()
  return labels.some(l => label === l.toLowerCase())
}

function sectionMarker(sectionId) {
  return `${SECTION_MARKER_PREFIX}${sectionId}`
}

function parseSectionMarker(note) {
  const raw = String(note ?? '').trim()
  if (!raw.startsWith(SECTION_MARKER_PREFIX)) return null
  const payload = raw.slice(SECTION_MARKER_PREFIX.length)
  if (!payload) return null
  const [id, type] = payload.split(':')
  return { id: id || null, type: type || null }
}

function parseTotalMarker(note) {
  const raw = String(note ?? '').trim()
  if (!raw.startsWith(TOTAL_MARKER_PREFIX)) return null
  const payload = raw.slice(TOTAL_MARKER_PREFIX.length).trim()
  return payload || null
}

function getSectionMarkerMeta(row) {
  return parseSectionMarker(row?.[COL_META]) || parseSectionMarker(row?.[COL_NOTES])
}

function getTotalMarkerId(row) {
  return parseTotalMarker(row?.[COL_META]) || parseTotalMarker(row?.[COL_NOTES])
}

function hasSectionMarker(row) {
  return !!getSectionMarkerMeta(row)
}

function normalizeHexColor(color, fallback = '#2560a0') {
  const raw = String(color || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw
  return fallback
}

function buildLayoutCandidate(budget, { includeSectionHeaders, includeGrandTotals }) {
  const itemRowMap = {}
  let row = 1 // header row
  row++

  for (const section of budget.sections) {
    if (section.type === 'summary') {
      if (includeGrandTotals) row += 2
      row += 2 // remaining + running balance
      row++ // separator
      continue
    }

    if (includeSectionHeaders) row++

    let autoRowIndex = null
    if (section.type === 'savings') {
      let linkedItemId = null
      for (const s of budget.sections) {
        if (s.type !== 'expense' && s.type !== 'income') continue
        for (const it of s.items) {
          if (it.savingsLink === section.id) {
            linkedItemId = it.id
            break
          }
        }
        if (linkedItemId) break
      }
      if (linkedItemId && itemRowMap[linkedItemId] != null) {
        autoRowIndex = row
        row++
      }
    }

    const itemStart = row
    for (const item of section.items) {
      itemRowMap[item.id] = row
      row++
    }
    const itemEnd = row - 1

    if (section.showTotal && (section.items.length > 0 || autoRowIndex != null)) row++
    else if (section.showTotal && itemStart > itemEnd) row++

    row++ // separator
  }

  return { itemRowMap, includeSectionHeaders, includeGrandTotals }
}

function candidateMatchesSheet(candidate, sheetRows) {
  const forbiddenLabels = ['Tilbage', 'Remaining', 'Løbende saldo', 'Running Balance', 'Total expenses', 'Total savings']
  for (const rowIndex of Object.values(candidate.itemRowMap)) {
    const row = sheetRows[rowIndex - 1]
    if (!row) {
      return false
    }
    const label = rowLabel(row)
    if (!label) return false
    if (hasSectionMarker(row)) return false
    if (matchesAnyLabel(row, forbiddenLabels)) return false
    if (/^←/.test(label)) return false
  }
  return true
}

function pickExactItemRowMap(budget, sheetRows) {
  if (!sheetRows || sheetRows.length === 0) {
    return buildLayoutCandidate(budget, { includeSectionHeaders: true, includeGrandTotals: true }).itemRowMap
  }

  const candidates = [
    buildLayoutCandidate(budget, { includeSectionHeaders: true, includeGrandTotals: true }),
    buildLayoutCandidate(budget, { includeSectionHeaders: false, includeGrandTotals: true }),
    buildLayoutCandidate(budget, { includeSectionHeaders: true, includeGrandTotals: false }),
    buildLayoutCandidate(budget, { includeSectionHeaders: false, includeGrandTotals: false }),
  ]

  for (const candidate of candidates) {
    if (candidateMatchesSheet(candidate, sheetRows)) {
      return candidate.itemRowMap
    }
  }

  return null
}

function buildNameMatchedRowMap(budget, sheetRows) {
  const forbiddenLabels = ['Tilbage', 'Remaining', 'Løbende saldo', 'Running Balance', 'Total expenses', 'Total savings']
  const usedRows = new Set()
  const map = {}

  function isRowUsable(row) {
    const label = rowLabel(row)
    if (!label) return false
    if (hasSectionMarker(row)) return false
    if (matchesAnyLabel(row, forbiddenLabels)) return false
    if (/^←/.test(label)) return false
    return true
  }

  for (const section of budget.sections) {
    if (section.type === 'summary') continue
    for (const item of section.items) {
      if (item.savingsPercentage != null && section.type === 'savings') continue
      const rowIdx = sheetRows.findIndex((row, idx) =>
        !usedRows.has(idx) &&
        rowLabel(row) === item.name &&
        isRowUsable(row)
      )
      if (rowIdx >= 0) {
        map[item.id] = rowIdx + 1
        usedRows.add(rowIdx)
      }
    }
  }

  return map
}

function buildMarkerItemRowMap(budget, sheetRows) {
  const markers = sheetRows
    .map((row, idx) => {
      const markerMeta = getSectionMarkerMeta(row)
      if (!markerMeta) return null
      return { idx, row, markerMeta }
    })
    .filter(Boolean)
    .map(x => ({
      rowIndex: x.idx + 1,
      name: rowLabel(x.row),
      markerId: x.markerMeta.id,
    }))

  if (markers.length === 0) return null

  const usedMarkerRows = new Set()
  const map = {}
  const boundaryLabels = ['Total expenses', 'Total savings', 'Tilbage', 'Remaining', 'Løbende saldo', 'Running Balance']

  function findMarker(section) {
    const byId = markers.find(m => !usedMarkerRows.has(m.rowIndex) && m.markerId === section.id)
    if (byId) return byId
    const byName = markers.find(m => !usedMarkerRows.has(m.rowIndex) && m.name === section.name)
    if (byName) return byName
    return markers.find(m => !usedMarkerRows.has(m.rowIndex)) || null
  }

  for (const section of budget.sections) {
    if (section.type === 'summary') continue
    const marker = findMarker(section)
    if (!marker) continue
    usedMarkerRows.add(marker.rowIndex)

    const nextMarker = markers.find(m => m.rowIndex > marker.rowIndex)
    const sectionEndRow = nextMarker ? nextMarker.rowIndex : sheetRows.length + 1
    let rowIndex = marker.rowIndex + 1

    if (section.type === 'savings') {
      const autoRow = sheetRows[rowIndex - 1]
      if (/^←/.test(rowLabel(autoRow))) rowIndex++
    }

    for (const item of section.items) {
      while (rowIndex < sectionEndRow) {
        const row = sheetRows[rowIndex - 1]
        const label = rowLabel(row)
        if (!label && !hasMonthData(row)) {
          rowIndex++
          continue
        }
        if (/^←/.test(label)) {
          rowIndex++
          continue
        }
        if (hasSectionMarker(row)) {
          rowIndex = sectionEndRow
          break
        }
        if (matchesAnyLabel(row, boundaryLabels) || /^Total\b/i.test(label)) {
          rowIndex = sectionEndRow
          break
        }
        map[item.id] = rowIndex
        rowIndex++
        break
      }
    }
  }

  return Object.keys(map).length > 0 ? map : null
}

function buildBudgetFromMarkers(budget, sheetRows, rowColors = null) {
  const markerRows = sheetRows
    .map((row, idx) => {
      const meta = getSectionMarkerMeta(row)
      if (!meta) return null
      return {
        rowIndex: idx + 1,
        name: rowLabel(row),
        id: meta.id,
        type: meta.type,
      }
    })
    .filter(Boolean)

  if (markerRows.length === 0) return null

  const boundaryLabels = ['Total expenses', 'Total savings', 'Tilbage', 'Remaining', 'Løbende saldo', 'Running Balance']
  const existingSections = budget.sections.filter(s => s.type !== 'summary')
  const existingById = new Map(existingSections.map(s => [s.id, s]))
  const existingByName = new Map(existingSections.map(s => [s.name, s]))
  const parsedSections = []
  const savingsLinkHints = []

  for (let i = 0; i < markerRows.length; i++) {
    const marker = markerRows[i]
    const nextMarkerRow = markerRows[i + 1]?.rowIndex ?? (sheetRows.length + 1)
    const existingSection = (marker.id && existingById.get(marker.id)) || existingByName.get(marker.name)

    let cursor = marker.rowIndex + 1
    let sawAutoRow = false
    let autoLinkedItemName = null
    let totalLabel = existingSection?.totalLabel || `Total ${marker.name}`
    const itemRows = []

    while (cursor < nextMarkerRow) {
      const row = sheetRows[cursor - 1]
      const label = rowLabel(row)
      const note = String(row?.[COL_NOTES] ?? '').trim()
      const totalMarkerSectionId = getTotalMarkerId(row)

      if (!label && !note && !hasMonthData(row)) {
        cursor++
        continue
      }
      if (/^←/.test(label)) {
        sawAutoRow = true
        autoLinkedItemName = label.replace(/^←\s*/, '').trim() || null
        cursor++
        continue
      }
      if (matchesAnyLabel(row, boundaryLabels)) break
      if (hasSectionMarker(row)) break
      if (totalMarkerSectionId && (!marker.id || totalMarkerSectionId === marker.id)) {
        totalLabel = label || totalLabel
        break
      }
      const nextRow = cursor + 1 < nextMarkerRow ? sheetRows[cursor] : null
      const nextLabel = rowLabel(nextRow)
      const nextNote = String(nextRow?.[COL_NOTES] ?? '').trim()
      const nextIsBlank = !nextLabel && !nextNote && !hasMonthData(nextRow)
      const nextIsBoundary = !nextRow || hasSectionMarker(nextRow) || matchesAnyLabel(nextRow, boundaryLabels)
      if (/^(Total|I alt)\b/i.test(label) && (nextIsBlank || nextIsBoundary)) {
        totalLabel = label
        break
      }

      itemRows.push(row)
      cursor++
    }

    const existingItems = existingSection?.items || []
    const usedExistingItemIds = new Set()
    const items = itemRows.map((row, idx) => {
      const name = rowLabel(row)
      const existingItem = existingItems.find(it => it.name === name && !usedExistingItemIds.has(it.id))
      if (existingItem) usedExistingItemIds.add(existingItem.id)
      const note = String(row?.[COL_NOTES] ?? '').trim()
      return {
        id: existingItem?.id ?? uuidv4(),
        name,
        color: existingItem?.color ?? null,
        note,
        excluded: existingItem?.excluded ?? false,
        negative: existingItem?.negative ?? false,
        savingsLink: existingItem?.savingsLink ?? null,
        savingsPercentage: existingItem?.savingsPercentage ?? null,
        monthlyValues: Array.from({ length: 12 }, (_, m) => Number(row?.[COL_JAN + m]) || 0),
      }
    })

    let sectionType = marker.type || existingSection?.type || null
    if (!sectionType) {
      if (sawAutoRow || /savings|opsparing/i.test(marker.name)) sectionType = 'savings'
      else if (/income|indkomst/i.test(marker.name) || /income|indkomst/i.test(totalLabel)) sectionType = 'income'
      else sectionType = 'expense'
    }

    const parsedSection = {
      id: marker.id || existingSection?.id || uuidv4(),
      name: marker.name || existingSection?.name || 'Section',
      type: sectionType,
      color: normalizeHexColor(rowColors?.[marker.rowIndex], existingSection?.color || '#2560a0'),
      showTotal: true,
      totalLabel,
      items,
    }
    parsedSections.push(parsedSection)
    if (sectionType === 'savings' && autoLinkedItemName) {
      savingsLinkHints.push({ savingsSectionId: parsedSection.id, linkedItemName: autoLinkedItemName })
    }
  }

  for (const hint of savingsLinkHints) {
    for (const section of parsedSections) {
      if (section.type !== 'income' && section.type !== 'expense') continue
      for (const item of section.items) {
        if (item.name === hint.linkedItemName) {
          item.savingsLink = hint.savingsSectionId
        }
      }
    }
  }

  const summarySection = budget.sections.find(s => s.type === 'summary') || {
    id: uuidv4(),
    name: 'Summary',
    type: 'summary',
    color: '#0a1828',
    showTotal: false,
    totalLabel: '',
    items: [],
  }

  return { ...budget, sections: [...parsedSections, summarySection] }
}

/**
 * Parse sheet data back into budget items using the existing budget as a template.
 *
 * @param {Object} budget - The current budget state (used for structure/IDs)
 * @param {Array[]} sheetRows - 2D array from Sheets API (row 0 = sheet row 1)
 * @returns {{ updatedBudget: Object, changes: Array }} - Updated budget and list of changes detected
 */
export function parseSheetData(budget, sheetRows, rowColors = null) {
  const rebuiltBudget = buildBudgetFromMarkers(budget, sheetRows, rowColors)
  if (rebuiltBudget) {
    const changed = JSON.stringify(rebuiltBudget.sections) !== JSON.stringify(budget.sections)
    const changes = changed
      ? [{
          type: 'name',
          sectionName: 'Sheet structure',
          itemId: 'structure',
          oldValue: 'Local layout',
          newValue: 'Rebuilt from sheet markers',
        }]
      : []
    return { updatedBudget: rebuiltBudget, changes }
  }

  const markerMap = buildMarkerItemRowMap(budget, sheetRows)
  const exactMap = pickExactItemRowMap(budget, sheetRows)
  const itemRowMap = markerMap ?? exactMap ?? buildNameMatchedRowMap(budget, sheetRows)
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
