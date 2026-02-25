import { useReducer, useCallback, useRef } from 'react'

/**
 * A wrapper around useReducer that adds undo/redo capability.
 *
 * Every action dispatched through the returned `dispatch` is recorded in a
 * history stack (unless it's one of the meta-actions: UNDO, REDO).
 *
 * Some actions are "transient" — they don't push a new undo entry but instead
 * overwrite the current state. This keeps high-frequency events (e.g.
 * individual cell edits while typing) from flooding the undo stack.
 *
 * SET_BUDGET is treated as a history reset — it clears the undo/redo stacks
 * entirely since the user has switched to a completely different budget.
 *
 * Returns [state, dispatch, { canUndo, canRedo }]
 */

const MAX_HISTORY = 100

// Actions that should NOT create a new undo entry
const TRANSIENT_ACTIONS = new Set([
  'SET_TITLE',
  'SET_YEAR',
  'SET_LINKED_SHEET',
])

// Actions that reset history entirely (switching budgets, full replace)
const RESET_ACTIONS = new Set([
  'SET_BUDGET',
])

function undoReducer(historyState, action) {
  const { past, present, future, innerReducer } = historyState

  switch (action.type) {
    case 'UNDO': {
      if (past.length === 0) return historyState
      const previous = past[past.length - 1]
      return {
        ...historyState,
        past: past.slice(0, -1),
        present: previous,
        future: [present, ...future],
      }
    }

    case 'REDO': {
      if (future.length === 0) return historyState
      const next = future[0]
      return {
        ...historyState,
        past: [...past, present],
        present: next,
        future: future.slice(1),
      }
    }

    default: {
      const newPresent = innerReducer(present, action)

      // If reducer returned exact same reference, nothing changed
      if (newPresent === present) return historyState

      // Reset actions clear all history
      if (RESET_ACTIONS.has(action.type)) {
        return {
          ...historyState,
          past: [],
          present: newPresent,
          future: [],
        }
      }

      // Transient actions update present without recording history
      if (TRANSIENT_ACTIONS.has(action.type)) {
        return {
          ...historyState,
          present: newPresent,
        }
      }

      // Normal action: push current state to past, clear future
      const newPast = past.length >= MAX_HISTORY
        ? [...past.slice(past.length - MAX_HISTORY + 1), present]
        : [...past, present]

      return {
        ...historyState,
        past: newPast,
        present: newPresent,
        future: [],
      }
    }
  }
}

export function useUndoReducer(innerReducer, initialArg, init) {
  const innerReducerRef = useRef(innerReducer)
  innerReducerRef.current = innerReducer

  const [historyState, historyDispatch] = useReducer(
    undoReducer,
    { innerReducer, initialArg, init },
    ({ innerReducer: ir, initialArg: ia, init: initFn }) => ({
      past: [],
      present: initFn ? initFn(ia) : ia,
      future: [],
      innerReducer: ir,
    })
  )

  // Keep innerReducer reference current in the history state
  // (it's captured in the closure but we pass it fresh via the ref)
  historyState.innerReducer = innerReducerRef.current

  const dispatch = useCallback((action) => {
    historyDispatch(action)
  }, [])

  const canUndo = historyState.past.length > 0
  const canRedo = historyState.future.length > 0

  return [historyState.present, dispatch, { canUndo, canRedo }]
}
