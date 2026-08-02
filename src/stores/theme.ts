import { useSyncExternalStore } from 'react'
import { DEFAULT_PALETTE_ID, paletteById, type Palette } from '@/theme/palettes'

/**
 * The palette in force.
 *
 * The UI half is written onto the document as inline custom properties, which
 * shadow the ones Tailwind emits from `@theme` — so every `bg-paper`,
 * `text-ink` and so on follows without a rebuild. The scene half is handed to
 * the 3D components, which have no stylesheet to read.
 *
 * The choice is kept in localStorage so a reload does not throw it away.
 */
const KEY = 'joe:palette'

let current: Palette = paletteById(readStored())
const listeners = new Set<() => void>()

function readStored() {
  try {
    return localStorage.getItem(KEY) ?? DEFAULT_PALETTE_ID
  } catch {
    // Private browsing and the like — the default is a fine answer.
    return DEFAULT_PALETTE_ID
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return current
}

/** Writes the UI colours onto :root. Safe to call repeatedly. */
export function applyPalette(palette: Palette = current) {
  const root = document.documentElement.style
  root.setProperty('--color-paper', palette.ui.paper)
  root.setProperty('--color-panel', palette.ui.panel)
  root.setProperty('--color-ink', palette.ui.ink)
  root.setProperty('--color-ink-muted', palette.ui.inkMuted)
  root.setProperty('--color-brand-orange', palette.ui.brand)
  root.setProperty('--color-brand-orange-dark', palette.ui.brandDark)
  root.setProperty('--color-brand-blue', palette.ui.blue)
  root.setProperty('--color-brand-red', palette.ui.red)
}

export function setPalette(id: string) {
  const next = paletteById(id)
  if (next.id === current.id) return
  current = next
  applyPalette(next)
  try {
    localStorage.setItem(KEY, next.id)
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }
  listeners.forEach((l) => l())
}

// Applied at import rather than from an effect: the first paint should already
// be in the chosen theme, not flash the default and correct itself.
if (typeof document !== 'undefined') applyPalette(current)

export function usePalette(): Palette {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
