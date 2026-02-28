import React, { useEffect, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { createDefaultBudget } from './utils/defaultBudget.js'
import { generateBudget } from './utils/generateBudget.js'
import { reducer } from './utils/budgetReducer.js'
import { useUndoReducer } from './utils/useUndoReducer.js'
import Header from './components/Header.jsx'
import BudgetTable from './components/BudgetTable.jsx'
import SectionManager from './components/SectionManager.jsx'
import GoogleSyncModal from './components/GoogleSyncModal.jsx'
import ItemEditor from './components/ItemEditor.jsx'
import ChartsPanel from './components/ChartsPanel.jsx'
import BudgetWizard from './components/BudgetWizard.jsx'
import DuplicateBudgetModal from './components/DuplicateBudgetModal.jsx'
import BudgetPickerModal from './components/BudgetPickerModal.jsx'

const STORE_KEY = 'budgetStore'
const LEGACY_KEY = 'budget'

// ── Storage helpers ──────────────────────────────────────────────────────────

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}

  // Migrate from legacy single-budget key
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const budget = JSON.parse(legacy)
      if (!budget.id) budget.id = uuidv4()
      const store = {
        activeId: budget.id,
        budgets: { [budget.id]: budget },
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(store))
      localStorage.removeItem(LEGACY_KEY)
      return store
    }
  } catch {}

  // Brand new — return empty store (wizard will create first budget)
  return { activeId: null, budgets: {} }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {}
}

function budgetsMeta(store) {
  return Object.values(store.budgets).map(b => ({ id: b.id, title: b.title, year: b.year }))
}

// ── App ──────────────────────────────────────────────────────────────────────

function getInitialBudget(store) {
  if (store.activeId && store.budgets[store.activeId]) {
    return store.budgets[store.activeId]
  }
  // Fallback if activeId points to missing budget
  const first = Object.values(store.budgets)[0]
  return first || createDefaultBudget()
}

export default function App() {
  const [allBudgetsMeta, setAllBudgetsMeta] = useState(() => {
    const store = loadStore()
    return budgetsMeta(store)
  })

  const [budget, dispatch, { canUndo, canRedo }] = useUndoReducer(
    reducer,
    null,
    () => {
      const store = loadStore()
      if (Object.keys(store.budgets).length === 0) return createDefaultBudget()
      return getInitialBudget(store)
    }
  )
  const [activeBudgetId, setActiveBudgetId] = useState(() => {
    const store = loadStore()
    if (Object.keys(store.budgets).length === 0) return null
    return store.activeId || Object.keys(store.budgets)[0]
  })
  const [showWizard, setShowWizard] = useState(() => {
    const store = loadStore()
    return Object.keys(store.budgets).length === 0
  })
  const [showBudgetPicker, setShowBudgetPicker] = useState(() => {
    const store = loadStore()
    return Object.keys(store.budgets).length > 1
  })
  const [duplicatingSource, setDuplicatingSource] = useState(null)

  const [showSectionManager, setShowSectionManager] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showCharts, setShowCharts] = useState(true)
  const [sectionChartsCloseKey, setSectionChartsCloseKey] = useState(0)
  const [editingItem, setEditingItem] = useState(null)

  // Persist active budget on every change
  useEffect(() => {
    if (!activeBudgetId) return
    const store = loadStore()
    store.budgets[activeBudgetId] = budget
    store.activeId = activeBudgetId
    saveStore(store)
  }, [budget, activeBudgetId])

  // ── Undo/Redo keyboard shortcuts ──────────────────────────────────────────
  const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch])
  const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch])

  useEffect(() => {
    function handleKeyDown(e) {
      // Don't intercept when user is typing in an input/textarea/contenteditable
      const tag = e.target.tagName
      const editable = e.target.isContentEditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return

      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // ── Budget management handlers ─────────────────────────────────────────────

  function handleSwitchBudget(id) {
    const store = loadStore()
    const target = store.budgets[id]
    if (!target) return
    store.activeId = id
    saveStore(store)
    dispatch({ type: 'SET_BUDGET', budget: target })
    setActiveBudgetId(id)
    setAllBudgetsMeta(budgetsMeta(store))
  }

  function handleCreateBudget(newBudget) {
    const store = loadStore()
    store.budgets[newBudget.id] = newBudget
    store.activeId = newBudget.id
    saveStore(store)
    dispatch({ type: 'SET_BUDGET', budget: newBudget })
    setActiveBudgetId(newBudget.id)
    setAllBudgetsMeta(budgetsMeta(store))
    setShowWizard(false)
    setShowBudgetPicker(false)
  }

  function handleCreateBlankBudget({ name, year }) {
    const budgetYear = Number(year) || new Date().getFullYear()
    const blankBudget = generateBudget({
      name: name || '',
      year: budgetYear,
      selectedSections: [],
      selectedItems: {},
      incomeItems: [],
    })
    handleCreateBudget(blankBudget)
  }

  function handlePullFromGoogle({ name, year }) {
    handleCreateBlankBudget({ name, year })
    setShowSyncModal(true)
  }

  function handleDeleteBudget(id) {
    const store = loadStore()
    if (Object.keys(store.budgets).length <= 1) return
    delete store.budgets[id]
    if (store.activeId === id) {
      store.activeId = Object.keys(store.budgets)[0]
      const next = Object.values(store.budgets)[0]
      dispatch({ type: 'SET_BUDGET', budget: next })
      setActiveBudgetId(store.activeId)
    }
    saveStore(store)
    setAllBudgetsMeta(budgetsMeta(store))
  }

  function handleDuplicateBudget({ name, year, keepValues }) {
    if (!duplicatingSource) return

    // Build old-section-id → new-section-id map so savingsLink refs stay valid
    const sectionIdMap = {}
    duplicatingSource.sections.forEach(s => { sectionIdMap[s.id] = uuidv4() })

    const newBudget = {
      ...duplicatingSource,
      id: uuidv4(),
      title: name,
      year,
      linkedSheetId: null,
      sections: duplicatingSource.sections.map(s => ({
        ...s,
        id: sectionIdMap[s.id],
        items: s.items.map(item => ({
          ...item,
          id: uuidv4(),
          savingsLink: item.savingsLink ? (sectionIdMap[item.savingsLink] ?? null) : item.savingsLink,
          monthlyValues: keepValues ? [...item.monthlyValues] : Array(12).fill(0),
        })),
      })),
    }

    const store = loadStore()
    store.budgets[newBudget.id] = newBudget
    store.activeId = newBudget.id
    saveStore(store)
    dispatch({ type: 'SET_BUDGET', budget: newBudget })
    setActiveBudgetId(newBudget.id)
    setAllBudgetsMeta(budgetsMeta(store))
    setDuplicatingSource(null)
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(budget, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${budget.title.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJSON(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        if (!imported.id) imported.id = uuidv4()
        const store = loadStore()
        store.budgets[imported.id] = imported
        store.activeId = imported.id
        saveStore(store)
        dispatch({ type: 'SET_BUDGET', budget: imported })
        setActiveBudgetId(imported.id)
        setAllBudgetsMeta(budgetsMeta(store))
      } catch {
        alert('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="app">
      <Header
        budget={budget}
        dispatch={dispatch}
        onExport={handleExportJSON}
        onImport={handleImportJSON}
        onOpenSync={() => setShowSyncModal(true)}
        onOpenSections={() => setShowSectionManager(true)}
        showCharts={showCharts}
        onToggleCharts={() => {
          setShowCharts(v => !v)
          setSectionChartsCloseKey(k => k + 1)
        }}
        allBudgetsMeta={allBudgetsMeta}
        activeBudgetId={activeBudgetId}
        onSwitchBudget={handleSwitchBudget}
        onDeleteBudget={handleDeleteBudget}
        onNewBudget={() => setShowWizard(true)}
        onDuplicateBudget={id => {
          const store = loadStore()
          setDuplicatingSource(store.budgets[id] ?? null)
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <main className="main-content">
        <div className={`charts-panel-collapse${showCharts ? '' : ' closed'}`}>
          <ChartsPanel budget={budget} />
        </div>

        <BudgetTable
          budget={budget}
          dispatch={dispatch}
          onEditItem={(sectionId, item, isNew) =>
            setEditingItem({ sectionId, itemId: item.id, isNew: !!isNew })
          }
          sectionChartsCloseKey={sectionChartsCloseKey}
          allSections={budget.sections}
        />
      </main>

      {showSectionManager && (
        <SectionManager
          budget={budget}
          dispatch={dispatch}
          onClose={() => setShowSectionManager(false)}
        />
      )}

      {showSyncModal && (
        <GoogleSyncModal
          budget={budget}
          dispatch={dispatch}
          onClose={() => setShowSyncModal(false)}
        />
      )}

      {editingItem && (() => {
        const liveSection = budget.sections.find(s => s.id === editingItem.sectionId)
        const liveItem = liveSection?.items.find(it => it.id === editingItem.itemId)
        return liveItem ? (
          <ItemEditor
            sectionId={editingItem.sectionId}
            item={liveItem}
            dispatch={dispatch}
            onClose={() => setEditingItem(null)}
            onCancel={editingItem.isNew
              ? () => {
                  dispatch({ type: 'DELETE_ITEM', sectionId: editingItem.sectionId, itemId: editingItem.itemId })
                  setEditingItem(null)
                }
              : undefined
            }
            section={liveSection}
            sections={budget.sections}
          />
        ) : null
      })()}

      {showWizard && (
        <BudgetWizard
          canClose={allBudgetsMeta.length > 0}
          onComplete={handleCreateBudget}
          onCreateBlank={handleCreateBlankBudget}
          onPullFromGoogle={handlePullFromGoogle}
          onClose={() => setShowWizard(false)}
        />
      )}

      {duplicatingSource && (
        <DuplicateBudgetModal
          source={duplicatingSource}
          onConfirm={handleDuplicateBudget}
          onClose={() => setDuplicatingSource(null)}
        />
      )}

      {showBudgetPicker && !showWizard && (
        <BudgetPickerModal
          budgets={allBudgetsMeta}
          onSelect={id => { handleSwitchBudget(id); setShowBudgetPicker(false) }}
          onNew={() => { setShowBudgetPicker(false); setShowWizard(true) }}
          onClose={() => setShowBudgetPicker(false)}
        />
      )}
    </div>
  )
}
