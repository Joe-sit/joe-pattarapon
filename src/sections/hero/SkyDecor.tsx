import { useEffect, useRef } from 'react'
import { panProgress } from './story'
import { useEyeOpen } from '@/stores/intro'
import { usePalette } from '@/stores/theme'

/**
 * The sky band above the platform: sun, drifting clouds, floating confetti.
 *
 * Flat SVG rather than 3D on purpose — the true horizon sits above the frame at
 * this camera, so nothing in the scene can occupy the sky. Drawing it in screen
 * space also keeps it in the same 2.5D register as the rest of the art.
 */

const VIEW = { w: 1440, h: 280 }

/**
 * Headroom above the artwork, in user units. The band slides down by
 * PARALLAX_PX during the intro; without a painted run above the artwork the
 * band's own sky would start on a hard edge partway down the screen.
 */
const HEADROOM = 320

/**
 * How far the band travels over the camera pan, in px.
 *
 * Strictly a pedestal move leaves an infinitely distant sky untouched, but the
 * story here needs the eye to open on sky: the band starts far enough down that
 * the sun, clouds and confetti sit inside the aperture, then rides up to its
 * resting place as the camera settles on the platform.
 */
const PARALLAX_PX = 300

/**
 * How far the band slides against the pointer, in px.
 *
 * Opposite the lens: swinging the camera right pushes distant things left, and
 * the band is the most distant thing there is. Smaller than the scene's own
 * sway for the same reason — parallax is what sells the depth.
 */
const SWAY_PX = { x: 26, y: 10 }

/** One cloud as a single path: overlapping circles would seam under a gradient. */
type Puff = { x: number; r: number }

function cloudPath(puffs: Puff[], baseline: number) {
  const first = puffs[0]
  const last = puffs[puffs.length - 1]
  let d = `M ${first.x - first.r} ${baseline}`
  for (const puff of puffs) {
    d += ` A ${puff.r} ${puff.r} 0 0 1 ${puff.x + puff.r} ${baseline}`
  }
  d += ` L ${last.x + last.r} ${baseline} Z`
  return d
}

const CLOUDS: { puffs: Puff[]; baseline: number; opacity: number }[] = [
  { puffs: [{ x: 110, r: 52 }, { x: 205, r: 62 }], baseline: 190, opacity: 0.95 },
  { puffs: [{ x: 470, r: 26 }, { x: 540, r: 46 }], baseline: 190, opacity: 0.8 },
  { puffs: [{ x: 820, r: 34 }], baseline: 190, opacity: 0.7 },
  { puffs: [{ x: 1000, r: 66 }, { x: 1110, r: 48 }, { x: 1190, r: 36 }], baseline: 190, opacity: 0.95 },
]

/** Squares are drawn rotated 45°, which is what reads as a sparkle. */
const CONFETTI: { x: number; y: number; size: number; outline?: boolean }[] = [
  { x: 62, y: 96, size: 6 },
  { x: 158, y: 38, size: 11 },
  { x: 246, y: 118, size: 8 },
  { x: 352, y: 26, size: 12, outline: true },
  { x: 448, y: 92, size: 9 },
  { x: 556, y: 44, size: 13 },
  { x: 644, y: 122, size: 7 },
  { x: 742, y: 32, size: 11, outline: true },
  { x: 838, y: 104, size: 12 },
  { x: 936, y: 52, size: 8 },
  { x: 1032, y: 128, size: 10 },
  { x: 1128, y: 34, size: 13, outline: true },
  { x: 1226, y: 100, size: 9 },
  { x: 1324, y: 58, size: 11 },
  { x: 1398, y: 126, size: 7 },
]

export function SkyDecor() {
  const bandRef = useRef<HTMLDivElement>(null)
  const introDone = useEyeOpen()
  const { scene: colors } = usePalette()

  useEffect(() => {
    const band = bandRef.current
    if (!band || !introDone) return

    const start = performance.now()
    const pointer = { x: 0, y: 0 }
    const sway = { x: 0, y: 0 }
    let last = start

    const onMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    // One loop for both moves: the pan is finite but the sway never ends, and
    // two writers on one transform would each drop the other's half.
    let frame = requestAnimationFrame(function step(now) {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      const k = 1 - Math.exp(-delta * 3.5)
      sway.x += (pointer.x - sway.x) * k
      sway.y += (pointer.y - sway.y) * k

      const p = panProgress((now - start) / 1000)
      const x = -sway.x * SWAY_PX.x * p
      const y = (1 - p) * PARALLAX_PX - sway.y * SWAY_PX.y * p
      band.style.transform = `translate(${x}px, ${y}px)`
      frame = requestAnimationFrame(step)
    })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [introDone])

  return (
    <div
      ref={bandRef}
      className="pointer-events-none absolute overflow-hidden"
      style={{
        // Wider than the viewport by more than the sway: sliding the band
        // sideways would otherwise uncover a strip of the section behind it.
        left: -(SWAY_PX.x + 8),
        right: -(SWAY_PX.x + 8),
        top: -HEADROOM,
        height: `calc(36vh + ${HEADROOM}px)`,
        transform: `translateY(${PARALLAX_PX}px)`,
      }}
    >
      <svg
        className="size-full"
        viewBox={`0 ${-HEADROOM} ${VIEW.w} ${VIEW.h + HEADROOM}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* The band carries its own sky so it still reads as sky once it has
              travelled down past the section's own gradient. The top stop
              matches that gradient exactly, so at rest nothing changes. */}
          {/* User-space so the ramp is pinned to the artwork, not to the
              rect's box — the headroom above stays the top colour. */}
          <linearGradient
            id="sky-field"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={VIEW.h}
          >
            <stop offset="0%" stopColor={colors.band[0]} />
            <stop offset="38%" stopColor={colors.band[1]} />
            <stop offset="78%" stopColor={colors.band[2]} />
            <stop offset="100%" stopColor={colors.band[3]} />
          </linearGradient>
          <linearGradient id="sky-cloud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="sky-moon-glow">
            <stop offset="0%" stopColor={colors.moonGlow} stopOpacity="0.55" />
            <stop offset="45%" stopColor={colors.moonGlow} stopOpacity="0.22" />
            <stop offset="100%" stopColor={colors.moonGlow} stopOpacity="0" />
          </radialGradient>
          {/* Crescent: the disc, minus a second disc biting into it from the
              right — the sun in the 3D scene is off to the left, so the lit
              limb has to be the left one. */}
          <mask id="sky-moon">
            <circle cx="436" cy="150" r="56" fill="white" />
            <circle cx="472" cy="136" r="50" fill="black" />
          </mask>
        </defs>

        <rect
          x="0"
          y={-HEADROOM}
          width={VIEW.w}
          height={VIEW.h + HEADROOM}
          fill="url(#sky-field)"
        />

        <g className="hero-moon">
          <circle cx="436" cy="150" r="150" fill="url(#sky-moon-glow)" />
          <circle
            cx="436"
            cy="150"
            r="56"
            fill={colors.moon}
            mask={colors.celestial === 'moon' ? 'url(#sky-moon)' : undefined}
          />
        </g>

        {/* Two copies a full viewport apart, slid by exactly that width: the
            wrap point lands on identical artwork, so the loop is seamless. */}
        <g className="hero-clouds">
          {[0, VIEW.w].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              {CLOUDS.map((cloud, i) => (
                <path
                  key={i}
                  d={cloudPath(cloud.puffs, cloud.baseline)}
                  fill="url(#sky-cloud)"
                  opacity={cloud.opacity}
                />
              ))}
            </g>
          ))}
        </g>

        {/* Placement lives on the wrapper: a CSS transform on the rect would
            replace its `transform` attribute, not add to it. */}
        {CONFETTI.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y})`}>
            <rect
              className="hero-confetti"
              x={-c.size / 2}
              y={-c.size / 2}
              width={c.size}
              height={c.size}
              rx={c.size * 0.15}
              fill={c.outline ? 'none' : '#FFFFFF'}
              stroke={c.outline ? '#FFFFFF' : 'none'}
              strokeWidth={c.outline ? 2 : 0}
              style={{ animationDelay: `${(i % 7) * 0.55}s` }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
