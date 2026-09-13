import { useEffect, useRef, useState } from 'react'
import {
  IconAdjustments,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsMove,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconGridDots,
  IconRestore,
  IconUser,
  IconVideo,
  IconWaveSine,
} from '@tabler/icons-react'
import { DEFAULTS, setTuner, useTuner } from '@/newhero/tuner'
/* ผังกลุ่มของแผง /new-hero — หยิบกลุ่มที่เป็นริกของตัวละครมาแสดงที่นี่ด้วย ไม่ก๊อปช่วงค่ามาซ้ำ */
import { GROUPS as TUNER_GROUPS, GROUP_ICONS } from '@/newhero/tunerGroups'
import { PIXEL_DEFAULTS, pixelDbg, pixelRead } from './pixelDbg'

/**
 * แผงจูนจอ what-i-do (dev) — หน้าตาและท่าใช้ชุดเดียวกับแผงของ /new-hero (CameraTuner)
 *
 * เหตุที่ต้องเหมือน: สองแผงนี้จูนตัวละครตัวเดียวกันคนละจอ สลับไปมาทั้งวัน ถ้าท่าใช้ไม่ตรงกัน
 * (ที่พับกลุ่ม ที่คืนค่า ที่คัดลอก) ต้องจำสองแบบ — ของที่ยกมาตรง ๆ: กล่องแก้วเข้ม กลุ่มพับได้
 * จุดเขียวบอกค่าที่ถูกแก้ ดับเบิลคลิกชื่อคีย์คืนค่า shift+ลูกศรก้าว ×10 ช่องกรอกเลขข้างสไลเดอร์
 * และท้ายแผงมีคัดลอกค่า / คืนค่าเริ่มต้น
 *
 * ต่างจาก CameraTuner ที่เดียว: ค่าของจอนี้อยู่ใน pixelDbg ซึ่งเป็นอ็อบเจกต์นิ่ง ไม่ใช่ store
 * ที่ subscribe ได้ แผงจึงยก state ของตัวเองเป็นกระจกเงา แล้วเขียนทะลุลง pixelDbg ให้ฉากอ่าน
 * ใน useFrame — ส่งเป็น prop เข้าฉากไม่ได้ ทุกการลากจะ reconcile ทั้งต้นไม้ r3f (geometry
 * และวัสดุถูกปั้นใหม่) ซึ่งเป็นบั๊กที่เคยเจอกับแผงพอร์ทัลของจอ Experiences
 */

type Key = keyof typeof PIXEL_DEFAULTS

type Row = [k: Key, min: number, max: number, step: number, unit?: string, dp?: number]

type Group = { name: string; icon: typeof IconUser; rows: Row[] }

/**
 * แบ่งกลุ่มตาม "ของที่กำลังขยับ" ไม่ใช่ตามชื่อตัวแปร — มีสองอย่างที่ขยับได้และคนละเรื่องกัน
 * คือ *ตัวละคร* (หมุน / ใหญ่ / ขยับในหน้าต่าง) กับ *พอร์ทัล* (ขนาดและที่วางบนจอ)
 */
const GROUPS: Group[] = [
  {
    name: 'การวางตัวละคร',
    icon: IconUser,
    rows: [
      ['rotY', -180, 180, 1, '° หันซ้าย/ขวา', 0],
      ['rotX', -60, 60, 1, '° ก้ม/เงย', 0],
      ['rotZ', -60, 60, 1, '° เอียงข้าง', 0],
      ['zoom', 0.4, 3.2, 0.02, '× ขนาดตัวจริง'],
      ['shiftX', -8, 8, 0.05, 'เลื่อนตัว ←→ (ลบ = ยื่นออกซ้าย)'],
      ['lift', -8, 8, 0.05, 'เลื่อนตัว ↑↓'],
    ],
  },
  {
    name: 'พอร์ทัล',
    icon: IconGridDots,
    rows: [
      ['scale', 0.5, 1.8, 0.01, '× ขนาด (1 = ตามแบบ)'],
      ['posX', -12, 12, 0.1, 'ที่วางบนจอ ←→'],
      ['posY', -12, 12, 0.1, 'ที่วางบนจอ ↑↓'],
      ['spill', -3, 6, 0.05, 'รอยตัด 3D ที่ขอบซ้าย'],
    ],
  },
  { name: 'กล้อง', icon: IconVideo, rows: [['cam', 10, 40, 0.2, 'ระยะห่าง']] },
  {
    name: 'จังหวะบล็อกยื่นออก',
    icon: IconWaveSine,
    rows: [
      ['stagger', 0, 2.5, 0.05, 'วิ เหลื่อมทั้งชุด'],
      ['grow', 0.05, 1.2, 0.01, 'วิ เวลาต่อใบ'],
    ],
  },
]

const GREEN = '#6ee7b7'
const PANEL_KEY = 'whatido.pixel.panel'

type Panel = {
  open: Record<string, boolean>
  side: 'left' | 'right'
  collapsed: boolean
  pos?: { x: number; y: number } | null
}

/** สถานะของตัวแผงเอง (กลุ่มไหนเปิด ชิดข้างไหน) — คนละที่กับค่าที่จูน เหมือนคีย์ newhero.panel */
function loadPanel(): Panel {
  /* ชิดซ้ายเป็นค่าเริ่มต้น: หน้า /2026-final มีแผงของ /new-hero อยู่ชิดขวาแล้ว ทับกันพอดี */
  const base: Panel = { open: { การวางตัวละคร: true }, side: 'left', collapsed: false, pos: null }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PANEL_KEY) || '{}') }
  } catch {
    return base
  }
}
function savePanel(p: Panel) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(p))
  } catch {
    /* โหมดส่วนตัว — จำข้ามรีเฟรชไม่ได้ก็ยังใช้ได้ */
  }
}

const box: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  zIndex: 70,
  width: 340,
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

function Ic({ icon: I, size = 13 }: { icon?: typeof IconUser; size?: number }) {
  if (!I) return null
  return <I size={size} stroke={1.9} style={{ verticalAlign: '-2px', marginRight: 4, flex: 'none' }} />
}

/** ค่าเท่ากับค่าเริ่มต้นไหม — เผื่อเศษทศนิยมจากสไลเดอร์ */
const isDefault = (k: Key, v: number) => Math.abs(v - PIXEL_DEFAULTS[k]) < 1e-9

function Row({ row, v, set }: { row: Row; v: number; set: (k: Key, v: number) => void }) {
  const [k, min, max, step, unit, dp] = row
  const changed = !isDefault(k, v)
  const clamp = (n: number) => Math.min(max, Math.max(min, +n.toFixed(6)))
  /** shift + ลูกศร = ก้าวละ 10 เท่า — ท่าเดียวกับแผงของ /new-hero */
  const onKey = (e: React.KeyboardEvent) => {
    if (!e.shiftKey) return
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    set(k, clamp(v + dir * step * 10))
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 62px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => set(k, PIXEL_DEFAULTS[k])}
        title={`${unit || ''}\nค่าเริ่มต้น ${PIXEL_DEFAULTS[k]} — ดับเบิลคลิกเพื่อคืนค่า`}
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
        onChange={(e) => set(k, Number(e.target.value))}
        onKeyDown={onKey}
        style={{ cursor: 'pointer', accentColor: GREEN, minWidth: 0 }}
      />
      <input
        type="number"
        step={step}
        value={dp === 0 ? Math.round(v) : v}
        onChange={(e) => set(k, Number(e.target.value))}
        style={{ ...field, width: 62 }}
      />
    </div>
  )
}

/** ตัวเลขที่ฉากเขียนกลับ — อ่านทุก 200ms พอ ไม่ต้องตามทุกเฟรม (เหมือน Readout ของ /new-hero) */
function Readout() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])
  const sharp = pixelRead.onScreen > 0 ? pixelRead.rt / pixelRead.onScreen : 0
  return (
    <div style={{ display: 'grid', gap: 2, padding: '5px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
      <div style={{ opacity: 0.6 }}>เวลาในจังหวะบล็อกยื่นออก</div>
      <div style={{ color: GREEN }}>{pixelRead.t.toFixed(2)} วิ</div>
      {/* ความคมของภาพ: ภาพที่ถ่ายต้องไม่เล็กกว่าพอร์ทัลบนจอ ไม่งั้นตัวละครแตกเป็นหยัก */}
      <div style={{ opacity: 0.6, marginTop: 2 }}>ความคมของภาพ (ต้องไม่ต่ำกว่า 1)</div>
      <div style={{ color: sharp >= 0.95 ? GREEN : '#f4a4a4' }}>
        {sharp ? sharp.toFixed(2) : '?'}×{' '}
        <span style={{ opacity: 0.5 }}>
          ต้องการ {Math.round(pixelRead.onScreen)}px · ถ่ายได้ {pixelRead.rt}px
        </span>
      </div>
    </div>
  )
}

/**
 * กลุ่มของริกที่ยกมาจากแผง /new-hero — เลือกด้วยคำขึ้นต้นของชื่อกลุ่ม
 *
 * ทำไมต้องมีในแผงนี้: ตัวละครในพอร์ทัลคือ hero ตัวเดียวกัน (HeroRider อ่านค่าจากแผงจูนชุดเดียว)
 * เวลาจูนท่า/สัดส่วน/หน้า แล้วต้องเลื่อนไปดูอีกหน้าเพื่อลากสไลเดอร์คือเสียเวลา
 *
 * ค่าพวกนี้เป็น **ของกลาง**: แก้ที่นี่แล้วตัวใน /new-hero กับฉาก hero ของ /2026-final
 * เปลี่ยนตามทันที (เก็บลง localStorage ชุดเดียวกัน) — ไม่ใช่ค่าเฉพาะจอนี้
 */
const RIG_PREFIX = [
  'ตัวละคร',
  'ลำตัว',
  'ขา',
  'แขน A',
  'แขน B',
  'หน้า / ตา',
  'รองเท้า',
  'ลายเสื้อ',
  'สเก็ตบอร์ด',
  'แสง',
]

type TunerRow = [k: string, min: number, max: number, step: number, unit?: string]
type TunerGroup = { name: string; rows: TunerRow[] }

const RIG_GROUPS: TunerGroup[] = RIG_PREFIX.flatMap(
  (p) => (TUNER_GROUPS as TunerGroup[]).filter((g) => g.name.startsWith(p)),
)

/**
 * หัวข้อใหญ่ของแผง — พับได้ทั้งก้อน
 *
 * แผงนี้มีสองก้อนที่ไม่เกี่ยวกัน: *ผังพอร์ทัล* (ค่าเฉพาะจอนี้) กับ *ริกของตัวละคร* (ค่าของกลาง
 * ชุดเดียวกับ /new-hero) รวมกันแล้วยาวเกินจอ เวลาจูนของก้อนหนึ่งอีกก้อนก็แค่กินที่ — พับได้
 * ทั้งก้อนจึงเลื่อนหาน้อยลง (สถานะพับเก็บใน panel.open เหมือนกลุ่มย่อย)
 */
function Section({
  name,
  icon,
  open,
  changed,
  onToggle,
  children,
}: {
  name: string
  icon: typeof IconUser
  open: boolean
  changed: number
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...btn,
          border: 0,
          background: 'rgba(255,255,255,0.05)',
          padding: '4px 6px',
          textAlign: 'left',
          letterSpacing: '0.06em',
        }}
      >
        <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
        <Ic icon={icon} />
        {name}
        {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
      </button>
      {open && children}
    </div>
  )
}

/** แถวของค่าในแผงจูนกลาง — หน้าตาเดียวกับ Row ข้างบน แต่เขียนผ่าน setTuner ไม่ใช่ pixelDbg */
function RigRow({ row }: { row: TunerRow }) {
  const [k, min, max, step, unit] = row
  const t = useTuner() as Record<string, number>
  const v = t[k]
  const def = (DEFAULTS as Record<string, number>)[k]
  const changed = Math.abs(v - def) >= 1e-9
  const onKey = (e: React.KeyboardEvent) => {
    if (!e.shiftKey) return
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    setTuner({ [k]: Math.min(max, Math.max(min, +(v + dir * step * 10).toFixed(6))) })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 62px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => setTuner({ [k]: def })}
        title={`${unit || ''}\nค่าเริ่มต้น ${def} — ดับเบิลคลิกเพื่อคืนค่า`}
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
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        onKeyDown={onKey}
        style={{ cursor: 'pointer', accentColor: GREEN, minWidth: 0 }}
      />
      <input
        type="number"
        step={step}
        value={v}
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        style={{ ...field, width: 62 }}
      />
    </div>
  )
}

export function PixelTuner() {
  const [panel, setPanelState] = useState(loadPanel)
  /** กระจกเงาของ pixelDbg — แผงวาดค่าจากตัวนี้ ส่วนฉากอ่านจาก pixelDbg ตัวจริงใน useFrame */
  const [vals, setVals] = useState(() => ({ ...pixelDbg }))
  /** ค่าแผงจูนกลาง — ใช้นับจุดเขียวที่หัวกลุ่มริก (แถวข้างในอ่านเองอีกที) */
  const rig = useTuner() as Record<string, number>
  const boxRef = useRef<HTMLDivElement>(null)

  const setPanel = (patch: Partial<Panel>) =>
    setPanelState((p) => {
      const next = { ...p, ...patch }
      savePanel(next)
      return next
    })

  const set = (k: Key, v: number) => {
    pixelDbg[k] = v
    setVals((o) => ({ ...o, [k]: v }))
  }
  const resetAll = () => {
    Object.assign(pixelDbg, PIXEL_DEFAULTS)
    setVals({ ...PIXEL_DEFAULTS })
  }
  /** คัดลอกไปวางทับค่าใน pixelDbg.ts — ท่าเดียวกับ "คัดลอกค่า" ของแผง /new-hero */
  const copy = (onlyChanged: boolean) => {
    const keys = (Object.keys(PIXEL_DEFAULTS) as Key[]).filter(
      (k) => !onlyChanged || !isDefault(k, vals[k]),
    )
    navigator.clipboard?.writeText(keys.map((k) => `  ${k}: ${vals[k]},`).join('\n') + '\n')
  }

  /* ค่าเริ่มต้น: ผังพอร์ทัลกาง ริกพับ — ริกมีสิบกลุ่ม กางค้างไว้แล้วต้องเลื่อนหาทุกครั้ง */
  const secPortal = panel.open['sec:portal'] !== false
  const secRig = !!panel.open['sec:rig']
  const rigChanged = RIG_GROUPS.reduce(
    (n, g) =>
      n +
      g.rows.filter(([k]) => Math.abs(rig[k] - (DEFAULTS as Record<string, number>)[k]) >= 1e-9)
        .length,
    0,
  )

  const changedCount = (Object.keys(PIXEL_DEFAULTS) as Key[]).filter(
    (k) => !isDefault(k, vals[k]),
  ).length

  const side: React.CSSProperties = panel.pos
    ? { left: panel.pos.x, top: panel.pos.y, right: 'auto' }
    : panel.side === 'left'
      ? { left: 12 }
      : { right: 12 }

  /**
   * ลากที่หัวแผง — ระหว่างลากเขียน left/top ใส่ DOM ตรง ๆ ไม่ผ่าน state แล้วบันทึกทีเดียว
   * ตอนปล่อย (แผงมีสไลเดอร์หลายแถว re-render ทุก pointermove คือกระตุก)
   */
  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
    const el = boxRef.current
    if (!el) return
    /* เก็บโหนดไว้ก่อน: React ล้าง e.currentTarget เป็น null ทันทีที่แฮนด์เลอร์คืนค่า */
    const handle = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    let x = r.left
    let y = r.top
    /* ตั้ง left ให้ตรงที่มันอยู่ก่อนปลด right — ไม่งั้นแผงเด้งไปชิดซ้ายทันที */
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.right = 'auto'
    handle.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      x = Math.min(Math.max(ev.clientX - dx, 8 - r.width + 60), window.innerWidth - 60)
      y = Math.min(Math.max(ev.clientY - dy, 8), window.innerHeight - 32)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const up = (ev: PointerEvent) => {
      handle.releasePointerCapture?.(ev.pointerId)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      setPanel({ pos: { x: Math.round(x), y: Math.round(y) } })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  }

  return (
    /* data-lenis-prevent: หน้านี้อยู่ใต้ smooth scroll ของ Lenis ซึ่งดักล้อทั้งหน้าแล้วขยับเอง
       กล่องที่เลื่อนในตัวเองจึงไม่ได้รับล้อเลยถ้าไม่มีแอตทริบิวต์นี้ */
    <div
      ref={boxRef}
      data-lenis-prevent
      style={{ ...box, ...side, width: panel.collapsed ? 'auto' : box.width }}
    >
      {/* หัวแผง: จุดจับลาก + ยุบ/ขยาย + ย้ายข้าง — ไม่เลื่อนไปกับเนื้อหา */}
      <div
        onPointerDown={startDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          cursor: 'grab',
          touchAction: 'none',
          borderBottom: panel.collapsed ? 0 : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span
          title="ลากที่หัวแผงเพื่อย้าย"
          style={{ cursor: 'grab', touchAction: 'none', display: 'inline-flex', padding: 2, opacity: 0.75 }}
        >
          <Ic icon={IconArrowsMove} size={12} />
        </span>
        <button
          type="button"
          onClick={() => setPanel({ collapsed: !panel.collapsed })}
          style={{ ...btn, border: 0, background: 'transparent', padding: '2px 4px', flex: 1, textAlign: 'left' }}
        >
          <Ic icon={panel.collapsed ? IconChevronRight : IconChevronDown} size={12} />
          <Ic icon={IconAdjustments} />
          พอร์ทัลพิกเซล what-i-do
          {changedCount > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changedCount}</span>}
        </button>
        {!panel.collapsed && (
          <button
            type="button"
            style={btn}
            title="ย้ายแผงไปชิดอีกข้าง (ล้างตำแหน่งที่ลากไว้)"
            onClick={() => setPanel({ side: panel.side === 'left' ? 'right' : 'left', pos: null })}
          >
            <Ic icon={panel.side === 'left' ? IconArrowRight : IconArrowLeft} />
          </button>
        )}
      </div>

      {!panel.collapsed && (
        <>
          <div style={{ overflowY: 'auto', display: 'grid', gap: 10, padding: 10, alignContent: 'start' }}>
            <Section
              name="ผังพอร์ทัล"
              icon={IconGridDots}
              open={secPortal}
              changed={changedCount}
              onToggle={() => setPanel({ open: { ...panel.open, 'sec:portal': !secPortal } })}
            >
              <div style={{ display: 'grid', gap: 10 }}>
            <Readout />
            {GROUPS.map((g) => {
              const open = !!panel.open[g.name]
              const changed = g.rows.filter(([k]) => !isDefault(k, vals[k])).length
              return (
                <div key={g.name} style={{ display: 'grid', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setPanel({ open: { ...panel.open, [g.name]: !open } })}
                    style={{
                      ...btn,
                      border: 0,
                      background: 'transparent',
                      padding: '3px 0',
                      textAlign: 'left',
                      opacity: 0.85,
                    }}
                  >
                    <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
                    <Ic icon={g.icon} />
                    {g.name}
                    {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
                  </button>
                  {open && g.rows.map((r) => <Row key={r[0]} row={r} v={vals[r[0]]} set={set} />)}
                </div>
              )
            })}
              </div>
            </Section>

            {/* ── ริกของตัวละคร ────────────────────────────────────────────
                ค่าของกลาง (แผงจูนชุดเดียวกับ /new-hero) ไม่ใช่ค่าเฉพาะจอนี้ */}
            <Section
              name="ริกของตัวละคร"
              icon={IconUser}
              open={secRig}
              changed={rigChanged}
              onToggle={() => setPanel({ open: { ...panel.open, 'sec:rig': !secRig } })}
            >
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ opacity: 0.4, fontSize: 9.5, marginBottom: 2 }}>
                ค่าเดียวกับแผงของ /new-hero ·{' '}
                แก้ที่นี่แล้วฉาก hero ของ /2026-final เปลี่ยนตามด้วย · ไหวเบา ๆ กับลมพัดเสื้อ
                ถูกปิดในจอนี้เสมอ (noIdle / noWind) สไลเดอร์ของสองอย่างนั้นจึงไม่มีผลที่นี่
              </div>
              {RIG_GROUPS.map((g) => {
                const key = `rig:${g.name}`
                const open = !!panel.open[key]
                const changed = g.rows.filter(
                  ([k]) => Math.abs(rig[k] - (DEFAULTS as Record<string, number>)[k]) >= 1e-9,
                ).length
                return (
                  <div key={key} style={{ display: 'grid', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setPanel({ open: { ...panel.open, [key]: !open } })}
                      style={{
                        ...btn,
                        border: 0,
                        background: 'transparent',
                        padding: '3px 0',
                        textAlign: 'left',
                        opacity: 0.85,
                      }}
                    >
                      <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
                      <Ic icon={(GROUP_ICONS as Record<string, typeof IconUser>)[g.name]} />
                      {g.name}
                      {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
                    </button>
                    {open && g.rows.map((r) => <RigRow key={r[0]} row={r} />)}
                  </div>
                )
              })}
            </div>
            </Section>
          </div>

          {/* ท้ายแผง: คัดลอก / คืนค่า — ติดล่างตลอด เหมือนแผงของ /new-hero */}
          <div
            style={{
              display: 'grid',
              gap: 6,
              padding: '8px 10px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={btn}
                onClick={() => copy(false)}
                title="คัดลอกค่าทั้งชุด วางทับ pixelDbg ใน pixelDbg.ts"
              >
                <Ic icon={IconCopy} />
                คัดลอกทั้งหมด
              </button>
              <button
                type="button"
                style={btn}
                onClick={() => copy(true)}
                title="คัดลอกเฉพาะบรรทัดที่ต่างจากค่าเริ่มต้น"
              >
                คัดลอกที่แก้ ({changedCount})
              </button>
              <button type="button" style={btn} onClick={resetAll}>
                <Ic icon={IconRestore} />
                คืนค่าเริ่มต้น
              </button>
            </div>
            <div style={{ opacity: 0.4, fontSize: 9.5 }}>
              ดับเบิลคลิกชื่อคีย์ = คืนค่าเดิม · shift+ลูกศรบนสไลเดอร์ = ก้าว ×10
            </div>
          </div>
        </>
      )}
    </div>
  )
}
