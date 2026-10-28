// Pretty-prints JSON with numeric arrays kept on one line (e.g. "position": [0, 0.4, 0]),
// so hand-edited data files stay readable. Shared by the debug panel and vite.config.js.
export function formatJson(data, decimals = 3) {
  const factor = 10 ** decimals
  const round = (_key, value) => (typeof value === 'number' ? Math.round(value * factor) / factor : value)
  return (
    JSON.stringify(data, round, 2).replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_m, inner) =>
      `[${inner.split(/,\s*/).join(', ')}]`,
    ) + '\n'
  )
}
