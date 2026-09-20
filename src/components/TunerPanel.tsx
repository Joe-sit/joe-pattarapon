import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconRestore,
  IconSettings,
  type IconProps,
} from '@tabler/icons-react'

/**
 * แผงจูนของงานนี้ — **ตัวเดียวที่ทุกจอใช้ร่วมกัน**
 *
 * หน้าตาและท่าใช้: กล่องแก้วเข้มมุมมน กลุ่มพับได้ จุดเขียวบอกค่าที่ถูกแก้ ดับเบิลคลิกชื่อคีย์
 * คืนค่า shift+ลูกศรก้าว ×10 ช่องกรอกเลขข้างสไลเดอร์ ท้ายแผงมีคัดลอกค่าที่แก้ / คืนค่าเริ่มต้น
 *
 * ### ทำไมต้องเป็นตัวเดียว
 *
 * แผงพวกนี้ถูกสลับไปมาทั้งวัน ถ้าท่าใช้ไม่ตรงกัน (ที่พับกลุ่ม ที่คืนค่า ที่คัดลอก) ต้องจำคนละ
 * แบบ — เดิมมีสำเนาของ UI ชุดนี้อยู่สามที่ (newhero/CameraTuner · whatidocard/StagePanel ·
 * whatidopixel/PixelTuner) แก้ท่าใช้ทีเดียวไม่ได้ ต้องไล่แก้ทุกไฟล์แล้วหวังว่าจะไม่ลืม
 *
 * ตัวนี้ไม่รู้จักสโตร์ของใคร: คนเรียกส่ง `values`/`set`/`reset`/`defaults` เข้ามา ค่าจึงยัง
 * เขียนลงสโตร์เปล่า ๆ ของแต่ละจอตรง ๆ เหมือนเดิม (ส่งค่าเป็น prop เข้าฉาก 3D ไม่ได้ —
 * ทุกการลากจะ reconcile ต้นไม้ r3f ทั้งก้อน)
 */

export type TunerRow = [k: string, min: number, max: number, step: number, unit?: string]
export type TunerIcon = React.ComponentType<IconProps>
export type TunerGroup = { name: string; icon?: TunerIcon; rows: TunerRow[] }

const GREEN = '#8ef0a8'

const box = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'fixed',
  top: 12,
  [side]: 12,
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
})

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

function Ic({ icon: I, size = 13 }: { icon?: TunerIcon; size?: number }) {
  if (!I) return null
  return <I size={size} stroke={1.9} style={{ verticalAlign: '-2px', marginRight: 4, flex: 'none' }} />
}

type Store = {
  defaults: Record<string, number>
  values: Record<string, number>
  set: (patch: Record<string, number>) => void
}

/** ค่าเท่ากับค่าเริ่มต้นไหม — เผื่อเศษทศนิยมจากสไลเดอร์ */
const isDefault = (s: Store, k: string) => Math.abs((s.values[k] ?? 0) - (s.defaults[k] ?? 0)) < 1e-9

function ValueRow({ row, store }: { row: TunerRow; store: Store }) {
  const [k, min, max, step, unit] = row
  const v = store.values[k] ?? 0
  const changed = !isDefault(store, k)
  const clamp = (n: number) => Math.min(max, Math.max(min, +n.toFixed(6)))
  const set = (n: number) => store.set({ [k]: clamp(n) })
  /** shift + ลูกศร = ก้าวละ 10 เท่า */
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
    set(v + dir * step * 10)
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 58px', gap: 6, alignItems: 'center' }}>
      <span
        onDoubleClick={() => set(store.defaults[k])}
        title={`${unit || ''}\nค่าเริ่มต้น ${store.defaults[k]} — ดับเบิลคลิกเพื่อคืนค่า`}
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
      <input
        type="number"
        step={step}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        style={{ ...field, width: 58 }}
      />
    </div>
  )
}

function loadPanel(key: string, openFirst?: string): { collapsed: boolean; open: Record<string, boolean> } {
  try {
    const p = JSON.parse(localStorage.getItem(key) || 'null')
    if (p) return p
  } catch {
    /* ช่องว่าง */
  }
  return { collapsed: false, open: openFirst ? { [openFirst]: true } : {} }
}

export function TunerPanel({
  title,
  icon,
  panelKey,
  side = 'left',
  groups,
  defaults,
  values,
  set,
  reset,
}: {
  title: string
  icon?: TunerIcon
  /** คีย์ของ localStorage ที่จำว่าพับกลุ่มไหนไว้ — ต่อแผง ไม่ใช่ต่อหน้า */
  panelKey: string
  side?: 'left' | 'right'
  groups: TunerGroup[]
  defaults: Record<string, number>
  values: Record<string, number>
  set: (patch: Record<string, number>) => void
  reset: () => void
}) {
  const [panel, setPanelState] = useState(() => loadPanel(panelKey, groups[0]?.name))
  const first = useRef(true)
  const store: Store = { defaults, values, set }

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(panelKey, JSON.stringify(panel))
    } catch {
      /* โหมดส่วนตัว — จำข้ามรีเฟรชไม่ได้ก็ยังใช้ได้ */
    }
  }, [panel, panelKey])

  const toggle = (name: string) =>
    setPanelState((p) => ({ ...p, open: { ...p.open, [name]: !p.open[name] } }))

  /** คัดลอกเฉพาะค่าที่แก้ — แผงเป็นที่ลอง ค่าจริงต้องลงไฟล์ */
  const copy = () => {
    const diff: Record<string, number> = {}
    for (const k of Object.keys(defaults)) if (!isDefault(store, k)) diff[k] = values[k]
    navigator.clipboard?.writeText(JSON.stringify(diff, null, 2))
  }

  /**
   * แผงอยู่ที่ body ไม่ใช่ในต้นไม้ของ section
   *
   * จอพวกนี้ตรึงของด้วย `position: sticky` ซึ่ง *สร้าง stacking context ของตัวเอง* — z ของ
   * ลูกทุกตัวถูกขังอยู่ข้างใน แผงเลยไปอยู่ใต้แคนวาสของชั้นเคอร์เซอร์ (z 55) ที่เป็นพี่น้อง
   * หลังกว่าในลำดับ DOM: เห็นแต่คลิกไม่ได้ (วัดมาแล้ว — elementFromPoint คืน CANVAS)
   */
  return createPortal(
    <div style={box(side)} data-lenis-prevent>
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
          <Ic icon={icon ?? IconSettings} />
          {title}
        </button>
      </div>

      {!panel.collapsed && (
        <>
          <div style={{ display: 'grid', gap: 8, padding: 8, overflowY: 'auto' }}>
            {groups.map((g) => {
              const changed = g.rows.filter(([k]) => !isDefault(store, k)).length
              const open = panel.open[g.name]
              return (
                <div key={g.name} style={{ display: 'grid', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => toggle(g.name)}
                    style={{
                      ...btn,
                      border: 0,
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 6px',
                      textAlign: 'left',
                    }}
                  >
                    <Ic icon={open ? IconChevronDown : IconChevronRight} size={12} />
                    <Ic icon={g.icon} />
                    {g.name}
                    {changed > 0 && <span style={{ color: GREEN, marginLeft: 6 }}>●{changed}</span>}
                  </button>
                  {open && (
                    <div style={{ display: 'grid', gap: 5, padding: '0 2px 2px' }}>
                      {g.rows.map((r) => (
                        <ValueRow key={r[0]} row={r} store={store} />
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
            <button type="button" style={btn} onClick={reset}>
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
