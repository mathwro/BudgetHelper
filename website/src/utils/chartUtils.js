// Takes any hex color, extracts the hue, and returns a vivid version
// suitable for display on a dark background.
export function toChartColor(hex) {
  if (!hex || hex.length < 7) return '#c8a96e'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  if (d < 0.02) return 'hsl(0, 0%, 58%)'
  let h = 0
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    case b: h = ((r - g) / d + 4) / 6; break
  }
  return `hsl(${Math.round(h * 360)}, 60%, 55%)`
}

export function fmt(value) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)
}
