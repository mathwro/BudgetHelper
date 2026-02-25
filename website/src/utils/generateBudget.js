import { v4 as uuidv4 } from 'uuid'

export const SECTION_TEMPLATES = {
  income: {
    name: 'Income',
    color: '#2d8050',
    totalLabel: 'Total income',
    type: 'income',
    items: [{ name: 'Salary', monthlyValues: Array(12).fill(0) }],
  },
  fixed: {
    name: 'Fixed expenses',
    color: '#b37520',
    totalLabel: 'Total fixed expenses',
    type: 'expense',
    items: [{ name: 'Rent / Mortgage', monthlyValues: Array(12).fill(0) }],
  },
  variable: {
    name: 'Variable expenses',
    color: '#b03020',
    totalLabel: 'Total variable expenses',
    type: 'expense',
    items: [{ name: 'Groceries', monthlyValues: Array(12).fill(0) }],
  },
  savings: {
    name: 'Savings',
    color: '#2560a0',
    totalLabel: 'Total savings',
    type: 'savings',
    items: [{ name: 'Emergency fund', monthlyValues: Array(12).fill(0) }],
  },
}

function makeItem(template) {
  return {
    id: uuidv4(),
    name: template.name,
    color: null,
    note: '',
    excluded: false,
    negative: false,
    savingsLink: null,
    savingsPercentage: null,
    monthlyValues: [...template.monthlyValues],
  }
}

export function generateBudget({ name, year, selectedSections, selectedItems, incomeItems }) {
  const sections = []

  for (const key of selectedSections) {
    const tmpl = SECTION_TEMPLATES[key]
    const providedNames = selectedItems?.[key]
    const items = providedNames
      ? providedNames.map(iName => makeItem({ name: iName, monthlyValues: Array(12).fill(0) }))
      : tmpl.items.map(makeItem)

    sections.push({
      id: uuidv4(),
      name: tmpl.name,
      type: tmpl.type,
      color: tmpl.color,
      showTotal: true,
      totalLabel: tmpl.totalLabel,
      items,
    })
  }

  // Override income section items if user entered values
  if (incomeItems?.length) {
    const incomeSection = sections.find(s => s.type === 'income')
    if (incomeSection) {
      incomeSection.items = incomeItems.map(({ name: iName, monthly }) => ({
        id: uuidv4(),
        name: iName,
        color: null,
        note: '',
        excluded: false,
        negative: false,
        savingsLink: null,
        savingsPercentage: null,
        monthlyValues: Array(12).fill(Number(monthly) || 0),
      }))
    }
  }

  // Always append a summary section
  sections.push({
    id: uuidv4(),
    name: 'Summary',
    type: 'summary',
    color: '#2560a0',
    showTotal: false,
    totalLabel: '',
    items: [],
  })

  return {
    id: uuidv4(),
    title: name.trim() || `Budget ${year}`,
    year,
    linkedSheetId: null,
    sections,
  }
}
