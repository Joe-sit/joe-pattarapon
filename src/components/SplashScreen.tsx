import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

type SplashScreenProps = {
  /** Fired the moment the aperture is fully open, not when the splash ends. */
  onEyeOpen: () => void
  onDone: () => void
}

/**
 * Splash stage. Rendered with `preserveAspectRatio="xMidYMid slice"` so the
 * square always covers the viewport — no measuring, no resize handling.
 */
const STAGE = 1000

/** The eye aperture, in its own 368x154 design space. */
const EYE_PATH =
  'M176.678 0.130668C178.778 -0.052242 181.03 0.0347597 183.138 0.0110353C224.78 -0.45721 264.448 14.0255 300.443 33.996C306.604 37.4138 312.867 40.8774 318.901 44.5295C335.337 54.4776 351.865 64.9143 367.285 76.4044C359.562 81.6498 352.082 87.0649 344.247 92.2033C306.756 116.796 266.069 140.497 221.718 149.633C210.667 151.91 201.977 152.665 190.831 153.635C182.237 154.196 174.777 153.56 166.297 152.714C152.325 151.362 138.533 148.555 125.144 144.339C82.3354 131.016 36.8801 101.687 0 76.3695C3.35027 74.4019 8.21355 70.812 11.5035 68.5709C17.6458 64.4378 23.8389 60.3812 30.0818 56.4018C72.7436 29.3734 118.357 4.41723 169.463 0.653689C171.881 0.475572 174.253 0.274832 176.678 0.130668Z'

const EYE_BOX = { w: 368, h: 154 }
/** Local centre of EYE_PATH — GSAP transforms happen around this point. */
const EYE_ORIGIN = `${EYE_BOX.w / 2} ${EYE_BOX.h / 2}`

/** Eye width as a fraction of the stage — the one knob for how big it reads. */
const EYE_WIDTH = 0.58
const EYE_SCALE = (STAGE * EYE_WIDTH) / EYE_BOX.w
const EYE_PLACE = `translate(${(STAGE - EYE_BOX.w * EYE_SCALE) / 2}, ${
  (STAGE - EYE_BOX.h * EYE_SCALE) / 2
}) scale(${EYE_SCALE})`

/**
 * The reflection on the lower lid: one stroke per pass, widest and faintest
 * first, so they stack into a glow with a bright core.
 */
const SHEEN = [
  { width: 34, opacity: 0.8 },
  { width: 17, opacity: 0.9 },
  { width: 7, opacity: 1 },
]

/** Closed lid — a hairline rather than zero, so frame 1 shows a seam of light. */
const SHUT = 0.008

/**
 * Storyboard beats, in seconds. `blank + openDur` is the hero clock's pre-roll —
 * keep it in step with `EYE_OPEN_AT` in `sections/hero/story.ts`.
 */
const T = {
  blank: 0.5,
  openDur: 0.95,
  /**
   * The aperture swallows the frame the instant it is open — no held beat. The
   * scene behind is already moving by then, and pausing on it read as the
   * story stopping to wait for the splash.
   */
  get expand() {
    return this.blank + this.openDur
  },
  expandDur: 0.6,
}

/**
 * Blank, an eye opening, then the aperture widening into the page.
 *
 * Nothing is drawn inside the eye: the page is already mounted underneath, so
 * the hole shows the real hero scene rather than a picture of one.
 */
export function SplashScreen({ onEyeOpen, onDone }: SplashScreenProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onEyeOpenRef = useRef(onEyeOpen)
  onEyeOpenRef.current = onEyeOpen

  useEffect(() => {
    const scope = sceneRef.current
    if (!scope) return

    const ctx = gsap.context(() => {
      // Placement transforms live on wrapper groups, so GSAP owns these paths'
      // own transforms and works in the eye's local 368x154 space.
      const aperture = '#sp-aperture-path, #sp-lid, #sp-sheen'

      // ── Frame 1: blank. The aperture is shut, so the backdrop is solid. ──
      gsap.set(aperture, { scaleY: SHUT, svgOrigin: EYE_ORIGIN })
      gsap.set('#sp-lid, #sp-sheen', { opacity: 0 })

      const tl = gsap.timeline({ onComplete: () => onDoneRef.current() })

      // ── Frames 2-3: the eye opens ─────────────────────────────────
      tl.to('#sp-lid', { opacity: 1, duration: 0.35, ease: 'power1.out' }, T.blank)
      // The sheen only has something to catch once the lid is well open.
      tl.to('#sp-sheen', { opacity: 1, duration: 0.5, ease: 'power1.out' }, T.blank + 0.3)
      // In-out, not out: power3.out throws the lid most of the way open in its
      // first few frames and then crawls, which reads as a snap. This eases in
      // and out, so the lid parts the way an eye actually opens.
      tl.to(aperture, { scaleY: 1, duration: T.openDur, ease: 'power2.inOut' }, T.blank)
      // The scene behind starts playing here, in full view through the hole.
      tl.call(() => onEyeOpenRef.current(), undefined, T.blank + T.openDur)

      // ── Frame 4: the aperture expands past the viewport ───────────
      tl.to(
        aperture,
        { scale: 9, svgOrigin: EYE_ORIGIN, duration: T.expandDur, ease: 'power2.in' },
        T.expand,
      )
      tl.to('#sp-lid, #sp-sheen', { opacity: 0, duration: 0.35, ease: 'power1.in' }, T.expand + 0.2)
    }, scope)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={sceneRef} className="pointer-events-none fixed inset-0 z-9999">
      <svg
        viewBox={`0 0 ${STAGE} ${STAGE}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          {/* White keeps the backdrop; the black eye punches the hole. */}
          <mask id="sp-aperture">
            <rect x="-2000" y="-2000" width="5000" height="5000" fill="white" />
            <g transform={EYE_PLACE}>
              <path id="sp-aperture-path" d={EYE_PATH} fill="black" />
            </g>
          </mask>

          {/* Brightest at the centre of the arc, gone by the corners — light
              catching a curved wet rim, not a stroke around the whole shape. */}
          <linearGradient id="sp-sheen-run" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1FA8D8" stopOpacity="0" />
            <stop offset="18%" stopColor="#1FA8D8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#6FE0F7" stopOpacity="1" />
            <stop offset="82%" stopColor="#1FA8D8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1FA8D8" stopOpacity="0" />
          </linearGradient>

          {/* Keeps the lower arc only. The fade means the sheen dies out
              towards the corners rather than stopping on a cut. */}
          <linearGradient
            id="sp-sheen-fade"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={EYE_BOX.h * 0.5}
            x2="0"
            y2={EYE_BOX.h * 0.86}
          >
            <stop offset="0%" stopColor="black" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
          <mask id="sp-sheen-lower" maskUnits="userSpaceOnUse" x="-40" y="0" width="448" height="220">
            <rect x="-40" y="0" width="448" height="220" fill="url(#sp-sheen-fade)" />
          </mask>

          {/* sRGB: the default linearRGB blur of a light stroke over nothing
              comes back as a grey haze rather than a glow. */}
          <filter
            id="sp-sheen-blur"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="3.2" />
          </filter>

        </defs>

        {/* Light pooling on the inside of the lower lid.
            Drawn *before* the backdrop on purpose: the backdrop paints over
            everything except the eye, so it clips this to the inside of the
            shape for free — no second copy of the path to keep in step with
            the one GSAP is animating. That is what keeps the glow on the sky
            instead of ringing the outside like a plastic edge. */}
        <g transform={EYE_PLACE}>
          <g id="sp-sheen" mask="url(#sp-sheen-lower)" filter="url(#sp-sheen-blur)">
            {SHEEN.map(({ width, opacity }) => (
              <path
                key={width}
                d={EYE_PATH}
                fill="none"
                stroke="url(#sp-sheen-run)"
                strokeWidth={width}
                strokeOpacity={opacity}
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>

        <rect
          x="-2000"
          y="-2000"
          width="5000"
          height="5000"
          fill="#1E1F22"
          mask="url(#sp-aperture)"
        />

        {/* Lid rim. Non-scaling stroke keeps it hairline as the eye expands. */}
        <g transform={EYE_PLACE}>
          <path
            id="sp-lid"
            d={EYE_PATH}
            fill="none"
            stroke="#5865F2"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  )
}
