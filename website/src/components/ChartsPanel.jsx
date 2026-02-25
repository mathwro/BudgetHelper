import React, { useRef, useCallback, useState } from 'react'
import {
  AreaChart, Area, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  computeBudgetSummary,
  computeSectionTotals,
  computeAnnualTotal,
} from '../utils/budgetCalculator.js'

import { toChartColor, fmt } from '../utils/chartUtils.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#13151a',
      border: '1px solid #232428',
      borderRadius: 6,
      padding: '0.55rem 0.8rem',
      fontSize: '0.78rem',
      fontFamily: 'var(--font-mono)',
      color: '#e2ddd5',
      lineHeight: 1.7,
    }}>
      <div style={{ color: '#6b6560', marginBottom: '0.25rem', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div style={{
      background: '#13151a',
      border: '1px solid #232428',
      borderRadius: 6,
      padding: '0.55rem 0.8rem',
      fontSize: '0.78rem',
      fontFamily: 'var(--font-mono)',
      color: '#e2ddd5',
    }}>
      <div style={{ color: entry.payload.fill, fontWeight: 600 }}>{entry.name}</div>
      <div>{fmt(entry.value)}</div>
      <div style={{ color: '#6b6560' }}>{entry.payload.percent}%</div>
    </div>
  )
}

function useTooltipStyle() {
  const blockRef = useRef(null)
  const timerRef = useRef(null)
  const setTransition = useCallback((value) => {
    const wrapper = blockRef.current?.querySelector('.recharts-tooltip-wrapper')
    if (wrapper) wrapper.style.transition = value
  }, [])
  const onEnter = useCallback(() => {
    setTransition('none')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTransition('transform 60ms ease'), 100)
  }, [setTransition])
  const onLeave = useCallback(() => {
    clearTimeout(timerRef.current)
    setTransition('none')
  }, [setTransition])
  return { blockRef, onEnter, onLeave }
}

function PieSection({ pieData }) {
  const chart = useTooltipStyle()
  const [tooltipPos, setTooltipPos] = useState(null)

  const onMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const onMouseLeave = useCallback(() => {
    chart.onLeave()
    setTooltipPos(null)
  }, [chart])

  return (
    <div
      className="chart-block"
      ref={chart.blockRef}
      onMouseEnter={chart.onEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <div className="chart-title">Expense Breakdown</div>
      {pieData.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3a35', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
          No expense data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="46%"
              innerRadius="48%"
              outerRadius="72%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              activeShape={(props) => (
                <Sector {...props} stroke="rgba(200,169,110,0.75)" strokeWidth={1.5} />
              )}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} isAnimationActive={false} position={tooltipPos ?? undefined} />
            <Legend
              wrapperStyle={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#6b6560', paddingTop: '0.25rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function ChartsPanel({ budget }) {
  const chart1 = useTooltipStyle()
  const { incomeTotals, expenseTotals, remainingTotals } = computeBudgetSummary(budget.sections)

  const trendData = MONTHS.map((month, i) => ({
    month,
    income: incomeTotals[i],
    expenses: expenseTotals[i],
    remaining: remainingTotals[i],
  }))

  const expenseSections = budget.sections
    .filter(s => s.type === 'expense')
    .map(s => ({
      name: s.name,
      color: s.color || '#c8a96e',
      value: computeAnnualTotal(computeSectionTotals(s)),
    }))
    .filter(s => s.value > 0)

  const totalExpense = expenseSections.reduce((sum, s) => sum + s.value, 0)
  const pieData = expenseSections.map((s) => ({
    ...s,
    percent: totalExpense > 0 ? Math.round((s.value / totalExpense) * 100) : 0,
    fill: toChartColor(s.color),
  }))

  return (
    <div className="charts-panel">
      <div className="charts-grid">
        <div className="chart-block" ref={chart1.blockRef} onMouseEnter={chart1.onEnter} onMouseLeave={chart1.onLeave}>
          <div className="chart-title">Monthly Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5a9e6f" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#5a9e6f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c0614a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#c0614a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1b1f" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#3d3a35', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#3d3a35', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v === 0 ? '0' : v >= 1000 ? `${Math.round(v/1000)}k` : v}
                width={36}
              />
              <Tooltip content={<TrendTooltip />} isAnimationActive={false} />
              <Legend
                wrapperStyle={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#6b6560', paddingTop: '0.4rem' }}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#5a9e6f"
                strokeWidth={1.5}
                fill="url(#incomeGrad)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#c0614a"
                strokeWidth={1.5}
                fill="url(#expenseGrad)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="remaining"
                name="Remaining"
                stroke="#c8a96e"
                strokeWidth={1.5}
                fill="none"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <PieSection pieData={pieData} />
      </div>
    </div>
  )
}
