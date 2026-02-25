# GitHub Copilot Instructions — BudgetHelper

## Project Overview

React + Vite personal budget app. No backend. Google Sheets is the export target — the app generates both values and spreadsheet formulas so the resulting sheet is fully self-contained. All Google API calls are made from the browser via OAuth 2.0.

**Stack:** React 18, Vite 5, Recharts, uuid. No test framework, no linter config.

## Commands

```bash
npm run dev      # Dev server at localhost:5173
npm run build    # Production build
```

## File Structure

```
src/
  App.jsx                      # Root: useReducer state, localStorage persistence
  components/
    Header.jsx                 # Top bar: title, year, import/export, sync button
    BudgetTable.jsx            # Outer table shell, renders BudgetSection per section
    BudgetSection.jsx          # Section header row, item rows, total row, inline chart
    BudgetItem.jsx             # Single editable row (month cells, actions)
    ItemEditor.jsx             # Modal: edit item name, color, values, flags, savings mode
    SectionManager.jsx         # Modal: add/reorder/delete sections
    ChartsPanel.jsx            # Full-width charts above table (income/expense only)
    SectionChart.jsx           # Inline per-section chart
    GoogleSyncModal.jsx        # Google Sheets sync UI
  utils/
    budgetCalculator.js        # Live JS totals — must mirror formulaGenerator.js logic
    formulaGenerator.js        # Builds Google Sheets batchUpdate payload with formulas
    chartUtils.js              # Shared chart data helpers
    defaultBudget.js           # Factory for a blank budget
  services/
    googleAuth.js              # Google Identity Services token flow
    googleSheets.js            # Sheets REST API v4 wrapper
    googleDrive.js             # Drive file listing
  styles/
    index.css                  # All styles (single file)
```

## Data Model

```js
// localStorage["budget"]
{
  title: string,
  year: number,
  clientId: string,       // Google OAuth client ID (user-supplied)
  linkedSheetId: string,  // Google Sheets file ID (optional)
  sections: [{
    id: string,           // uuid
    name: string,
    type: "income" | "expense" | "summary" | "savings",
    color: string,        // hex
    showTotal: boolean,
    totalLabel: string,
    items: [{
      id: string,
      name: string,
      color: string | null,         // null = inherit section color
      note: string,
      excluded: boolean,            // visible but ignored in all calculations
      negative: boolean,            // subtracted from section total
      savingsLink: string | null,   // (expense/income items) savings section ID this feeds
      savingsPercentage: number | null, // (savings items) % of linked expense monthly values
      monthlyValues: number[],      // [Jan, ..., Dec], length 12
    }]
  }]
}
```

## Section Types

| Type | Description |
|------|-------------|
| `income` | Summed into income total; included in Remaining |
| `expense` | Summed into expense total; included in Remaining |
| `summary` | Auto-computed (e.g. Remaining = income − expense); no editable cells |
| `savings` | Informational only; **excluded from Remaining**. Can mirror a linked expense item |

## Savings Section Pattern

One expense/income item can link to a savings section by setting `item.savingsLink = savingsSectionId`. The savings section then shows:
- An **auto-row**: mirrors the full linked expense values (read-only)
- **Items**: each item is an allocation. If `item.savingsPercentage` is set, the item's displayed values are computed as `linkedExpense[month] * pct / 100` (read-only cells). Otherwise, `monthlyValues` is used directly.

Use `findSavingsLinkedItem(sections, savingsSectionId)` from `budgetCalculator.js` to find the linked item.

## Sheet Column Layout

| Col | Content |
|-----|---------|
| A | Category label |
| B–M | Jan–Dec (values or formulas) |
| N | Annual total `=SUM(B{r}:M{r})` |
| O | Monthly average `=N{r}/12` |
| P | Notes |

## Key Patterns

### formulaGenerator.js ↔ budgetCalculator.js
These two files must stay in sync. `formulaGenerator.js` produces Sheets formulas; `budgetCalculator.js` replicates the same logic in plain JS for live UI totals. Any new section type or item field affecting totals must be handled in both.

### Reducer actions (App.jsx)
- `UPDATE_ITEM { sectionId, itemId, updates }` — merges `updates` into the item; use for all item field changes
- `UPDATE_CELL { sectionId, itemId, monthIndex, value }` — single cell update from inline editing
- `ADD_ITEM / DELETE_ITEM / MOVE_ITEM` — item CRUD
- `UPDATE_SECTION / ADD_SECTION / DELETE_SECTION / MOVE_SECTION` — section CRUD
- `SET_BUDGET` — full replace (import)

### No test runner
Verify changes in the browser at `localhost:5173`. The `npm run build` must succeed (Vite type-checks JSX).

## CSS Gotchas

- **Sticky table header**: requires `border-collapse: separate; border-spacing: 0` on `.budget-table`. Using `border-collapse: collapse` silently breaks `position: sticky` on `thead` in Chrome/WebKit.
- **Scroll container**: `overflow: auto` belongs on `.main-content`, not `.table-scroll-wrapper`. A nested scroll container breaks sticky positioning.
- **Sticky column background**: `col-label` cells need `background: var(--bg-panel)` (not `inherit`). `inherit` resolves to transparent, causing visual bleed-through.

## Code Style

- 2-space indentation
- Single quotes
- No semicolons
- Functional components with hooks; no class components
- Avoid over-engineering — minimal abstractions, no premature helpers
