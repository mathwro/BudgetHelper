import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BudgetWizard from '../components/BudgetWizard'

function renderWizard(props = {}) {
  const onComplete = props.onComplete ?? vi.fn()
  const onClose = props.onClose ?? vi.fn()
  const onCreateBlank = props.onCreateBlank
  const onPullFromGoogle = props.onPullFromGoogle
  const canClose = props.canClose ?? false
  render(
    <BudgetWizard
      canClose={canClose}
      onComplete={onComplete}
      onClose={onClose}
      onCreateBlank={onCreateBlank}
      onPullFromGoogle={onPullFromGoogle}
    />
  )
  return { onComplete, onClose }
}

// Step 2 has 4 section checkboxes: Income, Fixed expenses, Variable expenses, Savings goals.
// By default income + fixed + variable are checked. We need to uncheck all three
// to get a wizard with no income for the "no income" path.

async function advanceToStep2(user) {
  await user.click(screen.getByRole('button', { name: /next/i }))
}

async function advanceToStep3(user) {
  await advanceToStep2(user)
  await user.click(screen.getByRole('button', { name: /next/i }))
}

// The section checkboxes on step 2 are wrapped in <label> elements that contain
// both a <strong> (section name) and a <span> (description). The accessible name
// computed by RTL is the full concatenation, e.g. "IncomeSalary, freelance, dividends…".
// We use getAllByRole('checkbox') and index into them by position:
//   0 = Income, 1 = Fixed expenses, 2 = Variable expenses, 3 = Savings goals

function getSectionCheckboxes() {
  return screen.getAllByRole('checkbox')
}

// Uncheck Income on step 2 (it's pre-selected by default)
async function uncheckIncome(user) {
  const checkboxes = getSectionCheckboxes()
  await user.click(checkboxes[0]) // Income is first
}

describe('BudgetWizard', () => {
  describe('step 1 — initial render', () => {
    it('shows the "New budget" heading on mount', () => {
      renderWizard()
      expect(screen.getByRole('heading', { name: /new budget/i })).toBeInTheDocument()
    })

    it('shows a Budget name input on step 1', () => {
      renderWizard()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('shows a Year numeric input on step 1', () => {
      renderWizard()
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })

    it('shows "Next →" button on step 1', () => {
      renderWizard()
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })

    it('does not show a Back button on step 1', () => {
      renderWizard()
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    })
  })

  describe('step 1 → step 2 navigation', () => {
    it('clicking Next on step 1 advances to step 2', async () => {
      const user = userEvent.setup()
      renderWizard()
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByRole('heading', { name: /choose sections/i })).toBeInTheDocument()
    })
  })

  describe('step 2 — section selection', () => {
    it('shows hint text about which sections to track', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      expect(screen.getByText(/which sections do you want to track/i)).toBeInTheDocument()
    })

    it('shows all four section options as checkboxes', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      // 4 section checkboxes: Income, Fixed expenses, Variable expenses, Savings goals
      expect(getSectionCheckboxes()).toHaveLength(4)
    })

    it('income section checkbox is pre-checked by default', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      // Income is first checkbox (index 0) and pre-selected by default
      expect(getSectionCheckboxes()[0]).toBeChecked()
    })

    it('shows a Back button on step 2', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('clicking Back on step 2 returns to step 1', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      await user.click(screen.getByRole('button', { name: /back/i }))
      expect(screen.getByRole('heading', { name: /new budget/i })).toBeInTheDocument()
    })

    it('clicking Next on step 2 advances to step 3', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByRole('heading', { name: /choose items/i })).toBeInTheDocument()
    })
  })

  describe('step 3 — item selection', () => {
    it('shows step-3 hint text about choosing items', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep3(user)
      expect(screen.getByText(/choose which items to include/i)).toBeInTheDocument()
    })

    it('shows a Back button on step 3', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep3(user)
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('clicking Back on step 3 returns to step 2', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep3(user)
      await user.click(screen.getByRole('button', { name: /back/i }))
      expect(screen.getByRole('heading', { name: /choose sections/i })).toBeInTheDocument()
    })

    it('shows "Next →" button on step 3 when income is selected', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep3(user)
      // income is selected by default — button should say "Next →"
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    })

    it('shows "Create budget" button on step 3 when income is NOT selected', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep2(user)
      await uncheckIncome(user)
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByRole('button', { name: /create budget/i })).toBeInTheDocument()
    })

    it('clicking Next on step 3 (with income) advances to step 4', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep3(user)
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.getByRole('heading', { name: /income sources/i })).toBeInTheDocument()
    })
  })

  describe('step 4 — income sources (path with income selected)', () => {
    async function advanceToStep4(user) {
      await advanceToStep3(user)
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    it('shows "Income sources" heading on step 4', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep4(user)
      expect(screen.getByRole('heading', { name: /income sources/i })).toBeInTheDocument()
    })

    it('shows hint text about income sources being optional', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep4(user)
      expect(screen.getByText(/optional/i)).toBeInTheDocument()
    })

    it('shows a Back button on step 4', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep4(user)
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('clicking Back on step 4 returns to step 3', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep4(user)
      await user.click(screen.getByRole('button', { name: /back/i }))
      expect(screen.getByRole('heading', { name: /choose items/i })).toBeInTheDocument()
    })

    it('shows "Create budget" and "Skip" buttons on step 4', async () => {
      const user = userEvent.setup()
      renderWizard()
      await advanceToStep4(user)
      expect(screen.getByRole('button', { name: /create budget/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    it('"Create budget" button calls onComplete with a valid budget object', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      render(
        <BudgetWizard canClose={false} onComplete={onComplete} onClose={vi.fn()} />
      )
      await advanceToStep4(user)
      await user.click(screen.getByRole('button', { name: /create budget/i }))
      expect(onComplete).toHaveBeenCalledOnce()
      const budget = onComplete.mock.calls[0][0]
      expect(budget).toHaveProperty('id')
      expect(Array.isArray(budget.sections)).toBe(true)
      expect(budget.sections.length).toBeGreaterThan(0)
      const summarySection = budget.sections.find(s => s.type === 'summary')
      expect(summarySection).toBeDefined()
    })

    it('"Skip" button also calls onComplete with a valid budget object', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      render(
        <BudgetWizard canClose={false} onComplete={onComplete} onClose={vi.fn()} />
      )
      await advanceToStep4(user)
      await user.click(screen.getByRole('button', { name: /skip/i }))
      expect(onComplete).toHaveBeenCalledOnce()
      const budget = onComplete.mock.calls[0][0]
      expect(budget).toHaveProperty('id')
      expect(Array.isArray(budget.sections)).toBe(true)
    })
  })

  describe('finishing without income (no step 4)', () => {
    it('"Create budget" on step 3 (no income) calls onComplete with a valid budget', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      render(
        <BudgetWizard canClose={false} onComplete={onComplete} onClose={vi.fn()} />
      )
      // Go to step 2, uncheck income, go to step 3
      await advanceToStep2(user)
      await uncheckIncome(user)
      await user.click(screen.getByRole('button', { name: /next/i }))
      // Now on step 3 with no income — button says "Create budget"
      await user.click(screen.getByRole('button', { name: /create budget/i }))
      expect(onComplete).toHaveBeenCalledOnce()
      const budget = onComplete.mock.calls[0][0]
      expect(budget).toHaveProperty('id')
      expect(Array.isArray(budget.sections)).toBe(true)
      // No income section present
      const incomeSection = budget.sections.find(s => s.type === 'income')
      expect(incomeSection).toBeUndefined()
      // Summary section always added
      const summarySection = budget.sections.find(s => s.type === 'summary')
      expect(summarySection).toBeDefined()
    })
  })

  describe('canClose prop', () => {
    it('hides the close button when canClose is false', () => {
      renderWizard({ canClose: false })
      expect(screen.queryByTitle('Close')).not.toBeInTheDocument()
    })

    it('shows the close button when canClose is true', () => {
      renderWizard({ canClose: true })
      expect(screen.getByTitle('Close')).toBeInTheDocument()
    })

    it('clicking the close button calls onClose when canClose is true', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <BudgetWizard canClose={true} onComplete={vi.fn()} onClose={onClose} />
      )
      await user.click(screen.getByTitle('Close'))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('step 1 quick actions', () => {
    it('shows quick action buttons when callbacks are provided', () => {
      renderWizard({ onCreateBlank: vi.fn(), onPullFromGoogle: vi.fn() })
      expect(screen.getByRole('button', { name: /create blank budget/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pull from google sheet/i })).toBeInTheDocument()
    })

    it('calls onCreateBlank with current name and year', async () => {
      const user = userEvent.setup()
      const onCreateBlank = vi.fn()
      renderWizard({ onCreateBlank })
      const year = new Date().getFullYear()
      await user.type(screen.getByRole('textbox'), 'My Blank Budget')
      await user.click(screen.getByRole('button', { name: /create blank budget/i }))
      expect(onCreateBlank).toHaveBeenCalledWith({ name: 'My Blank Budget', year })
    })

    it('calls onPullFromGoogle with current name and year', async () => {
      const user = userEvent.setup()
      const onPullFromGoogle = vi.fn()
      renderWizard({ onPullFromGoogle })
      const year = new Date().getFullYear()
      await user.type(screen.getByRole('textbox'), 'Imported Budget')
      await user.click(screen.getByRole('button', { name: /pull from google sheet/i }))
      expect(onPullFromGoogle).toHaveBeenCalledWith({ name: 'Imported Budget', year })
    })
  })
})
