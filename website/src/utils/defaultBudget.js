import { v4 as uuidv4 } from 'uuid'

export function createDefaultBudget() {
  const year = new Date().getFullYear()

  function item(name, values, note = '') {
    return {
      id: uuidv4(),
      name,
      color: null,
      note,
      monthlyValues: Array.isArray(values)
        ? values
        : Array(12).fill(values),
    }
  }

  return {
    id: uuidv4(),
    title: `Budget ${year}`,
    year,
    linkedSheetId: null,
    sections: [
      {
        id: uuidv4(),
        name: 'Income',
        type: 'income',
        color: '#0f2e1a',
        showTotal: true,
        totalLabel: 'Total income',
        items: [
          item('Gross salary', 73500),
          item('Bonus', [0,0,0,0,0,0,0,0,0,0,0,20000]),
          item('Net income', 43031),
          item('Stock dividends', 0),
          item('Other', 0),
        ],
      },
      {
        id: uuidv4(),
        name: 'Fixed expenses',
        type: 'expense',
        color: '#2e1a06',
        showTotal: true,
        totalLabel: 'Total fixed expenses',
        items: [
          item('Mortgage', 28331.42),
          item('Property tax', 3012.08),
          item('Home insurance', 867),
          item('Electricity', 1200),
          item('Heating', 1500),
          item('Water', 300),
          item('Internet', 299),
          item('Phone', 149),
          item('Streaming (Netflix, Spotify…)', 200),
          item('Car insurance', 850),
          item('Fuel', 1200),
          item('Memberships / clubs', 300),
        ],
      },
      {
        id: uuidv4(),
        name: 'Variable expenses',
        type: 'expense',
        color: '#2e0a15',
        showTotal: true,
        totalLabel: 'Total variable expenses',
        items: [
          item('Groceries & household', 5000),
          item('Restaurants / takeaway', 1000),
          item('Clothing & shoes', 500),
          item('Leisure & hobbies', 500),
          item('Gifts', 500),
          item('Health & pharmacy', 300),
          item('Travel & holidays', [0,0,0,0,0,10000,0,0,0,0,0,0]),
          item('Unexpected expenses', 500),
        ],
      },
      {
        id: uuidv4(),
        name: 'Summary',
        type: 'summary',
        color: '#0a1828',
        showTotal: false,
        totalLabel: '',
        items: [],
      },
    ],
  }
}
