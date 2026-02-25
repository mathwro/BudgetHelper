import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import DuplicateBudgetModal from '../components/DuplicateBudgetModal'

const currentYear = new Date().getFullYear()

function makeSource({ title = 'Budget', year = currentYear } = {}) {
  return { title, year }
}

function renderModal(sourceOverrides = {}, props = {}) {
  const onConfirm = props.onConfirm ?? vi.fn()
  const onClose = props.onClose ?? vi.fn()
  const source = makeSource(sourceOverrides)
  render(
    <DuplicateBudgetModal
      source={source}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
  return { onConfirm, onClose, source }
}

// The component uses <label> elements without htmlFor (no explicit association),
// so getByLabelText does not work. We query inputs by role index instead:
// textbox[0] = "New budget name", spinbutton[0] = "Year".
function getNameInput() {
  return screen.getAllByRole('textbox')[0]
}

function getYearInput() {
  return screen.getAllByRole('spinbutton')[0]
}

describe('DuplicateBudgetModal', () => {
  describe('name field pre-filling', () => {
    it('pre-fills name with "Budget <year+1>" when source year is current year', () => {
      renderModal({ title: 'Budget ' + currentYear, year: currentYear })
      expect(getNameInput().value).toBe('Budget ' + (currentYear + 1))
    })

    it('pre-fills name with "Budget copy" when source year is in the past', () => {
      renderModal({ title: 'Budget 2020', year: 2020 })
      expect(getNameInput().value).toBe('Budget copy')
    })
  })

  describe('year field', () => {
    it('defaults year to source.year + 1', () => {
      renderModal({ title: 'Budget ' + currentYear, year: currentYear })
      expect(Number(getYearInput().value)).toBe(currentYear + 1)
    })

    it('defaults year to past source.year + 1 when source is in the past', () => {
      renderModal({ title: 'Budget 2022', year: 2022 })
      expect(Number(getYearInput().value)).toBe(2023)
    })
  })

  describe('values toggle', () => {
    it('"Zero out values" button has active class by default', () => {
      renderModal()
      const zeroBtn = screen.getByRole('button', { name: /zero out values/i })
      expect(zeroBtn.className).toContain('active')
    })

    it('"Keep values" button does NOT have active class by default', () => {
      renderModal()
      const keepBtn = screen.getByRole('button', { name: /keep values/i })
      expect(keepBtn.className).not.toContain('active')
    })

    it('clicking "Keep values" gives it the active class', async () => {
      const user = userEvent.setup()
      renderModal()
      const keepBtn = screen.getByRole('button', { name: /keep values/i })
      await user.click(keepBtn)
      expect(keepBtn.className).toContain('active')
    })

    it('clicking "Keep values" removes active class from "Zero out values"', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByRole('button', { name: /keep values/i }))
      const zeroBtn = screen.getByRole('button', { name: /zero out values/i })
      expect(zeroBtn.className).not.toContain('active')
    })
  })

  describe('Duplicate (confirm) button', () => {
    it('calls onConfirm with keepValues: false when zero-out is active', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderModal({ title: 'Budget ' + currentYear, year: currentYear }, { onConfirm })
      await user.click(screen.getByRole('button', { name: /^duplicate$/i }))
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ keepValues: false })
      )
    })

    it('calls onConfirm with keepValues: true when "Keep values" is selected', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderModal({ title: 'Budget ' + currentYear, year: currentYear }, { onConfirm })
      await user.click(screen.getByRole('button', { name: /keep values/i }))
      await user.click(screen.getByRole('button', { name: /^duplicate$/i }))
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ keepValues: true })
      )
    })

    it('calls onConfirm with the current name value', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderModal({ title: 'Budget ' + currentYear, year: currentYear }, { onConfirm })
      const nameInput = getNameInput()
      await user.clear(nameInput)
      await user.type(nameInput, 'My Custom Budget')
      await user.click(screen.getByRole('button', { name: /^duplicate$/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Custom Budget' })
      )
    })

    it('calls onConfirm with suggestedName when name field is cleared', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderModal({ title: 'Budget ' + currentYear, year: currentYear }, { onConfirm })
      const nameInput = getNameInput()
      await user.clear(nameInput)
      await user.click(screen.getByRole('button', { name: /^duplicate$/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Budget ' + (currentYear + 1) })
      )
    })

    it('calls onConfirm with the current year value', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderModal({ title: 'Budget ' + currentYear, year: currentYear }, { onConfirm })
      await user.click(screen.getByRole('button', { name: /^duplicate$/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ year: currentYear + 1 })
      )
    })
  })

  describe('Cancel button', () => {
    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderModal({}, { onClose })
      await user.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('Close (x) button', () => {
    it('calls onClose when the x button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderModal({}, { onClose })
      await user.click(screen.getByRole('button', { name: '✕' }))
      expect(onClose).toHaveBeenCalledOnce()
    })
  })
})
