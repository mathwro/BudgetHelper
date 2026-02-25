import React from 'react'
import BudgetSection from './BudgetSection.jsx'
import { computeBudgetSummary, computeAnnualTotal, computeMonthlyAverage, computeRunningBalance } from '../utils/budgetCalculator.js'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n) {
  if (n === 0) return ''
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export default function BudgetTable({ budget, dispatch, onEditItem, sectionChartsCloseKey, allSections }) {
  const { remainingTotals } = computeBudgetSummary(budget.sections)
  const runningBalance = computeRunningBalance(budget.sections)
  const summarySection = budget.sections.find(s => s.type === 'summary')
  const remainingAnnual = computeAnnualTotal(remainingTotals)
  const remainingAccent = { boxShadow: `inset 4px 0 0 ${summarySection?.color || '#c8a96e'}` }

  return (
    <div className="table-scroll-wrapper">
      <table className="budget-table">
        <thead>
          <tr>
            <th className="col-label">Category</th>
            {MONTHS_SHORT.map(m => <th key={m} className="col-month">{m}</th>)}
            <th className="col-annual">Total</th>
            <th className="col-avg">Avg/mo.</th>
            <th className="col-notes">Notes</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {budget.sections.map(section => {
            if (section.type === 'summary') return null
            return (
              <BudgetSection
                key={section.id}
                section={section}
                dispatch={dispatch}
                onEditItem={onEditItem}
                sectionChartsCloseKey={sectionChartsCloseKey}
                allSections={allSections}
              />
            )
          })}

          {/* Remaining row */}
          {summarySection && (
            <>
              <tr className="section-spacer"><td colSpan={17}></td></tr>
              <tr className="total-row remaining-row">
                <td className="col-label bold" style={remainingAccent}>Remaining</td>
                {remainingTotals.map((v, i) => (
                  <td key={i} className={`col-month number ${v < 0 ? 'negative' : ''}`}>{fmt(v)}</td>
                ))}
                <td className={`col-annual number bold ${remainingAnnual < 0 ? 'negative' : ''}`}>
                  {fmt(remainingAnnual)}
                </td>
                <td className={`col-avg number ${computeMonthlyAverage(remainingAnnual) < 0 ? 'negative' : ''}`}>
                  {fmt(computeMonthlyAverage(remainingAnnual))}
                </td>
                <td className="col-notes"></td>
                <td className="col-actions"></td>
              </tr>
              <tr className="total-row running-balance-row">
                <td className="col-label bold" style={remainingAccent}>Running Balance</td>
                {runningBalance.map((v, i) => (
                  <td key={i} className={`col-month number ${v < 0 ? 'negative' : ''}`}>{fmt(v)}</td>
                ))}
                <td className="col-annual number bold"></td>
                <td className="col-avg number"></td>
                <td className="col-notes"></td>
                <td className="col-actions"></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
