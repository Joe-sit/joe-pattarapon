import { Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import { BASE_H, HeroScene } from './HeroScene'
import { HeroShatter } from './HeroShatter'
// แผงจูนฉาก (HeroPlatformDebug) ถูกถอดออกจากหน้าชั่วคราวตามที่สั่ง — ไฟล์ยังอยู่
// เอากลับมาได้ด้วยการคืน state กับบล็อก import.meta.env.DEV ที่ท้ายไฟล์
import type { HeroCfg } from './HeroPlatformDebug'
import * as THREE from 'three'
import { Worker } from './HeroWorker'

/**
 * แท่นไอโซเมตริกของจอแรก /2026-final — ของจริงในสามมิติ ไม่ใช่ SVG
 *
 * ในแบบ Figma แผ่นพวกนี้เป็นสี่เหลี่ยมแบน ๆ ที่ถูก skew ให้ดูเอียง ซึ่งพอจะวางวัตถุลงไป
 * จริงจะเข้ากันไม่ได้เลย — เงา ความสูง และมุมมองจะไม่ตรงกัน ที่นี่จึงเป็นกล้อง orthographic
 * ที่มุมไอโซจริง แผ่นเป็นกล่องบางวางบนระนาบ XZ ของฉาก ของที่จะมาวางทีหลังแค่ใส่เป็น
 * children แล้วอ้าง TILE เพื่อหาพิกัดกลางแผ่น
 *
 * ตัวละครเป็นตัวเดียวกับที่ใช้ในหน้า /2026 แต่สวมชุดคนงาน (ดู HeroWorker) — GLB ตัวเดิม
 * ให้ทุก instance อยู่แล้ว) โหมด isolated: ไม่กินไทม์ไลน์ intro/scroll ของฉาก joespresso
 * เหลือท่ายืนกับหัวหันตามเมาส์
 */

/** ความกว้างของหนึ่งแผ่นในหน่วยฉาก — ใช้เป็นหน่วยตั้งต้นของทุกพิกัดบนแท่น */
export const TILE = 4

/**
 * ค่าที่ใช้จริงบนหน้า — ตัวเลขชุดนี้มาจากการลากในแผงดีบัก (HeroPlatformDebug) แล้วก๊อบกลับมา
 * yaw เป็นหน่วย π ไม่ใช่องศา ให้ตรงกับที่แผงแสดง
 */
const DEFAULT_CFG: HeroCfg = {
  // ตัวละครตัวหน้าสุด ยืนอยู่หน้าโต๊ะ (อีกสองตัวในฉากตำแหน่งตายตัว — ดู HeroPlatform)
  mascot: { x: -2.6, z: 3.6, yaw: 0.1, scale: 0.42 },
  // ทั้ง diorama: เลื่อน/หมุน/ย่อทั้งก้อนพร้อมกัน
  scene: { x: 4.2, z: 1.4, yaw: 0, scale: 1 },
  // fit ผูกกับความสูงของกรอบ (126svh) — เปลี่ยนความสูงกรอบต้องขยับค่านี้ตามสัดส่วน
  fit: 21.4,
}

/** เผื่อขอบรอบฉากก่อนถึงเส้นขอบแผ่น — คิดเป็นเท่าของด้านที่ยาวที่สุดของฉาก */
const PLATE_MARGIN = 1.02

/** สูงกว่านี้ถือว่า "ลอย" ไม่ใช่ของที่ตั้งอยู่บนพื้น — ใช้คัดของออกจากการวัดขนาดแผ่น */
const GROUND_REACH = 1.5

/**
 * แผ่นข้าวหลามตัดที่ฉากยืนอยู่ — วัดจากฉากจริง ไม่ใช่ขนาดที่ตั้งไว้ตายตัว
 *
 * ก่อนหน้านี้แผ่นถูกวาดที่จุดกำเนิดด้วยขนาดคงที่ ส่วนฉากถูกเลื่อนไปทางขวา 4.2 หน่วย
 * แผ่นจึงไม่ได้อยู่ใต้ฉาก — ของล้นออกนอกเส้นขอบทั้งด้านขวาและด้านหน้า ตรงนี้จึงวัดกล่อง
 * ขอบเขตของฉาก (พี่น้องของตัวเองใน group เดียวกัน) หลังทุกอย่างเมานต์แล้ว แล้วขยับ+ย่อ
 * ตัวเองให้ครอบพอดี — ฉากขยับหรือเปลี่ยนขนาดเมื่อไร แผ่นก็ตามไปเอง
 *
 * วัดเฉพาะ XZ: ความสูงของเครนกับฝาจอไม่เกี่ยวกับรอยเท้าบนพื้น
 */
function GroundPlate({ frozen }: { frozen: boolean }) {
  const ref = useRef<THREE.Mesh>(null)

  useEffect(() => {
    // ระหว่างฉากระเบิด ชิ้นส่วนลอยกระจายอยู่ ถ้าวัดตอนนั้นแผ่นจะพองตามชิ้นที่ปลิวไปไกลสุด
    if (frozen) return
    const plate = ref.current
    const parent = plate?.parent
    if (!plate || !parent) return

    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    // ซ่อนแผ่นก่อนวัด ไม่ใช่แค่ข้ามตัวมันในลูป — เส้นขอบของ <Edges> เป็นลูกของแผ่นและเป็น
    // Mesh จริง (fat line) การข้ามแค่ตัวแผ่นจึงยังวัดเส้นขอบติดมาด้วย ผลคือทุกครั้งที่
    // effect ทำงานซ้ำ (หน้า re-render ตอน scroll) แผ่นจะโตขึ้นทีละ PLATE_MARGIN ทบไปเรื่อย ๆ
    plate.visible = false
    parent.traverseVisible((o) => {
      if (!(o as THREE.Mesh).isMesh || o.userData.noBounds) return
      tmp.setFromObject(o)
      if (tmp.isEmpty()) return
      // นับเฉพาะของที่ "แตะพื้น" — แผ่นคือรอยเท้าของฉากบนพื้น ไม่ใช่กล่องครอบทุกอย่าง
      // เสาเครนกับแขนเครนลอยเข้ามาจากนอกเฟรมด้านบน (เริ่มที่ y 6.4) ถ้านับด้วย แผ่นจะ
      // ถูกยืดออกไปทางขวาอีกหลายหน่วยจนล้นกรอบแคนวาส
      if (tmp.min.y > GROUND_REACH) return
      box.union(tmp)
    })
    plate.visible = true
    // ยังไม่มีอะไรวัดได้ (GLB ยังโหลดไม่เสร็จ) — ปล่อยไว้ก่อน รอบหน้าค่อยวัดใหม่
    if (box.isEmpty()) return

    // แผ่นต้องมีฉากอยู่ "กลาง" ทั้งสองแกน — วัดระยะที่ไกลที่สุดจากจุดกึ่งกลางฉากออกไป
    // ทุกทิศ แล้วใช้ค่านั้นเป็นครึ่งด้านของแผ่น ถ้าใช้แค่ความกว้างกล่องขอบเขต ด้านที่สั้นกว่า
    // จะเหลือขอบไม่เท่ากันสองข้าง ฉากเลยดูเบี้ยวไปมุมหนึ่ง
    const cx = (box.min.x + box.max.x) / 2
    const cz = (box.min.z + box.max.z) / 2
    const reach = Math.max(box.max.x - cx, box.max.z - cz)
    // กล่องที่วัดได้เป็นพิกัดโลก แต่แผ่นเป็นลูกของ group ที่ถูกเลื่อน/ย่อไปแล้ว — ต้องแปลง
    // กลับเป็นพิกัดของ group ก่อน ไม่งั้นค่าจะโดนบวกการเลื่อนของ group ซ้ำอีกรอบ
    // (นี่คือเหตุที่แผ่นเยื้องไปทางขวาเท่ากับระยะเลื่อนฉากพอดี)
    const local = parent.worldToLocal(new THREE.Vector3(cx, 0, cz))
    const worldScale = parent.getWorldScale(new THREE.Vector3()).x || 1
    plate.scale.setScalar((reach * 2 * PLATE_MARGIN) / worldScale)
    plate.position.set(local.x, 0, local.z)
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      {/* แผ่นบางเป็นระนาบ ไม่ใช่กล่อง — กล่องให้เส้นขอบสองชั้น (ขอบบนกับขอบล่าง)
          ซึ่งอ่านเป็นเส้นคู่รก ๆ ผิดจากแบบที่เป็นเส้นเดี่ยว
          ขนาด 1×1 แล้วคุมด้วย scale ตอนวัด */}
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.05}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
      <Edges color="#ffffff" transparent opacity={0.55} />
    </mesh>
  )
}

/**
 * ปรับ zoom ของกล้อง orthographic ตามความสูงของแคนวาส
 *
 * กล้อง orthographic ที่ zoom ตายตัวจะให้แผ่นขนาดพิกเซลเท่าเดิมเสมอ พอจอเตี้ยลงแท่นจะล้น
 * ออกนอกกรอบ ผูกกับความสูงแทน แท่นจึงกินสัดส่วนของจอเท่าเดิมทุกขนาด
 */
function Rig({ fit }: { fit: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    // แท่น 2×2 (8 หน่วย) ฉายเป็นข้าวหลามตัดสูงราว 6.5 หน่วย — หาร 8 แล้วมันกินความสูง
    // ของกรอบราว 80% เท่าสัดส่วนในแบบ
    camera.zoom = size.height / fit
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.height, fit, invalidate])

  return null
}

/**
 * วางของให้ "ยืนบนแผ่น" จริง + เปิดเงาให้ทุกชิ้นข้างใน
 *
 * จุดกำเนิดของ GLB ตัวนี้อยู่แถวหัว ไม่ใช่ฝ่าเท้า วางที่ y=0 ตรง ๆ ตัวจะจมอยู่ใต้แผ่นทั้งตัว
 * (มองเห็นอยู่เพราะแผ่นโปร่ง) แทนที่จะฮาร์ดโค้ดตัวเลขยกขึ้นซึ่งจะผิดทันทีที่เปลี่ยน scale
 * ตรงนี้วัดกล่องขอบเขตจริงหลังเมานต์แล้วเลื่อนให้ก้นกล่องแตะ y=0 พอดี
 *
 * castShadow ก็ตั้งที่นี่ด้วยเหตุผลเดียวกัน — ต้องรอให้โมเดลถูก clone เข้ามาเป็นลูกก่อน
 * (onUpdate ของ group ยิงตั้งแต่ตอนใส่ prop ซึ่งเร็วเกินไป)
 */
function OnPlatform({
  children,
  position,
}: {
  children: ReactNode
  position: [number, number, number]
}) {
  const ref = useRef<THREE.Group>(null)
  const snapped = useRef(false)

  useEffect(() => {
    const g = ref.current
    if (!g || snapped.current) return
    const box = new THREE.Box3().setFromObject(g)
    if (box.isEmpty()) return
    // กล่องเป็นพิกัดโลก ต้องแปลงก้นกล่องกลับมาเป็นพิกัดของ parent ก่อน — ตัวที่ยืนบนของที่
    // ยกสูง (เช่นขอบบนฝาจอ) มี parent อยู่สูงจากพื้นแล้ว ถ้าลบด้วยค่าโลกดิบ ๆ มันจะถูก
    // ดันจมลงไปเท่ากับความสูงของ parent พอดี
    const parent = g.parent
    const footLocal = parent ? parent.worldToLocal(new THREE.Vector3(0, box.min.y, 0)).y : box.min.y
    g.position.y += position[1] - footLocal
    snapped.current = true
    g.traverse((o) => {
      o.castShadow = true
    })
  })

  return (
    <group ref={ref} position={position} userData={{ mascot: true }}>
      {children}
    </group>
  )
}

type HeroPlatformProps = {
  className?: string
  /** ระเบิดฉากออกเป็นชิ้น ๆ — สั่งจากช่องแชทในหัวเรื่อง */
  exploded?: boolean
  /** ยิงตอนประกอบฉากกลับครบแล้ว */
  onRestored?: () => void
  /** ของที่จะมาวางบนแท่น — อ้างพิกัดด้วย slot() */
  children?: ReactNode
}

export function HeroPlatform({
  className,
  children,
  exploded = false,
  onRestored,
}: HeroPlatformProps) {
  const cfg = DEFAULT_CFG
  // ตั้งแต่ระเบิดจนประกอบกลับเสร็จถือว่า "ไม่นิ่ง" — ห้ามวัดแผ่นพื้นระหว่างนี้ ไม่งั้นมันจะไป
  // วัดตอนชิ้นส่วนลอยกระจาย แล้วได้ขนาดผิด (ชิ้นที่ลอยสูงถูกกรองออก เหลือแค่ของบนพื้นไม่กี่ชิ้น)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (exploded) setBusy(true)
  }, [exploded])

  return (
    <div className={className} aria-hidden>
      <Canvas
        shadows
        orthographic
        // มุมไอโซจริง: กล้องอยู่ระยะเท่ากันทั้งสามแกน มองกลับมาที่จุดกำเนิด
        camera={{ position: [12, 12, 12], near: -100, far: 100 }}
        // ตัวละครขยับทุกเฟรม (ลมหายใจ + หัวตามเมาส์) frameloop จึงเป็น always ไม่ใช่ demand
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: 'none' }}
      >
        <Rig fit={cfg.fit} />
        {/* แสงอ่อน ๆ ไว้ให้ของที่มาวางทีหลังมีปริมาตร ตัวแผ่นเองใช้ material ที่ไม่รับแสง */}
        <ambientLight intensity={0.8} />
        <directionalLight
          castShadow
          position={[5, 14, 3]}
          intensity={1.2}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-normalBias={0.03}
        />

        <Suspense fallback={null}>
          <group
            position={[cfg.scene.x, 0, cfg.scene.z]}
            rotation={[0, Math.PI * cfg.scene.yaw, 0]}
            scale={cfg.scene.scale}
          >
            {/* ระนาบรับเงาที่มองไม่เห็นตัวเอง — แผ่นของแท่นใช้ material ที่ไม่รับแสง จึงรับเงา
                ไม่ได้ ตัวนี้จึงเป็นตัวรับเงาแทน เห็นเฉพาะเงาที่ตกลงบนมัน
                อยู่ในกลุ่มเดียวกับฉาก ไม่ใช่ที่จุดกำเนิดโลก — ไม่งั้นเงาของของที่อยู่ขอบขวา
                จะตกออกนอกระนาบแล้วหายไป */}
            <mesh
              receiveShadow
              userData={{ noBounds: true }}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.01, 0]}
            >
              <planeGeometry args={[TILE * 6, TILE * 6]} />
              <shadowMaterial transparent opacity={0.28} />
            </mesh>
            <GroundPlate frozen={busy} />
            <HeroShatter
              exploded={exploded}
              onRestored={() => {
                setBusy(false)
                onRestored?.()
              }}
            >
              <HeroScene
                // คนที่ปีนบันไดกับคนที่ยืนบนแท่นเครนต้องเอียง/ห้อยไปกับของพวกนั้น จึงส่งเข้าไป
                // ให้ฉากแขวนเอง ไม่ใช่วางเป็นพิกัดโลกแล้วเดาให้ตรง
                onLadder={<Worker scale={0.34} rotation={[0, Math.PI * 1, 0]} />}
                onCrane={
                  // ยืนบนขอบบนของฝาจอ — OnPlatform วัดกล่องจริงแล้ววางเท้าให้แตะระนาบของ
                  // parent (ซึ่ง HeroScene ตั้งไว้ที่ยอดฝาจอแล้ว) จึงส่ง y = 0
                  <OnPlatform position={[0, 0, 0]}>
                    <Worker scale={0.32} rotation={[0, Math.PI * -0.15, 0]} />
                  </OnPlatform>
                }
              >
                {/* key ผูกกับ scale: การยกให้เท้าแตะพื้นวัดครั้งเดียวตอนเมานต์ พอลากสเกลในแผง
                  ดีบัก ค่าที่วัดไว้ก็ผิดทันที บังคับให้เมานต์ใหม่จึงวัดใหม่ (GLB มาจากแคช) */}
                <OnPlatform key={cfg.mascot.scale} position={[cfg.mascot.x, 0, cfg.mascot.z]}>
                  <Worker
                    scale={cfg.mascot.scale}
                    rotation={[0, Math.PI * cfg.mascot.yaw, 0]}
                  />
                </OnPlatform>

                {/* คนงานที่เหลือตามภาพอ้างอิง — ยืนบนฐานแล็ปท็อปหนึ่ง ข้างซ้ายสอง ขวาหนึ่ง */}
                <OnPlatform position={[-1.5, BASE_H, 0.5]}>
                  <Worker scale={0.34} rotation={[0, Math.PI * 0.55, 0]} />
                </OnPlatform>
                <OnPlatform position={[-4.8, 0, 0.6]}>
                  <Worker scale={0.4} rotation={[0, Math.PI * 0.15, 0]} />
                </OnPlatform>
                <OnPlatform position={[7.4, 0, 3.4]}>
                  <Worker scale={0.4} rotation={[0, Math.PI * -0.3, 0]} />
                </OnPlatform>

                {children}
              </HeroScene>
            </HeroShatter>
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}
