import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULTS, READOUT, REF, getTuner, projectGuides, resetTuner, setTuner, useTuner } from './tuner'

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

const GROUPS = [
  {
    name: 'กล้อง',
    rows: [
      ['fov', 20, 120, 0.01, '°'],
      ['pitch', -40, 60, 0.01, '° ก้ม'],
      ['camX', -20, 20, 0.1],
      ['camY', -10, 30, 0.1],
      ['camZ', -10, 60, 0.1],
      ['fitMax', 1, 2, 0.01, 'ถอยเมื่อจอแคบ'],
    ],
  },
  {
    name: 'แกนหมุน',
    rows: [
      ['groundYaw', 0, 90, 0.01, '° ตารางพื้น'],
      ['bandYaw', -45, 45, 0.01, '° แถบหน้าต่าง'],
    ],
  },
  {
    name: 'หน้าต่าง',
    rows: [
      ['panelCount', 1, 9, 1, 'ใบ'],
      ['panelW', 1, 40, 0.1],
      ['panelH', 1, 40, 0.1],
      ['panelD', 0.1, 10, 0.1, 'หนา'],
      ['panelGap', 1, 40, 0.01, 'ระยะห่าง'],
      ['panelX', -30, 30, 0.01, 'เลื่อนแถบ'],
      ['panelZ', -40, 10, 0.1],
      ['panelBase', -40, 10, 0.01, 'ระดับฐาน'],
    ],
  },
  {
    name: 'พื้น',
    rows: [
      ['gridY', -40, 10, 0.01],
      ['gridCell', 0.2, 20, 0.1, 'ช่อง'],
    ],
  },
  {
    name: 'ของลอย (ยกทั้งชุด)',
    rows: [
      ['propScale', 0.2, 5, 0.01, 'สเกล'],
      ['propX', -30, 30, 0.1],
      ['propY', -30, 30, 0.1],
      ['propZ', -30, 30, 0.1],
    ],
  },
  {
    name: 'ตัวละคร',
    rows: [
      ['skaterScale', 0.1, 6, 0.01, 'สเกล'],
      ['skaterX', -30, 30, 0.05],
      ['skaterY', -20, 20, 0.05],
      ['skaterZ', -20, 20, 0.05],
      ['skaterRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['skaterRotY', -180, 180, 0.5, '° หันหน้า'],
      ['skaterRotZ', -180, 180, 0.5, '° เอียงข้าง'],
      ['mascotScale', 0.05, 3, 0.01, 'ขนาดตัว'],
      ['mascotLift', -3, 3, 0.01, 'ยกพ้นบอร์ด'],
      ['boardScale', 0.2, 3, 0.01, 'ขนาดบอร์ด'],
      ['armScale', 0.3, 2.5, 0.01, 'ขนาดแขนทั้งเส้น'],
      ['foreScale', 0.3, 2.5, 0.01, 'ขนาดท่อนล่าง+มือ'],
    ],
  },
  {
    name: 'ลำตัว',
    rows: [
      ['leanX', -90, 90, 0.5, '° เอียงทั้งตัวไปหน้า'],
      ['leanZ', -90, 90, 0.5, '° เอียงทั้งตัวข้าง'],
      ['foldX', -120, 120, 0.5, '° พับตัวไปหน้า'],
      ['foldY', -120, 120, 0.5, '° บิดตัว'],
      ['foldZ', -120, 120, 0.5, '° พับตัวข้าง'],
      ['headX', -90, 90, 0.5, '° เงยหัวสวน'],
    ],
  },
  {
    name: 'ขา',
    rows: [
      ['hipLX', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['hipLY', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['hipLZ', -180, 180, 0.5, '° สะโพกซ้าย'],
      ['kneeL', -20, 180, 0.5, '° เข่าซ้าย'],
      ['ankleL', -90, 90, 0.5, '° ข้อเท้าซ้าย'],
      ['hipRX', -180, 180, 0.5, '° สะโพกขวา'],
      ['hipRY', -180, 180, 0.5, '° สะโพกขวา'],
      ['hipRZ', -180, 180, 0.5, '° สะโพกขวา'],
      ['kneeR', -20, 180, 0.5, '° เข่าขวา'],
      ['ankleR', -90, 90, 0.5, '° ข้อเท้าขวา'],
    ],
  },
  {
    name: 'สเก็ตบอร์ด',
    rows: [
      ['bdLen', 0.1, 1.2, 0.005, 'ยาวแผ่นกลาง'],
      ['bdWide', 0.08, 0.6, 0.005, 'กว้างแผ่น'],
      ['bdThick', 0.004, 0.08, 0.002, 'หนาแผ่น'],
      ['bdTip', 0.05, 0.5, 0.005, 'ยาวหัว/ท้าย'],
      ['bdKick', 0, 60, 0.5, '° เชิดหัว/ท้าย'],
      ['bdTruckX', 0.05, 0.5, 0.005, 'ระยะทรัค'],
      ['bdWheelR', 0.01, 0.12, 0.002, 'รัศมีล้อ'],
      ['bdWheelW', 0.01, 0.12, 0.002, 'หนาล้อ'],
      ['bdRideY', 0.03, 0.3, 0.005, 'สูงจากพื้น'],
      ['boardRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['boardRotY', -180, 180, 0.5, '° หันหน้า'],
      ['boardRotZ', -180, 180, 0.5, '° เอียงข้าง'],
    ],
  },
  {
    name: 'แขน A (ข้างที่เล็งด้วยแกนแขน)',
    rows: [
      ['aimX', -1, 1, 0.01, 'ทิศออกข้าง'],
      ['aimY', -1, 1, 0.01, 'ทิศขึ้น'],
      ['aimZ', -1, 1, 0.01, 'ทิศหน้า'],
      ['elbowX', -180, 180, 0.5, '° ศอก'],
      ['elbowY', -180, 180, 0.5, '° ศอก'],
      ['elbowZ', -180, 180, 0.5, '° ศอก (เหยียด ≈ 20)'],
      ['wristX', -180, 180, 0.5, '° ข้อมือ'],
      ['wristY', -180, 180, 0.5, '° ข้อมือ'],
      ['wristZ', -180, 180, 0.5, '° ข้อมือ'],
    ],
  },
  {
    name: 'แขน B (ข้างที่คิดจากท่าพัก)',
    rows: [
      ['mugShX', -180, 180, 0.5, '° ไหล่'],
      ['mugShY', -180, 180, 0.5, '° ไหล่'],
      ['mugShZ', -180, 180, 0.5, '° ไหล่ (กางออก ≈ -60)'],
      ['mugElX', -180, 180, 0.5, '° ศอก'],
      ['mugElY', -180, 180, 0.5, '° ศอก'],
      ['mugElZ', -180, 180, 0.5, '° ศอก'],
    ],
  },
  {
    name: 'ริบบิ้น',
    rows: [
      ['ribbonScale', 0.05, 3, 0.01, 'สเกล'],
      ['ribbonW', 0.5, 30, 0.1, 'กว้าง'],
      ['ribbonThick', 0, 2, 0.01, 'หนา'],
      ['ribbonWave', 0, 3, 0.01, 'คลื่น'],
      ['ribbonWaves', 0.2, 8, 0.1, 'จำนวนลูก'],
      ['ribbonX', -20, 20, 0.1],
      ['ribbonY', -20, 20, 0.1],
      ['ribbonZ', -20, 20, 0.1],
      ['ribbonRotX', -180, 180, 0.5, '° ก้ม/เงย'],
      ['ribbonRotY', -180, 180, 0.5, '° กวาดซ้ายขวา'],
      ['ribbonRotZ', -180, 180, 0.5, '° บิดรอบตัว'],
    ],
  },
]

const box = {
  position: 'fixed',
  top: 12,
  right: 12,
  zIndex: 60,
  width: 300,
  maxHeight: 'calc(100svh - 24px)',
  overflowY: 'auto',
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
  background: 'rgba(255,255,255,0.08)',
  color: '#e8e8e8',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 6,
  padding: '4px 8px',
  font: 'inherit',
}

function Row({ k, min, max, step, unit }) {
  const t = useTuner()
  const v = t[k]
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '78px 1fr 62px', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
      <span style={{ opacity: 0.72 }}>{k}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        style={{ cursor: 'pointer', accentColor: '#6ee7b7' }}
      />
      <input
        type="number"
        step={step}
        value={v}
        onChange={(e) => setTuner({ [k]: Number(e.target.value) })}
        style={{
          width: 62,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 4,
          color: '#e8e8e8',
          font: 'inherit',
          padding: '2px 4px',
        }}
        title={unit || ''}
      />
    </label>
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
      <div style={{ color: '#6ee7b7' }}>
        x {READOUT.x.toFixed(2)}  y {READOUT.y.toFixed(2)}  z {READOUT.z.toFixed(2)}
      </div>
      <div style={{ opacity: 0.6, marginTop: 2 }}>ฝ่าเท้า / หน้าแผ่นบอร์ด</div>
      <div style={{ color: Math.abs(READOUT.gap) < 0.01 ? '#6ee7b7' : '#f4a4a4' }}>
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
    <button
      type="button"
      onClick={() => setTuner({ [k]: on ? 0 : 1 })}
      style={{ ...btn, background: on ? 'rgba(110,231,183,0.22)' : btn.background }}
    >
      {on ? '●' : '○'} {label}
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
      <span style={{ color: ok ? '#6ee7b7' : '#f4a4a4' }}>
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

export function CameraTuner() {
  const [open, setOpen] = useState(true)
  const [ref, setRef] = useState('off')
  const [opacity, setOpacity] = useState(0.5)
  const [crop, setCrop] = useState(false)
  const [stage, setStage] = useState(null)

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
      <div style={box} data-lenis-prevent>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ ...btn, width: '100%', borderRadius: '10px 10px 0 0', border: 0, textAlign: 'left', padding: '7px 10px' }}
        >
          {open ? '▾' : '▸'} ปรับมุมกล้อง /new-hero
        </button>
        {open && (
          <div style={{ display: 'grid', gap: 8, padding: 10 }}>
            <Guides />
            <Readout />

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Toggle k="props" label="ของลอย" />
              <Toggle k="clay" label="clay" />
              <Toggle k="grid" label="ตารางพื้น" />
              <Toggle k="skater" label="ตัวละคร" />
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                ['off', 'ปิด ref'],
                ['sheet', 'ชีทเส้น'],
                ['color', 'ภาพสี'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRef(v)}
                  style={{ ...btn, background: ref === v ? 'rgba(110,231,183,0.22)' : btn.background }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCrop((c) => !c)}
                style={{ ...btn, background: crop ? 'rgba(110,231,183,0.22)' : btn.background }}
                title="ครอบจอเป็นอัตราส่วน 1199x735 เท่าชีท"
              >
                กรอบ ref
              </button>
            </div>
            {ref !== 'off' && (
              <label style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ opacity: 0.72 }}>ความทึบ</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  style={{ cursor: 'pointer', accentColor: '#6ee7b7' }}
                />
              </label>
            )}

            {GROUPS.map((g) => (
              <div key={g.name} style={{ display: 'grid', gap: 4 }}>
                <div style={{ opacity: 0.5, marginTop: 2 }}>{g.name}</div>
                {g.rows.map(([k, min, max, step, unit]) => (
                  <Row key={k} k={k} min={min} max={max} step={step} unit={unit} />
                ))}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                style={btn}
                onClick={() => {
                  const t = getTuner()
                  const body = Object.keys(DEFAULTS)
                    .map((k) => `  ${k}: ${t[k]},`)
                    .join('\n')
                  navigator.clipboard?.writeText(`export const DEFAULTS = {\n${body}\n}\n`)
                }}
              >
                คัดลอกค่า
              </button>
              <button type="button" style={btn} onClick={resetTuner}>
                คืนค่าเริ่มต้น
              </button>
            </div>
            <div style={{ opacity: 0.45 }}>
              คัดลอกแล้ววางทับ DEFAULTS ใน src/newhero/tuner.js เพื่อยึดค่าเป็นถาวร
            </div>
          </div>
        )}
      </div>
    </>
  )
}
