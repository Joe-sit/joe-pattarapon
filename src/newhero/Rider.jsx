import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Mascot } from '@/joespresso/scene/Mascot'
import { READOUT } from './tuner'
import { deckTop, Skateboard } from './Skateboard'

/**
 * ตัวละครบนสเก็ตบอร์ด — ใช้ mascot ตัวเดิมของเว็บ ไม่ปั้นตัวละครใหม่
 *
 * ตัวละครของเว็บมีอยู่แล้วและถูกใช้ในหน้าอื่น การปั้นตัวใหม่ตามภาพ ref แปลว่าเว็บจะมี
 * ตัวละครสองตัวที่ต้องดูแลคู่กันและมีโอกาสเพี้ยนออกจากกัน — ยืมท่ายืนของตัวเดิมมาวางบนบอร์ด
 *
 * ท่า: ใช้ prop `skate` ของ rig เอง (ย่อเข่าลึก บิดสะโพกออกข้าง ชูแขนข้างหนึ่ง)
 * ไม่ใช้ `skydive` เพราะนั่นเป็นท่านอนคว่ำที่ทำไว้ให้ฉาก tunnel วางบนบอร์ดแล้วอ่านเป็นนอนราบ
 *
 * หน่วย: ฐานบอร์ดอยู่ที่ y = 0 วางบนถนน/พื้นได้ตรง ๆ
 */

/** เวกเตอร์ใช้ซ้ำ — สร้างใหม่ทุกเฟรมคือขยะให้ GC เก็บ 60 ครั้งต่อวินาที */
const WORLD = new THREE.Vector3()
const INV = new THREE.Matrix4()
const BOX1 = new THREE.Box3()

export function Rider({
  bob = true,
  mascotScale = 0.5,
  mascotLift = 0,
  boardScale = 1,
  armScale = 1,
  foreScale = 1,
  armPose = null,
  legPose = null,
  torsoPose = null,
  boardSpec = null,
  boardRot = [0, 0.26, 0],
  ...props
}) {
  const sway = useRef()
  const body = useRef()
  const board = useRef()
  const fitted = useRef(null)
  /** นับเฟรมหลังกุญแจเปลี่ยน — ยังวัดซ้ำอยู่จนกว่าโมเดลจะขึ้นครบ */
  const settle = useRef(0)
  /**
   * กุญแจของการวัด — อะไรก็ตามที่ทำให้ผลการวัดเปลี่ยนต้องอยู่ในนี้
   *
   * เดิมใช้ธง boolean วัดครั้งเดียวจบ ผลคือลาก boardScale/mascotScale แล้วไม่มีอะไร
   * ขยับจนกว่าจะรีเฟรช — เพราะโค้ดวัดไม่เคยถูกเรียกอีกเลย
   */
  const specKey = `${JSON.stringify(boardSpec)}|${boardScale}|${mascotScale}`
  /**
   * วางบอร์ดจากกล่องขอบเขตจริงของ mascot ไม่ใช่จากตัวเลขที่เดา
   *
   * mascot โหลดแบบ async และมีจุดกำเนิดไม่ได้อยู่ที่ฝ่าเท้า ถ้าใส่ตำแหน่งบอร์ดตายตัว
   * มันจะไปลอยอยู่แถวหัวหรือจมใต้พื้น (และเพี้ยนอีกทุกครั้งที่เปลี่ยน mascotScale)
   * วัดกล่องหลังโหลดเสร็จครั้งเดียวแล้วเลื่อนบอร์ดไปที่ฝ่าเท้า พร้อมขยายให้ยาวกว่าตัว
   */
  useFrame(({ clock }) => {
    /**
     * วัดซ้ำสักพักหลังกุญแจเปลี่ยน ไม่ใช่วัดครั้งเดียวจบ
     *
     * mascot ขึ้นทีละส่วน เฟรมแรกที่ body มีลูกแล้วอาจมีแค่ลำตัว ยังไม่มีขา
     * กล่องขอบเขตรอบนั้นจึงสั้นกว่าจริง แล้วบอร์ดไปเกาะอยู่ระดับเอวค้างอยู่อย่างนั้น
     */
    if (fitted.current !== specKey) settle.current = 0
    if (settle.current < 45 && sway.current && body.current && board.current && body.current.children.length) {
      /**
       * แปลงกล่องกลับเข้าพิกัดของกลุ่มที่บอร์ดอยู่ ก่อนเอาไปใช้
       *
       * setFromObject คืนกล่องใน "พิกัดโลก" ซึ่งรวมสเกลของกลุ่มแม่ทุกชั้นมาแล้ว
       * (skaterScale × mascotScale × ...) เอาตัวเลขนั้นไปตั้งเป็น scale/position
       * ของลูกในกลุ่มเดียวกัน = คูณสเกลซ้ำอีกรอบ บอร์ดเลยใหญ่จนหลุดเฟรมไปเลย
       */
      /**
       * รวมกล่องจาก "เมชที่มองเห็นเท่านั้น"
       *
       * Box3.setFromObject ไล่ลูกทุกตัวรวมถึงตัวที่ visible = false ด้วย — แก้วกาแฟ
       * ที่ถูกซ่อนด้วย noMug ก็ยังนับ กล่องเลยยื่นต่ำกว่าฝ่าเท้าจริง บอร์ดจึงไปเกาะ
       * ระดับนั้นแล้วดูเหมือนลอยห่างจากเท้า
       */
      const box = new THREE.Box3()
      let lowName = ''
      let lowY = Infinity
      body.current.traverseVisible((o) => {
        if (!o.isMesh) return
        BOX1.setFromObject(o)
        box.union(BOX1)
        if (BOX1.min.y < lowY) {
          lowY = BOX1.min.y
          lowName = o.name || o.type
        }
      })
      READOUT.low = lowName
      if (box.isEmpty()) return
      sway.current.updateWorldMatrix(true, false)
      box.applyMatrix4(INV.copy(sway.current.matrixWorld).invert())
      if (Number.isFinite(box.min.y)) {
        const size = new THREE.Vector3()
        box.getSize(size)
        /**
         * ความยาวบอร์ดคิดจาก "ความสูงตัว" ไม่ใช่ความกว้างของกล่องขอบเขต
         *
         * ความกว้างของกล่องขึ้นกับท่าแขน — กางแขนเป็น T แล้วกล่องกว้างเท่าช่วงแขน
         * บอร์ดจะยาวตามไปด้วยทั้งที่เท้าไม่ได้ขยับ ความสูงตัวนิ่งกว่ามากในทุกท่า
         * (สเก็ตบอร์ดจริงยาวราวครึ่งหนึ่งของความสูงคนขี่ — 0.62 เผื่อไว้ให้ปรับต่อ)
         */
        const s = size.y * 0.62 * boardScale
        /**
         * จัดให้ "หน้าแผ่น" มาอยู่ที่ฝ่าเท้า ไม่ใช่เอาล้อไปแตะฝ่าเท้า
         *
         * ล้อของ Skateboard แตะ y = 0 ของตัวมันเอง ถ้าวางที่ box.min.y ตรง ๆ หน้าแผ่น
         * จะสูงกว่าฝ่าเท้าเท่ากับความหนาของทรัค+ล้อ เท้าเลยจมเข้าไปในแผ่น
         */
        const top = deckTop(boardSpec ?? undefined) * s
        board.current.position.set(0, box.min.y - top, 0)
        // ส่งตัวเลขให้แผง debug: ระดับฝ่าเท้า / ระดับหน้าแผ่น / ช่องว่างระหว่างสอง
        // วัดบอร์ดจริงหลังจัดวาง แทนการเชื่อสูตร — ตัวเลขต้องมาจากของที่เรนเดอร์จริง
        board.current.updateWorldMatrix(true, true)
        const bb = new THREE.Box3()
        board.current.traverseVisible((o) => {
          if (!o.isMesh) return
          BOX1.setFromObject(o)
          bb.union(BOX1)
        })
        bb.applyMatrix4(INV.copy(sway.current.matrixWorld).invert())
        READOUT.sole = box.min.y
        READOUT.deck = bb.max.y
        READOUT.gap = READOUT.sole - READOUT.deck
        board.current.scale.setScalar(s)
        fitted.current = specKey
        settle.current += 1
      }
    }
    // ส่งตำแหน่งจริงในโลกให้แผง debug อ่าน — ค่านี้รวมผลของกลุ่มแม่ทุกชั้นแล้ว
    if (body.current) body.current.getWorldPosition(WORLD).toArray().forEach((v, i) => {
      READOUT[['x', 'y', 'z'][i]] = v
    })
    const g = sway.current
    if (!g || !bob) return
    const t = clock.elapsedTime
    // เลี้ยงตัวบนบอร์ด: ยุบขึ้นลง + เอียงข้าง คนละความถี่ ไม่ให้อ่านเป็นจังหวะเดียว
    g.position.y = Math.sin(t * 1.1) * 0.05
    g.rotation.z = Math.sin(t * 0.73 + 0.6) * 0.04
    g.rotation.x = Math.sin(t * 0.86 + 2.1) * 0.03
  })

  return (
    <group {...props}>
      <group ref={sway}>
        {/* บอร์ดจริง: แผ่น + กริป + ทรัค + ล้อ (ดู Skateboard.jsx) */}
        <group ref={board} rotation={boardRot}>
          <Skateboard spec={boardSpec ?? undefined} />
        </group>

        {/* เอียงตัวไปทางที่บอร์ดวิ่ง + บิดลำตัวเข้าหากล้อง = ท่าเลี้ยงตัว */}
        <group ref={body} position={[0, mascotLift, 0]} rotation={[0.06, -0.35, -0.12]}>
          <Suspense fallback={null}>
            <Mascot
              scale={mascotScale}
              isolated
              noIdle
              noMug
              skate
              armScale={armScale}
              foreScale={foreScale}
              armPose={armPose}
              legPose={legPose}
              torsoPose={torsoPose}
            />
          </Suspense>
        </group>
      </group>
    </group>
  )
}
