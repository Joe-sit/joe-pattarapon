import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconAppWindow,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconRestore,
  IconPhoto,
  IconStack2,
  IconToggleRight,
  IconUser,
  IconWindow,
} from '@tabler/icons-react'
import { DEFAULTS, resetStageTuner, setStageTuner, useStageTuner } from './stageTuner'

/**
 * แผงจูนจอ "สิ่งที่ทำ" (dev) — ท่าใช้และหน้าตาชุดเดียวกับแผงอื่นของงานนี้
 *
 * ยกมาจาก /new-hero (newhero/CameraTuner) และแผงของจอพิกเซล (whatidopixel/PixelTuner)
 * ทั้งชุด: กล่องแก้วเข้มมุมมน กลุ่มพับได้ จุดเขียวบอกค่าที่ถูกแก้ ดับเบิลคลิกชื่อคีย์คืนค่า
 * shift+ลูกศรก้าว ×10 ช่องกรอกเลขข้างสไลเดอร์ และท้ายแผงมีคัดลอกค่า / คืนค่าเริ่มต้น
 *
 * เหตุที่ต้องเหมือน: สามแผงนี้ถูกสลับไปมาทั้งวัน ถ้าท่าใช้ไม่ตรงกัน (ที่พับกลุ่ม ที่คืนค่า
 * ที่คัดลอก) ต้องจำคนละแบบ
 *
 * รอบก่อนแผงนี้เป็น leva ซึ่งเป็นคนละหน้าตากับที่เหลือ *และ* ค่าไม่ไหลถึงฉาก (หน้าปัดขยับ
 * แต่ฉากนิ่ง) — เขียนใหม่ให้เขียนลงสโตร์ตรง ๆ เหมือนแผงอื่น ค่าจึงถึงฉากทุกครั้งที่ลาก
 *
 * ค่าอยู่ใน ./stageTuner ซึ่งเป็นสโตร์เปล่า ๆ ที่ฉากอ่านผ่าน useSyncExternalStore — ส่งค่า
 * เป็น prop เข้าฉากไม่ได้ ทุกการลากจะ reconcile ต้นไม้ r3f ทั้งก้อน
 */

type Row = [k: keyof typeof DEFAULTS, min: number, max: number, step: number, unit?: string]
type Group = { name: string; icon: typeof IconWindow; rows: Row[] }

const GREEN = '#8ef0a8'
const PANEL_KEY = 'whatidocard.panel.v1'

/**
 * กลุ่มตาม "ของที่กำลังขยับ" — หน้าต่างใบละกลุ่ม บวกกลุ่มสวิตช์
 *
 * บานที่ 1 คือใบพอร์ทัล (ใบกลางที่มีช่องทะลุ) ขยับได้เหมือนใบอื่น แต่กรอบของมันคือปลายทาง
 * ของท่า genie จากจอก่อนหน้า (CARD ใน sections/hero/ScrollTell) — ขยับแล้วรอยต่อสองจอ
 * จะไม่ตรง ต้องไปวัดกรอบใหม่แล้วแก้ค่าคู่นั้นตาม
 */
const GROUPS: Group[] = [
  { name: 'บาน 1 · พอร์ทัล', icon: IconAppWindow, rows: win('w1') },
  { name: 'บาน 2 · หลังซ้าย', icon: IconWindow, rows: win('w2') },
  { name: 'บาน 3 · หลังขวา', icon: IconWindow, rows: win('w3') },
  { name: 'บาน 4 · หน้า', icon: IconStack2, rows: win('w4') },
  {
    name: 'ตัวละคร',
    icon: IconUser,
    rows: [
      ['chRotY', -180, 180, 1, '° หันซ้าย/ขวา'],
      ['chRotZ', -90, 90, 1, '° เอียงข้าง (แก้ท่าเอียงของริก)'],
      ['chRotX', -60, 60, 1, '° ก้ม/เงย'],
      ['chHeadYaw', -60, 60, 1, '° หัวหันต่อจากลำตัว'],
      ['chHeadPitch', -30, 30, 1, '° หัวก้ม/เงย'],
      ['chHeadRoll', -30, 30, 1, '° หัวเอียง'],
      ['chScale', 0.5, 4, 0.02, '× ขนาด'],
      ['chX', -8, 8, 0.05, 'เลื่อน ←→'],
      ['chY', -16, 4, 0.05, 'เลื่อน ↑↓ (ลบ = จมลง เหลือครึ่งบน)'],
      ['chZ', -10, 6, 0.05, 'ลึก / ตื้น'],
    ],
  },
  {
    name: 'รูปจริง (รอยสาด)',
    icon: IconPhoto,
    rows: [
      ['phZoom', 0.2, 2, 0.005, '× ความกว้างเทียบเฟรม'],
      ['phX', -1, 1, 0.002, 'เยื้อง ←→'],
      ['phY', -1, 1, 0.002, 'เยื้อง ↑↓'],
    ],
  },
  {
    name: 'สวิตช์',
    icon: IconToggleRight,
    rows: [
      ['char', 0, 1, 1, 'ตัวละคร'],
      ['hoop', 0, 1, 1, 'ห่วงส้ม'],
      ['skills', 0, 1, 1, 'ของสกิล (แว่น/ถาดสี/สวิตช์)'],
    ],
  },
]

/** แถวของหน้าต่างหนึ่งใบ — ที่วาง ขนาด และการหันรอบแกนตั้ง */
function win(p: 'w1' | 'w2' | 'w3' | 'w4'): Row[] {
  return [
    [`${p}x`, -8, 8, 0.05, 'เลื่อน ←→'],
    [`${p}y`, -6, 6, 0.05, 'เลื่อน ↑↓'],
    [`${p}z`, -10, 6, 0.05, 'ลึก / ตื้น'],
    [`${p}s`, 0.2, 1.4, 0.01, '× ขนาด'],
    [`${p}ry`, -45, 45, 0.5, '° หันซ้าย/ขวา'],
  ]
}

const box: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  zIndex: 70,
  width: 320,
  maxHeight: 'calc(100svh - 24px)',
  display: 'flex',
  flexDirection: 'column',
  overscrollBehavior: 'contain',
  background: 'rgba(18,18,20,0.92)',
  color: '#e8e8e8',
  font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(6px)',
}
const btn: React.CSSProperties = {
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.08)',
  color: '#e8e8e8',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 6,
  padding: '4px 8px',
  font: 'inherit',
}
const field: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 4,
  color: '#e8e8e8',
  font: 'inherit',
  padding: '2px 4px',
}

function Ic({ icon: I, size = 13 }: { icon?: typeof IconWindow; size?: number }) {
  if (!I) return null
  return <I size={size} stroke={1.9} style={{ verticalAlign: '-2px', marginRight: 4, flex: 'none' }} />
}

/** ค่าเท่ากับค่าเริ่มต้นไหม — เผื่อเศษทศนิยมจากสไลเดอร์ */
const isDefault = (k: keyof typeof DEFAULTS, v: number) => Math.abs(v - DEFAULTS[k]) < 1e-9

function loadPanel(): { collapsed: boolean; open: Record<string, boolean> } {
  try {
    const p = JSON.parse(localStorage.getItem(PANEL_KEY) || 'null')
    if (p) return p
  } catch {
    /* ช่องว่าง */
  }
  return { collapsed: false, open: { 'บาน 1 · พอร์ทัล': true } }
}

function ValueRow({ row, v }: { row: Row; v: number }) {
  const [k, min, max, step, unit] = row
  const changed = !isDefault(k, v)
  const clamp = (n: number) => Math.min(max, Math.max(min, +n.toFixed(6)))
  const set = (n: number) => setStageTuner({ [k]: clamp(n) })
  /** shift + ลูกศร = ก้าวละ 10 เท่า — ท่าเดียวกับแผงอื่น */
  const onKey = (e: React.KeyboardEvent) => {
    if (!e.shiftKey) return
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    set(v + dir * step * 10)
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 58px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => set(DEFAULTS[k])}
        title={`${unit || ''}\nค่าเริ่มต้น ${DEFAULTS[k]} — ดับเบิลคลิกเพื่อคืนค่า`}
        style={{ cursor: 'pointer', lineHeight: 1.2, overflow: 'hidden' }}
      >
        <span style={{ color: changed ? GREEN : 'inherit', opacity: changed ? 1 : 0.78 }}>
          {changed ? '● ' : ''}
          {k}
        </span>
        {unit && (
          <span
            style={{
              display: 'block',
              opacity: 0.42,
              fontSize: 9.5,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {unit}
          </span>
        )}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        onKeyDown={onKey}
        style={{ cursor: 'pointer', accentColor: GREEN, minWidth: 0 }}
      />
      <input type="number" step={step} value={v} onChange={(e) => set(Number(e.target.value))} style={{ ...field, width: 58 }} />
    </div>
  )
}

export function StagePanel() {
  const t = useStageTuner() as Record<string, number>
  const [panel, setPanelState] = useState(loadPanel)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify(panel))
    } catch {
      /* โหมดส่วนตัว — จำข้ามรีเฟรชไม่ได้ก็ยังใช้ได้ */
    }
  }, [panel])

  const toggle = (name: string) =>
    setPanelState((p) => ({ ...p, open: { ...p.open, [name]: !p.open[name] } }))

  /** คัดลอกเฉพาะค่าที่แก้ — แผงเป็นที่ลอง ค่าจริงต้องลงไฟล์ (ดู ./stageTuner) */
  const copy = () => {
    const diff: Record<string, number> = {}
    for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      if (!isDefault(k, t[k])) diff[k] = t[k]
    }
    navigator.clipboard?.writeText(JSON.stringify(diff, null, 2))
  }

  /**
   * แผงอยู่ที่ body ไม่ใช่ในต้นไม้ของ section
   *
   * จอนี้ตรึงของด้วย `position: sticky` ซึ่ง *สร้าง stacking context ของตัวเอง* — z ของลูก
   * ทุกตัวถูกขังอยู่ข้างใน แผงเลยไปอยู่ใต้แคนวาสของชั้นเคอร์เซอร์ (z 55) ที่เป็นพี่น้องหลังกว่า
   * ในลำดับ DOM: เห็นแต่คลิกไม่ได้ (วัดมาแล้ว — elementFromPoint คืน CANVAS)
   *
   * ซ้ายบน ไม่ใช่ขวาบนซึ่งเป็นที่ของแผงจูนจอแรก — สองแผงทับกันจนลากไม่ได้ทั้งคู่
   */
  return createPortal(
    <div style={box} data-lenis-prevent>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: panel.collapsed ? 0 : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button
          type="button"
          onClick={() => setPanelState((p) => ({ ...p, collapsed: !p.collapsed }))}
          style={{ ...btn, border: 0, background: 'transparent', padding: '2px 4px', flex: 1, textAlign: 'left' }}
        >
          <Ic icon={panel.collapsed ? IconChevronRight : IconChevronDown} size={12} />
          <Ic icon={IconStack2} />
          จอ “สิ่งที่ทำ”
        </button>
      </div>

      {!panel.collapsed && (
        <>
          <div style={{ display: 'grid', gap: 8, padding: 8, overflowY: 'auto' }}>
            {GROUPS.map((g) => {
              const changed = g.rows.filter(([k]) => !isDefault(k, t[k])).length
              const open = panel.open[g.name]
              return (
                <div key={g.name} style={{ display: 'grid', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => toggle(g.name)}
                    style={{ ...btn, border: 0, background: 'rgba(255,255,255,0.05)', padding: '4px 6px', textAlign: 'left' }}
                  >
                    <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
                    <Ic icon={g.icon} />
                    {g.name}
                    {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
                  </button>
                  {open && (
                    <div style={{ display: 'grid', gap: 5, padding: '0 2px 2px' }}>
                      {g.rows.map((r) => (
                        <ValueRow key={r[0]} row={r} v={t[r[0]]} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button type="button" style={btn} onClick={copy}>
              <Ic icon={IconCopy} />
              คัดลอกค่าที่แก้
            </button>
            <button type="button" style={btn} onClick={() => resetStageTuner()}>
              <Ic icon={IconRestore} />
              คืนค่าเริ่มต้น
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

export default StagePanel
