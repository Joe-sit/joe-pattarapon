import { useState } from 'react'

/**
 * แผงจูนแท่น 3D ของจอแรก — เห็นเฉพาะตอน dev (ดูตัวกั้นที่ HeroPlatform)
 *
 * มีเพราะการหาตำแหน่งของบนแท่นไอโซทำในหัวไม่ได้: แกน x/z ของฉากไม่ตรงกับซ้าย-ขวา/บน-ล่าง
 * บนจอ (หน้าจอเห็นเป็น x−z กับ x+z) กว่าจะรู้ว่าเลข 2.7 คือตรงไหนต้องแก้โค้ด รีโหลด แล้วดู
 * ทีละรอบ แผงนี้ลากได้เห็นผลทันที แล้วกดปุ่มก๊อบค่าที่ได้กลับไปแปะเป็นค่าตั้งต้นในโค้ด
 *
 * ค่าที่แผงนี้แก้เป็น state ของ React จริง ๆ ไม่ใช่การเขียนทับ object ในฉากตรง ๆ — มันเปลี่ยน
 * เฉพาะตอนลาก (ไม่ใช่ทุกเฟรม) และการวางของยังผ่านทางเดิมที่โค้ดจริงใช้ ค่าที่เห็นจึงเชื่อได้ว่า
 * เอาไปแปะแล้วได้ภาพเดิม
 */

export type HeroCfg = {
  mascot: { x: number; z: number; yaw: number; scale: number }
  scene: { x: number; z: number; yaw: number; scale: number }
  /** ตัวหารความสูงแคนวาสที่ใช้เป็น zoom ของกล้อง — น้อย = แท่นใหญ่ */
  fit: number
}

type Row = {
  label: string
  value: number
  min: number
  max: number
  step: number
  set: (v: number) => void
}

function Slider({ label, value, min, max, step, set }: Row) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] text-[#9aa4b2]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.currentTarget.value))}
        className="h-1 flex-1 cursor-pointer accent-[#4a7ec0]"
      />
      <span className="w-10 shrink-0 text-right tabular-nums">{value.toFixed(2)}</span>
    </label>
  )
}

export function HeroPlatformDebug({
  cfg,
  setCfg,
  reset,
}: {
  cfg: HeroCfg
  setCfg: (next: HeroCfg) => void
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)

  const part = (key: 'mascot' | 'scene') => (field: 'x' | 'z' | 'yaw' | 'scale') => (v: number) =>
    setCfg({ ...cfg, [key]: { ...cfg[key], [field]: v } })

  const mascot = part('mascot')
  const scene = part('scene')

  /** โค้ดที่เอาไปแปะทับค่าตั้งต้นใน HeroPlatform ได้ตรง ๆ */
  const snippet =
    `mascot: { x: ${cfg.mascot.x}, z: ${cfg.mascot.z}, yaw: ${cfg.mascot.yaw}, scale: ${cfg.mascot.scale} },\n` +
    `scene: { x: ${cfg.scene.x}, z: ${cfg.scene.z}, yaw: ${cfg.scene.yaw}, scale: ${cfg.scene.scale} },\n` +
    `fit: ${cfg.fit},`

  return (
    <div
      data-hero-debug=""
      className="pointer-events-auto fixed bottom-3 left-3 z-[10000] w-[268px] rounded border border-[#2a3340] bg-[#060910]/92 p-3 font-mono text-[11px] text-[#cfd6e0]"
    >
      <div className="mb-1 text-[10px] tracking-wide text-[#6f7d8f]">MASCOT</div>
      <div className="flex flex-col gap-1">
        <Slider label="x" value={cfg.mascot.x} min={-4} max={4} step={0.1} set={mascot('x')} />
        <Slider label="z" value={cfg.mascot.z} min={-4} max={4} step={0.1} set={mascot('z')} />
        {/* yaw เป็นหน่วย π ไม่ใช่องศา — ค่าที่ได้แปะกลับเป็น Math.PI * n ได้ทันที */}
        <Slider label="yaw π" value={cfg.mascot.yaw} min={-1} max={1} step={0.01} set={mascot('yaw')} />
        <Slider label="scale" value={cfg.mascot.scale} min={0.2} max={1.4} step={0.01} set={mascot('scale')} />
      </div>

      <div className="mt-3 mb-1 text-[10px] tracking-wide text-[#6f7d8f]">SCENE</div>
      <div className="flex flex-col gap-1">
        <Slider label="x" value={cfg.scene.x} min={-6} max={6} step={0.1} set={scene('x')} />
        <Slider label="z" value={cfg.scene.z} min={-6} max={6} step={0.1} set={scene('z')} />
        <Slider label="yaw π" value={cfg.scene.yaw} min={-1} max={1} step={0.01} set={scene('yaw')} />
        <Slider label="scale" value={cfg.scene.scale} min={0.3} max={2.5} step={0.01} set={scene('scale')} />
      </div>

      <div className="mt-3 mb-1 text-[10px] tracking-wide text-[#6f7d8f]">CAMERA</div>
      <Slider
        label="fit"
        value={cfg.fit}
        min={4}
        max={16}
        step={0.1}
        set={(v) => setCfg({ ...cfg, fit: v })}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="cursor-pointer rounded border border-[#2a3340] px-2 py-1"
          onClick={() => {
            navigator.clipboard.writeText(snippet).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
        <button
          type="button"
          className="cursor-pointer rounded border border-[#2a3340] px-2 py-1"
          onClick={() => {
            setCopied(false)
            reset()
          }}
        >
          reset
        </button>
      </div>
    </div>
  )
}
