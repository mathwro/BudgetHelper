import { v4 as uuidv4 } from 'uuid'

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_BUDGET':
      return action.budget

    case 'SET_TITLE':
      return { ...state, title: action.title }

    case 'SET_YEAR':
      return { ...state, year: action.year }

    case 'SET_LINKED_SHEET':
      return { ...state, linkedSheetId: action.sheetId }

    case 'UPDATE_CELL': {
      const { sectionId, itemId, monthIndex, value } = action
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            items: s.items.map(item =>
              item.id !== itemId ? item : {
                ...item,
                monthlyValues: item.monthlyValues.map((v, i) => i === monthIndex ? value : v),
              }
            ),
          }
        ),
      }
    }

    case 'UPDATE_ITEM': {
      const { sectionId, itemId, updates } = action
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            items: s.items.map(item =>
              item.id !== itemId ? item : { ...item, ...updates }
            ),
          }
        ),
      }
    }

    case 'ADD_ITEM': {
      const { sectionId, itemId } = action
      const newItem = {
        id: itemId ?? uuidv4(),
        name: 'New item',
        color: null,
        note: '',
        monthlyValues: Array(12).fill(0),
      }
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            items: [...s.items, newItem],
          }
        ),
      }
    }

    case 'DELETE_ITEM': {
      const { sectionId, itemId } = action
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id !== sectionId ? s : {
            ...s,
            items: s.items.filter(item => item.id !== itemId),
          }
        ),
      }
    }

    case 'MOVE_ITEM': {
      const { sectionId, fromIndex, toIndex } = action
      return {
        ...state,
        sections: state.sections.map(s => {
          if (s.id !== sectionId) return s
          const items = [...s.items]
          const [moved] = items.splice(fromIndex, 1)
          items.splice(toIndex, 0, moved)
          return { ...s, items }
        }),
      }
    }

    case 'UPDATE_SECTION': {
      const { sectionId, updates } = action
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id !== sectionId ? s : { ...s, ...updates }
        ),
      }
    }

    case 'ADD_SECTION': {
      const newSection = {
        id: uuidv4(),
        name: 'New section',
        type: action.sectionType || 'expense',
        color: '#2560a0',
        showTotal: true,
        totalLabel: 'Total',
        items: [],
      }
      // Insert before summary sections
      const summaryIdx = state.sections.findIndex(s => s.type === 'summary')
      const sections = [...state.sections]
      if (summaryIdx >= 0) {
        sections.splice(summaryIdx, 0, newSection)
      } else {
        sections.push(newSection)
      }
      return { ...state, sections }
    }

    case 'DELETE_SECTION': {
      return {
        ...state,
        sections: state.sections.filter(s => s.id !== action.sectionId),
      }
    }

    case 'MOVE_SECTION': {
      const { fromIndex, toIndex } = action
      const sections = [...state.sections]
      const [moved] = sections.splice(fromIndex, 1)
      sections.splice(toIndex, 0, moved)
      return { ...state, sections }
    }

    default:
      return state
  }
}
