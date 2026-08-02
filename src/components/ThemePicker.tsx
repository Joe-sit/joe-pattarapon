import { useState } from 'react'
import { PALETTES } from '@/theme/palettes'
import { setPalette, usePalette } from '@/stores/theme'

/**
 * A floating picker for the site's dark palettes.
 *
 * Each row shows the theme's own colours rather than a name alone — the sky,
 * the platform and the four orbs, in the order the hero uses them, so the swatch
 * reads as a preview of the scene instead of a legend.
 *
 * Collapsed to a single button by default: it sits over the hero, and the hero
 * is the thing being judged.
 */
export function ThemePicker() {
  const [open, setOpen] = useState(false)
  const active = usePalette()

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {open && (
        <div className="w-64 rounded-2xl bg-panel/95 p-2 shadow-3xl backdrop-blur">
          {PALETTES.map((palette) => {
            const selected = palette.id === active.id
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => setPalette(palette.id)}
                className={`flex w-full cursor-pointer flex-col gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  selected ? 'bg-ink/10' : 'hover:bg-ink/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{palette.name}</span>
                  {selected && (
                    <span className="size-1.5 rounded-full bg-brand-orange" aria-hidden="true" />
                  )}
                </div>

                <span className="text-[11px] leading-tight text-ink-muted">{palette.note}</span>

                <span className="flex items-center gap-1" aria-hidden="true">
                  <span
                    className="h-4 w-8 rounded-md"
                    style={{
                      background: `linear-gradient(180deg, ${palette.scene.sky[0]}, ${palette.scene.sky[3]})`,
                    }}
                  />
                  {palette.scene.orbs.map((orb) => (
                    <span
                      key={orb}
                      className="size-4 rounded-full"
                      style={{ background: orb }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded-full bg-panel/95 px-4 py-2 text-xs font-medium text-ink shadow-3xl backdrop-blur transition-colors hover:bg-panel"
      >
        {open ? 'Close' : `Theme: ${active.name}`}
      </button>
    </div>
  )
}
