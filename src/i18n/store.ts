import { useSyncExternalStore } from 'react'
import { DICTS, LANGS, type Lang, type TranslationKey } from './dict'

const STORAGE_KEY = 'joe.lang'

function readInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang
  return navigator.language.toLowerCase().startsWith('th') ? 'th' : 'en'
}

let lang: Lang = readInitialLang()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Lang {
  return lang
}

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.lang = next
  listeners.forEach((l) => l())
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

type Vars = Record<string, string | number>

/** Replaces `{placeholder}` tokens. Unknown tokens are left untouched. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export type TFunction = (key: TranslationKey, vars?: Vars) => string

export function useT(): TFunction {
  const current = useLang()
  return (key, vars) => interpolate(DICTS[current][key], vars)
}

export function toggleLang() {
  setLang(lang === 'en' ? 'th' : 'en')
}
