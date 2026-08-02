/**
 * The hero's one timeline.
 *
 * Every beat is an absolute time on a single clock that starts the moment the
 * splash's eye is open, and every part of the scene reads that same clock.
 * Nothing waits on another part's progress and nothing keeps a clock of its own
 * — that is what makes the whole thing land as one story rather than a queue of
 * animations.
 *
 * The orb is the only thing moving while the aperture is still open; everything
 * else waits for the splash to clear at roughly 2.2s.
 */

/**
 * How long the lid takes to open — mirrors SplashScreen's `T.blank + T.openDur`.
 *
 * The clock starts at `-EYE_OPEN_AT` so t = 0 is still the moment the eye is
 * open and every beat below keeps its meaning; negative time is the pre-roll
 * that plays inside the opening aperture.
 */
export const EYE_OPEN_AT = 1.45

export const STORY = {
  /** Camera slides down from the orb to the platform. */
  /** The rolled sheet opens as we arrive. */
  unroll: { at: 0.9, duration: 1.7 },
  /** Guides are drawn onto the part of the sheet that is already flat. */
  guides: { at: 1.6, duration: 1.2 },
  /** The orb climbing into the middle of the lid while the lid is opening. */
  orbRise: { at: -EYE_OPEN_AT, duration: EYE_OPEN_AT },
  /**
   * The intro orb's descent. Starts on the eye, not a beat later: the camera
   * hangs off this, so any delay here is a stall on an open frame.
   */
  orbDrop: { at: 0, duration: 3 },
  /** The orb carries the lead piece across to its slot. */
  leadMove: { at: 3.3, duration: 1.9 },
  /**
   * The other three. They set off while the lead is still being carried, so
   * something is always entering the frame, and follow each other closely
   * rather than queueing — near enough to read as one cascade, far enough
   * apart that they do not land as a single block. The move itself is long:
   * they come from well off screen and have to arrive gently.
   */
  others: { at: 3.6, stagger: 0.45, duration: 2.4 },
  /** Lead-in before an orb's piece starts moving. */
  orbIn: 0.5,
  /** The sentence lands on the finished picture. */
  title: 7.3,
}

/**
 * When the picture lights up: a beat before the sentence, so the sheet and the
 * light above it answer the last piece rather than the copy. Shared, or the
 * glow on the plan and the rays over it drift apart.
 */
export const GLOW_LEAD = 0.4
export const GLOW_RISE = 1.1

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Moving at once, easing into the landing. */
export function easeOutSine(t: number) {
  return Math.sin((t * Math.PI) / 2)
}

/**
 * Quintic smootherstep with its derivatives, for anything that has to look like
 * it has mass.
 *
 * `d` is speed and `dd` acceleration, both in units of the eased value — divide
 * by the beat's duration (once, twice) for per-second. Acceleration is positive
 * through the first half and negative through the second, which is the sign
 * change a carried object leans through.
 *
 * Quintic rather than the cubic: the cubic's acceleration jumps from +12 to -12
 * at the midpoint, and a tilt driven off that flips over in a single frame. The
 * quintic passes through zero smoothly, so the lean rolls over instead.
 */
export function smootherStepD(t: number) {
  const e = t * t * t * (t * (t * 6 - 15) + 10)
  const d = 30 * t * t * (1 - t) * (1 - t)
  const dd = 60 * t * (1 - t) * (1 - 2 * t)
  return { e, d, dd }
}

/**
 * How much of the sheet's unroll the intro plays on its own. The rest is the
 * reader's: the sheet comes to rest still partly curled, and opens the last of
 * the way as the page is scrolled — the one piece of the story the visitor
 * performs rather than watches.
 */
export const INTRO_UNROLL = 0.82

/** Scroll distance that spends the remaining unroll, as a fraction of a screen. */
const SCROLL_SPAN = 0.7

/**
 * Lenis already smooths `window.scrollY`, so this needs no easing of its own.
 *
 * The span is capped by how far the page can actually scroll: with only the
 * hero and the footer on screen that is a couple of hundred pixels, and a fixed
 * span would leave the sheet stuck half open with no way to finish it.
 */
function scrollFraction() {
  if (typeof window === 'undefined') return 0
  const reachable = document.documentElement.scrollHeight - window.innerHeight
  const span = Math.min(window.innerHeight * SCROLL_SPAN, reachable)
  return span > 0 ? Math.max(0, Math.min(1, window.scrollY / span)) : 0
}

/**
 * The sheet's unroll, 0..1, as the intro and the reader between them have it.
 *
 * Both the sheet and the pieces read this: a piece is revealed by the sheet's
 * flat edge passing over its slot, so the two have to agree exactly.
 */
export function unrollProgress(now: number) {
  const intro = easeInOutCubic(beat(now, STORY.unroll.at, STORY.unroll.duration)) * INTRO_UNROLL
  return Math.min(1, intro + (1 - INTRO_UNROLL) * scrollFraction())
}

/** Clamped 0..1 progress of a beat at time `now`. */
export function beat(now: number, at: number, duration: number) {
  return Math.max(0, Math.min(1, (now - at) / duration))
}

/**
 * The camera and the orb, in world units.
 *
 * `fromY` is both where the frame is aimed when the eye opens and where the orb
 * hangs, which is what puts the orb dead centre of the aperture. `landingY` is
 * the orb sitting on a placed piece — derived from the platform, sheet and
 * piece heights, and kept in step with them by eye rather than by import, since
 * a tenth of a millimetre either way is invisible.
 */
export const CAMERA = { fromY: 4, restY: 1.25 }
export const ORB_LANDING_Y = 0.33
/** Where the orb sits as the lid cracks open: below the frame's centre. */
export const ORB_RISE_FROM_Y = CAMERA.fromY - 1.2

/**
 * The orb's height before its descent starts.
 *
 * It enters low in the opening lid and climbs to `fromY`, which is the centre of
 * the aperture — so the eye finds it already rising rather than parked. Settles
 * at `fromY` for the rest of the story, which is what lets the descent below
 * start from this value unconditionally.
 */
export function orbRiseY(now: number) {
  const t = beat(now, STORY.orbRise.at, STORY.orbRise.duration)
  // Out-cubic: fast out of the lid, easing into place as the lid finishes.
  const e = 1 - Math.pow(1 - t, 3)
  return ORB_RISE_FROM_Y + (CAMERA.fromY - ORB_RISE_FROM_Y) * e
}

/** The orb's height at time `now`. The camera is driven off this. */
export function orbDropY(now: number) {
  // Out-sine, not in-out: an in-out curve spends its first second barely
  // moving, and with the camera reading this that is a second of open frame
  // with nothing happening in it. This leaves as the eye finishes opening and
  // eases into the landing. Out-cubic starts three times faster again and
  // reads as the orb being dropped rather than sinking.
  const e = easeOutSine(beat(now, STORY.orbDrop.at, STORY.orbDrop.duration))
  return CAMERA.fromY + (ORB_LANDING_Y - CAMERA.fromY) * e
}

/**
 * Progress of the camera move — the sky band rides this too.
 *
 * The camera does not run a timeline of its own: it simply stays level with the
 * orb until the orb drops past its resting height, so the two move at exactly
 * the same speed on exactly the same curve. Giving each its own beat is what
 * made them look unrelated.
 */
export function panProgress(now: number) {
  const y = Math.max(CAMERA.restY, orbDropY(now))
  return (CAMERA.fromY - y) / (CAMERA.fromY - CAMERA.restY)
}
