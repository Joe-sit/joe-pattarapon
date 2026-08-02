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

/** Closed lid — a hairline rather than zero, so frame 1 shows a seam of light. */
const SHUT = 0.008

/** Storyboard beats, in seconds. */
const T = {
  blank: 0.4,
  openDur: 1.1,
  /** A short held beat on the open eye before it swallows the frame. */
  expand: 1.85,
  expandDur: 1.2,
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
      const aperture = '#sp-aperture-path, #sp-lid'

      // ── Frame 1: blank. The aperture is shut, so the backdrop is solid. ──
      gsap.set(aperture, { scaleY: SHUT, svgOrigin: EYE_ORIGIN })
      gsap.set('#sp-lid', { opacity: 0 })

      const tl = gsap.timeline({ onComplete: () => onDoneRef.current() })

      // ── Frames 2-3: the eye opens ─────────────────────────────────
      tl.to('#sp-lid', { opacity: 1, duration: 0.25, ease: 'power1.out' }, T.blank)
      tl.to(aperture, { scaleY: 1, duration: T.openDur, ease: 'power3.out' }, T.blank)
      // The scene behind starts playing here, in full view through the hole.
      tl.call(() => onEyeOpenRef.current(), undefined, T.blank + T.openDur)

      // ── Frame 4: the aperture expands past the viewport ───────────
      tl.to(
        aperture,
        { scale: 9, svgOrigin: EYE_ORIGIN, duration: T.expandDur, ease: 'power2.in' },
        T.expand,
      )
      tl.to('#sp-lid', { opacity: 0, duration: 0.5, ease: 'power1.in' }, T.expand + 0.45)
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
        </defs>

        <rect
          x="-2000"
          y="-2000"
          width="5000"
          height="5000"
          fill="#F1F0EE"
          mask="url(#sp-aperture)"
        />

        {/* Lid rim. Non-scaling stroke keeps it hairline as the eye expands. */}
        <g transform={EYE_PLACE}>
          <path
            id="sp-lid"
            d={EYE_PATH}
            fill="none"
            stroke="#FD5000"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  )
}
