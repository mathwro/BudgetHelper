/**
 * Generates a Google Sheets batchUpdate payload from the budget state.
 *
 * Sheet layout:
 *   Row 1: Header (blank, Jan, Feb, …, Dec, Total, Avg/month, Notes)
 *   Row 2+: Items and total rows per section, blank separator rows between sections
 *
 * Columns: A(0)=Label, B-M(1-12)=Jan-Dec, N(13)=Annual, O(14)=Avg, P(15)=Notes
 */

const MONTHS = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December']
const COL_LABEL = 0   // A
const COL_JAN = 1     // B
const COL_DEC = 12    // M
const COL_ANNUAL = 13 // N
const COL_AVG = 14    // O
const COL_NOTES = 15  // P
const COL_META = 16   // Q
const SECTION_MARKER_PREFIX = '__BH_SECTION__:'
const TOTAL_MARKER_PREFIX = '__BH_TOTAL__:'

function colLetter(colIndex) {
  // colIndex is 0-based
  let result = ''
  let n = colIndex + 1
  while (n > 0) {
    n--
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

function cellRef(row, col) {
  return `${colLetter(col)}${row}`
}


/**
 * Build the full row layout from the budget state.
 * Returns { rowLayout, incomeTotalRows, expenseTotalRows, savingsTotalRows, itemRowMap }
 *
 * Each entry in rowLayout:
 *   { type: 'header'|'section-header'|'item'|'total'|'separator'|'remaining', ... }
 *
 * itemRowMap: { itemId -> rowIndex } for all item rows
 */
export function buildRowLayout(budget) {
  const rowLayout = []
  let row = 1

  // Header row
  rowLayout.push({ type: 'header', rowIndex: row })
  row++

  const incomeTotalRows = []
  const expenseTotalRows = []
  const savingsTotalRows = []
  const itemRowMap = {}  // itemId -> rowIndex

  for (const section of budget.sections) {
    if (section.type === 'summary') {
      // summary section: add rollup rows + remaining/running balance
      rowLayout.push({
        type: 'expense-grand-total',
        rowIndex: row,
        section,
        color: section.color,
      })
      row++
      rowLayout.push({
        type: 'savings-grand-total',
        rowIndex: row,
        section,
        color: section.color,
      })
      row++
      rowLayout.push({
        type: 'remaining',
        rowIndex: row,
        section,
        color: section.color,
      })
      row++
      rowLayout.push({
        type: 'running-balance',
        rowIndex: row,
        section,
        remainingRow: row - 1,
        color: section.color,
      })
      row++
      rowLayout.push({ type: 'separator', rowIndex: row })
      row++
      continue
    }

    rowLayout.push({
      type: 'section-header',
      rowIndex: row,
      section,
      color: section.color,
    })
    row++

    // For savings sections: insert an auto-row before items if a linked expense item exists
    let autoRowIndex = null
    if (section.type === 'savings') {
      // Find the linked expense item
      let linkedItemId = null
      let linkedItemName = null
      for (const s of budget.sections) {
        if (s.type !== 'expense' && s.type !== 'income') continue
        for (const it of s.items) {
          if (it.savingsLink === section.id) {
            linkedItemId = it.id
            linkedItemName = it.name
            break
          }
        }
        if (linkedItemId) break
      }
      if (linkedItemId && itemRowMap[linkedItemId] != null) {
        autoRowIndex = row
        rowLayout.push({
          type: 'savings-auto',
          rowIndex: row,
          section,
          linkedItemRow: itemRowMap[linkedItemId],
          linkedItemName,
        })
        row++
      }
    }

    const itemStartRow = row
    const itemRowEntries = []

    for (const item of section.items) {
      itemRowMap[item.id] = row
      itemRowEntries.push({ rowIndex: row, item })
      rowLayout.push({
        type: 'item',
        rowIndex: row,
        item,
        section,
        color: null,
      })
      row++
    }

    const itemEndRow = row - 1

    if (section.showTotal && (section.items.length > 0 || autoRowIndex != null)) {
      const totalRow = row
      rowLayout.push({
        type: 'total',
        rowIndex: totalRow,
        section,
        itemStartRow,
        itemEndRow,
        itemRowEntries,
        autoRowIndex,
        color: null,
      })
      row++

      if (section.type === 'income') incomeTotalRows.push(totalRow)
      if (section.type === 'expense') expenseTotalRows.push(totalRow)
      if (section.type === 'savings') savingsTotalRows.push(totalRow)
      // savings sections: NOT added to expenseTotalRows
    } else if (section.showTotal && section.items.length === 0) {
      // Empty section still reserves a total row (value = 0)
      const totalRow = row
      rowLayout.push({
        type: 'total',
        rowIndex: totalRow,
        section,
        itemStartRow: row,
        itemEndRow: row - 1,
        itemRowEntries: [],
        autoRowIndex: null,
        color: null,
      })
      row++
      if (section.type === 'income') incomeTotalRows.push(totalRow)
      if (section.type === 'expense') expenseTotalRows.push(totalRow)
      if (section.type === 'savings') savingsTotalRows.push(totalRow)
    }

    // Blank separator between sections
    rowLayout.push({ type: 'separator', rowIndex: row })
    row++
  }

  return { rowLayout, incomeTotalRows, expenseTotalRows, savingsTotalRows, itemRowMap }
}

/**
 * Generates the full Sheets API payload.
 * Returns { valueRanges, formatRequests, sheetId }
 */
export function generateSheetsPayload(budget, sheetId = 0) {
  const { rowLayout, incomeTotalRows, expenseTotalRows, savingsTotalRows, itemRowMap } = buildRowLayout(budget)

  const allValues = []   // For values.batchUpdate
  const formatRequests = []  // For batchUpdate

  // ── Header row ──────────────────────────────────────────────────────────────
  const headerRow = rowLayout.find(r => r.type === 'header')
  if (headerRow) {
    const r = headerRow.rowIndex
    const headerValues = [
      ['', ...MONTHS, 'Total', 'Gns./måned', 'Noter', '']
    ]
    allValues.push({
      range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
      values: headerValues,
    })
  }

  // ── Data rows ────────────────────────────────────────────────────────────────
  for (const entry of rowLayout) {
    if (entry.type === 'item') {
      const r = entry.rowIndex
      const item = entry.item
      const rowData = [item.name]

      // Savings items with savingsPercentage: formula referencing the section's auto-row
      const autoEntry = (entry.section.type === 'savings' && item.savingsPercentage != null)
        ? rowLayout.find(e => e.type === 'savings-auto' && e.section.id === entry.section.id)
        : null

      for (let m = 0; m < 12; m++) {
        if (autoEntry) {
          rowData.push(`=${cellRef(autoEntry.rowIndex, COL_JAN + m)}*${item.savingsPercentage / 100}`)
        } else {
          rowData.push(Number(item.monthlyValues[m]) || 0)
        }
      }
      rowData.push(`=SUM(${cellRef(r, COL_JAN)}:${cellRef(r, COL_DEC)})`)
      rowData.push(`=${cellRef(r, COL_ANNUAL)}/12`)
      rowData.push(item.note || '')
      rowData.push('')

      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'section-header') {
      const r = entry.rowIndex
      const rowData = [entry.section.name]
      for (let col = COL_JAN; col <= COL_META; col++) {
        rowData.push('')
      }
      rowData[COL_META] = `${SECTION_MARKER_PREFIX}${entry.section.id}:${entry.section.type}`
      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'savings-auto') {
      // Auto-row for savings sections: mirrors the full linked expense item values
      const r = entry.rowIndex
      const linkedRow = entry.linkedItemRow
      const rowData = [`← ${entry.linkedItemName}`]

      for (let m = 0; m < 12; m++) {
        rowData.push(`=${cellRef(linkedRow, COL_JAN + m)}`)
      }
      rowData.push(`=SUM(${cellRef(r, COL_JAN)}:${cellRef(r, COL_DEC)})`)
      rowData.push(`=${cellRef(r, COL_ANNUAL)}/12`)
      rowData.push('')
      rowData.push('')

      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'total') {
      const r = entry.rowIndex
      const { itemStartRow, itemEndRow, itemRowEntries, autoRowIndex } = entry
      const rowData = [entry.section.totalLabel || `Total ${entry.section.name}`]

      const hasSpecial = itemRowEntries.some(e => e.item.excluded || e.item.negative)
      const hasItems = itemStartRow <= itemEndRow
      const hasAuto = autoRowIndex != null

      if (hasAuto && !hasItems) {
        // Only auto-row, no manual items
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          rowData.push(`=${colLetter(col)}${autoRowIndex}`)
        }
      } else if (hasAuto && hasItems && !hasSpecial) {
        // Auto-row + plain items range
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          rowData.push(`=${colLetter(col)}${autoRowIndex}+SUM(${colLetter(col)}${itemStartRow}:${colLetter(col)}${itemEndRow})`)
        }
      } else if (hasAuto && hasItems && hasSpecial) {
        // Auto-row + explicit item references
        const included = itemRowEntries.filter(e => !e.item.excluded)
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          const parts = [`${colLetter(col)}${autoRowIndex}`, ...included.map(e =>
            e.item.negative ? `-${colLetter(col)}${e.rowIndex}` : `${colLetter(col)}${e.rowIndex}`
          )]
          rowData.push(`=${parts.join('+')}`)
        }
      } else if (!hasAuto && hasItems && !hasSpecial) {
        // Simple case: plain SUM range
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          rowData.push(`=SUM(${colLetter(col)}${itemStartRow}:${colLetter(col)}${itemEndRow})`)
        }
      } else if (!hasAuto && hasItems && hasSpecial) {
        // Explicit formula respecting excluded/negative
        const included = itemRowEntries.filter(e => !e.item.excluded)
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          if (included.length === 0) {
            rowData.push(0)
          } else {
            const parts = included.map(e =>
              e.item.negative ? `-${colLetter(col)}${e.rowIndex}` : `${colLetter(col)}${e.rowIndex}`
            )
            rowData.push(`=${parts.join('+')}`)
          }
        }
      } else {
        // Empty section
        for (let col = COL_JAN; col <= COL_DEC; col++) {
          rowData.push(0)
        }
      }

      rowData.push(`=SUM(${cellRef(r, COL_JAN)}:${cellRef(r, COL_DEC)})`)
      rowData.push(`=${cellRef(r, COL_ANNUAL)}/12`)
      rowData.push('')
      rowData.push(`${TOTAL_MARKER_PREFIX}${entry.section.id}`)

      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'remaining') {
      const r = entry.rowIndex
      const rowData = ['Tilbage']

      for (let col = COL_JAN; col <= COL_DEC; col++) {
        const colL = colLetter(col)
        if (incomeTotalRows.length > 0 || expenseTotalRows.length > 0) {
          const incParts = incomeTotalRows.length > 0
            ? incomeTotalRows.map(tr => `${colL}${tr}`).join('+')
            : '0'
          const expParts = expenseTotalRows.length > 0
            ? expenseTotalRows.map(tr => `${colL}${tr}`).join('+')
            : '0'
          rowData.push(`=(${incParts})-(${expParts})`)
        } else {
          rowData.push(0)
        }
      }

      rowData.push(`=SUM(${cellRef(r, COL_JAN)}:${cellRef(r, COL_DEC)})`)
      rowData.push(`=${cellRef(r, COL_ANNUAL)}/12`)
      rowData.push('')
      rowData.push('')

      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'expense-grand-total' || entry.type === 'savings-grand-total') {
      const r = entry.rowIndex
      const rowData = [entry.type === 'expense-grand-total' ? 'Total expenses' : 'Total savings']
      const sourceRows = entry.type === 'expense-grand-total' ? expenseTotalRows : savingsTotalRows
      for (let col = COL_JAN; col <= COL_DEC; col++) {
        const colL = colLetter(col)
        rowData.push(sourceRows.length > 0
          ? `=${sourceRows.map(tr => `${colL}${tr}`).join('+')}`
          : 0)
      }
      rowData.push(`=SUM(${cellRef(r, COL_JAN)}:${cellRef(r, COL_DEC)})`)
      rowData.push(`=${cellRef(r, COL_ANNUAL)}/12`)
      rowData.push('')
      rowData.push('')
      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }

    if (entry.type === 'running-balance') {
      const r = entry.rowIndex
      const remainingRow = entry.remainingRow
      const rowData = ['Løbende saldo']

      // Col B (Jan): just reference the remaining row's Jan value
      rowData.push(`=${cellRef(remainingRow, COL_JAN)}`)
      // Col C–M (Feb–Dec): previous running balance + current remaining
      for (let col = COL_JAN + 1; col <= COL_DEC; col++) {
        rowData.push(`=${cellRef(r, col - 1)}+${cellRef(remainingRow, col)}`)
      }
      // Annual/Avg columns left blank — cumulative total is the last month value
      rowData.push('')
      rowData.push('')
      rowData.push('')
      rowData.push('')

      allValues.push({
        range: `${cellRef(r, COL_LABEL)}:${cellRef(r, COL_META)}`,
        values: [rowData],
      })
    }
  }

  // ── Formatting ───────────────────────────────────────────────────────────────
  const totalRows = rowLayout.filter(r =>
    r.type === 'total' ||
    r.type === 'section-header' ||
    r.type === 'expense-grand-total' ||
    r.type === 'savings-grand-total' ||
    r.type === 'remaining' ||
    r.type === 'running-balance' ||
    r.type === 'header'
  )
  const lastRow = rowLayout[rowLayout.length - 1]?.rowIndex || 50

  // Reset stale formatting from prior syncs (especially old background colors)
  formatRequests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: lastRow,
        startColumnIndex: COL_LABEL,
        endColumnIndex: COL_META + 1,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 1, green: 1, blue: 1 },
          textFormat: { bold: false },
        },
      },
      fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold',
    },
  })

  // Bold on total rows and header
  for (const entry of totalRows) {
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: entry.rowIndex - 1,
          endRowIndex: entry.rowIndex,
          startColumnIndex: COL_LABEL,
          endColumnIndex: COL_META + 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    })
  }

  // Background colors per section
  for (const entry of rowLayout) {
    if (entry.type === 'separator' || entry.type === 'header' || !entry.color) continue
    const colorHex = entry.color
    const rgb = hexToRgb(colorHex)

    formatRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: entry.rowIndex - 1,
          endRowIndex: entry.rowIndex,
          startColumnIndex: COL_LABEL,
          endColumnIndex: COL_META + 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: {
              red: rgb.r / 255,
              green: rgb.g / 255,
              blue: rgb.b / 255,
            },
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    })
  }

  // Number format on numeric columns (B-O)
  formatRequests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 1, // row 2
        endRowIndex: lastRow,
        startColumnIndex: COL_JAN,
        endColumnIndex: COL_AVG + 1,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern: '#,##0.00' },
        },
      },
      fields: 'userEnteredFormat.numberFormat',
    },
  })

  // Column widths
  const colWidths = [
    { col: 0, width: 220 },  // A: Label
    ...Array.from({ length: 12 }, (_, i) => ({ col: i + 1, width: 90 })), // B-M
    { col: 13, width: 110 }, // N: Annual
    { col: 14, width: 110 }, // O: Avg
    { col: 15, width: 200 }, // P: Notes
    { col: 16, width: 40 },  // Q: Meta
  ]

  for (const { col, width } of colWidths) {
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: col,
          endIndex: col + 1,
        },
        properties: { pixelSize: width },
        fields: 'pixelSize',
      },
    })
  }

  // Hide metadata marker column from users
  formatRequests.push({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: COL_META,
        endIndex: COL_META + 1,
      },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    },
  })

  // Freeze header row
  formatRequests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 },
      },
      fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
    },
  })

  return { valueRanges: allValues, formatRequests }
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  }
}
