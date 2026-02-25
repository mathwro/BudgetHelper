import React, { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import BudgetItem from './BudgetItem.jsx'
import SectionChart from './SectionChart.jsx'
import { computeSectionTotals, computeAnnualTotal, computeMonthlyAverage, findSavingsLinkedItem } from '../utils/budgetCalculator.js'

function fmt(n) {
  if (n === 0) return ''
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export default function BudgetSection({ section, dispatch, onEditItem, sectionChartsCloseKey, allSections }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [dragOver, setDragOver] = useState(null)
  const chartRowRef = useRef(null)

  useEffect(() => {
    setShowChart(false)
  }, [sectionChartsCloseKey])

  const totals = computeSectionTotals(section, allSections)

  // For savings sections: find the linked expense item (if any)
  const savingsLinkedItem = section.type === 'savings' && allSections
    ? findSavingsLinkedItem(allSections, section.id)
    : null

  // Find which savings section name an expense item links to
  const savingsSectionName = (itemObj) => {
    if (!itemObj.savingsLink || !allSections) return null
    const s = allSections.find(sec => sec.id === itemObj.savingsLink)
    return s ? s.name : null
  }
  const annualTotal = computeAnnualTotal(totals)
  const avg = computeMonthlyAverage(annualTotal)

  // Color accent on label cell only — works regardless of stored color value
  const accentBar = { boxShadow: `inset 4px 0 0 ${section.color || '#c8a96e'}` }

  function handleAddItem() {
    const newId = uuidv4()
    dispatch({ type: 'ADD_ITEM', sectionId: section.id, itemId: newId })
    onEditItem(section.id, { id: newId }, true)
  }

  function handleDragStart(e, index) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ sectionId: section.id, index }))
  }

  function handleDragOver(e, index) {
    e.preventDefault()
    setDragOver(index)
  }

  function handleDrop(e, toIndex) {
    e.preventDefault()
    const dragSource = JSON.parse(e.dataTransfer.getData('text/plain'))
    if (dragSource.sectionId !== section.id) {
      setDragOver(null)
      return
    }
    const fromIndex = dragSource.index
    if (fromIndex !== toIndex) {
      dispatch({ type: 'MOVE_ITEM', sectionId: section.id, fromIndex, toIndex })
    }
    setDragOver(null)
  }

  function handleDragEnd() {
    setDragOver(null)
  }

  return (
    <>
      {/* Section header row */}
      <tr className="section-header-row">
        <td
          className="col-label section-name"
          colSpan={17}
          style={accentBar}
          onClick={() => setCollapsed(c => !c)}
        >
          <div className="section-header-name">
            <span className={`collapse-icon${collapsed ? ' closed' : ''}`}>▼</span>
            <span className="section-color-dot" style={{ background: section.color }} />
            <strong>{section.name}</strong>
            {section.type === 'savings' && savingsLinkedItem && (
              <span className="savings-linked-badge" title={`Funded by: ${savingsLinkedItem.name}`}>
                ← {savingsLinkedItem.name}
              </span>
            )}
          </div>
          {section.type !== 'summary' && (
            <button
              className={`btn-icon section-chart-toggle${showChart ? ' active' : ''}`}
              onClick={e => {
                e.stopPropagation()
                setShowChart(v => {
                  if (!v) {
                    setTimeout(() => {
                      chartRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }, 260)
                  }
                  return !v
                })
              }}
              title="Toggle chart"
            >▤</button>
          )}
        </td>
      </tr>

      {/* Auto-row for savings sections with a linked expense item — mirrors full linked expense values */}
      {section.type === 'savings' && savingsLinkedItem && (() => {
        const autoValues = savingsLinkedItem.monthlyValues.map(v => Number(v) || 0)
        const autoAnnual = autoValues.reduce((s, v) => s + v, 0)
        return (
          <tr className={`savings-auto-row${collapsed ? ' row-collapsed' : ''}`}>
            <td className="col-label" style={accentBar}>
              <div className="cell-wrap">
                <span className="savings-auto-label">← {savingsLinkedItem.name}</span>
              </div>
            </td>
            {autoValues.map((v, i) => (
              <td key={i} className="col-month number savings-auto-cell">
                <div className="cell-wrap"><span>{fmt(v)}</span></div>
              </td>
            ))}
            <td className="col-annual number savings-auto-cell">
              <div className="cell-wrap">{fmt(autoAnnual)}</div>
            </td>
            <td className="col-avg number savings-auto-cell">
              <div className="cell-wrap">{fmt(autoAnnual / 12)}</div>
            </td>
            <td className="col-notes"></td>
            <td className="col-actions"></td>
          </tr>
        )
      })()}

      {/* Item rows — always in DOM so height can transition */}
      {section.items.map((item, index) => {
        // For savings items with savingsPercentage: compute display values from linked expense
        const displayValues = (section.type === 'savings' && item.savingsPercentage != null && savingsLinkedItem)
          ? savingsLinkedItem.monthlyValues.map(v => (Number(v) || 0) * item.savingsPercentage / 100)
          : null
        return (
          <BudgetItem
            key={item.id}
            item={item}
            section={section}
            dispatch={dispatch}
            onEdit={() => onEditItem(section.id, item)}
            dragging={dragOver === index}
            isCollapsed={collapsed}
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={e => handleDragOver(e, index)}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            savingsSectionName={savingsSectionName(item)}
            displayValues={displayValues}
            readOnly={displayValues != null}
          />
        )
      })}

      {/* Add item row — always in DOM */}
      {section.type !== 'summary' && (
        <tr className={`add-item-row${collapsed ? ' row-collapsed' : ''}`}>
          <td colSpan={17}>
            <div className="cell-wrap">
              <button className="btn-add-item" onClick={handleAddItem}>
                + Add item
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* Total row */}
      {section.showTotal && (section.items.length > 0 || savingsLinkedItem != null) && (
        <tr className="total-row">
          <td className="col-label bold" style={accentBar}>
            {section.totalLabel || `Total ${section.name}`}
          </td>
          {totals.map((v, i) => (
            <td key={i} className="col-month number">{fmt(v)}</td>
          ))}
          <td className="col-annual number bold">{fmt(annualTotal)}</td>
          <td className="col-avg number">{fmt(avg)}</td>
          <td className="col-notes"></td>
          <td className="col-actions"></td>
        </tr>
      )}

      {/* Inline chart row — always in DOM so height can transition */}
      {section.items.length > 0 && (
        <tr className="section-chart-row" ref={chartRowRef}>
          <td colSpan={17} style={{ padding: 0 }}>
            <div className={`section-chart-collapse${showChart ? '' : ' closed'}`}>
              <SectionChart section={section} totals={totals} allSections={allSections} />
            </div>
          </td>
        </tr>
      )}

      {/* Spacer */}
      <tr className="section-spacer"><td colSpan={17}></td></tr>
    </>
  )
}
