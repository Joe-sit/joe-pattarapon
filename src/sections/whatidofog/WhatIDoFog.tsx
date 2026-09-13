import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HeroRider } from '@/newhero/HeroRider'
import { SKILLS, STORY_ORDER } from '@/sections/whatido/WhatIDo'

/**
 * จอ "สิ่งที่ทำ" เล่าด้วยการเลื่อน — มองจากบนหัว ตัวละครไถลผ่านหมอก หางที่มันผ่าเปิดเนื้อหา
 *
 * แนวคิดตามภาพอ้างอิง (โปสเตอร์ Urumqi Bainiaohu): คนตัวเล็กอยู่ปลายแคบของลิ่มที่บานออก
 * ไปทางท้าย ในลิ่มนั้นมีเนื้อหาเป็นรูปทรงสีเรียงกัน ที่นี่เปลี่ยนเป็นมุมมองจากบน (top view)
 * ลิ่มคือ *รอยที่ตัวละครผ่าหมอกไว้* ไม่ใช่กราฟิกที่วางทับ
 *
 * เรขาคณิตของเรื่อง (กล้องอยู่เหนือหัว มองลงตรง ๆ):
 *   +Z = ล่างจอ · -Z = บนจอ · +X = ขวาจอ
 *   ตัวละครนิ่งอยู่ที่ z = CHAR_Z (ราว 70% ลงมาจากขอบบน) ไถลไปทาง +Z
 *   เนื้อหาวางไว้ข้างหน้ามัน (z มากกว่า = ใต้ขอบจอ) แล้ว *โลกเลื่อนเข้าหาตัวละคร* ตาม scroll
 *   ระยะที่ไถลไปแล้ว (travel) จึงเท่ากับระยะที่โลกถูกเลื่อนขึ้นไป
 *
 * ทำไมเลื่อนโลกไม่เลื่อนกล้อง: รอยผ่าต้องเกาะตัวละครเสมอ (มันคือหางของมัน) ถ้าเลื่อนกล้อง
 * ตามตัวละคร รอยผ่าจะต้องคิดในพิกัดโลกที่วิ่งหนีไปเรื่อย ๆ และแผ่นหมอกต้องใหญ่ตามระยะทาง
 * ทั้งหมด ตรงนี้ให้ตัวละครกับแผ่นหมอกอยู่กับที่ ลิ่มจึงเป็นสมการคงที่ในพิกัดของแผ่น ไม่ต้อง
 * มี render target สะสมรอย — และการ "เปิดค้าง" เกิดเองเพราะเนื้อหาที่ผ่านไปแล้วอยู่ในเขต
 * ที่เปิดอยู่ตลอด ไม่มีใครไปปิดมันคืน
 */

/** ความสูงกล้อง + มุมกว้าง — คู่นี้เป็นตัวกำหนดว่าเห็นพื้นกว้างแค่ไหน (ดู HALF_Z) */
const CAM_H = 38
const FOV = 34
/** ครึ่งความสูงของพื้นที่ที่เห็นตรงระนาบพื้น: tan(FOV/2) × CAM_H */
const HALF_Z = Math.tan((FOV / 2) * (Math.PI / 180)) * CAM_H

/** ตัวละครอยู่ต่ำกว่ากลางจอ — หางที่ผ่าไว้จึงมีที่ให้เห็นเต็มครึ่งบน */
const CHAR_Z = HALF_Z * 0.42
/**
 * ขนาด/การหันของตัวละคร — ต้องหันหน้าเข้าหาหมอก (+Z = ล่างจอ) เพราะมันเป็นตัวผ่า
 *
 * ริกตั้งต้นหันไปทาง +X (ในฉาก hero มันไถลไปทางนั้น) หมุนรอบ Y −90° จึงพา +X ไปเป็น +Z
 */
/* เล็กแบบในภาพอ้างอิง (คนงานในโปสเตอร์ตัวจิ๋ว ลิ่มเป็นพระเอก) — ตัวโตแล้วท่าไถลของริก
   ซึ่งออกแบบมาให้มองจากข้าง อ่านเป็นคนนอนกางแขนเมื่อมองจากบน */
const CHAR_SCALE = 1.2
const CHAR_FACE = -Math.PI / 2

/** ชิ้นเนื้อหาชิ้นแรกอยู่ห่างจากตัวละครเท่าไร (พ้นขอบล่างจอไปแล้ว) และห่างกันชิ้นละเท่าไร */
const AHEAD = HALF_Z + 2
/**
 * ห่างกัน 9 หน่วย ไม่ใช่ 13
 *
 * 13 ทำให้ช่วงจบเหลือการ์ดใบเดียวในเฟรม ภาพปิดเรื่องจึงเป็นทุ่งโล่งที่มีของชิ้นเดียว
 * 9 ทำให้ทั้งสามใบอยู่ในความลึกที่เห็นได้พร้อมกันตอนหมอกสลาย = ปิดเรื่องด้วยภาพที่ครบ
 */
const GAP = 9
/** ไถลต่ออีกเท่าไรหลังผ่านชิ้นสุดท้าย — ให้ชิ้นท้ายลอยขึ้นไปอยู่ในลิ่มเต็มตัวก่อนจบจอ */
const TAIL = 7
const TRAVEL = AHEAD + (SKILLS.length - 1) * GAP + TAIL

/**
 * รูปของลิ่ม: ครึ่งความกว้างที่ระยะ d หลังตัวละคร = W0 + SPREAD × d
 *
 * W0 คือความกว้างตรงตัวละคร (แคบ แต่ต้องไม่ศูนย์ ไม่งั้นปลายลิ่มเป็นเข็มแหลมผิดธรรมชาติ)
 * SPREAD 0.62 ทำให้ที่ขอบบนจอ (d ≈ 11 หน่วย) ลิ่มกว้างราว 15 หน่วย = เกือบเต็มความกว้าง
 * ที่เห็น เหลือหมอกเป็นแฉกสองข้างอย่างในภาพอ้างอิง
 */
const WEDGE_W0 = 1.7
const WEDGE_SPREAD = 0.62
/**
 * ความยาวรอยผ่าเต็มที่ = ไกลกว่าขอบบนจอ แล้วไล่ขึ้นจากศูนย์ในช่วง 8% แรกของจอ
 *
 * รอบก่อนผูกความยาวรอยไว้กับระยะที่ไถลจริง ผลคือช่วงต้นจอลิ่มเป็นรูปคางหมูที่ถูกตัดยอด
 * เป็นเส้นตรงกลางจอ ซึ่งอ่านเป็นขอบของกราฟิก ไม่ใช่รอยที่ถูกผ่า — และมันผิดความจริงด้วย
 * ตัวละครไถลมาจากนอกจอด้านบนอยู่แล้ว ทางที่มันมาจึงต้องเปิดอยู่ตั้งแต่ต้น ความคืบหน้า
 * ของเรื่องมาจาก *เนื้อหาที่ไหลเข้ามาในลิ่ม* ไม่ใช่จากความยาวของลิ่ม
 */
const OPEN_FULL = 24
const OPEN_IN = 0.08

/**
 * ลิ่มบานกว้างขึ้นเรื่อย ๆ ตามความคืบหน้า และหมอกละลายหมดตอนจบ — นี่คือ "เรื่อง" ของจอนี้
 *
 * รอบก่อนลิ่มเป็นรูปเดิมตั้งแต่ต้นจนจบ การ์ดแค่ไหลผ่านไปทีละใบ ไม่มีอะไรก่อตัวขึ้น จอจึงไม่มี
 * ต้นกลางปลาย ตอนนี้: เริ่มที่รอยแคบ ๆ (โลกยังปิด) → กว้างขึ้นทุกใบที่ผ่าน → 18% ท้ายหมอก
 * สลายทั้งจอ เหลือทุ่งโล่งที่มีเนื้อหาครบสามชิ้นเป็นภาพปลายเรื่อง แล้วส่งต่อจอถัดไปแบบไม่มี
 * รอยตัด (จอ Experiences เปิดด้วยทุ่งฟ้าสว่างเหมือนกัน)
 */
const SPREAD_TO = 1.15
const CLEAR_FROM = 0.82

/**
 * ระนาบของหมอก — หมอกบังเนื้อหาด้วยความลึกจริง ไม่ต้องมาสก์รายชิ้น
 *
 * 2.4 ไม่ใช่ 1.6: ของประดับสูงถึงราว 1.6 หน่วย ยอดมันจึงโผล่พ้นหมอกแล้วเห็นเป็นเงาจาง ๆ
 * ในเขตที่ยังไม่ถูกเปิด (เห็นชัดที่มุมล่างขวาในภาพรอบก่อน) ตัวละครสูงกว่านั้นอยู่แล้ว
 * มันจึงยังโผล่ไหล่พ้นหมอกเหมือนคนที่กำลังลุยเข้าไป ซึ่งเป็นสิ่งที่ต้องการ
 */
const FOG_Y = 2.4
/**
 * ไล่ค่าความสว่างสามชั้น: หมอก (เข้มสุด) → พื้นที่เปิดแล้ว → การ์ด (ขาว)
 *
 * รอบก่อนหมอกเป็นสีขาวบนพื้นอมฟ้าอ่อน สองอย่างสว่างใกล้กันจนรอยผ่าแทบไม่มีตัวตน
 * สลับเป็นหมอกฟ้าเทาเข้มกว่าพื้น (ตามภาพอ้างอิงที่พื้นเป็นกระดาษขาวแล้ว plume เป็นสี)
 * คนจึงเห็นทันทีว่าตรงไหนถูกผ่าเปิดไปแล้ว
 */
const GROUND = '#e9eff2'

/** ความคืบหน้าการเลื่อนของจอนี้ (0..1) — ค่าต่อเฟรม ไม่ผ่าน state (ดูกฎ r3f ใน .agents/skills) */
/**
 * to = ค่าที่ scroll ชี้อยู่ · p = ค่าที่ฉากใช้จริง ซึ่งวิ่งตาม to แบบผ่อน
 *
 * ผูกฉากกับ to ตรง ๆ แล้วทุกอย่างขยับเป็นขั้นเท่าเดลตาของล้อ (ล้อหนึ่งคลิก = กระโดดทีละ
 * ร้อยพิกเซล) ตาอ่านเป็นการกระตุก ไม่ใช่การไถล — ผ่อนเข้าหาเป้าทุกเฟรมแล้วมันมีโมเมนตัม
 * ของตัวเอง หยุดหมุนล้อแล้วยังไหลต่ออีกนิดก่อนนิ่ง
 */
const flow = { p: 0, to: 0 }
/** ความเร็วที่ p ไล่ตาม to (ต่อวินาที) — ต่ำกว่านี้หน่วง สูงกว่านี้เริ่มกระตุกตามล้อ */
const EASE = 5.5

/** จำนวนวิวพอร์ตที่จอนี้กิน — หนึ่งจอต่อหนึ่งชิ้น บวกช่วงเปิดเรื่องกับช่วงท้าย */
const SCREENS = SKILLS.length + 1.6

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => x * x * (3 - 2 * x)

/**
 * การ์ดเนื้อหาเป็น texture ที่วาดเอง ไม่ใช่ DOM
 *
 * ทั้งจอเป็น r3f การ์ดจึงต้องอยู่ในระนาบพื้นเพื่อให้หมอกบังได้จริง ถ้าเป็น DOM ทับข้างบน
 * มันจะลอยอยู่หน้าหมอกตลอด การเปิดเผยก็ไม่มีความหมาย — ส่วนคนที่อ่านด้วยเครื่องอ่านหน้าจอ
 * ได้ข้อความชุดเดียวกันจากบล็อก sr-only ท้ายไฟล์
 */
function cardTexture(i: number, title: string, desc: string, color: string) {
  const W = 1024
  const H = 512
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (ctx) {
    const r = 44
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.arcTo(W, 0, W, H, r)
    ctx.arcTo(W, H, 0, H, r)
    ctx.arcTo(0, H, 0, 0, r)
    ctx.arcTo(0, 0, W, 0, r)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    /* แถบสีของสกิลชิดขอบซ้าย — ตัวเดียวกับสีกระเบื้องในผังเดิม คนจึงโยงสองจอเข้าหากันได้ */
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 26, H)

    ctx.fillStyle = color
    ctx.font = '600 44px ui-monospace, monospace'
    ctx.fillText(`0${i + 1}`, 78, 108)

    ctx.fillStyle = '#16181f'
    ctx.font = '700 104px Archivo, Helvetica, Arial, sans-serif'
    ctx.fillText(title.toUpperCase(), 78, 232)

    ctx.fillStyle = '#4a4f5a'
    ctx.font = '400 44px Archivo, Helvetica, Arial, sans-serif'
    /* ตัดบรรทัดด้วยความกว้างจริงของตัวอักษร ไม่ใช่นับตัวอักษร — ฟอนต์นี้ไม่ใช่ monospace */
    const words = desc.split(' ')
    let line = ''
    let y = 330
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (ctx.measureText(next).width > W - 156 && line) {
        ctx.fillText(line, 78, y)
        line = w
        y += 62
      } else {
        line = next
      }
    }
    if (line) ctx.fillText(line, 78, y)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** รูปทรงประดับในลิ่ม — ชุดเดียวกับภาพอ้างอิง: บล็อกสีเรียบ ๆ ไม่มีลวดลาย */
const PROP_GEO = [
  new THREE.BoxGeometry(1, 0.5, 1),
  new THREE.CylinderGeometry(0.5, 0.5, 0.45, 24),
  new THREE.ConeGeometry(0.6, 0.9, 4),
]

/**
 * ของประดับรอบการ์ดแต่ละชิ้น — ตำแหน่งคิดจากดัชนี ไม่ได้สุ่มตอนรัน
 *
 * สุ่มตอนรันแล้วผังเปลี่ยนทุกครั้งที่รีเฟรช เทียบภาพก่อน/หลังการแก้ไม่ได้เลย
 */
function propsFor(i: number) {
  const out: { pos: [number, number, number]; rot: number; s: number; g: number }[] = []
  for (let k = 0; k < 5; k += 1) {
    const a = (i * 2.3 + k * 1.7) % (Math.PI * 2)
    const rad = 3.6 + ((i + k) % 3) * 1.15
    out.push({
      pos: [Math.cos(a) * rad * 1.55, 0.34, Math.sin(a) * rad * 0.72],
      rot: a,
      s: 1.15 + ((i + k) % 4) * 0.3,
      g: (i + k) % PROP_GEO.length,
    })
  }
  return out
}

/**
 * หนึ่งชิ้นเนื้อหา — ไม่ได้แค่ไหลผ่าน มันต้อง "มาถึง"
 *
 * รอบก่อนการ์ดเลื่อนขึ้นด้วยความเร็วเดียวตลอด โผล่จากหมอกแล้วไหลออกนอกจอ ทุกใบเหมือนกัน
 * หมด ไม่มีจังหวะไหนเป็นจุดสนใจ ตอนนี้ผูกกับ d (ระยะที่ตัวละครผ่านมันไปแล้ว):
 *   d < 0      ยังอยู่หน้าตัวละคร ใต้หมอก — ไม่ต้องวาด
 *   d 0 → 4    ผุดขึ้น: ขยายจาก 0.8 เต็มขนาด ความทึบไล่ขึ้น เอียงเข้าที่
 *   d > 4      ลอยห่างออกไปทางข้าง (ตามลิ่มที่บานออก) และยกสูงขึ้นเล็กน้อย
 *
 * ของประดับเริ่มต่างเฟสกันเล็กน้อย (k × 0.55) ทั้งชุดจึงผุดเป็นระลอก ไม่ใช่ปรากฏพร้อมกัน
 */
function Beat({ i, tex, color }: { i: number; tex: THREE.Texture; color: string }) {
  const props = useMemo(() => propsFor(i), [i])
  /* สลับข้างซ้าย/ขวา — ลิ่มบานออกสองข้าง ถ้าทุกชิ้นอยู่กลางจะเหลือที่ว่างข้างละครึ่งจอ */
  const side = i % 2 === 0 ? 1 : -1
  const z0 = AHEAD + i * GAP
  const grp = useRef<THREE.Group>(null)
  const card = useRef<THREE.Mesh>(null)
  const shapes = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const g = grp.current
    if (!g) return
    const d = CHAR_Z - (z0 - flow.p * TRAVEL)
    const t = state.clock.elapsedTime
    const r = ease(clamp01(d / 4))
    g.visible = d > -1.5
    if (!g.visible) return
    /* ยิ่งอยู่ไกลไปทางท้าย ยิ่งเยื้องออกข้างตามลิ่ม — แนวของการ์ดจึงลู่ไปกับขอบหมอก */
    g.position.x = side * (2.3 + Math.max(0, d - 4) * 0.16)
    g.position.y = Math.max(0, d - 4) * 0.045
    const c = card.current
    if (c) {
      c.scale.setScalar(0.8 + r * 0.2)
      const m = c.material as THREE.MeshBasicMaterial
      m.opacity = r
      /* เอียงเข้าที่ตอนผุด — การ์ดที่นอนแบนสนิทตั้งแต่เฟรมแรกดูเหมือนภาพแปะ */
      c.rotation.z = (1 - r) * side * 0.18
    }
    for (let k = 0; k < shapes.current.length; k += 1) {
      const m = shapes.current[k]
      if (!m) continue
      const rk = ease(clamp01((d - k * 0.55) / 3.4))
      m.scale.setScalar(props[k].s * rk)
      /* ลอยขึ้นลงคนละจังหวะ — ของประดับที่นิ่งสนิทดูเป็นของวาง ไม่ใช่ของที่ลอยอยู่ในเมฆ */
      m.position.y = props[k].pos[1] + Math.sin(t * 0.8 + k * 1.3 + i) * 0.18 * rk
      m.rotation.y = props[k].rot + t * 0.12
    }
  })

  return (
    <group ref={grp} position={[side * 2.3, 0, z0]}>
      {/* การ์ดนอนราบกับพื้น (หมุน -90° รอบ X) เพราะกล้องมองลงมาตรง ๆ */}
      <mesh ref={card} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <planeGeometry args={[7.4, 3.7]} />
        <meshBasicMaterial map={tex} transparent opacity={0} toneMapped={false} />
      </mesh>
      {props.map((p, k) => (
        <mesh
          key={k}
          ref={(m) => {
            shapes.current[k] = m
          }}
          geometry={PROP_GEO[p.g]}
          position={p.pos}
          rotation={[0, p.rot, 0]}
          scale={0}
        >
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * แผ่นหมอก — ลิ่มที่เปิดคิดในเชดเดอร์ ไม่ใช่การวาดรอยลง render target
 *
 * เส้นขอบลิ่มถูกกวนด้วย fbm ขอบจึงเป็นปุยขาดวิ่นเหมือนเมฆที่ถูกผ่า ไม่ใช่สามเหลี่ยมคม
 * uOpen คือความยาวของรอยที่ผ่าไปแล้ว (= travel) ตอนยังไม่เลื่อนเลยจึงไม่มีรอยเปิดใด ๆ
 */
function FogSheet() {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uOpen: { value: 0 },
      uTime: { value: 0 },
      uClear: { value: 0 },
      uCharZ: { value: CHAR_Z },
      uW0: { value: WEDGE_W0 },
      uSpread: { value: WEDGE_SPREAD },
    }),
    [],
  )
  useFrame((_, dt) => {
    const m = mat.current
    if (!m) return
    m.uniforms.uOpen.value = OPEN_FULL * Math.min(1, flow.p / OPEN_IN)
    m.uniforms.uTime.value += dt
    /* ลิ่มกว้างขึ้นตามความคืบหน้า แล้วหมอกสลายทั้งจอในช่วงท้าย */
    m.uniforms.uSpread.value = WEDGE_SPREAD + (SPREAD_TO - WEDGE_SPREAD) * flow.p
    m.uniforms.uClear.value = clamp01((flow.p - CLEAR_FROM) / (1 - CLEAR_FROM))
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FOG_Y, 0]} renderOrder={2}>
      <planeGeometry args={[HALF_Z * 7, HALF_Z * 6]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        vertexShader={`
          varying vec2 vXZ;
          void main() {
            vXZ = (modelMatrix * vec4(position, 1.0)).xz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision mediump float;
          uniform float uOpen;
          uniform float uTime;
          uniform float uCharZ;
          uniform float uW0;
          uniform float uSpread;
          uniform float uClear;
          varying vec2 vXZ;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }
          /* สามชั้นพอ — มือถือคิดเชดเดอร์นี้เต็มจอ ชั้นที่สี่แลกมาด้วยเฟรมที่ตกแต่ตาไม่เห็นต่าง */
          float fbm(vec2 p) {
            float a = 0.0;
            float w = 0.5;
            for (int k = 0; k < 3; k += 1) {
              a += noise(p) * w;
              p *= 2.03;
              w *= 0.5;
            }
            return a;
          }

          void main() {
            /* d = ระยะหลังตัวละคร (บวก = ขึ้นไปทางบนจอ ซึ่งคือทางที่ไถลผ่านมาแล้ว) */
            float d = uCharZ - vXZ.y;
            float hw = uW0 + uSpread * d;
            /* ขอบลิ่มขาดวิ่น: กวนความกว้างด้วย fbm ที่เลื่อนช้า ๆ ไม่ใช่เส้นตรงคม */
            hw += (fbm(vec2(vXZ.y * 0.22, uTime * 0.05)) - 0.5) * 1.9;

            float inSide = 1.0 - smoothstep(hw - 1.4, hw + 0.6, abs(vXZ.x));
            /* ปลายรอย: เปิดได้ไม่เกินระยะที่ไถลมาจริง และหน้าตัวละครยังเป็นหมอกเต็ม */
            float inBack = smoothstep(-0.2, 1.1, d) * (1.0 - smoothstep(uOpen - 2.2, uOpen + 0.4, d));
            float open = inSide * inBack;

            /* ตัวหมอกเอง: ก้อนปุยที่ไหลช้า ๆ ไม่ใช่แผ่นทึบสีเดียว */
            float puff = fbm(vXZ * 0.13 + vec2(uTime * 0.012, uTime * 0.02));
            /**
             * หมอกต้องทึบเกือบเต็ม ไม่ใช่ฝ้าบาง ๆ
             *
             * รอบก่อนตั้งฐานไว้ 0.62 แล้วเนื้อหาใต้หมอกยังอ่านออกทั้งที่ยังไม่ถูกเปิด
             * การผ่าจึงไม่มีความหมาย ฐาน 0.93 ทำให้ "ยังไม่เปิด = ไม่เห็น" จริง ๆ ส่วน puff
             * เหลือหน้าที่แค่ทำให้ผิวหมอกไม่เรียบเป็นแผ่นพลาสติก
             */
            /**
             * การสลายตอนจบไม่ใช่การลดอัลฟาทั้งแผ่นเท่ากัน
             *
             * ลดเท่ากันแล้วหมอกกลายเป็นฟิล์มโปร่งทั้งผืน เห็นเป็นกระจกฝ้าไม่ใช่เมฆที่จางหาย
             * ยกเกณฑ์ของ puff ขึ้นแทน ก้อนที่บางอยู่แล้วจึงหายไปก่อน เหลือก้อนหนาเป็นหยอม ๆ
             * แล้วค่อยหายตาม = การสลายตัวของเมฆจริง
             */
            float a = clamp(0.96 + puff * 0.1 - uClear * (1.55 - puff * 0.5), 0.0, 1.0) * (1.0 - open);
            if (a < 0.01) discard;
            /* ริมรอยฉีกเข้มกว่ากลางก้อนเล็กน้อย — ขอบจึงมีตัวตน ไม่ละลายหายไปกับพื้น */
            float rim = smoothstep(0.0, 0.35, open) * (1.0 - smoothstep(0.35, 0.9, open));
            vec3 col = mix(vec3(0.72, 0.80, 0.86), vec3(0.84, 0.90, 0.94), clamp(puff * 1.1 - rim * 0.35, 0.0, 1.0));
            gl_FragColor = vec4(col, a);
          }
        `}
      />
    </mesh>
  )
}

/** โลกที่เลื่อนเข้าหาตัวละครตาม scroll — ชิ้นเนื้อหาทั้งหมดอยู่ในกลุ่มนี้ */
function Story({ texes }: { texes: THREE.Texture[] }) {
  const grp = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = grp.current
    if (!g) return
    const travel = flow.p * TRAVEL
    g.position.z = -travel
    if (import.meta.env.DEV) {
      const w = window as unknown as { __fog?: Record<string, number> }
      w.__fog = { p: flow.p, travel, at: Math.floor((travel - AHEAD) / GAP + 1) }
    }
  })
  return (
    <group ref={grp}>
      {/* ไล่ตาม *ลำดับเล่า* ไม่ใช่ลำดับใน SKILLS — texture ก็เรียงตามลำดับเล่าเหมือนกัน
          รอบก่อนวนด้วย SKILLS.map แล้วสีของของประดับไปจับคู่กับการ์ดผิดใบ (การ์ด Coding
          ม่วงได้ของประดับสีส้มของ Design) */}
      {STORY_ORDER.map((si, n) => (
        <Beat key={SKILLS[si].title} i={n} tex={texes[n]} color={SKILLS[si].color} />
      ))}
    </group>
  )
}

/**
 * ลายเส้นบนพื้น — เส้นตารางบาง ๆ ที่ถูกเปิดเผยไปพร้อมเนื้อหา
 *
 * พื้นสีเรียบทำให้ "เปิดแล้ว" กับ "ยังไม่เปิด" ต่างกันแค่ความสว่าง ไม่มีอะไรให้ตาจับว่ากำลัง
 * เคลื่อนที่ผ่านอะไร มีเส้นแล้วมันกลายเป็นแผนที่ที่เลื่อนผ่านใต้ตัวละคร = รู้ว่าไถลไปจริง
 */
function gridTexture() {
  const N = 256
  const cv = document.createElement('canvas')
  cv.width = N
  cv.height = N
  const ctx = cv.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#e9eff2'
    ctx.fillRect(0, 0, N, N)
    ctx.strokeStyle = '#d5e0e6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0.5, 0)
    ctx.lineTo(0.5, N)
    ctx.moveTo(0, 0.5)
    ctx.lineTo(N, 0.5)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(18, 12)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** ปุยเมฆกลม ๆ นุ่ม ๆ ใบเดียว ใช้ซ้ำทุกก้อน */
function puffTexture() {
  const N = 128
  const cv = document.createElement('canvas')
  cv.width = N
  cv.height = N
  const ctx = cv.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.55, 'rgba(246,250,252,0.55)')
    g.addColorStop(1, 'rgba(246,250,252,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, N, N)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** จำนวนก้อนปุยที่เกาะริมรอยผ่า (ข้างละครึ่ง) */
const PUFFS = 16

/**
 * ก้อนปุยเกาะริมรอยผ่า — แผ่นหมอกแบนผืนเดียวไม่มีความหนา ขอบจึงดูเป็นรอยตัดกระดาษ
 *
 * ก้อนพวกนี้เกาะ *ขอบลิ่ม* ซึ่งนิ่งอยู่ในเฟรม (ลิ่มผูกกับตัวละคร ไม่ได้เลื่อนไปกับโลก) จึงวางไว้
 * นอกกลุ่มที่เลื่อน แล้วให้มันไหลขึ้นช้า ๆ เองเป็นวงรอบ — ได้ความหนาที่ริมรอยโดยไม่ต้องทำ
 * volumetric อะไรเลย และหายไปพร้อมหมอกตอนจบ
 */
function EdgePuffs({ tex }: { tex: THREE.Texture }) {
  const grp = useRef<THREE.Group>(null)
  const seeds = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, k) => ({
        side: k % 2 === 0 ? 1 : -1,
        /* กระจายตามความยาวรอย ไม่สุ่ม — ต้องได้ผังเดิมทุกครั้งที่รีเฟรชเพื่อเทียบภาพ */
        d0: ((k * 7.3) % OPEN_FULL) / OPEN_FULL,
        s: 3.4 + ((k * 5) % 4) * 1.1,
        sp: 0.55 + ((k * 3) % 5) * 0.12,
      })),
    [],
  )
  useFrame((state) => {
    const g = grp.current
    if (!g) return
    const t = state.clock.elapsedTime
    const clear = clamp01((flow.p - CLEAR_FROM) / (1 - CLEAR_FROM))
    const spread = WEDGE_SPREAD + (SPREAD_TO - WEDGE_SPREAD) * flow.p
    g.children.forEach((o, k) => {
      const sd = seeds[k]
      /* ไหลขึ้นไปทางท้ายรอยแล้ววนกลับ — ก้อนเมฆที่ถูกแหวกจะถอยไปทางหลังเสมอ */
      const d = ((sd.d0 + (t * sd.sp) / OPEN_FULL) % 1) * OPEN_FULL
      const hw = WEDGE_W0 + spread * d
      o.position.set(sd.side * hw, FOG_Y + 0.35, CHAR_Z - d)
      /* จางที่ปลายทั้งสองข้างของช่วงชีวิต ไม่งั้นเห็นก้อนโผล่/หายกลางอากาศ */
      const life = Math.sin((d / OPEN_FULL) * Math.PI)
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = 0.85 * life * (1 - clear)
      o.scale.setScalar(sd.s * (0.7 + life * 0.5))
    })
  })
  return (
    <group ref={grp}>
      {seeds.map((_, k) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * ตัวละคร + เงาที่พื้น
 *
 * เงา: วงรีจาง ๆ ใต้ตัว — ไม่มีเงาแล้วตัวละครดูลอยอยู่เหนือพื้นคนละระนาบกับการ์ด
 * การเอียง: เอนเข้าหาข้างที่การ์ดใบถัดไปอยู่ (มันกำลังเลี้ยวไปหา) แล้วคืนตรงตอนผ่านไปแล้ว
 * — ตัวที่ตรงนิ่งตลอดทางคือเหตุที่ดูเหมือนของวางไว้ ไม่ใช่คนที่กำลังพาเรื่องไป
 */
function Skater() {
  const lean = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = lean.current
    if (!g) return
    const travel = flow.p * TRAVEL
    /* ใบถัดไปอยู่ข้างไหน และใกล้แค่ไหน */
    const k = (travel - AHEAD + GAP * 0.5) / GAP
    const next = Math.max(0, Math.round(k))
    const side = next % 2 === 0 ? 1 : -1
    const near = 1 - Math.min(1, Math.abs(k - next) * 2)
    g.rotation.z = -side * near * 0.16
    g.rotation.y = CHAR_FACE + side * near * 0.12
    /* ไหวขึ้นลงเบา ๆ ตลอด — ไม่มีอะไรนิ่งสนิทตอนไถลผ่านลม */
    g.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.06
  })
  return (
    <group position={[0, 0, CHAR_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0.2]} scale={[3.1, 1.9, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#7e93a1" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={lean} rotation={[0, CHAR_FACE, 0]} scale={CHAR_SCALE}>
        <Suspense fallback={null}>
          <HeroRider />
        </Suspense>
      </group>
    </group>
  )
}

function Stage() {
  const { camera } = useThree()
  const grid = useMemo(gridTexture, [])
  const puff = useMemo(puffTexture, [])
  useEffect(
    () => () => {
      grid.dispose()
      puff.dispose()
    },
    [grid, puff],
  )

  /* ตัวขับเดียวของทั้งฉาก: ผ่อน p เข้าหาค่าที่ scroll ชี้ (ดู flow) */
  useFrame((_, dt) => {
    flow.p += (flow.to - flow.p) * Math.min(1, dt * EASE)
    /**
     * เลื่อน *ลาย* ของพื้น ไม่ใช่เลื่อนตัวพื้น
     *
     * ถ้าเอาพื้นไปไว้ในกลุ่มที่เลื่อน มันจะไถลออกนอกเฟรมตั้งแต่กลางจอ (ระยะทางทั้งเรื่อง
     * ยาวกว่าตัวพื้นเอง) ต้องทำพื้นยาวเท่าระยะทางซึ่งเปลืองเปล่า ๆ — เลื่อน uv แทน
     * ตัวคูณ = repeat.y ÷ ความลึกของระนาบ (12 ÷ HALF_Z×3.4) ลายจึงวิ่งเท่าโลกจริงพอดี
     */
    grid.offset.y = (flow.p * TRAVEL * 12) / (HALF_Z * 6)
  })
  /**
   * มองลงจากบน แต่เอียงจากแนวดิ่งราว 15° ไม่ใช่ตั้งฉากเป๊ะ
   *
   * ตั้งฉากเป๊ะแล้วตัวละครเหลือแค่ก้อนดำ (จากบนหัวเห็นแต่ผมกับแผ่นบอร์ด) ไม่มีใครอ่านออก
   * ว่าเป็นคนกำลังไถล เอียงเท่านี้ยังเป็น top view เต็มตัว (การ์ดที่นอนกับพื้นหดแค่ 3%)
   * แต่ได้ทั้งด้านหลังและด้านบนของตัวละคร และลิ่มหมอกได้เปอร์สเปกทีฟลู่เข้าหาปลายด้วย
   */
  useEffect(() => {
    /* 18 หน่วย ≈ เอียง 25° จากแนวดิ่ง — 10 หน่วย (15°) ยังเห็นตัวละครเป็นแผ่นบอร์ดดำ
       เกือบทั้งตัว เอียงเท่านี้เห็นลำตัวกับแขนจากด้านหลัง อ่านออกว่าเป็นคนไถล */
    /* อยู่บนแกนกลางเสมอ — ลองเยื้องข้างแล้วลิ่มเอียงจนไม่เป็นแนวตั้ง การ์ดบิด และขอบระนาบ
       โผล่เข้ามาในเฟรม (เห็นเป็นแถบดำมุมซ้ายบน) เสียมากกว่าได้ */
    camera.position.set(0, CAM_H, CHAR_Z + 18)
    camera.lookAt(0, 0, CHAR_Z - 4)
  }, [camera])

  const texes = useMemo(
    /* เลขบนการ์ดคือลำดับ *ที่เรื่องเล่าถึง* ไม่ใช่ดัชนีใน SKILLS (ลำดับเล่าคือ Research →
       Design → Coding) รอบก่อนใช้ดัชนีตรง ๆ การ์ดใบที่สองจึงขึ้นเลข 03 */
    () => STORY_ORDER.map((i, n) => cardTexture(n, SKILLS[i].title, SKILLS[i].desc, SKILLS[i].color)),
    [],
  )
  useEffect(() => () => texes.forEach((t) => t.dispose()), [texes])

  return (
    <>
      <ambientLight intensity={0.9} />
      {/* ส่องจากบนซ้ายหน้า = ฝั่งกล้อง ตัวละครจึงไม่เป็นเงาทึบเมื่อมองจากด้านหลัง */}
      <directionalLight position={[-9, 16, 12]} intensity={1.3} />
      {/* พื้น — เส้นตารางบาง ๆ บอกว่าเรากำลังเลื่อนผ่านอะไรอยู่ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[HALF_Z * 7, HALF_Z * 6]} />
        <meshBasicMaterial color={GROUND} map={grid} />
      </mesh>
      <Story texes={texes} />
      <FogSheet />
      <EdgePuffs tex={puff} />
      {/* ตัวละครตัวเดียวกับ hero — ไม่ได้ปั้นตัวใหม่ให้มุมนี้ */}
      <Skater />
    </>
  )
}

export function WhatIDoFog({ id = 'what-i-do' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = section.current
    if (!el) return
    /* ความคืบหน้าเขียนลงอ็อบเจกต์นิ่ง ไม่ใช่ state — ฉากอ่านมันใน useFrame */
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      const span = Math.max(1, el.offsetHeight - window.innerHeight)
      flow.to = clamp01(-r.top / span)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    /* วาดเฉพาะตอนจออยู่ในสายตา — จอนี้สูงหลายวิวพอร์ต ปล่อยวาดทิ้งไว้คือเผา GPU เปล่า */
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { rootMargin: '10%' })
    io.observe(el)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      io.disconnect()
    }
  }, [])

  return (
    <section
      id={id}
      data-screen={id}
      ref={section}
      className="v2-theme relative w-full bg-[var(--v2-bg)]"
      style={{ height: `${SCREENS * 100}svh` }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-clip">
        <Canvas
          className="block h-full w-full"
          frameloop={live ? 'always' : 'never'}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, CAM_H, 0.01], fov: FOV, near: 1, far: 120 }}
        >
          <Stage />
        </Canvas>

        {/* หัวจอชิดซ้าย ไม่ใช่กลาง — กลางจอเป็นทางที่การ์ดลอยผ่าน ตัวหนังสือจะทับกันตลอด */}
        <div className="pointer-events-none absolute left-[clamp(24px,4.4vw,64px)] top-[clamp(48px,9svh,96px)]">
          <p className="v3-eyebrow">WHAT I DO</p>
        </div>
      </div>

      {/* ข้อความชุดเดียวกับการ์ดในฉาก สำหรับเครื่องอ่านหน้าจอและเครื่องมือค้นหา
          (ในฉากมันเป็น texture ซึ่งอ่านไม่ได้) */}
      <div className="sr-only">
        <h2>What I do</h2>
        {STORY_ORDER.map((i) => (
          <div key={SKILLS[i].title}>
            <h3>{SKILLS[i].title}</h3>
            <p>{SKILLS[i].desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
