import React, { useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { computeAnnualTotal, findSavingsLinkedItem } from '../utils/budgetCalculator.js'
import { toChartColor, fmt } from '../utils/chartUtils.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#13151a',
      border: '1px solid #232428',
      borderRadius: 6,
      padding: '0.45rem 0.7rem',
      fontSize: '0.75rem',
      fontFamily: 'var(--font-mono)',
      color: '#e2ddd5',
    }}>
      {label && (
        <div style={{ color: '#6b6560', marginBottom: '0.2rem', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      )}
      <div style={{ color: payload[0]?.fill || '#c8a96e' }}>{fmt(payload[0]?.value ?? 0)}</div>
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

export default function SectionChart({ section, totals, allSections }) {
  const monthlyData = MONTHS.map((month, i) => ({ month, value: totals[i] }))

  const itemData = section.items
    .filter(item => !item.excluded)
    .map(item => {
      const linkedItem = (section.type === 'savings' && item.savingsPercentage != null && allSections)
        ? findSavingsLinkedItem(allSections, section.id)
        : null
      const values = linkedItem
        ? linkedItem.monthlyValues.map(v => (Number(v) || 0) * item.savingsPercentage / 100)
        : item.monthlyValues
      return {
        name: item.name.length > 22 ? item.name.slice(0, 21) + '\u2026' : item.name,
        value: computeAnnualTotal(values) * (item.negative ? -1 : 1),
        fill: toChartColor(item.color || section.color),
      }
    })
    .filter(d => d.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  const barColor = toChartColor(section.color)
  const chart1 = useTooltipStyle()
  const chart2 = useTooltipStyle()

  return (
    <div className="section-chart">
      <div className="section-chart-grid">
        <div className="chart-block" ref={chart1.blockRef} onMouseEnter={chart1.onEnter} onMouseLeave={chart1.onLeave}>
          <div className="chart-title">Monthly total</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1b1f" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#3d3a35', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#3d3a35', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                width={32}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} />
              <Bar
                dataKey="value"
                fill={barColor}
                radius={[2, 2, 0, 0]}
                background={{ fill: 'transparent' }}
                activeBar={{ fill: barColor, stroke: 'rgba(200,169,110,0.75)', strokeWidth: 1.5 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {itemData.length > 0 && (
          <div className="chart-block" ref={chart2.blockRef} onMouseEnter={chart2.onEnter} onMouseLeave={chart2.onLeave}>
            <div className="chart-title">By item — annual</div>
            <ResponsiveContainer width="100%" height={Math.max(120, itemData.length * 28 + 16)}>
              <BarChart layout="vertical" data={itemData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#3d3a35', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#6b6560', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} />
                <Bar
                  dataKey="value"
                  radius={[0, 2, 2, 0]}
                  background={{ fill: 'transparent' }}
                  activeBar={{ stroke: 'rgba(200,169,110,0.75)', strokeWidth: 1.5 }}
                >
                  {itemData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
