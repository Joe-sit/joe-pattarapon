import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { makeRandom, useDisposable } from '@/joespresso/scene/utils'

/**
 * ลูกโลกจิ๋ววนลูป — ฉากในพอร์ทัลแทนภูมิทัศน์ joespresso เดิม
 *
 * ตามภาพ ref: พื้นม่วงพาสเทล ถนนม่วงอ่อนเป็นแถบวนรอบดาว พุ่มหญ้าเขียวก้อนกลม ๆ
 * ต้นไม้ทรงกรวย (ลูกกลมซ้อนกัน) ต้นไม้ทรงพุ่ม ลำต้นฟ้า เห็ดม่วง ตอไม้น้ำเงิน ดอกไม้ขาว/เหลือง
 * ไม่มีคนไม่มีสัตว์ — ดาวหมุนรอบแกนของถนนช้า ๆ ถนนจึง "วิ่ง" วนไม่รู้จบ
 *
 * ปั้นในหน่วยรัศมี 1: ทุกอย่างวางบนผิวทรงกลมด้วย place() แล้วให้กลุ่มนอกย่อ/เอียง
 * ของทุกชิ้นแชร์ geometry ทรงกลม/ทรงกระบอกหน่วยเดียว แล้ว scale ที่ mesh —
 * มีของหลายสิบชิ้น ปั้น geometry แยกชิ้นกิน GPU buffer เปล่า ๆ
 */

const COL = {
  ground: '#b39cf7',
  path: '#cbbcff',
  stripe: '#dccfff',
  grass: ['#22b47a', '#18996a', '#3dd08f', '#2fbf86'],
  lime: '#8ae23c',
  teal: '#3ecfaa',
  trunk: '#9fd0f2',
  cap: '#9b7cf4',
  stem: '#7c63d9',
  stump: '#5b63f0',
  stumpTop: '#7d86ff',
  white: '#fff8ee',
  yellow: '#ffd23f',
  berry: '#f0567a',
  pebble: '#d7c9ff',
}


const UP = new THREE.Vector3(0, 1, 0)
/**
 * วางของบนผิวดาว: ละติจูด/ลองจิจูด -> ตำแหน่งบนผิว + หมุนให้แกน y ของของชี้ออกจากศูนย์กลาง
 * lat 0 = เส้นศูนย์สูตร (กลางถนน) ของที่ไม่ใช่ถนนต้องอยู่ |lat| > ครึ่งความกว้างถนน
 */
function place(lat, lon, sink = 0) {
  const n = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n)
  return { position: n.clone().multiplyScalar(1 - sink), quaternion: q }
}

/** สุ่มละติจูดนอกถนน (สองซีก) ห่างขอบถนนอย่างน้อย margin */
function offRoad(rand, road, margin, max = 1.2) {
  const side = rand() < 0.5 ? -1 : 1
  return side * (road + margin + rand() * (max - road - margin))
}

export function Globe({
  speed = 0.08,
  seed = 7,
  /** ครึ่งความกว้างของแถบถนน (เรเดียนของละติจูด) */
  road = 0.24,
  /** จำนวนของประดับแต่ละชนิด */
  bushes = 26,
  cones = 5,
  rounds = 4,
  mushrooms = 2,
  flowers = 12,
  berries = 6,
  pebbles = 24,
  /** สเกลรวมของของประดับ (ไม่แตะดาว/ถนน) */
  propScale = 1,
  /** ความเร็วหมุนเพิ่ม (เรเดียน/วิ) อ่านทุกเฟรม — อินโทรใช้ทำให้ดาวหมุนติ้วแล้วค่อยผ่อน */
  spinBoost = null,
  ...props
}) {
  const spin = useRef()
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 40, 28), [])
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 20), [])
  /** ถนน = เปลือกทรงกลมบาง ๆ เฉพาะแถบละติจูดรอบเส้นศูนย์สูตร ลอยเหนือพื้นนิดเดียว */
  const roadGeo = useMemo(
    () => new THREE.SphereGeometry(1.012, 96, 12, 0, Math.PI * 2, Math.PI / 2 - road, road * 2),
    [road],
  )
  const stripe = useMemo(
    () => new THREE.SphereGeometry(1.018, 96, 4, 0, Math.PI * 2, Math.PI / 2 - road * 0.62, road * 0.12),
    [road],
  )
  useDisposable([sphere, cyl, roadGeo, stripe])

  const mats = useMemo(() => {
    const m = (color, rough = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
    return {
      ground: m(COL.ground, 0.7),
      path: m(COL.path, 0.6),
      stripe: m(COL.stripe, 0.6),
      grass: COL.grass.map((c) => m(c)),
      lime: m(COL.lime),
      teal: m(COL.teal, 0.35),
      trunk: m(COL.trunk),
      cap: m(COL.cap, 0.35),
      stem: m(COL.stem),
      stump: m(COL.stump),
      stumpTop: m(COL.stumpTop),
      white: m(COL.white),
      yellow: m(COL.yellow),
      berry: m(COL.berry, 0.35),
      pebble: m(COL.pebble),
    }
  }, [])
  useDisposable(useMemo(() => Object.values(mats).flat(), [mats]))

  /** ของประดับทั้งหมด — สุ่มแบบ deterministic จะได้หน้าตาเดิมทุกครั้ง */
  const items = useMemo(() => {
    const rand = makeRandom(seed)
    const list = []
    const push = (kind, lat, lon, extra = {}) =>
      list.push({ kind, ...place(lat, lon, extra.sink ?? 0.02), ...extra, s: (extra.s ?? 1) * propScale })
    for (let i = 0; i < bushes; i += 1) {
      push('bush', offRoad(rand, road, 0.02), rand() * Math.PI * 2, {
        s: 0.12 + rand() * 0.2,
        mat: mats.grass[i % mats.grass.length],
        squash: 0.55 + rand() * 0.25,
        sink: 0.05,
      })
    }
    for (let i = 0; i < cones; i += 1) push('cone', offRoad(rand, road, 0.18, 1.1), rand() * Math.PI * 2, { s: 0.28 + rand() * 0.14 })
    for (let i = 0; i < rounds; i += 1) push('round', offRoad(rand, road, 0.2, 1.1), rand() * Math.PI * 2, { s: 0.3 + rand() * 0.14 })
    for (let i = 0; i < mushrooms; i += 1) push('mushroom', offRoad(rand, road, 0.12), rand() * Math.PI * 2, { s: 0.22 + rand() * 0.08 })
    push('stump', offRoad(rand, road, 0.06), rand() * Math.PI * 2, { s: 0.14 })
    for (let i = 0; i < flowers; i += 1) {
      push('flower', offRoad(rand, road, 0.01), rand() * Math.PI * 2, {
        s: 0.05 + rand() * 0.03,
        mat: rand() < 0.5 ? mats.white : mats.yellow,
      })
    }
    for (let i = 0; i < berries; i += 1) push('berry', offRoad(rand, road, 0.02), rand() * Math.PI * 2, { s: 0.05 + rand() * 0.02 })
    // กรวดบนถนน — กระจายในแถบถนนเอง
    for (let i = 0; i < pebbles; i += 1) {
      push('pebble', (rand() * 2 - 1) * road * 0.85, rand() * Math.PI * 2, { s: 0.012 + rand() * 0.014, sink: 0 })
    }
    return list
  }, [seed, mats, road, bushes, cones, rounds, mushrooms, flowers, berries, pebbles, propScale])

  useFrame(({ clock }, dt) => {
    if (spin.current) spin.current.rotation.y += (speed + (spinBoost ? spinBoost(clock) : 0)) * dt
  })

  return (
    <group {...props}>
      <group ref={spin}>
        <mesh geometry={sphere} material={mats.ground} />
        <mesh geometry={roadGeo} material={mats.path} />
        <mesh geometry={stripe} material={mats.stripe} />
        <mesh geometry={stripe} material={mats.stripe} rotation={[Math.PI, 0, 0]} />
        {items.map((it, i) => (
          <group key={i} position={it.position} quaternion={it.quaternion}>
            {it.kind === 'bush' && (
              <mesh geometry={sphere} material={it.mat} scale={[it.s, it.s * it.squash, it.s]} />
            )}
            {it.kind === 'cone' && (
              <>
                <mesh geometry={cyl} material={mats.trunk} position={[0, it.s * 0.2, 0]} scale={[it.s * 0.12, it.s * 0.5, it.s * 0.12]} />
                {/* ลูกกลมสามชั้นซ้อนขึ้นไป เล็กลงเรื่อย ๆ = ต้นสนแบบการ์ตูน */}
                <mesh geometry={sphere} material={mats.lime} position={[0, it.s * 0.55, 0]} scale={[it.s * 0.5, it.s * 0.36, it.s * 0.5]} />
                <mesh geometry={sphere} material={mats.lime} position={[0, it.s * 0.98, 0]} scale={[it.s * 0.4, it.s * 0.32, it.s * 0.4]} />
                <mesh geometry={sphere} material={mats.lime} position={[0, it.s * 1.36, 0]} scale={[it.s * 0.28, it.s * 0.28, it.s * 0.28]} />
              </>
            )}
            {it.kind === 'round' && (
              <>
                <mesh geometry={cyl} material={mats.trunk} position={[0, it.s * 0.35, 0]} scale={[it.s * 0.1, it.s * 0.8, it.s * 0.1]} />
                <mesh geometry={sphere} material={mats.teal} position={[0, it.s * 0.95, 0]} scale={[it.s * 0.55, it.s * 0.42, it.s * 0.55]} />
                <mesh geometry={sphere} material={mats.teal} position={[it.s * 0.22, it.s * 1.15, it.s * 0.1]} scale={it.s * 0.32} />
                <mesh geometry={sphere} material={mats.teal} position={[-it.s * 0.24, it.s * 1.1, -it.s * 0.08]} scale={it.s * 0.28} />
              </>
            )}
            {it.kind === 'mushroom' && (
              <>
                <mesh geometry={cyl} material={mats.stem} position={[0, it.s * 0.3, 0]} scale={[it.s * 0.22, it.s * 0.65, it.s * 0.22]} />
                {/* หมวกเห็ด = ทรงกลมกดแบน */}
                <mesh geometry={sphere} material={mats.cap} position={[0, it.s * 0.6, 0]} scale={[it.s * 0.62, it.s * 0.34, it.s * 0.62]} />
              </>
            )}
            {it.kind === 'stump' && (
              <>
                <mesh geometry={cyl} material={mats.stump} position={[0, it.s * 0.5, 0]} scale={[it.s * 0.55, it.s, it.s * 0.55]} />
                <mesh geometry={cyl} material={mats.stumpTop} position={[0, it.s * 1.0, 0]} scale={[it.s * 0.5, it.s * 0.04, it.s * 0.5]} />
              </>
            )}
            {it.kind === 'flower' && (
              <>
                <mesh geometry={cyl} material={mats.grass[0]} position={[0, it.s * 0.9, 0]} scale={[it.s * 0.08, it.s * 1.8, it.s * 0.08]} />
                {/* กลีบ 5 กลีบ = ลูกกลมแบน ๆ เรียงรอบเกสร */}
                {[0, 1, 2, 3, 4].map((k) => {
                  const a = (k / 5) * Math.PI * 2
                  return (
                    <mesh
                      key={k}
                      geometry={sphere}
                      material={it.mat}
                      position={[Math.cos(a) * it.s * 0.55, it.s * 1.8, Math.sin(a) * it.s * 0.55]}
                      scale={[it.s * 0.36, it.s * 0.16, it.s * 0.36]}
                    />
                  )
                })}
                <mesh geometry={sphere} material={it.mat === mats.white ? mats.yellow : mats.berry} position={[0, it.s * 1.85, 0]} scale={it.s * 0.24} />
              </>
            )}
            {it.kind === 'berry' && (
              <>
                <mesh geometry={cyl} material={mats.grass[1]} position={[0, it.s * 1.2, 0]} scale={[it.s * 0.08, it.s * 2.4, it.s * 0.08]} />
                {[[0, 2.4, 0], [0.5, 2.0, 0.2], [-0.45, 1.7, -0.2], [0.3, 1.3, -0.4]].map((o, k) => (
                  <mesh key={k} geometry={sphere} material={mats.berry} position={[o[0] * it.s, o[1] * it.s, o[2] * it.s]} scale={it.s * 0.3} />
                ))}
              </>
            )}
            {it.kind === 'pebble' && (
              <mesh geometry={sphere} material={mats.pebble} scale={[it.s, it.s * 0.5, it.s * 1.6]} />
            )}
          </group>
        ))}
      </group>
    </group>
  )
}
