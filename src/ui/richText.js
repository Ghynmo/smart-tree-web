import { formatNumber, t } from '../i18n/i18n.js'

// Translated text with `{name}` placeholders filled from `facts`, as DOM nodes (no innerHTML).
// facts: { name: { value: number | [min, max], unit: key under units.*, digits } }
// Each value + unit is wrapped in <bdi dir="ltr">, so "120 W" or "150–180 cm" never flips
// inside Arabic text (a dash between two numbers would otherwise reverse the range).
export function richText(key, facts = {}) {
  return t(key)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1]
      return name && facts[name] ? factNode(facts[name]) : document.createTextNode(part)
    })
}

function factNode({ value, unit, digits = 0 }) {
  const format = (v) => formatNumber(v, { maximumFractionDigits: digits })
  const bdi = document.createElement('bdi')
  bdi.dir = 'ltr'
  bdi.textContent = `${Array.isArray(value) ? value.map(format).join('–') : format(value)} ${t(`units.${unit}`)}`
  return bdi
}
