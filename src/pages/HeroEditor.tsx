import { useState, useSyncExternalStore } from 'react'

/**
 * โหมดจัดฉาก (dev เท่านั้น) — ลากวางชิ้นส่วนในฉากได้อิสระ แล้วก๊อบตัวเลขกลับมาใส่โค้ด
 *
 * เก็บสถานะไว้ในสโตร์นอก React ไม่ใช่ context เพราะ <Canvas> ของ r3f เป็น React root
 * คนละต้นกับหน้าเว็บ — context ของหน้าไม่ไหลเข้าไปในฉาก ต้องมีตัวกลางที่ทั้งสองฝั่งอ่านได้
 *
 * ชิ้นส่วนรายงานตำแหน่งตัวเองเข้ามาหลังถูกลาก (ดู Chunk ใน HeroShatter) แผงมุมขวาล่างจึง
 * พิมพ์ผลออกมาเป็นบล็อกที่ก๊อบไปวางทับโค้ดเดิมได้เลย ไม่ต้องนั่งเดาเลขจากภาพ
 */

export type EditEntry = {
  /** ชื่อที่ใช้อ้างในบล็อกที่ก๊อบออกไป */
  name: string
  position: [number, number, number]
  /** เรเดียน — มีเฉพาะชิ้นที่ถูกหมุน/เอียง */
  rotation?: [number, number, number]
}

/** ค่าวางทั้ง diorama — ตำแหน่ง/หมุน/ย่อทั้งก้อน + ระยะ fit ของกล้อง */
export type SceneCfg = { x: number; y: number; z: number; yaw: number; scale: number; fit: number }

const store = {
  editing: false,
  /** null = ยังไม่ถูกแตะ ใช้ค่าจากโค้ดตามเดิม */
  scene: null as SceneCfg | null,
  selected: null as number | null,
  entries: new Map<number, EditEntry>(),
  rev: 0,
}

const listeners = new Set<() => void>()
const emit = () => {
  store.rev++
  for (const l of listeners) l()
}

export const editor = {
  get editing() {
    return store.editing
  },
  get selected() {
    return store.selected
  },
  get entries() {
    return store.entries
  },
  get scene() {
    return store.scene
  },
  /** ตั้งค่าตั้งต้นจากโค้ด เรียกได้หลายครั้ง แต่จะเขียนแค่ครั้งแรก */
  initScene(cfg: SceneCfg) {
    if (!store.scene) store.scene = cfg
  },
  setScene(patch: Partial<SceneCfg>) {
    if (!store.scene) return
    store.scene = { ...store.scene, ...patch }
    emit()
  },
  setEditing(on: boolean) {
    store.editing = on
    if (!on) store.selected = null
    emit()
  },
  select(id: number | null) {
    store.selected = id
    emit()
  },
  report(id: number, entry: EditEntry) {
    store.entries.set(id, entry)
    emit()
  },
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** คืนเลขเวอร์ชันของสโตร์ — ใช้บังคับให้คอมโพเนนต์วาดใหม่เมื่อมีการลาก/เลือก */
export function useEditorRev() {
  return useSyncExternalStore(
    subscribe,
    () => store.rev,
    () => store.rev,
  )
}

const fmt = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(1))
const fmtR = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2))
const line = (e: EditEntry) =>
  `${e.name}: [${e.position.map(fmt).join(', ')}]` +
  (e.rotation ? ` rot [${e.rotation.map(fmtR).join(', ')}]` : '')

/** แผง HTML ข้างแคนวาส — รายชื่อชิ้นที่ถูกย้าย + ปุ่มก๊อบตำแหน่งทั้งชุด */
export function EditorPanel({ onClose }: { onClose: () => void }) {
  useEditorRev()
  const [copied, setCopied] = useState(false)

  const rows = [...store.entries.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  const sc = store.scene
  const dump = [
    ...rows.map(([, e]) => line(e)),
    ...(sc
      ? [
          `scene: { x: ${fmt(sc.x)}, y: ${fmt(sc.y)}, z: ${fmt(sc.z)}, yaw: ${fmtR(sc.yaw)}, scale: ${fmtR(sc.scale)} }`,
          `fit: ${fmtR(sc.fit)}`,
        ]
      : []),
  ].join('\n')

  return (
    <div className="pointer-events-auto fixed right-4 bottom-4 z-50 w-[290px] rounded-xl bg-[#101216]/95 p-3 font-mono text-[11px] text-white shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[12px]">Scene editor</strong>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded px-2 py-1 text-white/60 hover:bg-white/10"
        >
          close
        </button>
      </div>

      <p className="mb-2 text-white/50">
        ลาก = ย้ายบนพื้น · Shift+ลาก = ยกขึ้น/ลง · Alt+ลาก = หมุน (ซ้าย-ขวา) และเอียง (ขึ้น-ลง)
      </p>

      {sc && (
        <div className="mb-2 border-b border-white/10 pb-2">
          <div className="mb-1 text-white/50">ทั้งฉาก</div>
          {(
            [
              ['x', -14, 14, 0.1],
              ['y', -8, 8, 0.1],
              ['z', -14, 14, 0.1],
              ['yaw', -1, 1, 0.01],
              ['scale', 0.4, 2, 0.01],
              ['fit', 8, 40, 0.1],
            ] as const
          ).map(([key, min, max, step]) => (
            <label key={key} className="flex items-center gap-2 py-[1px]">
              <span className="w-9 text-white/70">{key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={sc[key]}
                onChange={(e) => editor.setScene({ [key]: Number(e.target.value) })}
                className="h-1 flex-1 cursor-pointer accent-[var(--v3-orange)]"
              />
              <span className="w-9 text-right tabular-nums">
                {key === 'x' || key === 'y' || key === 'z' ? fmt(sc[key]) : fmtR(sc[key])}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="max-h-[200px] overflow-y-auto">
        {rows.length === 0 && <p className="text-white/40">ยังไม่มีชิ้นไหนถูกลาก</p>}
        {rows.map(([id, e]) => (
          <div
            key={id}
            className={`flex justify-between gap-2 py-[2px] ${
              id === store.selected ? 'text-[#ffb27a]' : 'text-white/80'
            }`}
          >
            <span>{e.name}</span>
            <span className="text-right">
              [{e.position.map(fmt).join(', ')}]
              {e.rotation && <> rot [{e.rotation.map(fmtR).join(', ')}]</>}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!rows.length && !sc}
        onClick={() => {
          void navigator.clipboard?.writeText(dump)
          console.log(dump)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        className="mt-2 w-full cursor-pointer rounded bg-[var(--v3-orange)] py-2 font-bold text-white disabled:cursor-default disabled:opacity-40"
      >
        {copied ? 'copied' : 'copy positions'}
      </button>
    </div>
  )
}
