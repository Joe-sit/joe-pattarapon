import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTuner } from './tuner'
import { ridePose } from './ridePose'

/**
 * พลังงานที่เกาะตัวละครตอนไถลออกจากพอร์ทัล — บอกว่ามันมาจากอีกมิติ ไม่ใช่ออกมาจากหลังฉาก
 *
 * เกาะ *ตัวละคร* ไม่ใช่ปากช่อง: ปากช่องอยู่นอกเฟรมช่วงต้นอินโทร (วัดได้ ndc x ≈ -1.7 คือ
 * เลยขอบซ้ายจอไปเกือบเท่าตัว) แสงที่วางไว้ตรงนั้นไม่มีใครเห็น ส่วนตัวละครคือสิ่งที่คนดูมองอยู่
 *
 * ทุกชิ้นเป็นแผ่นบวกแสง (additive) หันเข้ากล้อง ไม่ใช่ปริมาตรจริง — ตัวละครคาบอยู่ครึ่งใน
 * ครึ่งนอกพอร์ทัลและถูก stencil ของหน้าต่างตัดอยู่ ของทึบวางเพิ่มจะไปตัดกับกรอบด้วย
 * แสงบวกไม่มีปัญหานั้น: ไม่เขียน depth ไม่บังอะไร และไม่ต้องมีวัสดุกำหนดเองให้ดูแล
 *
 * ความแรงอ่านจาก ridePose.gap (ระยะจากปากช่อง หน่วยเดียวกับพารามิเตอร์ของเส้น) ที่ Entrance
 * เขียนให้ทุกเฟรม — ไม่มีนาฬิกาของตัวเอง จังหวะจึงตรงกับตัวละครเสมอ แม้จะลากสไลเดอร์อินโทรอยู่
 */

let glowTex = null
let ringTex = null

/**
 * ภาพไล่ระดับรัศมี สร้างจากแคนวาสครั้งเดียวทั้งแอป
 * (รูปที่ต้องการคือ gradient ธรรมดา ภาพ 128px ให้ผลเท่าเชดเดอร์โดยไม่มีวัสดุให้ดูแล)
 */
function radial(stops) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function textures() {
  if (!glowTex) {
    glowTex = radial([
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(214,240,255,0.7)'],
      [0.65, 'rgba(150,190,255,0.2)'],
      [1, 'rgba(150,190,255,0)'],
    ])
    // วงแหวน: ขอบคมด้านใน จางออกด้านนอก = ปลอกพลังงานที่กำลังหลุดออกจากตัว
    ringTex = radial([
      [0, 'rgba(255,255,255,0)'],
      [0.6, 'rgba(255,255,255,0)'],
      [0.74, 'rgba(236,248,255,0.95)'],
      [0.88, 'rgba(160,130,255,0.4)'],
      [1, 'rgba(160,130,255,0)'],
    ])
  }
  return { glowTex, ringTex }
}

/** ปลอกพลังงานที่หลุดออกจากตัวเป็นระลอก */
const HOOPS = 3
const SPARKS = 30
const P = new THREE.Vector3()
const D = new THREE.Vector3()
const Q = new THREE.Quaternion()
const M = new THREE.Matrix4()
const S = new THREE.Vector3()
const UP = new THREE.Vector3(0, 0, 1)

export function PortalFx() {
  const { camera, invalidate } = useThree()
  const grp = useRef(null)
  const aura = useRef(null)
  const hoops = useRef([])
  const sparkMesh = useRef(null)
  const tex = useMemo(() => textures(), [])

  /**
   * เม็ดที่สะบัดออกจากตัว — สุ่มทิศ/จังหวะครั้งเดียวตอนสร้าง ไม่สุ่มใหม่ทุกรอบ
   * (สุ่มใหม่ไม่ได้ทำให้ดูดีขึ้น แต่ทำให้จับจังหวะตอนจูนไม่ได้)
   */
  const sparks = useMemo(
    () =>
      Array.from({ length: SPARKS }, (_, i) => {
        const a = (i / SPARKS) * Math.PI * 2 * 2.4
        return {
          a,
          /** เฟสของเม็ดนี้ในรอบการเกิด-ดับ — กระจายให้เม็ดสะบัดออกไม่พร้อมกัน */
          phase: (i * 0.137) % 1,
          rad: 0.35 + ((i * 37) % 100) / 145,
          drift: 0.3 + ((i * 53) % 100) / 130,
          size: 0.1 + ((i * 29) % 100) / 700,
        }
      }),
    [],
  )

  /** since = วินาทีนับจากที่ตัวละครพ้นปากช่อง (ติดลบ = ยังไม่พ้น) */
const state = useMemo(() => ({ clock: 0, since: -1 }), [])

  useFrame((_s, dt) => {
    const g = grp.current
    if (!g) return
    const t = getTuner()
    const amt = t.pfxAmt
    /**
     * ความแรงนับเป็น *วินาทีหลังพ้นปากช่อง* ไม่ใช่ระยะบนเส้น
     *
     * วัดแล้ว: gap วิ่งจาก 0 ถึงสุดช่วง (0.25 ของพารามิเตอร์เส้น) ภายใน ~0.2 วิ ซึ่งตอนนั้น
     * ตัวละครยังอยู่นอกเฟรม (ปากช่องอยู่ที่ ndc x ≈ -1.7) กว่าจะไถลเข้ามาให้เห็นคือหลังจากนั้น
     * ผูกกับระยะบนเส้นแสงจึงดับก่อนใครได้เห็น — เวลาจริงคือหน่วยที่ตรงกับสิ่งที่ตาเห็น
     */
    if (ridePose.gap < -0.02) state.since = -1
    else if (state.since < 0) state.since = 0
    else state.since += dt
    const life = Math.max(0.2, t.pfxLife)
    const e =
      ridePose.live && amt > 0 && state.since >= 0
        ? Math.min(1, Math.max(0, 1 - state.since / life))
        : 0
    if (e <= 0.001) {
      g.visible = false
      return
    }
    g.visible = true
    state.clock += dt

    // เกาะตัวละคร (พิกัดโลกที่ Entrance ประกาศ) แล้วแปลงเข้าพิกัดของกลุ่มแม่
    P.set(ridePose.wx, ridePose.wy, ridePose.wz)
    if (g.parent) g.parent.worldToLocal(P)
    g.position.copy(P)
    /**
     * หันเข้ากล้องด้วยควอเทอร์เนียนโลกของกล้อง หักการหมุนของกลุ่มแม่ออก
     * (กลุ่มแม่ของฉากนี้ถูกหมุนอยู่ ถ้าคัดลอกมาตรง ๆ แผ่นจะเอียงเป็นแผ่นบาง)
     */
    if (g.parent) {
      g.parent.getWorldQuaternion(Q)
      g.quaternion.copy(Q).invert().multiply(camera.quaternion)
    } else {
      g.quaternion.copy(camera.quaternion)
    }

    /** ออร่ารอบตัว — เต้นเบา ๆ ไม่ใช่ดวงนิ่ง ๆ ให้อ่านเป็นพลังงานที่ยังไม่สงบ */
    if (aura.current) {
      const pulse = 1 + Math.sin(state.clock * 9) * 0.06
      const size = t.pfxSize * (1.15 - 0.15 * e) * pulse
      aura.current.scale.set(size, size, 1)
      aura.current.material.opacity = e * 0.8 * amt
    }

    for (let i = 0; i < HOOPS; i += 1) {
      const m = hoops.current[i]
      if (!m) continue
      /**
       * ปลอกหลุดออกเป็นระลอกต่อเนื่อง ไม่ใช่ยิงครั้งเดียวตอนข้ามปากช่อง
       * เฟสเดินตามนาฬิกาของตัวเอง แต่ความสว่างคูณด้วย e ปลอกจึงหายไปพร้อมกับการโผล่จบ
       */
      const u = (state.clock / Math.max(0.15, t.pfxRingLife) + i / HOOPS) % 1
      const grow = 1 - (1 - u) * (1 - u)
      const size = t.pfxSize * (0.45 + grow * t.pfxRingTo)
      m.scale.set(size, size, 1)
      m.material.opacity = (1 - u) * e * 0.7 * amt
      m.visible = m.material.opacity > 0.002
    }

    const im = sparkMesh.current
    if (im) {
      im.visible = true
      im.material.opacity = e * amt
      const cycle = Math.max(0.15, t.pfxSparkLife)
      for (let i = 0; i < sparks.length; i += 1) {
        const sp = sparks[i]
        const u = (state.clock / cycle + sp.phase) % 1
        const fade = 1 - u
        // สะบัดออกด้านข้างแล้วลอยถอยหลัง (ตัวละครวิ่งไปข้างหน้า เม็ดจึงร่วงไปทางท้าย)
        const reach = t.pfxSpark * (1 - fade * fade)
        D.set(
          Math.cos(sp.a + u * 2) * sp.rad,
          Math.sin(sp.a + u * 2) * sp.rad + u * 0.35,
          -sp.drift * u,
        )
        const k = sp.size * fade * t.pfxSize
        S.set(k, k, k)
        Q.setFromAxisAngle(UP, sp.a + u * 3)
        M.compose(D.multiplyScalar(reach), Q, S)
        im.setMatrixAt(i, M)
      }
      im.instanceMatrix.needsUpdate = true
    }

    if (import.meta.env.DEV) {
      const wp = new THREE.Vector3()
      g.getWorldPosition(wp)
      const v = wp.clone().project(camera)
      window.__pfx = { e: +e.toFixed(2), ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], gap: +ridePose.gap.toFixed(3) }
    }
    // ฉากวาดตามคำขอหลังอินโทรจบ — ยังมีแสงอยู่ก็ต้องขอเฟรมต่อไป
    invalidate()
  })

  return (
    <group ref={grp} visible={false}>
      {/* ออร่ารอบตัว */}
      <mesh ref={aura} renderOrder={30}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tex.glowTex}
          color="#eaf5ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* ปลอกพลังงานที่หลุดออกเป็นระลอก */}
      {Array.from({ length: HOOPS }, (_, i) => (
        <mesh
          key={i}
          ref={(n) => {
            hoops.current[i] = n
          }}
          visible={false}
          renderOrder={30}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={tex.ringTex}
            color="#cfe6ff"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* เม็ดพลังงานที่สะบัดออกจากตัว */}
      <instancedMesh
        ref={sparkMesh}
        args={[undefined, undefined, SPARKS]}
        visible={false}
        renderOrder={31}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tex.glowTex}
          color="#c9b0ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
