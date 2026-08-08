import { useEffect, useMemo, useRef, type Ref } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Mesh, Shape, type Group } from 'three'
import { createShirtTexture } from './mascotTextures'
import { Part } from './MascotDebug'

/**
 * The mascot, built out of blocks.
 *
 * The drawing is already a solid seen in three-quarter view — a box head with a
 * lit top face and a shaded side, a box of hair sitting on it, arms folded in
 * front — so this rebuilds those volumes rather than extruding the artwork.
 * What the illustration paints as three flat tones per block (top, front, side)
 * the lights here produce for free, which is the whole reason to make it 3D.
 *
 * Units: the head is one unit wide, and its centre is the origin. Every other
 * measurement was read off the SVG in head-widths, so the proportions are the
 * drawing's own.
 */

// ── Palette ─────────────────────────────────────────────────────────
// The mascot is the mascot in every theme, so these do not come from the
// palette store. Values are the drawing's, minus the tones it used to fake
// lighting — one skin, one hair, and the lights do the rest.
const C = {
  skin: '#EFB49B',
  skinDark: '#D2947A',
  chest: '#D38D6F',
  hair: '#232224',
  eye: '#262424',
  cream: '#EDE2CF',
  creamDark: '#E4D8C7',
  ink: '#313032',
  /** The cup. Off-white, not #fff — pure white is the one value a lit face
      cannot go above, so it clips flat and loses its own top plane. */
  cup: '#F4F1EC',
} as const

const HEAD = { w: 1.0, h: 1.164, d: 0.8 }

/**
 * The hair, measured off the front elevation.
 *
 * That drawing settled the thing every three-quarter view leaves ambiguous: the
 * hair is not a cap the width of the skull, it is a **wide mass that overhangs
 * the head by about a sixth of a face on each side**, with a *narrower* block
 * capping it. Read off the three-quarter view alone this looked like a single
 * box barely wider than the head, which is why the sides never stood out.
 *
 * All heights are given relative to the top of the head, positive upwards.
 */
const HAIR = {
  /**
   * Main mass. 1.22 faces against a 1.00 face — it overhangs the skull by 0.11
   * a side, measured off the head-on view of the artwork.
   *
   * It was 1.30, which on the real screen ate the sides of the face and made a
   * correctly proportioned head read as a narrow one.
   */
  w: 1.22,
  /** The block on top steps back in to about the width of the skull. */
  capW: 1.0,
  d: 0.92,
  capD: 0.88,
  capTop: 0.243,
  /** Where the cap ends and the mass below it begins. */
  massTop: 0.026,
  /** Thickness of the wall closing the back of the mass. */
  shell: 0.16,
  /** How far the cap's back half sits below its front half. */
  ledgeDrop: 0.09,
  /**
   * The tab of hair behind the temple, and how far down it carries.
   *
   * Only at the back. Head on, the hair stops dead where the ear would start
   * and nothing hangs over that strip — the elevation is unambiguous about it,
   * and a matching tab in front (read off the three-quarter wireframe) covered
   * the strip entirely.
   *
   * Nothing stands in the gap. The strip is left as the side of the head with
   * the hair recessed behind it, which is the break that keeps the mass from
   * reading as a solid helmet when he turns.
   */
  tabD: 0.26,
  tabBottom: -0.95,
}

/**
 * The hairline, as one continuous run of points across the front of the head.
 *
 * This replaces four separate blocks — a band, two side walls, a tilted fringe
 * slab and a swept quiff — and every fault they had came from being separate.
 * Each one ended at its own height, so the joins between them showed as steps
 * on the temple, and the corner where the fringe met the quiff read as a second
 * peak beside the real one. A hairline is one line. Cut it as one line and
 * there is nowhere for a step to appear.
 *
 * Its shape is one idea, and it was read backwards twice before this:
 *
 *  - The point in the middle of the brow is a **peak of skin**, not a peak of
 *    hair. The hair is pushed *highest* there, and the forehead comes up to a
 *    corner under it. Built the other way round — a spike of hair pointing down
 *    into the forehead — the whole face reads wrong, and no amount of tuning
 *    the depth of that spike fixes it, because it should not be there at all.
 *  - From that corner the hairline is **one straight diagonal**, falling right
 *    across the entire face in a single run. Cut as a staircase of square steps
 *    it becomes a different haircut.
 *
 * Left to right in the viewer's terms; y is measured **down from the top of the
 * head**, so every value is negative. The two outer x are ignored and replaced
 * with the mass's own edges, so the profile cannot drift away from `HAIR.w`.
 */
const HAIRLINE: [number, number][] = [
  // The temples stop here, just clear of the top of the ear. What carries on
  // down past the eye is the pair of tabs either side of the ear gap, which
  // are boxes rather than part of this profile — see HAIR.tabD.
  [-0.59, -0.6],
  [-0.5, -0.6],
  [-0.5, -0.5], // steps up at the edge of the face
  [-0.4, -0.46],
  // The corner of the forehead: the highest the skin reaches, a sixth of a face
  // right of its left edge. Well off centre, and that is the point.
  [-0.33, -0.35],
  // One straight run from there to the far side of the face. No steps in it.
  [0.5, -0.6],
  [0.59, -0.6],
]
/**
 * The shirt body.
 *
 * It is a **cropped, boxy shirt with a real hem** — not a torso that runs off
 * the bottom of the frame, which is what this was while the model was only ever
 * seen as a bust. The garment close-up settles it: flat top edge, flat bottom
 * edge, and the two about as far apart as the shirt is wide (1.13 : 1 there).
 *
 * Width is 1.42 faces, measured off the garment elevation: the shirt body runs
 * 1.44 times the width of the face beside it. At the old 1.04 the shoulders
 * were narrow enough to make a correctly sized head look oversized.
 *
 * Depth is read off the wireframe's receding side face, a little under half the
 * width.
 *
 * `top` is not a look — it is clearance, and it is derived. The head turns on a
 * pivot at `NECK_PIVOT`, and what it can foul is not its own lowest corner but
 * the **shirt's front plane**, at `TORSO.d / 2`. The corner swings out to z 0.59
 * under a full yaw, which is well outside a shirt only 0.66 deep — it passes in
 * front of the collar rather than through it, and reserving room for it is what
 * made the neck too long. What matters is the bottom face where it crosses
 * z = 0.33:
 *
 *     that edge   0.082 below the pivot
 *     pitch 0.10  drop = 0.082·cos θ + 0.33·sin θ = 0.115
 *
 * So nothing of the shirt may sit above `NECK_PIVOT - 0.115`. Change either
 * limit in `FOLLOW`, or the shirt's depth, and this has to move with it.
 */
const TORSO = { w: 1.42, h: 1.62, d: 0.66, top: -0.62 }
/**
 * How much is taken off the top outer corners of the shirt.
 *
 * Barely anything. The shirt's top edge runs **flat** from the collar out to
 * the shoulder point in the elevation; this only takes the hard pixel off that
 * corner. The shoulder's roundness lives on the sleeve — see `SHOULDER`.
 */
const SHOULDER_CHAMFER = 0.03
/**
 * The sleeve, as its own tapered tube hinged at the shoulder point.
 *
 * `angle` is the flare off vertical, 18°, read straight off the elevation. This
 * is the thing that has to stay separate from the body: in the drawing the
 * sleeve is plainly a tube swinging out and down from a square shoulder, and
 * folding it into the body's own profile — the last attempt — loses both the
 * flare and the shoulder in one move.
 *
 * Width is *not* the 0.47 the Figma frame reports. That number is the bounding
 * box of a shape drawn in three-quarter view, so it already contains the
 * sleeve's own side face; read straight into a 3D box it comes back out as a
 * shoulder pad. Only the drawing's flat axis-aligned rectangles — the face
 * front, the eyes — measure the thing itself.
 */
/**
 * The arm, as one tapered tube.
 *
 * This is the thing the earlier builds had structurally wrong. The arm is not a
 * sleeve block with an upper arm inside it and a forearm hinged off that — in
 * the elevation it is **one straight run from the shoulder to the hand**, with
 * no elbow anywhere in it, narrowing as it goes. The sleeve is not a separate
 * garment part either: it is the top 57% of that same run, one size larger.
 *
 * Everything here is measured off the elevation against a face one unit wide.
 */
const ARM = {
  /** Off vertical. The arms hang out and down, not straight down. */
  angle: 0.36,
  /** Shoulder to wrist. One number, because it is one bone. */
  length: 1.67,
  topW: 0.5,
  wristW: 0.33,
}

const SLEEVE = {
  /** How far down the arm the cuff falls. */
  run: 0.95,
  /** How far the cloth stands off the arm inside it. */
  over: 0.025,
}

/**
 * The shoulder cap: a short length at the very top of the sleeve that is
 * **narrower** than the sleeve below it.
 *
 * This is where the curve belongs, and it took two passes to find. It is not on
 * the shirt's top edge — that runs dead flat from the collar to the shoulder
 * point, and cutting it there only lowers the whole shoulder line. The rounding
 * is on the **outside of the sleeve**: the cap pinches in at the top and opens
 * out to full width just below, so the outer edge leaves the body, bulges, and
 * then falls away to the cuff.
 *
 * The inset is on the **outer face only**. A tapered tube narrows on every
 * side at once, so the inner face pulls away from the body as well and opens a
 * notch at the armpit — which is what a `cylinderGeometry` cap did. The inner
 * edge has to stay dead straight against the shirt; only the outside rolls.
 * That is a cut profile, not a prism.
 */
const SHOULDER = {
  /** How far the **outer** face is pulled in at the very top. */
  inset: 0.14,
  /** Over what length it comes back out to the sleeve's full width. */
  run: 0.18,
  /** Facets in the roll. One is a chamfer; three or four read as a curve. */
  steps: 4,
}

/**
 * The shoulder is **one corner**, not a transition.
 *
 * The elevation runs the shirt flat across the top all the way out, and the
 * sleeve takes over at the corner and drops away. There is no flare and no
 * bevel: a flared cap was read into it and it came out as three facets piled at
 * the top of each arm, which is worse than the hard step it was meant to cure.
 *
 * What makes it read as one edge is not a part but a placement — see
 * `shoulderX`. The sleeve's own top corner is put exactly on the shirt's.
 */

/**
 * The collar, read off the garment close-up.
 *
 * This is a camp collar worn open, and it is a much bigger piece of the shirt
 * than the two thin sticks it used to be: **broad flat lapels** that start at
 * the shoulder, run down and inward, and meet at a point around two fifths of
 * the way down the shirt, plus a **band standing up behind the neck**. The
 * lapels are panels, not edges — cut as thin ones they read as braces.
 */
const COLLAR = {
  /** Half the neck opening at the shoulder line. */
  neckHalf: 0.21,
  /** Where the lapels reach at the shoulder line. */
  outer: 0.44,
  /** How far down the two lapels meet. */
  vDrop: 0.54,
  /** Half-width of the lapel where it ends, near the V. */
  tipHalf: 0.13,
  /**
   * The lapels stand off the shirt front. Thin: they are panels of cloth lying
   * on the chest, and at any real thickness the shadow under their edge turns
   * the collar into the biggest thing on the figure.
   */
  thickness: 0.03,
  /** The band behind the neck, standing above the shoulder line. */
  bandW: 0.56,
  bandH: 0.13,
  bandD: 0.16,
}
/** The button placket down the centre front, and the buttons on it. */
const PLACKET = { w: 0.12, proud: 0.022, button: 0.042, gap: 0.3 }
/**
 * The cup, tapered the way a paper one is.
 *
 * Eight-sided rather than boxed. It is the one object he is holding rather than
 * made of, and giving it a different construction from the blocks is what says
 * so — at eight facets it still faces the light in flat planes like everything
 * else, so it does not turn into the one smooth thing in the shot either.
 *
 * Sunk slightly into the arms it stands between: a cup balanced exactly on a
 * surface shows a hairline of background between the two and reads as floating.
 */
/** Parked. Position is a placeholder until the pose it belongs to comes back. */
const CUP = { rTop: 0.21, rBottom: 0.172, h: 0.36, x: 0.12, y: -0.84, z: 0.46 }
const EYE = { radius: 0.038, length: 0.13, x: 0.192, y: -0.264 }

/**
 * Blinking.
 *
 * The face has two marks on it and nothing else — no brows, no mouth — so a
 * blink is the only thing he can do with it, and it carries more than it looks
 * like it should: a head that tracks the pointer but never blinks reads as a
 * camera on a gimbal.
 *
 * The eye is a vertical capsule and a blink is that capsule collapsing **from
 * the top down onto its own bottom edge** — the lid comes down to meet the
 * lower lash line. Squashed about its centre instead, which is what a plain
 * scale does, both edges travel and it reads as the eye shrinking rather than
 * closing.
 */
const BLINK = {
  /** How closed it gets. Not zero: a capsule at scale 0 is a degenerate mesh. */
  shut: 0.06,
  /** One blink. Slow enough to be seen as a movement rather than a dropped frame. */
  dur: 0.26,
  /** Spread on that, so no two blinks take the same time. */
  durJitter: 0.06,
  /**
   * A blink closes faster than it opens, and the split is what makes it read as
   * a blink at all: even timing gives a pulse, this gives a snap and a settle.
   */
  closeShare: 0.38,
  /**
   * Gap to the next one, drawn fresh each time. A fixed interval is worse than
   * no blink at all: the eye starts keeping time and the whole head reads as a
   * mechanism.
   */
  minGap: 3,
  maxGap: 8,
  /** How often a blink comes as a quick pair, and how tight that pair is. */
  doubleChance: 0.22,
  doubleGap: 0.22,
}

/** Total height of the eye mark, caps included — what the lid travels over. */
const eyeHeight = EYE.length + EYE.radius * 2

const headTop = HEAD.h / 2
/**
 * Where the arms hang from. Measured down from the shirt's neckline rather than
 * off the torso's centre — the torso runs off the bottom of the frame, so its
 * midpoint is an arbitrary number that moves whenever the crop changes.
 */
/**
 * Where the arms hang from.
 *
 * Set down from the shoulder line by more than it looks like it needs. `Limb`
 * draws its box overlength by half a thickness so joints have no daylight in
 * them, and that overhang plus half the arm's width reaches about 0.12 back up
 * past the joint — hung any higher, the top corner of the upper arm clears the
 * shoulder line and shows as bare skin above the sleeve.
 */
/**
 * Where the arm tube starts.
 *
 * `x` sets the tube's outer face flush with the shirt's own edge, so the arm
 * leaves the body on the line the shoulder already draws rather than stepping
 * in or out of it. `y` is a little under the shoulder line so the tube's square
 * top is buried in the shirt instead of showing as a cap.
 */
/**
 * How wide the bare arm is `d` along its own axis from the shoulder.
 *
 * Every piece that lies on the arm asks this rather than carrying its own copy
 * of the taper. Two pieces that each taper on their own terms meet at a step,
 * and the step lands wherever the two happen to disagree.
 */
const armWidthAt = (d: number) =>
  ARM.topW + (ARM.wristW - ARM.topW) * (d / ARM.length)

/** The cloth's width at the same place: the arm plus its ease, both sides. */
const clothWidthAt = (d: number) => armWidthAt(d) + SLEEVE.over * 2

const sleeveTopW = clothWidthAt(0)
/**
 * Where the bare arm starts.
 *
 * Not at the shoulder. The sleeve's outer face is rolled in by
 * `SHOULDER.inset`, and at the very top that is narrower than the arm itself —
 * so an arm run from zero puts a wedge of bare skin out through the roll. It
 * begins below the roll instead, with a little overlap so no seam opens.
 */
const armStart = SHOULDER.run - 0.04

/** Where the cap's outer face sits at its top, measured from the arm's axis. */
const capOuterTop = sleeveTopW / 2 - SHOULDER.inset

/**
 * The arm hangs from the shirt's own top corner.
 *
 * Both are derived, not chosen. The cap's top is square to the arm, so it is
 * tilted by `ARM.angle`; putting its **outer** top corner exactly on the
 * shirt's own top corner means backing the origin off along that tilt. Set by eye instead,
 * the corner lands proud of the shirt and the outline steps.
 */
const shoulderX = TORSO.w / 2 - capOuterTop * Math.cos(ARM.angle)
const shoulderY = TORSO.top - capOuterTop * Math.sin(ARM.angle)

/**
 * Half-width to the radius of a four-sided cylinder.
 *
 * A `cylinderGeometry` with four segments is a square prism, and it tapers,
 * which is the whole reason to use one — a box cannot. Its radius is to the
 * corners, so the flat-to-flat width is `r * √2`, not `2r`.
 */
const prismR = (w: number) => (w / 2) * Math.SQRT2


type V3 = [number, number, number]

/**
 * The fingers, widest and longest first.
 *
 * They are **not four separate blocks stuck on the end of a palm**, which is
 * what this was. In the artwork the hand is one solid whose end has three
 * narrow slots cut back into it, and the fingertips step back in a diagonal
 * from the long side to the short one. Built as separate blocks the gaps
 * between them show the background through the hand, and the fingers read as a
 * comb rather than as a hand.
 */
const FINGERS = [
  { w: 0.115, len: 0.34 },
  { w: 0.115, len: 0.31 },
  { w: 0.105, len: 0.28 },
  { w: 0.09, len: 0.245 },
]

/**
 * The hand.
 *
 * Wider than the arm it is on, which is the other thing the old one had
 * backwards: the artwork flares the palm out past the forearm and steps back in
 * at the wrist. A hand narrower than the wrist reads as a stump.
 */
const HAND = {
  d: 0.22,
  /** Width of the cut between two fingers, and how far it reaches back. */
  slot: 0.016,
  slotDepth: 0.09,
  /** How far back the palm narrows to meet the wrist, and to what. */
  wristRun: 0.1,
  wristW: 0.3,
}

/** Total width across the knuckles, from the fingers themselves. */
const handW =
  FINGERS.reduce((sum, f) => sum + f.w, 0) + (FINGERS.length - 1) * HAND.slot

/**
 * The hand as one closed outline, cut in the plane of the palm.
 *
 * Drawn in the forearm's own space: the arm runs along +Y, so the wrist is at
 * y = 0 and the fingers carry on past it.
 */
function handProfile() {
  const s = new Shape()
  const half = handW / 2

  // Up the long side, from the wrist through the flare.
  s.moveTo(-HAND.wristW / 2, 0)
  s.lineTo(-half, HAND.wristRun)
  s.lineTo(-half, FINGERS[0].len)

  let x = -half
  FINGERS.forEach((finger, i) => {
    const right = x + finger.w
    s.lineTo(right, finger.len)

    const next = FINGERS[i + 1]
    if (next) {
      // Down into the slot, across it, and up the next finger. Cut to the
      // shorter of the pair so the slot never opens out of the tip edge.
      const floor = Math.min(finger.len, next.len) - HAND.slotDepth
      s.lineTo(right, floor)
      s.lineTo(right + HAND.slot, floor)
      s.lineTo(right + HAND.slot, next.len)
      x = right + HAND.slot
    } else {
      s.lineTo(right, HAND.wristRun)
      s.lineTo(HAND.wristW / 2, 0)
    }
  })

  s.closePath()
  return s
}

function Hand({ tilt, roll }: { tilt: number; roll: number }) {
  const geometry = useMemo(() => slab(handProfile(), HAND.d), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  // `roll` turns the palm about the arm's own axis, and it is not optional.
  // The quaternion the bone is built from only says which way the arm points —
  // the spin around that direction is whatever `setFromUnitVectors` happened to
  // pick, and left alone it lands the palm edge on to the lens, so the finger
  // slots read as a flight of steps instead of as fingers.
  return (
    <group rotation={[0, roll, 0]}>
      <group rotation={[tilt, 0, 0]}>
        <mesh geometry={geometry}>
          <meshLambertMaterial color={C.skin} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Extrudes a flat profile into a slab centred on z=0.
 *
 * Every panel of the shirt is cut this way rather than assembled from boxes,
 * for one reason beyond the shapes themselves: `ExtrudeGeometry`'s default UV
 * generator works in the profile's own coordinates, so the print comes out the
 * same size on every surface and across every seam with no per-face
 * correction — which a box, whose UVs run 0..1 on a 0.42-wide face and a
 * 1.62-tall one alike, cannot do.
 */
function slab(shape: Shape, depth: number) {
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  // Extrusion runs from the profile's plane towards +z. Baked into the
  // geometry rather than applied as a mesh position, so a piece can be
  // mirrored by turning it about Y without its depth swinging off-centre.
  geo.translate(0, 0, -depth / 2)
  return geo
}

/**
 * One lapel, cut for the mascot's left and mirrored for the other side.
 *
 * Drawn in the shirt front's own plane with the origin at the middle of the
 * shoulder line, y running down the shirt. Four corners: it starts wide at the
 * shoulder and narrows as it runs down to the V, which is what gives the collar
 * its taper without any rotation being involved.
 */
function lapelProfile(side: number) {
  // Cut per side rather than mirrored by turning the mesh about Y, the way the
  // sleeve is. That trick only works on a piece sitting at z=0: it negates z as
  // well as x, and the lapel has to stand at the *front* of the shirt, so the
  // mirrored copy would land on its back.
  const s = new Shape()
  s.moveTo(side * COLLAR.neckHalf, 0)
  s.lineTo(side * COLLAR.outer, 0)
  s.lineTo(side * (COLLAR.tipHalf + 0.06), -COLLAR.vDrop + 0.06)
  s.lineTo(0, -COLLAR.vDrop)
  s.closePath()
  return s
}

/** The V of chest the open collar leaves, filling the gap between the lapels. */
function chestProfile() {
  const s = new Shape()
  s.moveTo(-COLLAR.neckHalf, 0)
  s.lineTo(COLLAR.neckHalf, 0)
  s.lineTo(0, -COLLAR.vDrop)
  s.closePath()
  return s
}

/**
 * The collar, worn open: a V of chest, a broad lapel lying either side of it,
 * and the band standing up behind the neck.
 */
function Collar() {
  const lapels = useMemo(
    () => [-1, 1].map((side) => slab(lapelProfile(side), COLLAR.thickness)),
    [],
  )
  const chest = useMemo(() => slab(chestProfile(), 0.02), [])

  useEffect(
    () => () => {
      lapels.forEach((geo) => geo.dispose())
      chest.dispose()
    },
    [lapels, chest],
  )

  return (
    <group position={[0, TORSO.top, 0]}>
      <Part name="collar — chest V">
        <mesh geometry={chest} position={[0, 0, TORSO.d / 2]}>
          <meshLambertMaterial color={C.chest} />
        </mesh>
      </Part>

      <Part name="collar — lapels">
      {lapels.map((geo, i) => (
        <mesh
          key={i}
          geometry={geo}
          position={[0, 0, TORSO.d / 2 + COLLAR.thickness / 2]}
        >
          <meshLambertMaterial color={C.creamDark} />
        </mesh>
      ))}
      </Part>

      {/* The band behind the neck. It stands proud of the shoulder line — in the
          close-up it is the one part of the shirt that rises above the shoulder,
          and without it the neck comes straight out of a flat top edge. */}
      <Part name="collar — band (behind the neck)">
        <mesh position={[0, COLLAR.bandH / 2, -TORSO.d / 2 + COLLAR.bandD / 2]}>
          <boxGeometry args={[COLLAR.bandW, COLLAR.bandH, COLLAR.bandD]} />
          <meshLambertMaterial color={C.creamDark} />
        </mesh>
      </Part>
    </group>
  )
}

/**
 * The hair: a cap, and one mass beneath it cut to the hairline.
 *
 * Its outline seen head on is two clean stacked shapes — a mass that overhangs
 * the skull on both sides and carries down past the temples, with a narrower
 * block capping it. That silhouette is the contract, and it is easy to break:
 * every extra mass this used to carry came from reading the three-quarter view,
 * and each one that poked past the outline turned the front view into a pile of
 * loose rectangles.
 *
 * So there are now two pieces, not six. What the extras used to do in width is
 * done by the profile; what is left earns its keep in **depth**: the cap's back
 * half sits lower than its front, which is the step on the skyline when he
 * turns and is hidden behind the front half when he does not.
 *
 * Nothing here is rotated, either. The hair node in the artwork carries a 3.81°
 * turn, but that is a rotation in the drawing's own flat space, not a lean in
 * three dimensions; applying it as one tips the whole silhouette off square and
 * every seam against the head becomes a step.
 */
function hairProfile() {
  const half = HAIR.w / 2
  const last = HAIRLINE.length - 1

  const s = new Shape()
  HAIRLINE.forEach(([x, y], i) => {
    // The outer two points take the mass's own edges, so the profile cannot
    // drift away from HAIR.w when either is retuned.
    const px = i === 0 ? -half : i === last ? half : x
    const py = headTop + y
    if (i === 0) s.moveTo(px, py)
    else s.lineTo(px, py)
  })

  const top = headTop + HAIR.massTop
  s.lineTo(half, top)
  s.lineTo(-half, top)
  s.closePath()

  return s
}

function Hair() {
  const capTopY = headTop + HAIR.capTop
  const massTopY = headTop + HAIR.massTop

  const capH = capTopY - massTopY
  const capY = (capTopY + massTopY) / 2

  /** The cap is split front/back so the back can sit lower without showing. */
  const capFrontD = HAIR.capD * 0.55
  const capBackD = HAIR.capD - capFrontD

  const mass = useMemo(() => slab(hairProfile(), HAIR.d), [])
  useEffect(() => () => mass.dispose(), [mass])

  /** The lowest the hairline goes, which is how far the back has to reach. */
  const lowest = headTop + Math.min(...HAIRLINE.map(([, y]) => y))
  const backH = massTopY - lowest

  /** The strip of hair that overhangs the skull, and so the tabs' width. */
  const overhang = HAIR.w / 2 - HEAD.w / 2
  const tabTop = lowest
  const tabH = tabTop - (headTop + HAIR.tabBottom)

  return (
    <group>
      <Part name="hair — cap, front half">
      {/* Cap, front half — the block whose top face is the brightest thing on
          the model, and whose outline is the top step of the silhouette. */}
      <mesh position={[0, capY, HAIR.capD / 2 - capFrontD / 2]}>
        <boxGeometry args={[HAIR.capW, capH, capFrontD]} />
        <meshLambertMaterial color={C.hair} />
      </mesh>

      </Part>

      <Part name="hair — cap, back half (dropped)">
      {/* Cap, back half, dropped. Reads as the notch on the skyline from three
          quarters; from straight on the front half stands in front of it. */}
      <mesh
        position={[0, capY - HAIR.ledgeDrop / 2, -HAIR.capD / 2 + capBackD / 2]}
      >
        <boxGeometry args={[HAIR.capW, capH - HAIR.ledgeDrop, capBackD]} />
        <meshLambertMaterial color={C.hair} />
      </mesh>

      </Part>

      <Part name="hair — mass (cut to HAIRLINE)">
      {/* The mass, cut to the hairline in one piece and run the full depth of
          the hair. Full depth is safe precisely because it is cut: where the
          forehead shows there is no material at any depth. */}
      <mesh geometry={mass}>
        <meshLambertMaterial color={C.hair} />
      </mesh>

      </Part>

      <Part name="hair — temple tabs (behind the ear gap)">
      {/* The hair behind the ear, carrying on down where the cut profile stops.
          A box, because all it is is the mass continuing — the shape is in
          where it is not. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            side * (HEAD.w / 2 + overhang / 2),
            tabTop - tabH / 2,
            -(HAIR.d / 2 - HAIR.tabD / 2),
          ]}
        >
          <boxGeometry args={[overhang, tabH, HAIR.tabD]} />
          <meshLambertMaterial color={C.hair} />
        </mesh>
      ))}

      </Part>

      <Part name="hair — back wall">
      {/* Closes the back below the hairline, where the cut profile leaves the
          skull bare. Never seen head on; it is what stops the back of his head
          turning to skin when he looks away. */}
      <mesh
        position={[0, lowest + backH / 2, -(HAIR.d / 2 - HAIR.shell / 2)]}
      >
        <boxGeometry args={[HAIR.w, backH, HAIR.shell]} />
        <meshLambertMaterial color={C.hair} />
      </mesh>
      </Part>
    </group>
  )
}

/**
 * The eyes, and the only thing they do.
 *
 * The whole blink is driven from one `useFrame` writing to `scale.y`, and never
 * through React state — a blink is 120ms, so a state update per frame would
 * re-render the entire figure seven times a second to move two marks.
 */
function Eyes() {
  const lids = useRef<(Group | null)[]>([])

  // Held in a ref rather than in state for the same reason.
  const beat = useRef({
    /** Seconds until the next blink starts. */
    wait: BLINK.minGap,
    /** Progress through the current blink, or -1 when the eye is open. */
    t: -1,
    /** How long this particular blink runs. */
    dur: BLINK.dur,
    /** Blinks still owed after this one — how a double blink is spelt. */
    owed: 0,
  })

  useFrame((_, delta) => {
    const b = beat.current

    if (b.t >= 0) {
      b.t += delta
      if (b.t >= b.dur) {
        b.t = -1
        if (b.owed > 0) {
          b.owed -= 1
          b.wait = BLINK.doubleGap
        } else {
          b.wait = BLINK.minGap + Math.random() * (BLINK.maxGap - BLINK.minGap)
        }
      }
    } else {
      b.wait -= delta
      if (b.wait <= 0) {
        b.t = 0
        b.dur = BLINK.dur + (Math.random() * 2 - 1) * BLINK.durJitter
        if (Math.random() < BLINK.doubleChance) b.owed = 1
      }
    }

    let open = 1
    if (b.t >= 0) {
      const u = b.t / b.dur
      // Two eased runs rather than one curve over the whole blink: the lid has
      // to arrive at the closed position and leave it again, and a single
      // symmetric curve either snaps at the turn or never really shuts.
      const down = u < BLINK.closeShare
      const k = down
        ? u / BLINK.closeShare
        : (u - BLINK.closeShare) / (1 - BLINK.closeShare)
      const eased = k * k * (3 - 2 * k)
      open = down ? 1 - (1 - BLINK.shut) * eased : BLINK.shut + (1 - BLINK.shut) * eased
    }

    for (const lid of lids.current) {
      if (lid) lid.scale.y = open
    }
  })

  return (
    <>
      {/* Flat black, unlit: in the drawing the eyes are the one mark that never
          picks up a highlight, and shading them breaks that. */}
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={(node) => {
            lids.current[i] = node
          }}
          position={[side * EYE.x, EYE.y - eyeHeight / 2, HEAD.d / 2 - 0.01]}
        >
          {/* The group sits on the *bottom* of the eye and the mark is lifted
              back up inside it, so scaling the group brings the top edge down
              onto the bottom one and leaves that bottom edge where it is. On
              the mark's own centre both edges would travel and the eye would
              read as shrinking rather than closing. */}
          <mesh position={[0, eyeHeight / 2, 0]}>
            <capsuleGeometry args={[EYE.radius, EYE.length, 4, 12]} />
            <meshBasicMaterial color={C.eye} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Head() {
  return (
    <group>
      <Part name="head — skull box">
        <mesh>
          <boxGeometry args={[HEAD.w, HEAD.h, HEAD.d]} />
          <meshLambertMaterial color={C.skin} />
        </mesh>
      </Part>

      <Part name="head — eyes (blink)">
        <Eyes />
      </Part>

      <Hair />

    </group>
  )
}

/**
 * The neck, which is **not** part of the head.
 *
 * It used to be, and that was wrong twice over: it swung with the head, so a
 * full turn walked it out of the collar and opened a gap on the far side, and
 * it gave the head no fixed thing to pivot over. Left behind, it is the post
 * the head turns on — hidden inside the skull at rest, revealed as he looks
 * away.
 *
 * It runs from the pivot down into the shirt, so there is no height at which
 * both ends could come apart.
 */
function Neck() {
  const top = NECK_PIVOT
  const bottom = TORSO.top - 0.06
  return (
    <Part name="neck (static — head turns over it)">
      <mesh position={[0, (top + bottom) / 2, -0.02]}>
        <boxGeometry args={[0.52, top - bottom, 0.46]} />
        <meshLambertMaterial color={C.skinDark} />
      </mesh>
    </Part>
  )
}

/** How many head-widths one tile of the print covers. */
const SHIRT_TILE = 1.95

/**
 * Whether the print is on the shirt.
 *
 * Off while the body's *shape* is being settled. A loud pattern hides the seams
 * and steps that are the whole point of looking at a plain grey model, and
 * every judgement made about the silhouette with it on has to be made again
 * with it off.
 */
const PRINT = false

/** The shirt body: a square-shouldered box with its top corners cut. */
function bodyProfile() {
  const s = new Shape()
  const half = TORSO.w / 2
  const top = TORSO.top
  const bottom = TORSO.top - TORSO.h
  const c = SHOULDER_CHAMFER

  s.moveTo(-half + c, top)
  s.lineTo(half - c, top)
  s.lineTo(half, top - c)
  s.lineTo(half, bottom)
  s.lineTo(-half, bottom)
  s.lineTo(-half, top - c)
  s.closePath()

  return s
}

function Torso() {
  const shirt = useMemo(() => {
    if (!PRINT) return null
    const texture = createShirtTexture()
    texture.repeat.set(1 / SHIRT_TILE, 1 / SHIRT_TILE)
    return texture
  }, [])

  const body = useMemo(() => slab(bodyProfile(), TORSO.d), [])

  useEffect(
    () => () => {
      shirt?.dispose()
      body.dispose()
    },
    [shirt, body],
  )

  // Hung off the V rather than off a measured height: the placket starts where
  // the collar stops being open, so the two cannot drift apart.
  const placketTop = TORSO.top - COLLAR.vDrop
  const placketH = TORSO.h - COLLAR.vDrop

  return (
    <group>
      <Part name="shirt — body">
        <mesh geometry={body}>
          <meshLambertMaterial color={C.cream} map={shirt} />
        </mesh>
      </Part>

      {/* The sleeves are not here — they are part of the arm, see ArmTube. */}

      {/* Button placket. Mostly behind the folded arms head on — it earns its
          place at the neck, where the collar opens onto it. */}
      <Part name="shirt — placket">
      <mesh
        position={[0, placketTop - placketH / 2, TORSO.d / 2 + PLACKET.proud / 2]}
      >
        <boxGeometry args={[PLACKET.w, placketH, PLACKET.proud]} />
        <meshLambertMaterial color={C.creamDark} />
      </mesh>
      </Part>

      <Part name="shirt — buttons">
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[
            0,
            placketTop - 0.16 - i * PLACKET.gap,
            TORSO.d / 2 + PLACKET.proud + 0.008,
          ]}
        >
          <boxGeometry args={[PLACKET.button, PLACKET.button, 0.02]} />
          <meshLambertMaterial color={C.ink} />
        </mesh>
      ))}
      </Part>

      <Collar />
    </group>
  )
}

/**
 * Arms folded. The mascot's left forearm lies across the top, its hand tucked
 * against the far elbow; the right one runs underneath, hand out the other
 * side. Which arm is on top is the whole pose — swap them and it reads as a
 * shrug.
 */
/**
 * One arm: the bare tube, the sleeve over the top of it, and the hand.
 *
 * Laid out in the arm's own frame — the group is put at the shoulder and turned
 * out by `ARM.angle`, so everything inside simply runs along -Y and no piece
 * has to know the angle. That is what keeps the sleeve on the arm: they are the
 * same axis by construction, not two things aimed at each other.
 */
function ArmTube({ side }: { side: number }) {
  const sleeve = useMemo(() => sleeveGeometry(), [])
  useEffect(() => () => sleeve.dispose(), [sleeve])

  return (
    <group
      position={[side * shoulderX, shoulderY, 0]}
      rotation={[0, 0, side * ARM.angle]}
    >
      <Part name="arm — bare tube (shoulder to wrist)">
        {/* Four-sided and turned an eighth so its flats face front and side
            like every other block on the figure. */}
        <mesh
          position={[0, -(armStart + (ARM.length - armStart) / 2), 0]}
          rotation={[0, Math.PI / 4, 0]}
        >
          <cylinderGeometry
            args={[
              prismR(armWidthAt(armStart)),
              prismR(ARM.wristW),
              ARM.length - armStart,
              4,
            ]}
          />
          <meshLambertMaterial color={C.skin} />
        </mesh>
      </Part>

      <Part name="arm — sleeve (with the shoulder roll)">
        {/* Cut for +x and turned about Y for the other side — the profile is
            centred in z, so the mirror lands it back on its own footprint. */}
        <group rotation={[0, side < 0 ? Math.PI : 0, 0]}>
          <mesh geometry={sleeve}>
            <meshLambertMaterial color={C.cream} />
          </mesh>
        </group>
      </Part>

      <Part name="arm — hand">
        {/* Cut wrist-at-origin pointing +Y, so it is turned to face back down
            the arm. */}
        <group position={[0, -ARM.length, 0]} rotation={[0, 0, Math.PI]}>
          <Hand tilt={0} roll={0} />
        </group>
      </Part>
    </group>
  )
}

/**
 * The sleeve, shoulder roll and all, as **one closed outline**.
 *
 * It was two pieces — a rolled cap and a tapered prism under it — and they
 * could not be made to stop showing their join: run the prism from the shoulder
 * and its square corner came out through the roll; start it below and the two
 * tapers disagreed by a hair and left a lip. There is no seam to hide when
 * there is only one piece.
 *
 * Cut in the arm's own plane, pointing +x, and mirrored for the other side.
 * The inner edge is a plain taper; the outer takes the roll over the first
 * `SHOULDER.run` and then tapers with it.
 */
function sleeveProfile() {
  const s = new Shape()
  const half = (d: number) => clothWidthAt(d) / 2

  // Down the inner edge, then across the cuff.
  s.moveTo(-half(0), 0)
  s.lineTo(-half(SLEEVE.run), -SLEEVE.run)
  s.lineTo(half(SLEEVE.run), -SLEEVE.run)

  // Back up the outer edge to where the roll begins.
  s.lineTo(half(SHOULDER.run), -SHOULDER.run)

  // Then the roll, bottom to top. `1 - cos` leaves the sleeve going straight up
  // and turns in hardest near the top, which is the way a shoulder sits; a
  // straight taper reads as a bevel and a `sin` rolls the wrong way round.
  for (let i = 1; i <= SHOULDER.steps; i += 1) {
    const u = i / SHOULDER.steps
    const d = SHOULDER.run * (1 - u)
    s.lineTo(half(d) - SHOULDER.inset * (1 - Math.cos((u * Math.PI) / 2)), -d)
  }

  s.closePath()
  return s
}

/**
 * That outline extruded, and then **tapered in depth to match**.
 *
 * `ExtrudeGeometry` gives a constant thickness, which would leave the cloth as
 * deep at the cuff as at the shoulder while the arm inside it narrows by a
 * third — fine head on, wrong the moment he turns. Scaling each vertex's z by
 * the cloth's own width at that height costs four lines and makes it a real
 * tapered tube.
 */
function sleeveGeometry() {
  const geo = slab(sleeveProfile(), sleeveTopW)
  const position = geo.attributes.position

  for (let i = 0; i < position.count; i += 1) {
    const d = -position.getY(i)
    position.setZ(i, position.getZ(i) * (clothWidthAt(d) / sleeveTopW))
  }

  position.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function Arms() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <ArmTube key={side} side={side} />
      ))}
    </group>
  )
}

/**
 * The cup, sitting on the top forearm.
 *
 * Placed off `shoulderY` and `ARM.thickness` rather than at a measured height,
 * so it stays on the arm when the fold is retuned. Nothing else in the figure
 * is balanced on anything, and a cup that drifts off its rest is worse than no
 * cup at all.
 */
function Cup() {
  return (
    <Part name="cup">
    <mesh position={[CUP.x, CUP.y, CUP.z]} rotation={[0, Math.PI / 8, 0]}>
      <cylinderGeometry args={[CUP.rTop, CUP.rBottom, CUP.h, 8]} />
      <meshLambertMaterial color={C.cup} />
    </mesh>
    </Part>
  )
}

/**
 * Where the head swivels from. Not its centre — pivoting there swings the chin
 * out one way while the crown goes the other, and the neck ends up sticking out
 * of the side of the collar. This sits at the base of the skull, so a turn
 * carries the head over a neck that stays put.
 */
const NECK_PIVOT = -0.5

/**
 * Which pieces are in the scene.
 *
 * The model is being built back up one part at a time, and this is the switch
 * for that: a part is turned off here, not deleted, and not commented out
 * either — everything below still has to compile and still has to agree with
 * the measurements it is built from, so that turning a part back on brings it
 * back exactly as it was rather than as whatever survived being edited around.
 */
const PARTS = { head: true, torso: true, arms: true, cup: false }

export function Mascot({
  headRef,
  ...props
}: {
  position?: V3
  rotation?: V3
  scale?: number
  /** Rotate this to turn the head on its own; the body stays where it is. */
  headRef?: Ref<Group>
}) {
  const root = useRef<Group>(null)

  // Every block both casts and receives. Set here by traversal rather than as a
  // prop on forty meshes — and it is not decoration: the folded arms are two
  // slabs of one colour lying across each other, and without a shadow between
  // them their touching faces take identical light and read as one lump.
  useEffect(() => {
    root.current?.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [])

  return (
    <group ref={root} {...props}>
      {PARTS.head && (
        <>
          {/* Outside the rotating group on purpose — see Neck. */}
          <Neck />
          <group ref={headRef} position={[0, NECK_PIVOT, 0]}>
            <group position={[0, -NECK_PIVOT, 0]}>
              <Head />
            </group>
          </group>
        </>
      )}
      {PARTS.torso && <Torso />}
      {PARTS.arms && <Arms />}
      {PARTS.cup && <Cup />}
    </group>
  )
}
