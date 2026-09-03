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
const BOX1 = new THREE.Box3()
const SCL = new THREE.Vector3()
const TOP = new THREE.Vector3()

export function Rider({
  bob = true,
  breathe = false,
  idleAmp = 1,
  idleSpeed = 1,
  mascotScale = 0.5,
  mascotLift = 0,
  boardScale = 1,
  armScale = 1,
  foreScale = 1,
  armPose = null,
  rimPower = 4.2,
  rimBoost = 0.5,
  rimEdge = 0,
  rimSoft = 0.1,
  rimDirMix = 0,
  rimYaw = 160,
  rimPitch = 35,
  flatBands = 0,
  legPose = null,
  torsoPose = null,
  facePose = null,
  /** หัวหันตามเมาส์ — ทับค่าจาก leva ของ Mascot (null = ใช้ค่าเดิม) */
  followOverride = null,
  boardSpec = null,
  boardRot = [0, 0.26, 0],
  boardOffset = [0, 0, 0],
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
  const specKey = `${JSON.stringify(boardSpec)}|${boardScale}|${mascotScale}|${boardOffset.join()}`
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
      /**
       * รวมกล่องจาก "เมชที่มองเห็นเท่านั้น" และคิดในพิกัดโลกตลอด
       *
       * Box3.setFromObject ไล่ลูกทุกตัวรวมถึงตัวที่ visible = false (แก้วที่ซ่อนด้วย
       * noMug ก็ยังนับ) และคืนกล่องในพิกัดโลก การเอาเลขพิกัดโลกไปตั้งเป็นพิกัด
       * ท้องถิ่นของลูกคือที่มาของบั๊กสเกลซ้ำรอบก่อน — คราวนี้จึงคิดในโลกให้จบ
       * แล้วค่อยแปลงเฉพาะตอนเขียนกลับลง position
       */
      const box = new THREE.Box3()
      body.current.traverseVisible((o) => {
        if (!o.isMesh) return
        BOX1.setFromObject(o)
        box.union(BOX1)
      })
      if (box.isEmpty() || !Number.isFinite(box.min.y)) return

      sway.current.updateWorldMatrix(true, false)
      /** สเกลรวมของกลุ่มแม่ — ใช้แปลงระยะในโลกกลับเป็นระยะท้องถิ่น */
      const pScale = SCL.setFromMatrixScale(sway.current.matrixWorld).y || 1
      const sizeY = (box.max.y - box.min.y) / pScale

      /**
       * ความยาวบอร์ดคิดจาก "ความสูงตัว" ไม่ใช่ความกว้างของกล่องขอบเขต
       *
       * ความกว้างของกล่องขึ้นกับท่าแขน — กางแขนเป็น T แล้วกล่องกว้างเท่าช่วงแขน
       * บอร์ดจะยาวตามไปด้วยทั้งที่เท้าไม่ได้ขยับ ความสูงตัวนิ่งกว่ามากในทุกท่า
       */
      board.current.scale.setScalar(sizeY * 0.62 * boardScale)

      /**
       * เลื่อนบอร์ดจาก "ตำแหน่งหน้าแผ่นที่เรนเดอร์จริง" ไม่ใช่จากสูตร
       *
       * รอบก่อนคำนวณระยะยกด้วย deckTop × scale แล้วเชื่อว่าถูก — ซึ่งพลาดทุกครั้งที่
       * กลุ่มแม่มีสเกล/การหมุนเพิ่มเข้ามา วิธีนี้ยิงจุดบนหน้าแผ่นผ่าน matrixWorld
       * ออกมาเป็นพิกัดโลกจริง แล้วขยับส่วนต่างกับฝ่าเท้า — ผิดสมมติฐานตรงไหนก็ยังตรง
       */
      board.current.position.set(boardOffset[0], board.current.position.y, boardOffset[2])
      board.current.updateWorldMatrix(true, false)
      const deckWorldY = TOP.set(0, deckTop(boardSpec ?? undefined), 0)
        .applyMatrix4(board.current.matrixWorld).y
      /**
       * ออฟเซ็ตแนวตั้งเป็น "เป้าหมาย" ของการจัดวาง ไม่ใช่ค่าที่บวกทีหลัง
       *
       * ถ้าบวกทีหลัง รอบวัดถัดไปจะเห็นออฟเซ็ตนั้นเป็นความคลาดแล้วหักล้างมันทิ้ง
       * ปุ่มก็จะขยับไม่ได้เลย — ต้องเลื่อนเป้าหมายไปแทน
       */
      board.current.position.y += (box.min.y - deckWorldY) / pScale + boardOffset[1]

      READOUT.sole = box.min.y
      READOUT.deck = deckWorldY
      READOUT.gap = box.min.y - deckWorldY
      fitted.current = specKey
      settle.current += 1
    }
    // ส่งตำแหน่งจริงในโลกให้แผง debug อ่าน — ค่านี้รวมผลของกลุ่มแม่ทุกชั้นแล้ว
    if (body.current) body.current.getWorldPosition(WORLD).toArray().forEach((v, i) => {
      READOUT[['x', 'y', 'z'][i]] = v
    })
    const g = sway.current
    if (!g) return
    if (!bob) {
      // ปิดไหว = คืนกลุ่มกลับท่านิ่งด้วย ไม่ใช่แค่หยุดเขียนค่าแล้วค้างที่เฟรมสุดท้าย
      g.position.y = 0
      g.rotation.set(0, 0, 0)
      return
    }
    /**
     * idle อยู่ที่กลุ่ม sway ซึ่งห่อทั้งตัวละครและบอร์ด — ทั้งคู่จึงขยับเป็นก้อนเดียว
     *
     * ถ้าไปใส่ไหวที่ข้อต่อของ rig แทน (poseIdle) เท้าจะขยับแต่บอร์ดไม่ตาม เพราะบอร์ด
     * ถูกจัดตำแหน่งครั้งเดียวตอนวัด ไม่ได้เกาะกระดูกเท้า — ฝ่าเท้าจะไถหลุดออกจากแผ่น
     * ต้องการไหวระดับข้อต่อจริง ๆ ค่อยเปิด `breathe` แยก (แลกกับการที่เท้าไม่แนบนิ่ง)
     */
    const t = clock.elapsedTime * idleSpeed
    const a = idleAmp
    g.position.y = Math.sin(t * 1.1) * 0.05 * a
    g.rotation.z = Math.sin(t * 0.73 + 0.6) * 0.04 * a
    g.rotation.x = Math.sin(t * 0.86 + 2.1) * 0.03 * a
    // ส่ายตามการเลี้ยว ช้ากว่าจังหวะยุบ — รวมกันแล้วไม่วนซ้ำให้ตาจับ
    g.rotation.y = Math.sin(t * 0.41 + 1.4) * 0.05 * a
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
              rimPower={rimPower}
              rimBoost={rimBoost}
              rimEdge={rimEdge}
              rimSoft={rimSoft}
              rimDirMix={rimDirMix}
              rimYaw={rimYaw}
              rimPitch={rimPitch}
              flatBands={flatBands}
              armScale={armScale}
              foreScale={foreScale}
              armPose={armPose}
              legPose={legPose}
              torsoPose={torsoPose}
              facePose={facePose}
              followOverride={followOverride}
              poseIdle={breathe}
            />
          </Suspense>
        </group>
      </group>
    </group>
  )
}
