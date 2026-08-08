import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, Box3Helper, Color, Mesh, Raycaster, type Object3D } from 'three'

/**
 * Naming the parts, so the model can be argued about out loud.
 *
 * The mascot is forty-odd blocks that all look like each other, and every round
 * of notes so far has had to describe a piece by where it happens to be sitting
 * — "the wedge at the shoulder", "that step by the temple". Half of those turned
 * out to be a different part than either of us thought. Pointing at the thing
 * and being told its name settles that in one move.
 *
 * DEV only.
 */

export type Hover = { name: string; object: Object3D } | null

/**
 * The key that turns it on, as a **physical key code** rather than a character.
 *
 * `event.key` is whatever the current keyboard layout produces, and on a Thai
 * layout the D key produces 'ก' — so a character comparison silently does
 * nothing for anyone not currently typing in English, which is most of the time
 * on this project. `event.code` is the key's position and never changes.
 */
const DEBUG_CODE = 'KeyD'
/** What to call it in the hint. */
const DEBUG_KEY = 'D'

/** Where a part hangs its name. Read back off the hit object's ancestors. */
const PART_KEY = 'mascotPart'

export function useMascotDebug() {
  const [enabled, setEnabled] = useState(false)
  const [hover, setHover] = useState<Hover>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const onKey = (event: KeyboardEvent) => {
      // Ignore the shortcut while typing, and while a modifier is held so it
      // cannot shadow a browser command.
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target?.closest('input, textarea')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code !== DEBUG_CODE) return

      setEnabled((on) => !on)
      setHover(null)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = useMemo(
    () => () => {
      setEnabled((on) => !on)
      setHover(null)
    },
    [],
  )

  return useMemo(
    () => ({ enabled: import.meta.env.DEV && enabled, hover, setHover, toggle }),
    [enabled, hover, toggle],
  )
}

/**
 * Wraps a piece of the model and labels it.
 *
 * A plain group carrying a name in `userData` and **nothing else** — no
 * handlers, no conditional rendering, nothing that changes when debug is turned
 * on. That matters: the first version swapped this wrapper in and out with the
 * mode, which rebuilt the whole figure at the instant of the toggle and left
 * the picker working only if the pointer happened to cross a boundary
 * afterwards.
 */
export function Part({ name, children }: { name: string; children: ReactNode }) {
  return <group userData={{ [PART_KEY]: name }}>{children}</group>
}

/** The nearest ancestor a `Part` put a name on, if any. */
function partOf(object: Object3D): Hover {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const name = node.userData[PART_KEY]
    if (typeof name === 'string') return { name, object: node }
  }
  return null
}

/**
 * Picks whatever is under the pointer, and boxes it.
 *
 * Casts its own ray every frame rather than relying on `onPointerOver`. Enter
 * and leave only fire when the pointer *crosses* an object, so with a still
 * mouse — which is exactly what you have while reading the label — nothing
 * updates. Re-casting each frame also keeps up with the figure as it breathes
 * and as the head turns under a pointer that has not moved at all.
 */
export function PartPicker({
  enabled,
  hover,
  setHover,
}: {
  enabled: boolean
  hover: Hover
  setHover: (next: Hover) => void
}) {
  const box = useRef(new Box3())
  const ray = useMemo(() => new Raycaster(), [])
  const helper = useMemo(
    () => new Box3Helper(box.current, new Color('#1868DB')),
    [],
  )

  useEffect(() => () => helper.dispose(), [helper])

  useFrame((state) => {
    helper.visible = false

    if (!enabled) {
      if (hover) setHover(null)
      return
    }

    ray.setFromCamera(state.pointer, state.camera)
    const hit = ray
      .intersectObjects(state.scene.children, true)
      // The outline itself is in the scene. Only solids can be parts.
      .find((it) => it.object instanceof Mesh && it.object.visible)

    const next = hit ? partOf(hit.object) : null
    if (next?.name !== hover?.name) setHover(next)

    if (next) {
      helper.visible = true
      box.current.setFromObject(next.object)
    }
  })

  return <primitive object={helper} />
}

/**
 * The readout. Plain DOM, outside the canvas, so it stays crisp.
 *
 * Top left rather than bottom left: the theme picker already lives down there
 * and the two overlapped.
 */
export function DebugOverlay({
  enabled,
  hover,
  onToggle,
}: {
  enabled: boolean
  hover: Hover
  onToggle: () => void
}) {
  if (!import.meta.env.DEV) return null

  return (
    <div className="absolute top-24 left-6 z-10 font-mono text-xs">
      {/* A real button, not just a keyboard hint. The shortcut needs the page
          to hold focus, and after a reload or a click on browser chrome it
          does not — which looks exactly like the tool being broken. */}
      <button
        type="button"
        onClick={onToggle}
        className={`cursor-pointer rounded-lg px-3 py-2 text-left text-paper ${
          enabled ? 'bg-ink/85' : 'bg-ink/35 opacity-70'
        }`}
      >
        {enabled ? (
          <>
            <div>{hover ? hover.name : 'point at a part'}</div>
            <div className="mt-1 opacity-60">click or {DEBUG_KEY} to exit</div>
          </>
        ) : (
          <>{DEBUG_KEY} — name parts</>
        )}
      </button>
    </div>
  )
}
