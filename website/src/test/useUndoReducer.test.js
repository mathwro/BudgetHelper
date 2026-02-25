import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoReducer } from '../utils/useUndoReducer.js'
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

function setup(initialBudget) {
  return renderHook(() =>
    useUndoReducer(reducer, initialBudget, (b) => b)
  )
}

describe('useUndoReducer', () => {
  describe('basic state management', () => {
    it('returns initial state with canUndo=false and canRedo=false', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)
      const [state, , { canUndo, canRedo }] = result.current
      expect(state).toEqual(budget)
      expect(canUndo).toBe(false)
      expect(canRedo).toBe(false)
    })

    it('forwards actions to the inner reducer', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(1)
      expect(result.current[0].sections[0].items[0].id).toBe('i1')
    })
  })

  describe('undo', () => {
    it('reverts to previous state after a normal action', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(1)
      expect(result.current[2].canUndo).toBe(true)

      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(0)
      expect(result.current[2].canUndo).toBe(false)
    })

    it('does nothing when there is no history', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[0]).toEqual(budget)
      expect(result.current[2].canUndo).toBe(false)
    })

    it('supports multiple undos', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i2' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(2)

      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(1)

      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(0)
    })
  })

  describe('redo', () => {
    it('re-applies an undone action', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[2].canRedo).toBe(true)

      act(() => {
        result.current[1]({ type: 'REDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(1)
      expect(result.current[2].canRedo).toBe(false)
    })

    it('does nothing when there is no future', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'REDO' })
      })
      expect(result.current[0]).toEqual(budget)
    })

    it('clears redo stack when a new action is dispatched', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[2].canRedo).toBe(true)

      // New action should clear the redo stack
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i2' })
      })
      expect(result.current[2].canRedo).toBe(false)
    })
  })

  describe('transient actions', () => {
    it('SET_TITLE does not create an undo entry', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'SET_TITLE', title: 'New title' })
      })
      expect(result.current[0].title).toBe('New title')
      expect(result.current[2].canUndo).toBe(false)
    })

    it('SET_YEAR does not create an undo entry', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'SET_YEAR', year: 2027 })
      })
      expect(result.current[0].year).toBe(2027)
      expect(result.current[2].canUndo).toBe(false)
    })

    it('SET_LINKED_SHEET does not create an undo entry', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      act(() => {
        result.current[1]({ type: 'SET_LINKED_SHEET', sheetId: 'abc123' })
      })
      expect(result.current[0].linkedSheetId).toBe('abc123')
      expect(result.current[2].canUndo).toBe(false)
    })
  })

  describe('reset actions', () => {
    it('SET_BUDGET clears undo and redo history', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      // Build up some history
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i2' })
      })
      expect(result.current[2].canUndo).toBe(true)

      // Switch budget — should reset history
      const newBudget = makeBudget([makeSection('s2')])
      act(() => {
        result.current[1]({ type: 'SET_BUDGET', budget: newBudget })
      })
      expect(result.current[0]).toEqual(newBudget)
      expect(result.current[2].canUndo).toBe(false)
      expect(result.current[2].canRedo).toBe(false)
    })
  })

  describe('history limits', () => {
    it('caps undo history at 100 entries', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      // Dispatch 105 actions
      for (let i = 0; i < 105; i++) {
        act(() => {
          result.current[1]({
            type: 'UPDATE_CELL',
            sectionId: 's1',
            itemId: 'i1',
            monthIndex: 0,
            value: i,
          })
        })
      }

      // Undo all — should only go back 100 steps
      let undoCount = 0
      while (result.current[2].canUndo) {
        act(() => {
          result.current[1]({ type: 'UNDO' })
        })
        undoCount++
      }
      expect(undoCount).toBe(100)
    })
  })

  describe('undo/redo cycle', () => {
    it('full cycle: action → undo → redo → new action clears redo', () => {
      const budget = makeBudget([makeSection('s1')])
      const { result } = setup(budget)

      // Action 1: add item
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i1' })
      })
      // Action 2: add another item
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i2' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(2)

      // Undo action 2
      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(1)
      expect(result.current[2].canUndo).toBe(true)
      expect(result.current[2].canRedo).toBe(true)

      // Redo action 2
      act(() => {
        result.current[1]({ type: 'REDO' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(2)

      // Undo again, then do a different action (should clear redo)
      act(() => {
        result.current[1]({ type: 'UNDO' })
      })
      act(() => {
        result.current[1]({ type: 'ADD_ITEM', sectionId: 's1', itemId: 'i3' })
      })
      expect(result.current[0].sections[0].items).toHaveLength(2)
      expect(result.current[0].sections[0].items[1].id).toBe('i3')
      expect(result.current[2].canRedo).toBe(false)
    })
  })
})
