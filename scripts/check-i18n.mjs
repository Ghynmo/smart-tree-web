// Validate locale files against the reference locale (id.json).
// Checks: same key set, no empty strings, same {placeholders}, no Arabic-Indic digits (Latin-only rule).
// `_meta` blocks are ignored. Exit code 1 on any error.
// Usage: node scripts/check-i18n.mjs

import fs from 'node:fs/promises'
import path from 'node:path'

const DIR = 'src/i18n/locales'
const REFERENCE = 'id'
const NON_LATIN_DIGITS = /[٠-٩۰-۹]/

function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (key === '_meta') continue
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, full, out)
    else out.set(full, value)
  }
  return out
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'))
const locales = {}
for (const f of files) locales[path.basename(f, '.json')] = flatten(JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8')))

const ref = locales[REFERENCE]
const errors = []
for (const [lang, entries] of Object.entries(locales)) {
  for (const key of ref.keys()) if (!entries.has(key)) errors.push(`${lang}: missing "${key}"`)
  for (const [key, value] of entries) {
    if (!ref.has(key)) errors.push(`${lang}: extra key "${key}" (not in ${REFERENCE}.json)`)
    if (typeof value !== 'string' || !value.trim()) errors.push(`${lang}: "${key}" is empty or not a string`)
    else if (NON_LATIN_DIGITS.test(value)) errors.push(`${lang}: "${key}" uses Arabic-Indic digits; use Latin 0-9`)
    if (ref.has(key) && placeholders(value) !== placeholders(ref.get(key)))
      errors.push(`${lang}: "${key}" placeholders {${placeholders(value)}} ≠ {${placeholders(ref.get(key))}}`)
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  console.error(`\n${errors.length} problem(s) in ${files.length} locale files`)
  process.exit(1)
}
console.log(`✓ ${files.length} locales (${Object.keys(locales).join(', ')}), ${ref.size} keys each, all consistent`)
