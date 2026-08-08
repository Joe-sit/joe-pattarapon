import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { SplashShapes, type MorphProgress } from './splash/SplashShapes'
import { buildLetterMorphs } from './splash/letterMorph'

type JoeSplashProps = {
  onDone: () => void
}

/**
 * The wordmark splash: JOE, whose letters relax into a triangle, a circle and a
 * square, which then turn out to have been solids all along.
 *
 * The pieces for this were already in `./splash` — the flubber morph targets and
 * the three meshes — but nothing drove them. This is the timeline they were
 * written for.
 */

/** Splash stage width. Shared with the morph targets' coordinate maths. */
const STAGE = 1000

/**
 * Puts the 259x104 wordmark on the stage. Not a free choice: `SplashShapes`
 * positions its solids from these exact numbers, so each one lands on the flat
 * shape it takes over from. Change this and the handoff jumps.
 */
const WORDMARK_PLACE = 'translate(351.075, 440.2) scale(1.15)'

/** One per letter, matching the solids they hand off to. */
const INK = { j: '#FD5000', o: '#1868DB', e: '#EF4343' }

const BACKDROP = '#1E1F22'

/**
 * The bits that make three blobs read as J-O-E.
 *
 * The morph sources are outer silhouettes only — that is what makes them
 * interpolate cleanly — so on their own the J is a tub and the E is a slab.
 * These are the cuts that turn them back into letters: painted in the backdrop
 * colour over the top rather than applied as a mask, because a mask cannot be
 * faded and these have to leave as the shapes start to move.
 */
const CUTS = {
  /** The J's hook, and the square corner above it. */
  jHook:
    'M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55Z',
  /** The E's counter and its mouth. */
  eMouth:
    'M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z',
}

/** Storyboard beats, in seconds. */
const T = {
  /** Long enough to read as a held frame rather than a stutter. */
  blank: 0.3,
  rise: 0.55,
  morphAt: 1.05,
  morphDur: 0.85,
  /** The 2D→3D crossfade. Both are aligned, so this reads as thickening. */
  handoffAt: 1.8,
  handoffDur: 0.4,
  /** Spin ramps in *after* the swap, so the swap itself happens dead still. */
  spinAt: 2.1,
  spinDur: 0.5,
  outAt: 3.2,
  outDur: 0.55,
}

export function JoeSplash({ onDone }: JoeSplashProps) {
  const scope = useRef<HTMLDivElement>(null)
  const jRef = useRef<SVGPathElement>(null)
  const oRef = useRef<SVGPathElement>(null)
  const eRef = useRef<SVGPathElement>(null)

  /** Read every frame by the 3D layer; never triggers a React render. */
  const progress = useRef<MorphProgress>({ reveal: 0, spin: 0 })

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const root = scope.current
    if (!root) return

    const morph = buildLetterMorphs()
    const state = { t: 0 }

    const paint = () => {
      jRef.current?.setAttribute('d', morph.j(state.t))
      oRef.current?.setAttribute('d', morph.o(state.t))
      eRef.current?.setAttribute('d', morph.e(state.t))
    }
    paint()

    const ctx = gsap.context(() => {
      gsap.set('#jsp-word', { opacity: 0, y: 24, transformOrigin: '50% 50%' })

      const tl = gsap.timeline({ onComplete: () => onDoneRef.current() })

      tl.to('#jsp-word', { opacity: 1, y: 0, duration: T.rise, ease: 'power2.out' }, T.blank)

      // The letters relax into their solids' silhouettes.
      tl.to(state, { t: 1, duration: T.morphDur, ease: 'power2.inOut', onUpdate: paint }, T.morphAt)
      tl.to(
        '#jsp-detail',
        { opacity: 0, duration: T.morphDur * 0.4, ease: 'power1.in' },
        T.morphAt,
      )

      // Solids fade up behind the flat shapes, then the flat shapes leave.
      tl.to(
        progress.current,
        { reveal: 1, duration: T.handoffDur, ease: 'none' },
        T.handoffAt,
      )
      tl.to('#jsp-word', { opacity: 0, duration: T.handoffDur, ease: 'none' }, T.handoffAt)

      tl.to(progress.current, { spin: 1, duration: T.spinDur, ease: 'power1.in' }, T.spinAt)

      // Out. The page underneath is already mounted and running.
      tl.to(root, { opacity: 0, duration: T.outDur, ease: 'power2.in' }, T.outAt)
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={scope} className="pointer-events-none fixed inset-0 z-9999">
      <div className="absolute inset-0" style={{ background: BACKDROP }} />

      {/* Solids sit between the field and the flat letters: they come up behind
          the shapes they replace, so the swap has nothing to cover. */}
      <div className="absolute inset-0">
        <SplashShapes progress={progress} />
      </div>

      <svg
        viewBox={`0 0 ${STAGE} ${STAGE}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 size-full"
        aria-label="Joe"
        role="img"
      >
        <g id="jsp-word">
          <g transform={WORDMARK_PLACE}>
            {/* Drawn from the morph interpolators rather than as static art, so
                frame one is already the shape the morph starts from — no seam
                between the letter that is shown and the letter that animates. */}
            <path ref={jRef} fill={INK.j} />
            <path ref={oRef} fill={INK.o} />
            <path ref={eRef} fill={INK.e} />

            {/* Leaves as soon as the shapes start moving: a counter that held
                its place while the letter around it turned into a triangle
                would read as a hole punched in the triangle. */}
            <g id="jsp-detail">
              <rect x="231" y="10" width="8" height="29" fill={INK.e} />
              <path d={CUTS.jHook} fill={BACKDROP} />
              <rect x="-1" y="-1" width="35" height="32" fill={BACKDROP} />
              <rect x="185" y="18" width="35" height="16" rx="8" fill={BACKDROP} />
              <path d={CUTS.eMouth} fill={BACKDROP} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
