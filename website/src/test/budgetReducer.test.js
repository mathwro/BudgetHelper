import { describe, it, expect } from 'vitest'
import { reducer } from '../utils/budgetReducer.js'

function makeItem(id, overrides = {}) {
  return {
    id,
    name: 'Item ' + id,
    color: null,
    note: '',
    monthlyValues: Array(12).fill(0),
    excluded: false,
    negative: false,
    savingsLink: null,
    savingsPercentage: null,
    ...overrides,
  }
}

function makeSection(id, overrides = {}) {
  return {
    id,
    name: 'Section ' + id,
    type: 'expense',
    color: '#ffffff',
    showTotal: true,
    totalLabel: 'Total ' + id,
    items: [],
    ...overrides,
  }
}

function makeBudget(sections = []) {
  return { id: 'b1', title: 'Test', year: 2026, linkedSheetId: null, sections }
}

describe('reducer', () => {
  describe('SET_BUDGET', () => {
    it('replaces entire state with the new budget', () => {
      const initial = makeBudget()
      const newBudget = makeBudget([makeSection('s1')])
      const result = reducer(initial, { type: 'SET_BUDGET', budget: newBudget })
      expect(result).toBe(newBudget)
    })
  })

  describe('ADD_ITEM', () => {
    it('adds a new item to the correct section', () => {
      const state = makeBudget([makeSection('s1')])
      const result = reducer(state, { type: 'ADD_ITEM', sectionId: 's1' })
      expect(result.sections[0].items).toHaveLength(1)
    })

    it('uses provided itemId when given', () => {
      const state = makeBudget([makeSection('s1')])
      const result = reducer(state, { type: 'ADD_ITEM', sectionId: 's1', itemId: 'my-id' })
      expect(result.sections[0].items[0].id).toBe('my-id')
    })

    it('does not affect other sections', () => {
      const s1 = makeSection('s1')
      const s2 = makeSection('s2', { items: [makeItem('i1')] })
      const result = reducer(makeBudget([s1, s2]), { type: 'ADD_ITEM', sectionId: 's1' })
      expect(result.sections[1].items).toHaveLength(1)
    })
  })

  describe('UPDATE_ITEM', () => {
    it('merges updates into the target item', () => {
      const state = makeBudget([makeSection('s1', { items: [makeItem('i1')] })])
      const result = reducer(state, { type: 'UPDATE_ITEM', sectionId: 's1', itemId: 'i1', updates: { name: 'Updated' } })
      expect(result.sections[0].items[0].name).toBe('Updated')
    })

    it('does not affect other items', () => {
      const state = makeBudget([makeSection('s1', { items: [makeItem('i1'), makeItem('i2', { name: 'Other' })] })])
      const result = reducer(state, { type: 'UPDATE_ITEM', sectionId: 's1', itemId: 'i1', updates: { name: 'Changed' } })
      expect(result.sections[0].items[1].name).toBe('Other')
    })
  })

  describe('DELETE_ITEM', () => {
    it('removes the correct item by id', () => {
      const state = makeBudget([makeSection('s1', { items: [makeItem('i1'), makeItem('i2')] })])
      const result = reducer(state, { type: 'DELETE_ITEM', sectionId: 's1', itemId: 'i1' })
      expect(result.sections[0].items).toHaveLength(1)
      expect(result.sections[0].items[0].id).toBe('i2')
    })
  })

  describe('MOVE_ITEM', () => {
    it('reorders items within the section', () => {
      const items = [makeItem('i1'), makeItem('i2'), makeItem('i3')]
      const state = makeBudget([makeSection('s1', { items })])
      const result = reducer(state, { type: 'MOVE_ITEM', sectionId: 's1', fromIndex: 0, toIndex: 2 })
      expect(result.sections[0].items.map(i => i.id)).toEqual(['i2', 'i3', 'i1'])
    })
  })

  describe('UPDATE_SECTION', () => {
    it('merges updates into the target section', () => {
      const state = makeBudget([makeSection('s1')])
      const result = reducer(state, { type: 'UPDATE_SECTION', sectionId: 's1', updates: { name: 'New Name' } })
      expect(result.sections[0].name).toBe('New Name')
    })
  })

  describe('ADD_SECTION', () => {
    it('inserts new section before summary sections', () => {
      const state = makeBudget([makeSection('sum', { type: 'summary' })])
      const result = reducer(state, { type: 'ADD_SECTION' })
      expect(result.sections[result.sections.length - 1].id).toBe('sum')
      expect(result.sections[0].type).not.toBe('summary')
    })

    it('uses provided sectionType', () => {
      const state = makeBudget([])
      const result = reducer(state, { type: 'ADD_SECTION', sectionType: 'income' })
      expect(result.sections[0].type).toBe('income')
    })
  })

  describe('DELETE_SECTION', () => {
    it('removes section by id', () => {
      const state = makeBudget([makeSection('s1'), makeSection('s2')])
      const result = reducer(state, { type: 'DELETE_SECTION', sectionId: 's1' })
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].id).toBe('s2')
    })
  })
})
