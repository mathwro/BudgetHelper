# BudgetHelper

A personal annual budget manager built with React + Vite. Edit your budget in the browser, then sync it directly to Google Sheets — the exported sheet contains live formulas and formatting so it works standalone without this app.

All data is stored in `localStorage`. There is no backend; Google API calls are made directly from the browser using OAuth 2.0.

## Features

- Create and manage multiple budgets
- Income, expense, savings, and summary section types
- Monthly value entry with live in-browser totals and remaining calculation
- Savings sections that track a percentage of a linked expense item
- Per-section and full-budget charts (via Recharts)
- Two-way sync with Google Sheets — push exports values, SUM/average formulas, and formatting; pull imports changes back
- Import/export budgets as JSON
- All data persisted in `localStorage` — no account required

## Getting started

### Prerequisites

- Node.js 18+
- A Google Cloud project with the Sheets API and Drive API enabled (only needed for the Sync to Sheets feature)

### Install and run

```bash
npm install
npm run dev        # Dev server at http://localhost:5173
```

### Build and run in a container (Podman or Docker)

Build the image:

```bash
podman build -t budget-helper .
# or
docker build -t budget-helper .
```

Run the container:

```bash
podman run --rm --name budget-helper -p 5173:5173 budget-helper
# or
docker run --rm --name budget-helper -p 5173:5173 budget-helper
```

Open on this PC:

- http://localhost:5173

To expose specifically on your LAN IP (example):

```bash
podman run --rm --name budget-helper -p 192.168.1.19:5173:5173 budget-helper
```

For UFW firewall steps on CachyOS/Linux, see [UFW_FIREWALL_LAN_ACCESS.md](UFW_FIREWALL_LAN_ACCESS.md).

### Google Sheets integration (optional)

To use the "Sync to Sheets" feature you need a Google OAuth 2.0 client ID:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project and enable the **Google Sheets API** and **Google Drive API**
3. Create an OAuth 2.0 **Web Application** credential
4. Add `http://localhost:5173` as an authorised JavaScript origin
5. Copy the Client ID and add it to a `.env.local` file:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Available scripts

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm test             # Run test suite (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

## Subsite artifact for mwrobel.io

This repository includes a workflow that builds BudgetHelper for subpath hosting and publishes a GitHub artifact:

- Workflow: `.github/workflows/build-subsite-artifact.yml`
- Artifact name: `budget-helper-subsite`
- Build base path: `/projects/budget-helper/`

Artifact contents:

- `projects/budget-helper/**` (ready to copy into the main site's published static root)
- `build-info.json` (source commit/run metadata)

The main site deployment can download this artifact and merge it into its output before deploying to Azure Static Web Apps.

## Running the tests

The test suite uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and [jsdom](https://github.com/jsdom/jsdom).

```bash
npm test
```

Expected output:

```
Test Files  9 passed (9)
     Tests  159 passed (159)
```

### Test files

| File | What it covers |
|------|----------------|
| `src/test/budgetCalculator.test.js` | `findSavingsLinkedItem`, `computeSectionTotals`, `computeBudgetSummary`, `computeAnnualTotal` |
| `src/test/budgetReducer.test.js` | All reducer actions (SET_BUDGET, ADD/UPDATE/DELETE/MOVE item and section) |
| `src/test/generateBudget.test.js` | `generateBudget` wizard output, `createDefaultBudget` |
| `src/test/formulaGenerator.test.js` | Row layout computation, sheet formula generation, savings auto-rows |
| `src/test/sheetParser.test.js` | Pull-from-Sheets parsing, change detection, value/name/note updates |
| `src/test/useUndoReducer.test.js` | Undo/redo state management hook |
| `src/test/DuplicateBudgetModal.test.jsx` | Name pre-fill, year field, keep/zero toggle, confirm/cancel |
| `src/test/BudgetWizard.test.jsx` | Multi-step wizard navigation, section/item selection, budget creation |
| `src/test/BudgetSection.test.jsx` | Section rendering, add-item flow, total row visibility |

## Project structure

```
src/
  components/
    BudgetItem.jsx           Single editable row (month cells, actions)
    BudgetPickerModal.jsx    Switch between multiple budgets
    BudgetSection.jsx        Section header row, item rows, total row, inline chart
    BudgetTable.jsx          Outer table shell, renders BudgetSection per section
    BudgetWizard.jsx         Multi-step wizard for creating a new budget
    ChartsPanel.jsx          Full-width charts above table (income/expense only)
    DuplicateBudgetModal.jsx Duplicate an existing budget with options
    GoogleSyncModal.jsx      Google Sheets push/pull sync UI
    Header.jsx               Top bar: title, year, import/export, sync button
    ItemEditor.jsx           Modal: edit item name, color, values, flags, savings mode
    SectionChart.jsx         Inline per-section chart
    SectionManager.jsx       Modal: add/reorder/delete sections
  services/
    apiFetch.js              Shared fetch wrapper for Google API calls
    googleAuth.js            Google Identity Services token flow (in-memory cache)
    googleDrive.js           Drive file listing, creation, and app-property tagging
    googleSheets.js          Sheets REST API v4 wrapper
  utils/
    budgetCalculator.js      Live JS totals — must mirror formulaGenerator.js logic
    budgetReducer.js         useReducer actions for budget state mutations
    chartUtils.js            Shared chart data helpers
    defaultBudget.js         Factory for a blank budget
    formulaGenerator.js      Builds Google Sheets batchUpdate payload with formulas
    generateBudget.js        Budget wizard generation logic
    sheetParser.js           Parses sheet data back into budget model (pull sync)
    useUndoReducer.js        Undo/redo wrapper around useReducer
  test/                      Test files
```

## Tech stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/) for charts
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) for tests
- Google Sheets API v4 + Google Identity Services for OAuth

## How the app identifies its Google Sheets

BudgetHelper uses the **Google Drive API `appProperties`** mechanism to tag and identify sheets it creates. This is a per-app metadata field invisible to users — it does not modify the sheet content or sharing settings.

### How it works

When the app creates a new spreadsheet via the Drive API, it sets a custom app property:

```json
{
  "appProperties": { "budgethelper": "1" }
}
```

When listing sheets in the sync modal, the app queries Drive for files matching:

```
appProperties has { key='budgethelper' and value='1' }
  AND mimeType='application/vnd.google-apps.spreadsheet'
  AND trashed=false
```

This means:

- **Only sheets created by BudgetHelper appear** in the sync modal — it cannot see or modify unrelated spreadsheets
- **The tag is scoped to your OAuth Client ID** — sheets tagged by one deployment's Client ID are not visible to a different Client ID, even for the same Google account
- **Users see nothing different** — `appProperties` are hidden from the Google Sheets UI and don't affect the sheet content
- **Manually created sheets won't appear** — if a user creates a spreadsheet directly in Google Sheets, it won't have the `budgethelper` app property and will not show up in the app

### What the app writes to a sheet

On **push** (app → Sheets), the app:

1. Clears columns A–P of the target sheet
2. Writes a header row: blank, January–December, Total, Avg/month, Notes
3. Writes each budget item as a row with monthly values in columns B–M
4. Writes `=SUM(B:M)` and `=N/12` formulas in the Total (N) and Average (O) columns
5. Writes section total rows with SUM formulas referencing the item rows above
6. Writes a "Remaining" row with formulas: `income totals − expense totals`
7. Writes a "Running balance" row with cumulative month-over-month formulas
8. Applies formatting: section background colors, bold on totals, number format, column widths, frozen header row and label column

The resulting spreadsheet is **fully self-contained** — all values use Sheets formulas, so it works standalone without the app.

On **pull** (Sheets → app), the app reads the sheet data and compares it against the local budget using the same row layout logic. Changed values, names, and notes are presented for review before being applied.

### OAuth scopes requested

| Scope | Purpose |
|-------|---------|
| `spreadsheets` | Read and write spreadsheet cell values, formulas, and formatting |
| `drive.file` | Create new spreadsheets and manage files the app created (app-property tagging) |
| `drive.metadata.readonly` | List Drive folders for the optional folder picker when creating a new sheet |

The `drive.file` scope only grants access to files the app itself created — it cannot see or modify the user's other Drive files.
