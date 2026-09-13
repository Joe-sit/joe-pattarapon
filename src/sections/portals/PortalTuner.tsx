import { useEffect, useRef, useState } from 'react'
import { layout, layoutSource, resetLayout, saveLayout } from './portalLayout'

/**
 * แผงจูนผังบานของจอ Experiences (dev เท่านั้น)
 *
 * มุมเอียงของบานเทียบกับภาพอ้างอิงด้วยตาเท่านั้น การแก้ตัวเลขในโค้ดแล้ว reload รอบละครั้ง
 * ใช้เทียบไม่ได้ — ต้องลากแล้วเห็นผลทันทีในเฟรมเดียวกับที่จะเอาไปเทียบ
 *
 * ตำแหน่ง/มุมถูกอ่านใน useFrame ของฉาก จึงไม่ต้อง re-render อะไรเลยตอนลาก ส่วนขนาดบาน
 * ต้องปั้นเรขาคณิตใหม่ — เลยยก `ver` ให้ฉากรู้ว่าต้องปั้นรอบใหม่
 *
 * ปุ่ม "คัดลอกโค้ด" ให้ค่าที่วางกลับลง DEFAULT_LAYOUT ได้ตรง ๆ — ของที่ deploy ต้องมาจาก
 * โค้ด ไม่ใช่ค่าที่ค้างใน localStorage ของเครื่องใครคนหนึ่ง
 */
const ROWS: { key: 'pos' | 'rot'; at: number; label: string; min: number; max: number; step: number }[] = [
  { key: 'pos', at: 0, label: 'x', min: -16, max: 16, step: 0.1 },
  { key: 'pos', at: 1, label: 'y', min: -10, max: 10, step: 0.1 },
  { key: 'pos', at: 2, label: 'z', min: -12, max: 8, step: 0.1 },
  /**
   * ช่วงมุมเต็มรอบครึ่ง (±π) ไม่ใช่ ±0.8/±1.2 ของเดิม
   *
   * ค่าที่จูนได้จริงไปติดขอบสไลเดอร์ทั้งสามแกน (0.8, 1.2, −1.2 คือค่าสุดของช่วงเดิมพอดี)
   * ซึ่งแปลว่าสไลเดอร์เป็นตัวจำกัดผลลัพธ์ ไม่ใช่ตาของคนจูน
   */
  { key: 'rot', at: 0, label: '° ก้ม/เงย', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'rot', at: 1, label: '° ส่าย', min: -Math.PI, max: Math.PI, step: 0.01 },
  { key: 'rot', at: 2, label: '° หมุนหน้าบาน', min: -Math.PI, max: Math.PI, step: 0.01 },
]

/** ตำแหน่งแผงจำไว้ข้ามรีเฟรช — ของ dev เท่านั้น ไม่มีผลกับหน้าจริง */
const POS_KEY = 'portals.tuner.pos'
/** สถานะพับของแผงและของแต่ละหัวข้อ — คนละที่กับค่าที่จูน (เหมือน newhero.panel) */
const UI_KEY = 'portals.tuner.panel'
const PANEL_W = 300

type Ui = { collapsed: boolean; open: Record<string, boolean> }

/**
 * ค่าเริ่มต้น: ยุบทั้งแผง เปิดเฉพาะหัวข้อ "บาน"
 *
 * แผงนี้ยาวกว่าความสูงจอเมื่อกางทุกหัวข้อ (สไลเดอร์ราว 25 แถว) และมันวางทับจอที่กำลังจูนอยู่
 * — เปิดหน้ามาเจอแถบเดียวแล้วค่อยกางเฉพาะที่จะแก้ ดีกว่าเจอกำแพงสไลเดอร์ทับฉากทั้งจอ
 */
function loadUi(): Ui {
  const base: Ui = { collapsed: true, open: { บาน: true } }
  if (typeof localStorage === 'undefined') return base
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') }
  } catch {
    return base
  }
}

/** หัวข้อพับได้ — หน้าตาเดียวกับแถบจับลาก ต่างที่มีลูกศรบอกสถานะ */
function Section({
  name,
  open,
  onToggle,
  children,
}: {
  name: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          textAlign: 'left',
          margin: '6px 0 4px',
          padding: '2px 6px',
          borderRadius: 6,
          border: 0,
          background: '#ffffff10',
          color: '#9fd4e8',
          font: 'inherit',
        }}
      >
        {open ? '▾' : '▸'} {name}
      </button>
      {open && children}
    </>
  )
}

function loadPos() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { x: number; y: number }
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? p : null
  } catch {
    return null
  }
}

export function PortalTuner() {
  const [, bump] = useState(0)
  const [copied, setCopied] = useState(false)
  /**
   * ลากแผงไปวางที่ไหนก็ได้
   *
   * จำเป็นเพราะแผงบังของที่กำลังจูนอยู่เอง (บานซ้ายล่างกับตัวละครอยู่ใต้แผงพอดี) และ
   * แผงจูนของฉาก hero จองฝั่งขวาไว้แล้ว — ที่ว่างจึงเปลี่ยนไปตามค่าที่กำลังลาก
   *
   * เก็บเป็นพิกัดซ้าย/บน (ไม่ใช่ขวา/ล่าง) เพื่อให้การหนีบขอบจอคิดจากกรอบเดียวกันทั้งสองแกน
   */
  const [pos, setPos] = useState(() => loadPos())
  const [ui, setUiState] = useState(loadUi)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const setUi = (patch: Partial<Ui>) =>
    setUiState((u) => {
      const next = { ...u, ...patch }
      try {
        localStorage.setItem(UI_KEY, JSON.stringify(next))
      } catch {
        /* โหมดส่วนตัว — จำข้ามรีเฟรชไม่ได้ก็ยังใช้ได้ */
      }
      return next
    })
  const toggle = (name: string) => setUi({ open: { ...ui.open, [name]: !ui.open[name] } })

  useEffect(() => {
    if (!pos) return
    localStorage.setItem(POS_KEY, JSON.stringify(pos))
  }, [pos])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      // หนีบไว้ในจอ ไม่ให้ลากหลุดออกไปจนคลิกกลับไม่ได้
      const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - d.dx))
      const y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - d.dy))
      setPos({ x, y })
    }
    const up = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])
  const sel = layout.sel
  const win = layout.wins[sel]

  const set = (fn: () => void, rebuild = false) => {
    fn()
    if (rebuild) layout.ver += 1
    saveLayout()
    bump((v) => v + 1)
  }

  return (
    <div
      style={{
        position: 'fixed',
        /* ยังไม่เคยลาก = ซ้ายล่าง (แผงจูนของ /new-hero จองฝั่งขวาไว้แล้ว) */
        left: pos ? pos.x : 12,
        top: pos ? pos.y : undefined,
        bottom: pos ? undefined : 12,
        zIndex: 70,
        width: ui.collapsed ? 'auto' : PANEL_W,
        padding: ui.collapsed ? 6 : 10,
        borderRadius: 10,
        background: '#0b1418ee',
        color: '#d8f4ff',
        font: '11px/1.6 ui-monospace, monospace',
        boxShadow: '0 6px 24px #0008',
      }}
    >
      {/* แถบจับลาก — ทั้งแถบเป็นที่จับ ไม่ใช่จุดเล็ก ๆ ที่ต้องเล็ง */}
      <div
        onPointerDown={(e) => {
          /* กดปุ่มยุบต้องเป็นการกดปุ่ม ไม่ใช่เริ่มลากแผง */
          if ((e.target as HTMLElement).closest('button')) return
          const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
          drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top }
          // ตรึงตำแหน่งเป็นซ้าย/บนทันทีที่เริ่มลาก ไม่งั้นแผงที่ยังยึดขอบล่างจะกระโดด
          setPos({ x: box.left, y: box.top })
        }}
        style={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: ui.collapsed ? 0 : 6,
          padding: '2px 6px',
          borderRadius: 6,
          background: '#ffffff14',
          color: '#9fd4e8',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* ปุ่มยุบอยู่ในแถบจับลาก — ตัวจับลากข้ามปุ่มให้เอง (ดู onPointerDown) */}
        <button
          type="button"
          onClick={() => setUi({ collapsed: !ui.collapsed })}
          title={ui.collapsed ? 'กางแผง' : 'ยุบเหลือแถบเดียว'}
          style={{
            cursor: 'pointer',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          {ui.collapsed ? '▸' : '▾'}
        </button>
        <span>⠿ ผังพอร์ทัล{ui.collapsed ? '' : ' — ลากย้ายได้'}</span>
      </div>

      {!ui.collapsed && (
        <>
      <Section name={`บาน (เลือกอยู่: บาน ${sel + 1})`} open={!!ui.open['บาน']} onToggle={() => toggle('บาน')}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {layout.wins.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => set(() => { layout.sel = i })}
            style={{
              flex: 1,
              cursor: 'pointer',
              padding: '3px 0',
              borderRadius: 6,
              border: '1px solid #ffffff22',
              background: i === sel ? '#2f6fe8' : '#ffffff12',
              color: '#eaf7ff',
            }}
          >
            บาน {i + 1}
          </button>
        ))}
      </div>

      {ROWS.map((r) => (
        <label key={`${r.key}${r.at}`} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
          <span>{r.label}</span>
          <input
            type="range"
            min={r.min}
            max={r.max}
            step={r.step}
            value={win[r.key][r.at]}
            onChange={(e) => set(() => { win[r.key][r.at] = Number(e.target.value) })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ textAlign: 'right' }}>{win[r.key][r.at].toFixed(2)}</span>
        </label>
      ))}

      {([
        ['w', 'กว้าง', 2, 12, 0.1],
        ['h', 'สูง', 2, 14, 0.1],
      ] as const).map(([k, label, min, max, step]) => (
        <label key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={win[k]}
            onChange={(e) => set(() => { win[k] = Number(e.target.value) }, true)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ textAlign: 'right' }}>{win[k].toFixed(2)}</span>
        </label>
      ))}

      </Section>

      {/* ตัวละคร — พิกัดเทียบกลางบานที่มันเกาะอยู่ ไม่ใช่พิกัดโลก */}
      <Section
        name={`ตัวละคร (อยู่บาน ${layout.guy.at + 1})`}
        open={!!ui.open['ตัวละคร']}
        onToggle={() => toggle('ตัวละคร')}
      >
      {([
        ['pos', 0, 'ตัว x', -8, 8, 0.05],
        ['pos', 1, 'ตัว y', -8, 8, 0.05],
        ['pos', 2, 'ตัว z', -8, 8, 0.05],
        ['rot', 0, 'ตัว ° ก้ม/หงาย', -3.2, 3.2, 0.01],
        ['rot', 1, 'ตัว ° ส่าย', -3.2, 3.2, 0.01],
        ['rot', 2, 'ตัว ° เอียงข้าง', -3.2, 3.2, 0.01],
      ] as const).map(([key, at, label, min, max, step]) => (
        <label key={`g${key}${at}`} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={layout.guy[key][at]}
            onChange={(e) => set(() => { layout.guy[key][at] = Number(e.target.value) })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ textAlign: 'right' }}>{layout.guy[key][at].toFixed(2)}</span>
        </label>
      ))}
      <label style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
        <span>ตัว ขนาด</span>
        <input
          type="range"
          min={0.2}
          max={6}
          step={0.05}
          value={layout.guy.scale}
          onChange={(e) => set(() => { layout.guy.scale = Number(e.target.value) })}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ textAlign: 'right' }}>{layout.guy.scale.toFixed(2)}</span>
      </label>
      {([
        ['deep', 'ตัว ลึกในมิติ', -12, 0, 0.1],
        ['outAt', 'ตัว จบลอยออกที่', 0.05, 0.9, 0.01],
        ['inAt', 'ตัว เริ่มลอยเข้าที่', 0.1, 0.98, 0.01],
      ] as const).map(([k, label, min, max, step]) => (
        <label key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={layout.guy[k]}
            onChange={(e) => set(() => { layout.guy[k] = Number(e.target.value) })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ textAlign: 'right' }}>{layout.guy[k].toFixed(2)}</span>
        </label>
      ))}
      <label style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
        <span>ตัวเริ่มที่บาน</span>
        <input
          type="range"
          min={0}
          max={layout.wins.length - 1}
          step={1}
          value={layout.guy.at}
          onChange={(e) => set(() => { layout.guy.at = Number(e.target.value) }, true)}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ textAlign: 'right' }}>{layout.guy.at + 1}</span>
      </label>

      </Section>

      <Section name="ฉาก" open={!!ui.open['ฉาก']} onToggle={() => toggle('ฉาก')}>
      {([
        ['depth', 'หนาบาน', 0.1, 4, 0.05, true],
        ['camZ', 'ระยะกล้อง', 10, 60, 0.5, false],
        ['drift', 'กล้องไหลตามคิว', 0, 1, 0.02, false],
        ['props', 'ของชิ้นเล็ก (จำนวน)', 0, 24, 1, false],
      ] as const).map(([k, label, min, max, step, rebuild]) => (
        <label key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 46px', gap: 6 }}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={layout[k]}
            onChange={(e) => set(() => { layout[k] = Number(e.target.value) }, rebuild)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ textAlign: 'right' }}>{layout[k].toFixed(2)}</span>
        </label>
      ))}

      </Section>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            const src = layoutSource()
            navigator.clipboard?.writeText(src)
            // คอนโซลด้วย เผื่อ clipboard ถูกบล็อก (หน้านี้เป็น https ของตัวเอง สิทธิ์ไม่แน่นอน)
            console.info(src)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          style={{
            flex: 1,
            cursor: 'pointer',
            padding: '5px 0',
            borderRadius: 6,
            border: '1px solid #ffffff22',
            background: copied ? '#1f7a4d' : '#ffffff14',
            color: '#eaf7ff',
          }}
        >
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
        </button>
        <button
          type="button"
          onClick={() => set(() => resetLayout(), true)}
          style={{
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid #ffffff22',
            background: '#ffffff14',
            color: '#eaf7ff',
          }}
        >
          คืนค่า
        </button>
      </div>
        </>
      )}
    </div>
  )
}
