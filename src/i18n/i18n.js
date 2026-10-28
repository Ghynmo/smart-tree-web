import { emit } from '../app/state.js'
import ar from './locales/ar.json'
import en from './locales/en.json'
import id from './locales/id.json'

// All locales are bundled (a few KB) so language switching works offline and without reload.
const LOCALES = { id, en, ar }
export const LANGUAGES = Object.keys(LOCALES)
const RTL = new Set(['ar'])
const FALLBACK = 'id'
const STORAGE_KEY = 'smarttree.lang'
// Legacy/alternate browser tags that map to a supported language.
const ALIASES = { in: 'id' }

let current = FALLBACK

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict)

export function t(key, vars) {
  const value = lookup(LOCALES[current], key) ?? lookup(LOCALES[FALLBACK], key)
  if (typeof value !== 'string') {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
    return key
  }
  return vars ? value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match)) : value
}

export const getLanguage = () => current
export const isRtl = (lang = current) => RTL.has(lang)

// Latin digits in every language (project rule), with the language's own separators.
export function formatNumber(value, options) {
  return new Intl.NumberFormat(`${current}-u-nu-latn`, options).format(value)
}

// Time of day from minutes since midnight, 24 h, Latin digits (e.g. "10:05").
export function formatClock(minutes) {
  const date = new Date(Date.UTC(2000, 0, 1, 0, Math.floor(minutes) % (24 * 60)))
  return new Intl.DateTimeFormat(`${current}-u-nu-latn`, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date)
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function store(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage blocked (private mode, policy): the choice simply isn't remembered.
  }
}

export function detectLanguage() {
  const stored = readStored()
  if (LANGUAGES.includes(stored)) return stored
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0]
    const lang = ALIASES[base] ?? base
    if (LANGUAGES.includes(lang)) return lang
  }
  return FALLBACK
}

// <el data-i18n="key"> sets textContent; <el data-i18n-attr="aria-label:key;title:key"> sets attributes.
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim())
      el.setAttribute(attr, t(key))
    }
  }
}

export function setLanguage(lang, { persist = true } = {}) {
  current = LANGUAGES.includes(lang) ? lang : FALLBACK
  const html = document.documentElement
  html.lang = current
  html.dir = isRtl() ? 'rtl' : 'ltr'
  document.title = t('meta.title')
  applyTranslations()
  if (persist) store(current)
  emit('lang:change', { lang: current, dir: html.dir })
}

export function initI18n() {
  setLanguage(detectLanguage(), { persist: false })
}
