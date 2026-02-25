import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BudgetSection from '../components/BudgetSection.jsx'

// SectionChart uses recharts which does not work in jsdom — mock it out
vi.mock('../components/SectionChart.jsx', () => ({ default: () => null }))

// BudgetSection renders <tr> elements.  All renders must be wrapped in a
// table/tbody so the DOM is valid and React does not emit warnings.
function renderSection(sectionOverrides = {}, props = {}) {
  const dispatch = props.dispatch ?? vi.fn()
  const onEditItem = props.onEditItem ?? vi.fn()

  const section = {
    id: 'sec-1',
    name: 'Test Section',
    type: 'expense',
    color: '#c8a96e',
    showTotal: true,
    totalLabel: 'Total expenses',
    items: [],
    ...sectionOverrides,
  }

  const allSections = props.allSections ?? [section]

  render(
    <table>
      <tbody>
        <BudgetSection
          section={section}
          dispatch={dispatch}
          onEditItem={onEditItem}
          sectionChartsCloseKey={0}
          allSections={allSections}
        />
      </tbody>
    </table>
  )

  return { dispatch, onEditItem, section }
}

function makeItem(overrides = {}) {
  return {
    id: 'item-1',
    name: 'Groceries',
    color: null,
    note: '',
    excluded: false,
    negative: false,
    savingsLink: null,
    savingsPercentage: null,
    monthlyValues: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    ...overrides,
  }
}

describe('BudgetSection', () => {
  describe('section name rendering', () => {
    it('renders the section name', () => {
      renderSection({ name: 'My Income' })
      expect(screen.getByText('My Income')).toBeInTheDocument()
    })
  })

  describe('"Add item" button', () => {
    it('exists for expense sections', () => {
      renderSection({ type: 'expense' })
      expect(screen.getByRole('button', { name: /\+ add item/i })).toBeInTheDocument()
    })

    it('exists for income sections', () => {
      renderSection({ type: 'income' })
      expect(screen.getByRole('button', { name: /\+ add item/i })).toBeInTheDocument()
    })

    it('exists for savings sections', () => {
      renderSection({ type: 'savings' })
      expect(screen.getByRole('button', { name: /\+ add item/i })).toBeInTheDocument()
    })

    it('does NOT exist for summary sections', () => {
      renderSection({ type: 'summary' })
      expect(screen.queryByRole('button', { name: /\+ add item/i })).not.toBeInTheDocument()
    })
  })

  describe('item rendering', () => {
    it('renders items present in the section', () => {
      const item = makeItem({ name: 'Electricity' })
      renderSection({ items: [item] })
      expect(screen.getByText('Electricity')).toBeInTheDocument()
    })

    it('renders multiple items', () => {
      const items = [
        makeItem({ id: 'item-1', name: 'Rent' }),
        makeItem({ id: 'item-2', name: 'Food' }),
      ]
      renderSection({ items })
      expect(screen.getByText('Rent')).toBeInTheDocument()
      expect(screen.getByText('Food')).toBeInTheDocument()
    })
  })

  describe('total row', () => {
    it('shows the total label when showTotal is true and section has items', () => {
      const item = makeItem()
      renderSection({ showTotal: true, totalLabel: 'Total expenses', items: [item] })
      expect(screen.getByText('Total expenses')).toBeInTheDocument()
    })

    it('does NOT show the total label when the section has no items', () => {
      renderSection({ showTotal: true, totalLabel: 'Total expenses', items: [] })
      expect(screen.queryByText('Total expenses')).not.toBeInTheDocument()
    })

    it('does NOT show the total label when showTotal is false', () => {
      const item = makeItem()
      renderSection({ showTotal: false, totalLabel: 'Total expenses', items: [item] })
      expect(screen.queryByText('Total expenses')).not.toBeInTheDocument()
    })
  })

  describe('"Add item" click behaviour', () => {
    it('dispatches ADD_ITEM with the correct sectionId', async () => {
      const user = userEvent.setup()
      const dispatch = vi.fn()
      renderSection({ id: 'sec-abc', type: 'expense', items: [] }, { dispatch })
      await user.click(screen.getByRole('button', { name: /\+ add item/i }))
      expect(dispatch).toHaveBeenCalledOnce()
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ADD_ITEM', sectionId: 'sec-abc' })
      )
    })

    it('dispatches ADD_ITEM with an itemId string', async () => {
      const user = userEvent.setup()
      const dispatch = vi.fn()
      renderSection({ id: 'sec-abc', type: 'expense', items: [] }, { dispatch })
      await user.click(screen.getByRole('button', { name: /\+ add item/i }))
      const { itemId } = dispatch.mock.calls[0][0]
      expect(typeof itemId).toBe('string')
      expect(itemId.length).toBeGreaterThan(0)
    })

    it('calls onEditItem with sectionId and an item object', async () => {
      const user = userEvent.setup()
      const onEditItem = vi.fn()
      renderSection({ id: 'sec-abc', type: 'expense', items: [] }, { onEditItem })
      await user.click(screen.getByRole('button', { name: /\+ add item/i }))
      expect(onEditItem).toHaveBeenCalledOnce()
      const [calledSectionId, calledItem, isNew] = onEditItem.mock.calls[0]
      expect(calledSectionId).toBe('sec-abc')
      expect(calledItem).toEqual(expect.objectContaining({ id: expect.any(String) }))
      expect(isNew).toBeTruthy()
    })

    it('dispatches ADD_ITEM and calls onEditItem with the same itemId', async () => {
      const user = userEvent.setup()
      const dispatch = vi.fn()
      const onEditItem = vi.fn()
      renderSection(
        { id: 'sec-abc', type: 'expense', items: [] },
        { dispatch, onEditItem }
      )
      await user.click(screen.getByRole('button', { name: /\+ add item/i }))

      const dispatchedItemId = dispatch.mock.calls[0][0].itemId
      const onEditItemId = onEditItem.mock.calls[0][1].id

      expect(dispatchedItemId).toBe(onEditItemId)
    })
  })
})
