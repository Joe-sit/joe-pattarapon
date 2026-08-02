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
 * else waits for the splash to clear at roughly 1.5s.
 */
export const STORY = {
  /** Camera slides down from the orb to the platform. */
  /** The rolled sheet opens as we arrive. */
  unroll: { at: 2.8, duration: 2.4 },
  /** Guides are drawn onto the part of the sheet that is already flat. */
  guides: { at: 3.8, duration: 1.6 },
  /** The intro orb's descent — timed to touch down exactly as the lead lands. */
  orbDrop: { at: 0.2, duration: 6.3 },
  /** The orb carries the lead piece across to its slot. */
  leadMove: { at: 6.8, duration: 1.9 },
  /** The other orbs arrive, one at a time, each bringing its own piece. */
  others: { at: 9, stagger: 1.4, duration: 2 },
  /** Lead-in before an orb's piece starts moving. */
  orbIn: 0.5,
  /** The sentence lands on the finished picture. */
  title: 14,
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
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

/** The orb's height at time `now`. The camera is driven off this. */
export function orbDropY(now: number) {
  const e = easeInOutCubic(beat(now, STORY.orbDrop.at, STORY.orbDrop.duration))
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
