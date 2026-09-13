import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconAdjustments,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconArrowsMove,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFilter,
  IconPlayerPause,
  IconPlayerPlay,
  IconRestore,
  IconRuler,
} from '@tabler/icons-react'
import { DEFAULTS, READOUT, REF, getTuner, projectGuides, resetTuner, setTuner, useTuner } from './tuner'
/* ผังกลุ่ม/ไอคอนย้ายไปไฟล์ของตัวเอง — แผงของจอ what-i-do หยิบกลุ่มริกไปใช้ชุดเดียวกัน */
import { GROUPS, GROUP_ICONS, GROUP_TOGGLES, TOGGLE_ICONS } from './tunerGroups'
import { replayIntro } from './intro'

/**
 * แผงปรับมุมกล้อง/องค์ประกอบของ /new-hero — dev เท่านั้น
 *
 * มีสามส่วนที่ทำให้ปรับแล้ว "รู้ว่าตรงหรือยัง" ไม่ใช่ปรับแล้วเดา:
 *   1. ตัวเลข horizon กับ VP สองข้างที่คำนวณสดจาก fov/pitch/yaw ปัจจุบัน
 *      วางคู่กับเลขที่วัดจากชีท ref (horizon 185, VP 25 / 1165 ที่เฟรม 1199x735)
 *   2. ปุ่ม "ทาบ ref" ซ้อนภาพชีท/ภาพสีทับจอจริง ปรับความทึบได้
 *   3. ปุ่ม "กรอบ ref" ครอบจอให้เป็นอัตราส่วน 1199x735 เท่าชีท — ไม่งั้นเทียบตำแหน่ง
 *      แนวตั้งไม่ได้เลยเพราะ fov คุมแกนตั้ง อัตราส่วนต่างกันนิดเดียวก็เลื่อนแล้ว
 *
 * ค่าทั้งหมดเก็บลง localStorage เอง กด "คัดลอกค่า" แล้ววางทับ DEFAULTS ใน tuner.js
 * เพื่อยึดค่าเป็นของถาวร
 */


/** ไอคอนขนาดข้อความ วางแนวเดียวกับตัวหนังสือ */
function Ic({ icon: I, size = 13 }) {
  if (!I) return null
  return <I size={size} stroke={1.9} style={{ verticalAlign: '-2px', marginRight: 4, flex: 'none' }} />
}

/** สวิตช์ที่ใช้บ่อยสุด — อยู่บนสุดเสมอ ไม่ต้องเลื่อนหา */
const QUICK_TOGGLES = [
  ['skater', 'ตัวละคร'],
  ['portal', 'พอร์ทัล'],
  ['props', 'ของลอย'],
  ['clay', 'clay'],
  ['grid', 'ตารางพื้น'],
]

const GREEN = '#6ee7b7'
const PANEL_KEY = 'newhero.panel'

/** สถานะของตัวแผงเอง (กลุ่มไหนเปิด, ชิดซ้าย/ขวา, ...) — คนละที่กับค่าที่จูน */
function loadPanel() {
  try {
    return { open: { กล้อง: true }, side: 'right', collapsed: false, ...JSON.parse(localStorage.getItem(PANEL_KEY) || '{}') }
  } catch {
    return { open: { กล้อง: true }, side: 'right', collapsed: false }
  }
}
function savePanel(p) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(p))
  } catch {
    /* โหมดส่วนตัว — ไม่จำข้ามรีเฟรชก็ยังใช้ได้ */
  }
}

const box = {
  position: 'fixed',
  top: 12,
  zIndex: 60,
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
const btn = {
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
const btnOn = { ...btn, background: 'rgba(110,231,183,0.22)' }
const field = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 4,
  color: '#e8e8e8',
  font: 'inherit',
  padding: '2px 4px',
}

/** ค่าเท่ากับค่าเริ่มต้นไหม — เผื่อเศษทศนิยมจากสไลเดอร์ */
const isDefault = (k, v) => Math.abs(v - DEFAULTS[k]) < 1e-9

function Row({ k, min, max, step, unit }) {
  const t = useTuner()
  const v = t[k]
  const changed = !isDefault(k, v)
  /** shift + ลูกศร = ก้าวละ 10 เท่า — ลากไกล ๆ ไม่ต้องกดค้าง */
  const onKey = (e) => {
    if (!e.shiftKey) return
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    setTuner({ [k]: Math.min(max, Math.max(min, +(v + dir * step * 10).toFixed(6))) })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 62px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => setTuner({ [k]: DEFAULTS[k] })}
        title={`${unit || ''}\nค่าเริ่มต้น ${DEFAULTS[k]} — ดับเบิลคลิกเพื่อคืนค่า`}
        style={{ cursor: 'pointer', lineHeight: 1.2, overflow: 'hidden' }}
      >
        <span style={{ color: changed ? GREEN : 'inherit', opacity: changed ? 1 : 0.78 }}>
          {changed ? '● ' : ''}{k}
        </span>
        {unit && (
          <span style={{ display: 'block', opacity: 0.42, fontSize: 9.5, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
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

/** ตำแหน่งจริงในโลกของ mascot — อ่านทุก 200ms พอ ไม่ต้องตามทุกเฟรม */
function Readout() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: 'grid', gap: 2, padding: '5px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
      <div style={{ opacity: 0.6 }}>ตำแหน่ง mascot ในโลก</div>
      <div style={{ color: GREEN }}>
        x {READOUT.x.toFixed(2)}  y {READOUT.y.toFixed(2)}  z {READOUT.z.toFixed(2)}
      </div>
      <div style={{ opacity: 0.6, marginTop: 2 }}>ฝ่าเท้า / หน้าแผ่นบอร์ด</div>
      <div style={{ color: Math.abs(READOUT.gap) < 0.01 ? GREEN : '#f4a4a4' }}>
        {READOUT.sole.toFixed(3)} / {READOUT.deck.toFixed(3)} (ห่าง {READOUT.gap.toFixed(3)})
      </div>
      <div style={{ opacity: 0.6 }}>ชิ้นต่ำสุด: {READOUT.low || '-'}</div>
    </div>
  )
}

function Toggle({ k, label }) {
  const t = useTuner()
  const on = t[k] > 0.5
  return (
    <button type="button" onClick={() => setTuner({ [k]: on ? 0 : 1 })} style={on ? btnOn : btn}>
      {on ? '●' : '○'} <Ic icon={TOGGLE_ICONS[k]} />{label}
    </button>
  )
}

/** ตัวเลขที่ปรับอยู่ vs ตัวเลขที่วัดจากชีท — เขียวคือห่างไม่เกิน 3 px */
function Guides() {
  const t = useTuner()
  const g = projectGuides(t)
  const cell = (now, want, tol = 3) => {
    const ok = Math.abs(now - want) <= tol
    return (
      <span style={{ color: ok ? GREEN : '#f4a4a4' }}>
        {now.toFixed(1)} <span style={{ opacity: 0.5 }}>/ {want}</span>
      </span>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 3, padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
      <div style={{ opacity: 0.6 }}>เทียบที่เฟรม {REF.w}x{REF.h} (ภาพเส้นที่วาด)</div>
      <div>horizon y {cell(g.horizonY, REF.horizonY)}</div>
      <div>VP แถบหน้าต่าง x {cell(g.bandVP, REF.bandVP, 60)}</div>
    </div>
  )
}

/** กลุ่มพับได้ พร้อมสวิตช์ของกลุ่มที่หัว และป้ายบอกว่ามีกี่ค่าที่แก้ไปแล้ว */
function Group({ g, open, onToggle, rows }) {
  const t = useTuner()
  const changed = g.rows.filter(([k]) => !isDefault(k, t[k])).length
  const toggles = GROUP_TOGGLES[g.name]
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggle}
          style={{ ...btn, border: 0, background: 'transparent', padding: '3px 0', flex: '1 1 auto', textAlign: 'left', opacity: 0.85 }}
        >
          <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
          <Ic icon={GROUP_ICONS[g.name]} />
          {g.name}
          {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
        </button>
        {toggles?.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
      </div>
      {open && g.name.startsWith('ทางเข้า') && <EntranceBar />}
      {open && g.name.startsWith('อินโทร') && <IntroBar />}
      {open && g.name.startsWith('ลายเสื้อ') && <PrintBar />}
      {open && rows.map(([k, min, max, step, unit]) => <Row key={k} k={k} min={min} max={max} step={step} unit={unit} />)}
    </div>
  )
}

/**
 * ปุ่มเล่นอินโทรใหม่ — ดูผลของค่าที่เพิ่งปรับโดยไม่ต้องรีหน้า
 *
 * มีตัวละครในฉาก = เล่นผ่าน enReplay ของ Entrance เพราะมันเป็นคนถือศูนย์เวลา (รอโมเดล
 * ขึ้นครบก่อนออกตัว) ปิดตัวละครแล้วไม่มีใครติดอาวุธให้ จึงออกตัวเองด้วย replayIntro
 */
function IntroBar() {
  const t = useTuner()
  const off = t.intro < 0.5
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%', padding: '2px 0 4px' }}>
      <button
        type="button"
        style={off ? { ...btn, opacity: 0.45 } : btn}
        disabled={off}
        title={off ? 'เปิดอินโทรก่อน' : 'เล่นอินโทรทั้งฉากใหม่ตั้งแต่ต้น'}
        onClick={() => {
          if (getTuner().skater > 0.5) setTuner({ enPause: 0, enReplay: getTuner().enReplay + 1 })
          else replayIntro()
        }}
      >
        <Ic icon={IconPlayerPlay} />เล่นอินโทร
      </button>
    </div>
  )
}

/**
 * ปุ่มสุ่มลายเสื้อ — เปลี่ยนแค่เมล็ด ผืนลายถูกวาดใหม่ทั้งผืนจากเลขนั้น
 * เลขเดิมได้ลายเดิมเสมอ เจอลายที่ชอบแล้วจดเลขจากแถบ เมล็ดลาย ไว้ได้เลย
 */
function PrintBar() {
  const t = useTuner()
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', width: '100%', padding: '2px 0 4px' }}>
      {['เล็ก', 'กลาง', 'ใหญ่'].map((label, i) => (
        <button
          key={label}
          type="button"
          style={Math.round(t.shpSize) === i ? btnOn : btn}
          title={`ขนาดลาย: ${label}`}
          onClick={() => setTuner({ shpSize: i })}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        style={btn}
        title="สุ่มลายใหม่ (เมล็ดเปลี่ยน)"
        onClick={() => setTuner({ shpSeed: 1 + Math.floor(Math.random() * 9999) })}
      >
        <Ic icon={IconRestore} />สุ่มลาย
      </button>
    </div>
  )
}

/**
 * แถบควบคุมทางเข้า — เล่น / หยุด / ลากดูตำแหน่ง อยู่ที่หัวกลุ่มให้กดได้ทันที
 *
 * ปุ่มเล่นต้องปลดหยุดให้ด้วย ไม่งั้นกดแล้วภาพไม่ขยับ (ค้างอยู่ที่ enScrub) แล้วดูเหมือนปุ่มเสีย
 * แถบลากใช้ได้เฉพาะตอนหยุด — ตอนเล่นอยู่ค่ามันถูกเวลาเขียนทับทุกเฟรม
 */
function EntranceBar() {
  const t = useTuner()
  const paused = t.enPause > 0.5
  const from = t.enFrom
  const to = t.enTo
  const partial = from > 0.001 || to < 0.999
  const slider = (value, onChange, extra) => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.005}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: 88, cursor: 'pointer', accentColor: GREEN, ...extra }}
    />
  )
  return (
    <div style={{ display: 'grid', gap: 3, width: '100%', padding: '2px 0 4px' }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={btn}
          title={partial ? 'เล่นวนซ้ำเฉพาะช่วงที่เลือก' : 'เล่นใหม่ตั้งแต่ต้น'}
          onClick={() => setTuner({ enPause: 0, enReplay: getTuner().enReplay + 1 })}
        >
          <Ic icon={IconPlayerPlay} />
          {partial ? 'เล่นช่วงนี้' : 'เล่น'}
        </button>
        <button
          type="button"
          style={paused ? btnOn : btn}
          title="หยุดค้าง แล้วลากแถบ ตำแหน่ง ดูทีละจุด"
          onClick={() => setTuner({ enPause: paused ? 0 : 1 })}
        >
          <Ic icon={paused ? IconPlayerPlay : IconPlayerPause} />
          {paused ? 'เล่นต่อ' : 'หยุด'}
        </button>
        <button
          type="button"
          style={btn}
          title="คืนช่วงเป็นทั้งเส้น"
          onClick={() => setTuner({ enFrom: 0, enTo: 1 })}
        >
          <Ic icon={IconRestore} />เต็มเส้น
        </button>
      </div>
      {/* เริ่ม/จบ = ขอบของช่วงที่จะเล่น — ตั้งแล้วปุ่มเล่นจะวนซ้ำเฉพาะช่วงนี้ */}
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ opacity: 0.7 }}>เริ่ม</span>
        {slider(from, (v) => setTuner({ enFrom: Math.min(v, to - 0.005) }))}
        <span style={{ opacity: 0.7 }}>{from.toFixed(2)}</span>
      </label>
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
        <span style={{ opacity: 0.7 }}>จบ</span>
        {slider(to, (v) => setTuner({ enTo: Math.max(v, from + 0.005) }))}
        <span style={{ opacity: 0.7 }}>{to.toFixed(2)}</span>
      </label>
      <label style={{ display: 'grid', gridTemplateColumns: '34px 1fr 34px', gap: 4, alignItems: 'center', cursor: paused ? 'pointer' : 'not-allowed' }}>
        <span style={{ opacity: paused ? 0.7 : 0.3 }}>ตำแหน่ง</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={t.enScrub}
          disabled={!paused}
          title={paused ? 'ลากดูทีละตำแหน่งในช่วงที่เลือก' : 'กดหยุดก่อนถึงจะลากได้'}
          onChange={(e) => setTuner({ enScrub: Number(e.target.value) })}
          style={{ cursor: paused ? 'pointer' : 'not-allowed', opacity: paused ? 1 : 0.3, accentColor: GREEN }}
        />
        <span style={{ opacity: paused ? 0.7 : 0.3 }}>{t.enScrub.toFixed(2)}</span>
      </label>
    </div>
  )
}

/** ช่อง A/B — จำค่าทั้งชุดไว้เทียบสองแบบสลับกันดูได้ทันที */
function Snapshot({ slot }) {
  const key = `${PANEL_KEY}.snap.${slot}`
  const [has, setHas] = useState(() => !!localStorage.getItem(key))
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <button
        type="button"
        style={btn}
        title={`จำค่าปัจจุบันไว้ในช่อง ${slot}`}
        onClick={() => {
          localStorage.setItem(key, JSON.stringify(getTuner()))
          setHas(true)
        }}
      >
        จำ {slot}
      </button>
      <button
        type="button"
        style={{ ...btn, opacity: has ? 1 : 0.4 }}
        disabled={!has}
        title={`เรียกค่าจากช่อง ${slot}`}
        onClick={() => {
          try {
            setTuner(JSON.parse(localStorage.getItem(key)))
          } catch {
            /* ช่องว่าง */
          }
        }}
      >
        เรียก {slot}
      </button>
    </span>
  )
}

export function CameraTuner() {
  const [panel, setPanelState] = useState(loadPanel)
  /** ตัวกล่องจริง — ตอนลากเขียน style ใส่มันตรง ๆ ไม่ผ่าน state */
  const boxRef = useRef(null)
  const setPanel = (patch) => setPanelState((p) => {
    const next = { ...p, ...patch }
    savePanel(next)
    return next
  })
  const [q, setQ] = useState('')
  const [changedOnly, setChangedOnly] = useState(false)
  const [ref, setRef] = useState('off')
  const [opacity, setOpacity] = useState(0.5)
  const [crop, setCrop] = useState(false)
  const [stage, setStage] = useState(null)
  const [showCheck, setShowCheck] = useState(false)
  const t = useTuner()

  // ครอบจอเป็นอัตราส่วนของชีท — เขียนลง :root ให้หน้าเพจอ่านไปใช้
  useEffect(() => {
    document.documentElement.dataset.newheroCrop = crop ? 'on' : 'off'
    return () => {
      delete document.documentElement.dataset.newheroCrop
    }
  }, [crop])

  // ภาพ ref ต้องทาบ "เวที" ไม่ใช่ทาบวิวพอร์ต — พอเปิดกรอบ ref เวทีเล็กกว่าจอ
  useEffect(() => {
    setStage(document.getElementById('newhero-stage'))
  }, [])

  /**
   * กรอง: พิมพ์ค้นหาแล้วเหลือเฉพาะแถวที่ชื่อคีย์/คำอธิบาย/ชื่อกลุ่มตรง
   * เปิด "เฉพาะที่แก้" แล้วเหลือแถวที่ค่าไม่เท่าค่าเริ่มต้น — ใช้ตอนจะคัดลอกไปวาง
   * กำลังค้น = ทุกกลุ่มที่เจอถูกกางออกให้เลย ไม่ต้องไปกดเปิดทีละกลุ่ม
   */
  const query = q.trim().toLowerCase()
  const visible = useMemo(
    () =>
      GROUPS.map((g) => {
        const groupHit = query && g.name.toLowerCase().includes(query)
        const rows = g.rows.filter(([k, , , , unit]) => {
          if (changedOnly && isDefault(k, t[k])) return false
          if (!query || groupHit) return true
          return k.toLowerCase().includes(query) || (unit || '').toLowerCase().includes(query)
        })
        return { g, rows }
      }).filter(({ rows }) => rows.length > 0 || (!query && !changedOnly)),
    [query, changedOnly, t],
  )
  const filtering = !!query || changedOnly
  const changedCount = Object.keys(DEFAULTS).filter((k) => !isDefault(k, t[k])).length

  const copy = (onlyChanged) => {
    const keys = Object.keys(DEFAULTS).filter((k) => !onlyChanged || !isDefault(k, t[k]))
    const body = keys.map((k) => `  ${k}: ${t[k]},`).join('\n')
    navigator.clipboard?.writeText(onlyChanged ? body + '\n' : `export const DEFAULTS = {\n${body}\n}\n`)
  }

  /**
   * ตำแหน่งแผง: ชิดข้างตามค่า side หรือพิกัดอิสระถ้าเคยลากไว้
   *
   * ลากที่หัวแผง — ระหว่างลากเขียน left/top ใส่ DOM ตรง ๆ ไม่ผ่าน state เพราะแผงมีสไลเดอร์
   * เป็นร้อยแถว re-render ทุก pointermove คือกระตุก แล้วค่อยบันทึกทีเดียวตอนปล่อย
   */
  const side = panel.pos
    ? { left: panel.pos.x, top: panel.pos.y, right: 'auto' }
    : panel.side === 'left'
      ? { left: 12 }
      : { right: 12 }

  const startDrag = (e) => {
    // ปุ่ม/ช่องกรอกในหัวแผงต้องกดได้ตามปกติ ไม่ใช่กลายเป็นจุดจับลาก
    if (e.target.closest('button, input, select, textarea')) return
    const el = boxRef.current
    if (!el) return
    // เก็บโหนดไว้ก่อน: React ล้าง e.currentTarget เป็น null ทันทีที่แฮนด์เลอร์คืนค่า
    // ตัวฟังที่ผูกทีหลังจะจับ null แล้วลากไม่ติด (เจอมาแล้ว: กดแล้วไม่มีอะไรเกิดขึ้น)
    const handle = e.currentTarget
    const r = el.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    let x = r.left
    let y = r.top
    // ตั้ง left ให้ตรงที่มันอยู่ก่อนปลด right — ปล่อยให้ left เป็น auto แผงจะเด้งไปชิดซ้ายทันที
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.right = 'auto'
    handle.setPointerCapture(e.pointerId)
    const move = (ev) => {
      // กันแผงหลุดจอ: เหลือให้เห็นอย่างน้อยหัวแผงเสมอ
      x = Math.min(Math.max(ev.clientX - dx, 8 - r.width + 60), window.innerWidth - 60)
      y = Math.min(Math.max(ev.clientY - dy, 8), window.innerHeight - 32)
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const up = (ev) => {
      handle.releasePointerCapture?.(ev.pointerId)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      setPanel({ pos: { x: Math.round(x), y: Math.round(y) } })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
  }

  return (
    <>
      {ref !== 'off' &&
        stage &&
        createPortal(
          <img
            src={ref === 'sheet' ? '/dev/new-hero-ref-sheet.png' : '/dev/new-hero-ref-color.png'}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              opacity,
              zIndex: 50,
              pointerEvents: 'none',
              mixBlendMode: ref === 'sheet' ? 'screen' : 'normal',
              filter: ref === 'sheet' ? 'invert(1) contrast(2)' : 'none',
            }}
          />,
          stage,
        )}
      {/**
       * data-lenis-prevent: หน้านี้อยู่ใต้ smooth scroll ของ Lenis ซึ่งดักล้อทั้งหน้า
       * แล้วขยับหน้าเอง แผงที่เลื่อนในตัวเองจึงไม่ได้รับล้อเลย — แอตทริบิวต์นี้คือทางออก
       * มาตรฐานของ Lenis สำหรับกล่องที่ต้องเลื่อนเองได้
       */}
      <div ref={boxRef} style={{ ...box, ...side, width: panel.collapsed ? 'auto' : box.width }} data-lenis-prevent>
        {/* หัวแผง: จุดจับลาก + ยุบ/ขยาย + ย้ายข้าง — ไม่เลื่อนไปกับเนื้อหา */}
        <div
          onPointerDown={startDrag}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'grab', touchAction: 'none', borderBottom: panel.collapsed ? 0 : '1px solid rgba(255,255,255,0.1)' }}
        >
          {/* จุดจับลาก — ปุ่มยุบ/ขยายกินความกว้างหัวแผงเกือบทั้งแถบ (flex: 1) จึงต้องมีที่จับ
              ของตัวเองชัด ๆ ไม่ใช่หวังพื้นที่ว่างข้าง ๆ ปุ่ม */}
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
            ปรับฉาก /new-hero
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
            {/* แถบเครื่องมือ: ค้นหา + ตัวกรอง + สวิตช์ที่ใช้บ่อย — ติดบนสุดตลอด */}
            <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="search"
                  value={q}
                  placeholder="ค้นหาคีย์ / คำอธิบาย / กลุ่ม…"
                  onChange={(e) => setQ(e.target.value)}
                  style={{ ...field, flex: 1, padding: '4px 6px' }}
                />
                <button
                  type="button"
                  style={changedOnly ? btnOn : btn}
                  title="แสดงเฉพาะค่าที่ต่างจากค่าเริ่มต้น"
                  onClick={() => setChangedOnly((c) => !c)}
                >
                  <Ic icon={IconFilter} />ที่แก้
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {QUICK_TOGGLES.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
                <button type="button" style={showCheck ? btnOn : btn} onClick={() => setShowCheck((c) => !c)}>
                  <Ic icon={IconRuler} />ตรวจ/ref
                </button>
              </div>
              {!filtering && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" style={btn} onClick={() => setPanel({ open: Object.fromEntries(GROUPS.map((g) => [g.name, true])) })}>
                    <Ic icon={IconArrowsMaximize} />ขยายทั้งหมด
                  </button>
                  <button type="button" style={btn} onClick={() => setPanel({ open: {} })}>
                    <Ic icon={IconArrowsMinimize} />ย่อทั้งหมด
                  </button>
                </div>
              )}
            </div>

            <div style={{ overflowY: 'auto', display: 'grid', gap: 10, padding: 10, alignContent: 'start' }}>
              {showCheck && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <Guides />
                  <Readout />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[
                      ['off', 'ปิด ref'],
                      ['sheet', 'ชีทเส้น'],
                      ['color', 'ภาพสี'],
                    ].map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setRef(v)} style={ref === v ? btnOn : btn}>
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCrop((c) => !c)}
                      style={crop ? btnOn : btn}
                      title="ครอบจอเป็นอัตราส่วน 1199x735 เท่าชีท"
                    >
                      กรอบ ref
                    </button>
                  </div>
                  {ref !== 'off' && (
                    <label style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                      <span style={{ opacity: 0.72 }}>ความทึบ</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        style={{ cursor: 'pointer', accentColor: GREEN }}
                      />
                    </label>
                  )}
                </div>
              )}

              {visible.length === 0 && <div style={{ opacity: 0.5 }}>ไม่มีแถวที่ตรง</div>}
              {visible.map(({ g, rows }) => (
                <Group
                  key={g.name}
                  g={g}
                  rows={rows}
                  open={filtering || !!panel.open[g.name]}
                  onToggle={() => setPanel({ open: { ...panel.open, [g.name]: !panel.open[g.name] } })}
                />
              ))}
            </div>

            {/* ท้ายแผง: คัดลอก / คืนค่า / ช่อง A-B — ติดล่างตลอด */}
            <div style={{ display: 'grid', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button type="button" style={btn} onClick={() => copy(false)} title="คัดลอก DEFAULTS ทั้งก้อน วางทับใน tuner.js">
                  <Ic icon={IconCopy} />คัดลอกทั้งหมด
                </button>
                <button type="button" style={btn} onClick={() => copy(true)} title="คัดลอกเฉพาะบรรทัดที่ต่างจากค่าเริ่มต้น">
                  คัดลอกที่แก้ ({changedCount})
                </button>
                <button type="button" style={btn} onClick={resetTuner}>
                  <Ic icon={IconRestore} />คืนค่าเริ่มต้น
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ opacity: 0.5 }}>เทียบ</span>
                <Snapshot slot="A" />
                <Snapshot slot="B" />
              </div>
              <div style={{ opacity: 0.4, fontSize: 9.5 }}>
                ดับเบิลคลิกชื่อคีย์ = คืนค่าเดิม · shift+ลูกศรบนสไลเดอร์ = ก้าว ×10
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
