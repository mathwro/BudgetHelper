# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + Vite web app for managing a personal annual budget. Google Sheets acts as the storage/export target — the app writes both values **and spreadsheet formulas** so the resulting sheet is fully self-contained. There is no backend; all Google API calls are made directly from the browser using an OAuth 2.0 access token.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build into dist/
npm run preview      # Preview production build
```

```bash
npm test             # Run test suite (Vitest + RTL)
npm run test:watch   # Watch mode
npm run test:coverage  # With coverage
```

## Architecture

### Data Flow
1. **State lives in `App.jsx`** using `useReducer`. Every state change is persisted to `localStorage` as JSON.
2. The user edits the budget in the web UI.
3. On "Sync to Sheets", `formulaGenerator.js` converts the budget state into a two-pass Google Sheets API payload (values/formulas first, then formatting), sent via `googleSheets.js`.

### Key Abstractions

**`src/utils/formulaGenerator.js`** — The most complex utility. It:
- Walks all sections/items to compute exact 1-based row indices
- Builds a `rowLayout` array (each entry has type, label, rowIndex, color, bold flag, section ref)
- Tracks `itemRowMap` (`itemId → rowIndex`) and `savingsAutoRowMap` (`sectionId → rowIndex`) for formula cross-references
- Generates A1-notation SUM formulas for total rows, annual totals (col N), and averages (col O = N/12)
- Generates the "Remaining" row formula referencing income-total and expense-total rows
- For `savings` sections: inserts an auto-row mirroring the linked expense item (`=B{linkedRow}`), and generates `=B{autoRow}*(pct/100)` formulas for percentage items
- Returns a `batchUpdate` payload for the Sheets API (values pass + formatting pass)

**`src/utils/budgetCalculator.js`** — Mirrors the formula logic but in plain JS for live in-browser totals. Must stay in sync with `formulaGenerator.js`. Key exports:
- `computeSectionTotals(section, allSections?)` — handles savings percentage items
- `computeBudgetSummary(sections)` — income/expense/remaining totals (savings sections excluded)
- `findSavingsLinkedItem(sections, savingsSectionId)` — finds the expense/income item with `savingsLink === savingsSectionId`

**`src/utils/chartUtils.js`** — Shared utilities for chart data preparation used by `ChartsPanel` and `SectionChart`.

**`src/services/googleAuth.js`** — Wraps Google Identity Services (`google.accounts.oauth2.initTokenClient`). Returns a promise that resolves to an access token. The Client ID is read from the `VITE_GOOGLE_CLIENT_ID` environment variable.

**`src/services/googleSheets.js`** — Thin wrapper over the Sheets REST API v4. Key methods: `clearRange`, `batchUpdateValues` (valueInputOption: USER_ENTERED so formulas work), `batchUpdateFormatting`.

**`src/services/googleDrive.js`** — Handles Drive file listing for the "open from Drive" flow.

**`src/components/ChartsPanel.jsx`** — Full-width charts panel shown above the table. Collapses/expands via header toggle; uses `recharts`. Only processes `income` and `expense` sections.

**`src/components/SectionChart.jsx`** — Inline per-section chart, toggled per section. Shows monthly totals for that section.

### Data Model

```js
// Stored in localStorage["budget"]
{
  title: "Budget 2026",
  year: 2026,
  linkedSheetId: "",     // Google Sheets file ID (optional)
  sections: [{
    id: "uuid",
    name: "Income",
    type: "income" | "expense" | "summary" | "savings",
    color: "#hex",
    showTotal: true,
    totalLabel: "Total income",
    items: [{
      id: "uuid",
      name: "Løn - brutto",
      color: null,              // null = inherit section color
      note: "",
      excluded: false,          // true = visible but ignored in all calculations
      negative: false,          // true = subtracted from section total
      savingsLink: null,        // (expense/income items) ID of the savings section this feeds
      savingsPercentage: null,  // (savings items) e.g. 10 = 10% of linked expense item's monthly values
      monthlyValues: [0,0,0,0,0,0,0,0,0,0,0,0]  // Jan–Dec, index 0–11
    }]
  }]
}
```

### Sheet Column Layout
- **A**: Category label
- **B–M**: January–December values or formulas
- **N**: Annual total (`=SUM(B{r}:M{r})`)
- **O**: Monthly average (`=N{r}/12`)
- **P**: Notes

### Section Types
- `income` — items summed into an "income total" row used by the Remaining calculation
- `expense` — items summed into an "expense total" row used by the Remaining calculation
- `summary` — auto-computed rows (e.g. Remaining = income total − expense total); no user-editable cells
- `savings` — informational tracking section; **excluded from the Remaining calculation**. Can be linked to one expense/income item via `savingsLink` on that item. When linked, shows an auto-row mirroring the full expense values. Individual savings items can use `savingsPercentage` to show a computed fraction of the linked item.

### Savings Section Mechanics
- An expense/income item opts into a savings section by setting `item.savingsLink = savingsSectionId`
- Only one expense item should link to a given savings section (one-to-one)
- `findSavingsLinkedItem(sections, savingsSectionId)` scans all expense/income items to find the linked one
- Savings items with `savingsPercentage` are **read-only** in the table (computed display; actual `monthlyValues` are ignored)
- Savings sections do **not** appear in `computeBudgetSummary`; the Remaining row is unaffected

## Gotchas

- **`formulaGenerator.js` and `budgetCalculator.js` must stay in sync.** Any new section type or item field that affects totals needs to be handled in both files.
- **CSS sticky table header requires `border-collapse: separate; border-spacing: 0`** on `.budget-table`. Chrome/WebKit silently breaks `position: sticky` on `thead` when `border-collapse: collapse` is used.
- **Scroll container for sticky header**: `overflow: auto` must be on `.main-content`, not on `.table-scroll-wrapper`. Setting overflow on the wrapper creates a nested scroll context that prevents thead sticky from working against the viewport.
- **`col-label` cells need an explicit solid `background`** (not `inherit`). `inherit` resolves to transparent through the tr/tbody chain, causing sticky column cells to show content behind them.
- **No linter or formatter is configured** — follow existing code style (2-space indent, single quotes, no semicolons).

## Google API Setup (User-Facing)
Users must create a Google Cloud project, enable the Sheets API, and create an OAuth 2.0 Web Application credential with `http://localhost:5173` as an authorized origin. The Client ID must be set as the `VITE_GOOGLE_CLIENT_ID` environment variable (e.g. in a `.env.local` file).
