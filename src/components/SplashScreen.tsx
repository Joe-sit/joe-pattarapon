import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplashShapes, type MorphProgress } from './splash/SplashShapes'
import { buildLetterMorphs, J_PATH, E_PATH, PETAL_PATHS } from './splash/letterMorph'

type SplashScreenProps = {
  onDone: () => void
}

/** Final resting transform of each `O` petal, reached at the end of the build. */
const PETAL_DATA = [
  { cx: 117.717, cy: 62.9484, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rot: 59.365 },
  { cx: 99.732, cy: 41.2846, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rot: 28.5804 },
]

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

/** The 259x104 wordmark, sized to sit comfortably inside the open eye. */
const WORDMARK = { w: 259, h: 104, scale: 1.15 }
const WORDMARK_PLACE = `translate(${(STAGE - WORDMARK.w * WORDMARK.scale) / 2}, ${
  (STAGE - WORDMARK.h * WORDMARK.scale) / 2
}) scale(${WORDMARK.scale})`

/** Interior of the eye — the wordmark plays against this. */
const EYE_FILL = '#FFFFFF'

/** Closed lid — a hairline rather than zero, so frame 1 shows a seam of light. */
const SHUT = 0.008

/** Storyboard beats, in seconds. */
const T = {
  blank: 0.4,
  openDur: 1.1,
  wordmark: 1.6,
  /** The wordmark build plays faster than its original standalone timing. */
  wordmarkScale: 1.5,
  /** Letters cross-fade to solid silhouettes, then those silhouettes morph. */
  morph: 3.95,
  swapDur: 0.25,
  morphDur: 0.75,
  expand: 5.75,
  expandDur: 1.2,
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  /** Shared values the GSAP timeline drives and the 3D scene reads. */
  const morphRef = useRef<MorphProgress>({ reveal: 0, spin: 0 })

  useEffect(() => {
    const scope = sceneRef.current
    if (!scope) return

    const ctx = gsap.context(() => {
      const petals = scope.querySelectorAll('.o-petal')
      // Placement transforms live on wrapper groups, so GSAP owns these paths'
      // own transforms and works in the eye's local 368x154 space.
      const aperture = '#sp-aperture-path, #sp-clip-path, #sp-lid'

      // ── Frame 1: blank. The aperture is shut, so the backdrop is solid. ──
      gsap.set(aperture, { scaleY: SHUT, svgOrigin: EYE_ORIGIN })
      gsap.set('#sp-lid', { opacity: 0 })

      // Wordmark starts off-stage, hidden until its beat.
      gsap.set('#sp-e-clip-rect', { attr: { x: 174, width: 4 } })
      gsap.set('#sp-e-counter', { scaleX: 0, svgOrigin: '185 26' })
      gsap.set('#sp-e-opening', { x: 60 })
      gsap.set('#sp-e-front', { scaleX: 0, svgOrigin: '232 24.5' })
      gsap.set('#sp-o-bullet', { opacity: 0, attr: { cx: 173, r: 1 } })
      petals.forEach((el) => gsap.set(el, { attr: { cx: 122, cy: 42 }, rotation: 0, opacity: 0 }))
      gsap.set('#sp-j-body', { y: -100 })
      gsap.set('#sp-j-mask', { scale: 0, svgOrigin: '34 31' })
      gsap.set('#sp-j-corner', { scale: 0, svgOrigin: '0 0' })
      gsap.set('#sp-slide-group', { x: -80, opacity: 0 })

      const tl = gsap.timeline({ onComplete: () => onDoneRef.current() })

      // ── Frames 2-3: the eye opens ─────────────────────────────────
      tl.to('#sp-lid', { opacity: 1, duration: 0.25, ease: 'power1.out' }, T.blank)
      tl.to(aperture, { scaleY: 1, duration: T.openDur, ease: 'power3.out' }, T.blank)

      // ── The wordmark builds inside the open eye ────────────────────
      const wordmark = gsap.timeline()

      wordmark.to('#sp-slide-group', { x: -60, duration: 1.18, ease: 'power1.in' }, 0)
      wordmark.to('#sp-slide-group', { x: 0, duration: 2.06, ease: 'power1.5.out' }, 1.17)

      // E
      wordmark.to('#sp-e-clip-rect', { attr: { width: 77 }, duration: 1.32, ease: 'power2.inOut' }, 0)
      wordmark.to('#sp-e-counter', { scaleX: 1, duration: 0.66, ease: 'power2.inOut' }, 0.4)
      wordmark.to('#sp-e-front', { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, 0.66)
      wordmark.to('#sp-e-opening', { x: 0, duration: 0.8, ease: 'power2.inOut' }, 0.46)
      wordmark.to('#sp-e-clip-rect', { attr: { x: 162 }, duration: 0.39, ease: 'power2.inOut' }, 0.93)

      // O
      wordmark.set('#sp-o-bullet', { opacity: 1 }, 1.12)
      wordmark.to('#sp-o-bullet', { attr: { cx: 122, r: 20 }, duration: 0.51, ease: 'power2.out' }, 1.12)
      wordmark.to('.sp-o-petal', { opacity: 1, duration: 0.15, ease: 'power2.inOut' }, 1.42)
      petals.forEach((el, i) => {
        const p = PETAL_DATA[i]
        wordmark.to(el, { attr: { cx: p.cx, cy: p.cy }, duration: 0.72, ease: 'power2.inOut' }, 1.32)
      })
      wordmark.to('#sp-o-bullet', { opacity: 0, duration: 0.2, ease: 'power2.inOut' }, 1.57)
      petals.forEach((el, i) => {
        const p = PETAL_DATA[i]
        wordmark.to(
          el,
          { rotation: p.rot, svgOrigin: `${p.cx} ${p.cy}`, duration: 1.4, ease: 'power2.inOut' },
          1.42,
        )
      })

      // J
      wordmark.to('#sp-j-body', { y: 0, duration: 1.74, ease: 'power2.inOut' }, 0.87)
      wordmark.to('#sp-j-corner', { scale: 1, duration: 1.45, ease: 'power2.inOut' }, 1.43)
      wordmark.to('#sp-j-mask', { scale: 1, duration: 1.4, ease: 'power2.inOut' }, 1.6)

      wordmark.timeScale(T.wordmarkScale)
      tl.set('#sp-slide-group', { opacity: 1 }, T.wordmark)
      tl.add(wordmark, T.wordmark)

      // ── The letters morph into their solids ───────────────────────
      // Three stages, so the change is a real shape transform end to end:
      //   1. swap the built wordmark for solid silhouettes of the same letters
      //   2. morph those paths J → triangle, O → circle, E → square (flubber)
      //   3. hand off to the 3D solids, which rest at exactly those silhouettes
      const jPath = scope.querySelector('#sp-morph-j')
      const ePath = scope.querySelector('#sp-morph-e')
      const oPath = scope.querySelector('#sp-morph-o')
      const morphs = buildLetterMorphs()
      const morphState = { t: 0 }
      // Start the petals from flubber's own t=0 output so the swap is exact.
      oPath?.setAttribute('d', morphs.o(0))

      const morphStart = T.morph + T.swapDur + 0.05
      const handoff = morphStart + T.morphDur

      // 1. Cross-fade to the flat silhouettes. The cutouts (J's hook, E's
      // counters) have no counterpart in the targets, so they go first.
      // This must sit *in* the timeline — a bare gsap.set fires at t=0 and
      // would blow away E's reveal clip for the whole build.
      tl.set('#sp-e-clip-rect', { attr: { x: -500, width: 2000 } }, T.morph)
      tl.to(
        '#sp-j-mask, #sp-j-corner, #sp-e-counter, #sp-e-opening, #sp-e-front',
        { opacity: 0, duration: T.swapDur, ease: 'power1.in' },
        T.morph,
      )
      tl.to('#sp-morph-layer', { opacity: 1, duration: T.swapDur, ease: 'none' }, T.morph)
      tl.to('#sp-slide-group', { opacity: 0, duration: 0.01 }, T.morph + T.swapDur)

      // 2. The actual path morph.
      tl.to(
        morphState,
        {
          t: 1,
          duration: T.morphDur,
          ease: 'power2.inOut',
          onUpdate: () => {
            jPath?.setAttribute('d', morphs.j(morphState.t))
            ePath?.setAttribute('d', morphs.e(morphState.t))
            oPath?.setAttribute('d', morphs.o(morphState.t))
          },
        },
        morphStart,
      )
      // Colours travel with the shapes so the 3D handoff is seamless.
      tl.to('#sp-morph-o', { fill: '#1868DB', duration: T.morphDur, ease: 'none' }, morphStart)
      tl.to('#sp-morph-e', { fill: '#EF4343', duration: T.morphDur, ease: 'none' }, morphStart)

      // 3. Hand off to 3D, then let the solids rotate so the depth reads.
      tl.to(morphRef.current, { reveal: 1, duration: 0.3, ease: 'none' }, handoff - 0.05)
      tl.to('#sp-morph-layer', { opacity: 0, duration: 0.25, ease: 'none' }, handoff + 0.05)
      tl.to(morphRef.current, { spin: 1, duration: 0.7, ease: 'power2.out' }, handoff + 0.1)

      // ── Frame 4: the aperture expands past the viewport ───────────
      tl.to(
        aperture,
        { scale: 9, svgOrigin: EYE_ORIGIN, duration: T.expandDur, ease: 'power2.in' },
        T.expand,
      )
      // Interior and shapes fade so the page shows through the widening hole.
      tl.to(
        '#sp-eye-fill, #sp-shapes',
        { opacity: 0, duration: 0.6, ease: 'power1.in' },
        T.expand + 0.15,
      )
      tl.to('#sp-lid', { opacity: 0, duration: 0.5, ease: 'power1.in' }, T.expand + 0.45)
    }, scope)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={sceneRef} className="pointer-events-none fixed inset-0 z-9999">
      {/* The eye's interior and the 3D shapes sit *behind* the SVG, so the
          aperture mask is the only thing deciding what is visible — no CSS
          clip-path copy of the animated eye. */}
      <div id="sp-eye-fill" className="absolute inset-0" style={{ background: EYE_FILL }} />
      <div id="sp-shapes" className="absolute inset-0">
        <SplashShapes progress={morphRef} />
      </div>

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

          {/* Same shape, inverted: keeps the interior and wordmark inside the
              eye. A mask, not a clipPath — clipPath ignores <g> children, so
              the placement wrapper would silently blank the whole thing. */}
          <mask id="sp-eye-inside">
            <g transform={EYE_PLACE}>
              <path id="sp-clip-path" d={EYE_PATH} fill="white" />
            </g>
          </mask>

          <clipPath id="sp-e-reveal">
            <rect id="sp-e-clip-rect" x="174" y="0" width="4" height="84" />
          </clipPath>
        </defs>

        <rect
          x="-2000"
          y="-2000"
          width="5000"
          height="5000"
          fill="#F1F0EE"
          mask="url(#sp-aperture)"
        />

        {/* The wordmark, kept inside the eye. */}
        <g mask="url(#sp-eye-inside)">
          <g transform={WORDMARK_PLACE}>
            <g id="sp-slide-group">
              {/* J */}
              <g id="sp-j-group">
                <path
                  id="sp-j-body"
                  d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z"
                  fill="#FD5000"
                />
                <path
                  id="sp-j-mask"
                  d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55V55Z"
                  fill={EYE_FILL}
                />
                <rect id="sp-j-corner" x="-1" y="-1" width="35" height="32" fill={EYE_FILL} />
              </g>

              {/* O */}
              <g id="sp-o-petals">
                <ellipse
                  className="sp-o-petal o-petal"
                  cx="117.717"
                  cy="62.9484"
                  rx="15.1684"
                  ry="18.4624"
                  fill="#FD5000"
                />
                <ellipse
                  className="sp-o-petal o-petal"
                  cx="126.342"
                  cy="20.4592"
                  rx="15.1684"
                  ry="18.4624"
                  fill="#FD5000"
                />
                <ellipse
                  className="sp-o-petal o-petal"
                  cx="99.732"
                  cy="41.2846"
                  rx="14.1752"
                  ry="19.4078"
                  fill="#FD5000"
                />
                <ellipse
                  className="sp-o-petal o-petal"
                  cx="144.851"
                  cy="41.4516"
                  rx="14.1752"
                  ry="19.4078"
                  fill="#FD5000"
                />
              </g>
              <circle id="sp-o-bullet" cx="173" cy="42" r="1" fill="#FD5000" />

              {/* E */}
              <g id="sp-e-group" clipPath="url(#sp-e-reveal)">
                <path d="M174 2H232V81H174V65H162V18H174Z" fill="#FD5000" />
                <rect id="sp-e-front" x="231" y="10" width="8" height="29" fill="#FD5000" />
                <rect
                  id="sp-e-counter"
                  x="185"
                  y="18"
                  width="35"
                  height="16"
                  rx="8"
                  fill={EYE_FILL}
                />
                <path
                  id="sp-e-opening"
                  d="M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z"
                  fill={EYE_FILL}
                />
              </g>
            </g>

            {/* Solid silhouettes of the same letters. Swapped in at the end of
                the build (identical outlines, no cutouts) and then morphed into
                triangle / circle / square. */}
            <g id="sp-morph-layer" opacity="0">
              <path id="sp-morph-j" d={J_PATH} fill="#FD5000" />
              <path id="sp-morph-o" d={PETAL_PATHS.join(' ')} fill="#FD5000" />
              <path id="sp-morph-e" d={E_PATH} fill="#FD5000" />
            </g>
          </g>
        </g>

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
