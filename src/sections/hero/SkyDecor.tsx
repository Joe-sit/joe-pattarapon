/**
 * The sky band above the platform: sun, drifting clouds, floating confetti.
 *
 * Flat SVG rather than 3D on purpose — the true horizon sits above the frame at
 * this camera, so nothing in the scene can occupy the sky. Drawing it in screen
 * space also keeps it in the same 2.5D register as the rest of the art.
 */

const VIEW = { w: 1440, h: 280 }

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
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[36vh] overflow-hidden">
      <svg
        className="size-full"
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sky-cloud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="sky-sun-glow">
            <stop offset="0%" stopColor="#FFFBE6" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#FFFBE6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFFBE6" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="hero-sun">
          <circle cx="352" cy="128" r="142" fill="url(#sky-sun-glow)" />
          <circle cx="352" cy="128" r="56" fill="#FFFCEC" />
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
