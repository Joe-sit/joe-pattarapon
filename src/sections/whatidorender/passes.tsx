import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'

/**
 * ตัวละครหนึ่งชุดต่อ "ขั้นของการเรนเดอร์" — ขังด้วย stencil ให้โผล่เฉพาะในหน้าต่างของขั้นนั้น
 *
 * ถอดจากเว็บอ้างอิง: หน้าต่างแต่ละบานคือช่องมองไปที่ *วัตถุชิ้นเดียวกัน ณ ตำแหน่งเดียวกัน* แค่
 * ผ่านคนละขั้น (เส้นโครง, UV, normal, ดินปั้น, สีล้วน, ภาพจริง) บานที่ซ้อนกันจึงต่อกันเป็น
 * ตัวละครตัวเดียวแบบปะติด ที่นี่ทำด้วย `HeroRider` ตัวเดียวกับจอ what-i-do ของ /2026-final
 * (ท่ายืนนิ่ง `noIdle` — ทุกชุดจึงอยู่ท่าเดียวกันเป๊ะ ไม่ต้องซิงก์แอนิเมชัน) วาดหลายชุดซ้อนกัน
 * แต่ละชุดใส่วัสดุของขั้นตัวเองและทดสอบ stencil ของบานตัวเอง
 *
 * ### ค่า stencil
 *
 * 0 = นอกหน้าต่าง (ช่วงเปิดจอ: ตัวละครเป็นเส้นโครงจาง ๆ) · 1–6 = หน้าต่างบานที่ 1–6 ·
 * 7 = "โลกจริง" (ไทล์ที่เรนเดอร์เสร็จ) — ชุดภาพจริงทดสอบด้วย mask 6 จึงผ่านทั้ง 6 (บาน
 * beauty) และ 7 (โลกจริง) ในการวาดรอบเดียว ไม่ต้องวาดตัวละครภาพจริงสองชุด
 *
 * ### ทำงานบนสำเนาวัสดุ
 *
 * วัสดุของริกถูกแคชระดับโมดูล เป็นใบเดียวกับที่ hero ใช้อยู่ เขียนธง stencil ทับของที่แชร์กัน
 * คือไปพังอีกจอ (บทเรียนเดียวกับ `InsideStencil` ใน newhero/stencilPortal) — ทุกชุดใช้วัสดุ
 * ของตัวเอง แล้วคืน GPU buffer ตอนออกจากจอ
 */

export type PassKind = 'ghost' | 'wire' | 'checker' | 'normal' | 'clay' | 'albedo' | 'beauty'

/** สีของหน้า /2026-final (`--v3-*`) */
const BLUE = '#265ada'
const SAND = '#e2d7cb'
const ORANGE = '#fd5000'

/**
 * ตาราง UV — หมากรุกส้ม-ขาวของหน้า 8×8 ช่อง
 *
 * กรองแบบ nearest ไม่ใช่ linear: ตาราง UV ต้องคมเป็นช่อง ๆ ตัวกรองเชิงเส้นทำให้ขอบช่อง
 * เบลอเป็นไล่สี ซึ่งเสียหน้าที่ของมันที่มีไว้ให้เห็นว่ายืด/บีบตรงไหน
 */
function checkerTexture() {
  const n = 8
  const data = new Uint8Array(n * n * 4)
  const o = new THREE.Color(ORANGE)
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const i = (y * n + x) * 4
      const on = (x + y) % 2 === 0
      data[i] = on ? Math.round(o.r * 255) : 255
      data[i + 1] = on ? Math.round(o.g * 255) : 255
      data[i + 2] = on ? Math.round(o.b * 255) : 255
      data[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, n, n)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

type Stencil = { ref: number; mask: number }

function withStencil<M extends THREE.Material>(m: M, s: Stencil): M {
  m.stencilWrite = true
  m.stencilRef = s.ref
  m.stencilFuncMask = s.mask
  m.stencilFunc = THREE.EqualStencilFunc
  m.stencilFail = THREE.KeepStencilOp
  m.stencilZFail = THREE.KeepStencilOp
  m.stencilZPass = THREE.KeepStencilOp
  return m
}

/**
 * ตัวละครชุดหนึ่งในขั้นหนึ่ง
 *
 * วัสดุถูกสลับในลูปเฟรมช่วงแรก ไม่ใช่ตอน mount: ริกสร้างชิ้นส่วนบางชิ้นทีหลัง (ท่าจัดตัวเอง
 * สองสามเฟรมแรก) กวาดซ้ำอยู่ช่วงหนึ่งจึงครอบของที่มาทีหลังด้วย แล้วหยุดเมื่อครบโควตา —
 * กวาดทุกเฟรมตลอดชีวิตจอคือเดินทุกเมชของตัวละครเจ็ดชุดหกสิบครั้งต่อวินาทีโดยไม่ได้อะไร
 */
export function PassRider({
  kind,
  stencil,
  order = 0,
  innerRef,
}: {
  kind: PassKind
  stencil: Stencil
  order?: number
  innerRef?: React.RefObject<THREE.Group | null>
}) {
  const own = useRef<THREE.Group | null>(null)
  const g = innerRef ?? own
  const left = useRef(180)
  const made = useRef<THREE.Material[]>([])
  const copies = useRef(new WeakMap<THREE.Material, THREE.Material>())

  /* วัสดุที่ใช้ร่วมกันทั้งชุด (ขั้นที่ไม่สนสีเดิมของชิ้นส่วน) */
  const shared = useMemo(() => {
    let m: THREE.Material | null = null
    if (kind === 'ghost') {
      m = new THREE.MeshBasicMaterial({
        color: BLUE,
        wireframe: true,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    } else if (kind === 'wire') {
      m = new THREE.MeshBasicMaterial({ color: BLUE, wireframe: true })
    } else if (kind === 'checker') {
      m = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.75 })
    } else if (kind === 'normal') {
      m = new THREE.MeshNormalMaterial()
    } else if (kind === 'clay') {
      m = new THREE.MeshStandardMaterial({ color: SAND, roughness: 0.95 })
    }
    return m ? withStencil(m, stencil) : null
  }, [kind, stencil])

  useEffect(
    () => () => {
      if (shared) {
        const map = (shared as THREE.MeshStandardMaterial).map
        map?.dispose()
        shared.dispose()
      }
      made.current.forEach((m) => m.dispose())
      made.current = []
    },
    [shared],
  )

  useFrame(() => {
    const root = g.current
    if (!root || left.current <= 0) return
    left.current -= 1
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      mesh.renderOrder = order
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const out = list.map((m) => {
        if (m.userData.passOf === kind) return m
        if (shared) return shared
        let c = copies.current.get(m)
        if (!c) {
          if (kind === 'albedo') {
            const src = m as THREE.MeshStandardMaterial
            c = new THREE.MeshBasicMaterial({
              color: src.color ? src.color.clone() : new THREE.Color('#ffffff'),
              map: src.map ?? null,
            })
          } else {
            c = m.clone()
          }
          withStencil(c, stencil)
          c.userData.passOf = kind
          copies.current.set(m, c)
          made.current.push(c)
        }
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? out : out[0]
    })
  })

  return (
    <group ref={g}>
      <HeroRider stand noBoard noLumber noWind noIdle />
    </group>
  )
}
