import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTuner } from './tuner'
import { ridePose } from './ridePose'

/**
 * รอยเงาท้ายตัวละคร — ซิลูเอตต์ของ *ตัวจริง* ซ้อนไล่สีไปตามทางที่วิ่งมา
 *
 * แบบที่อ้างอิง (githubuniverse.com) คือตัวละครทิ้งเงาตัวเองไว้เป็นชุด แต่ละใบสีทึบต่างกัน
 * เหมือนเฟรมฟิล์มที่ยังไม่ลบ — สิ่งที่ทำให้มันอ่านว่าเป็น "เงาของตัวนี้" คือรูปร่างที่ตรงกับ
 * ตัวจริงทุกเส้น จะปั้นรูปทรงเลียนขึ้นมาไม่ได้
 *
 * จึงถ่ายซิลูเอตต์จริงลง render target: เรนเดอร์เฉพาะกิ่งของตัวละครด้วยกล้องออร์โธที่กรอบ
 * พอดีทรงกลมครอบตัว แล้วใช้ **แชนเนลอัลฟา** ของภาพนั้นเป็นหน้ากาก ส่วนสีมาจากยูนิฟอร์ม
 * (ไม่ได้ใช้สี RGB ของภาพ — ถ้าใช้ จะได้ตัวละครสีเดิมซ้อนกันหลายตัว ไม่ใช่เงาสีทึบ)
 *
 * ทำแบบนี้จ่ายค่าวาดริกเพิ่ม *หนึ่ง* รอบต่อการรีเฟรช ต่างจากทางตรง ๆ (mount ตัวละครซ้ำ
 * หกตัวที่ตำแหน่งย้อนหลัง) ที่จ่ายหกรอบทุกเฟรม
 *
 * เงาวางเรียง "ถอยหลังตามทิศที่กำลังไป" ไม่ใช่ตามหมุดของทางที่วิ่งมาจริง
 *
 * ลองแบบหมุดทางมาแล้วและมันใช้ไม่ได้ที่นี่: ตัวละครไถลออกจากพอร์ทัลแล้ว *จอด* ระยะทาง
 * ที่มันเดินได้ทั้งฉากคือราวหนึ่งหน่วยครึ่ง (วัดจาก ridePose.wx: 11.84 → 13.26) หมุดทุกใบ
 * จึงกองอยู่จุดเดียวกัน เห็นเป็นก้อนสีเลอะรอบตัว ไม่ใช่เงาที่ไล่กันไป
 *
 * จึงคิดจากทิศทางที่วิ่ง (กรองให้นิ่ง) เป็นแนวเรียงเงา ส่วนความเร็วเป็นตัว *เพิ่ม* ความยืด
 * ไม่ใช่ตัวเปิด-ปิด: etHold คือสัดส่วนที่ยังค้างอยู่ตอนตัวละครจอด — ตั้ง 1 แล้วชั้นเงาซ้อนกัน
 * อยู่ครบทั้งตอนไถลและตอนอยู่ท่าสุดท้าย (เป็นองค์ประกอบของภาพ ไม่ใช่เอฟเฟกต์ชั่วขณะ)
 */

/**
 * กรอบภาพซิลูเอตต์
 *
 * 256 ไม่พอ: เงาถูกวาดกลับที่ราว 300-400 พิกเซลบนจอ และกรอบยังเผื่อขอบอีก 35% เนื้อจริง
 * จึงเหลือไม่ถึงครึ่งของภาพ — ขยายกลับแล้วเห็นขั้นบันไดที่ขอบชัด
 *
 * 512 ก็ยังไม่พอตอนกรอบกินทั้งริก: วัดจากแผงตรวจแล้วเนื้อในหน้ากากได้แค่ 8.6% ของภาพ
 * (กล่องครอบไล่ทุกเมชในกิ่ง รวมบอร์ดและของที่ซ่อนอยู่ รัศมีออกมา ~8 หน่วยทั้งที่ตัวคนสูง
 * ไม่ถึงสองหน่วย) ตัวคนจึงกินภาพจริงแค่ราว 150px แล้วถูกขยายขึ้นสามเท่าตอนวาด = หยัก
 * แก้สองทางคู่กัน: กรอบพอดี *ตัวคน* (ดู fitBox/echoBody) และเพิ่มความละเอียดเป็น 1024
 * ถ่ายทุกสามเฟรมอยู่แล้ว ค่าใช้จ่ายที่เพิ่มจึงเป็นหลักหนึ่งในสามของหนึ่ง draw call
 */
const RT_SIZE = 1024

/** ถ่ายซิลูเอตต์ใหม่ทุกกี่เฟรม — ท่าเปลี่ยนช้ากว่านั้นมาก ถ่ายทุกเฟรมคือจ่ายค่าฟรี */
const REFRESH_EVERY = 3

/** วัดกล่องครอบตัวใหม่ทุกกี่เฟรม — setFromObject ไล่ทุกเมชในริก ไม่ใช่ของถูก */
const BOX_EVERY = 15

/**
 * จังหวะโผล่ — ทีละใบ ไม่ใช่ทั้งชุดพร้อมกัน
 *
 * ถอดจากของจริงที่ githubuniverse.com (ยิงภาพช่วงโหลดทุก 120ms แล้วนับพื้นที่สีสด):
 * พื้นที่สีเพิ่มขึ้นเป็นขั้น ๆ ตั้งแต่เฟรมที่ ~0.5 วิ ถึง ~1.2 วิ แล้วค่อยลดลงนิ่งที่ค่าสุดท้าย
 * ดูภาพรายเฟรม: 0.6 วิ มีเงาใบเดียว (สีมัสตาร์ดหลังตัว) · 0.85 วิ มีสามใบ และทั้งสามยัง
 * *ใหญ่และสูงกว่าที่สุดท้ายมันไปอยู่* · หลังจากนั้นทั้งพวงหุบลงเข้าที่
 *
 * แปลว่ากลไกคือ: ใบที่ติดตัวมาก่อน ไล่ออกไปทางหางทีละใบ (POP_STEP) แต่ละใบพุ่งเลยสล็อต
 * ของตัวเองไปนิดแล้วผ่อนกลับ (easeOutBack) พร้อมหุบขนาดจากใหญ่กว่าจริงเล็กน้อย
 * ไม่ใช่การไล่ความจางของทั้งชุดพร้อมกันอย่างที่ทำไว้รอบก่อน
 */
const POP_STEP = 0.09
const POP_RISE = 0.34

/**
 * ผ่อนแบบเลยเป้าแล้วกลับ — ค่าพุ่งเกิน 1 ช่วงกลางทาง
 *
 * ตัวเลข 1.35 คือความแรงที่เลยเป้า เทียบกับภาพของ githubuniverse ที่ใบใหม่โผล่ออกมา
 * เกินตำแหน่งสุดท้ายแล้วหุบกลับ ถ้าใช้ ease ธรรมดาการโผล่จะอ่านเป็น "จางเข้ามา" ไม่ใช่
 * "ถูกสลัดออกมา" ซึ่งเป็นคนละความรู้สึกกัน
 */
function easeOutBack(x) {
  const c = 1.35
  const u = x - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

/** จำนวนเงามากสุดที่เตรียมของไว้ — สไลเดอร์ลดลงได้ แต่ไม่ต้องปั้นของใหม่ */
const MAX_ECHO = 10

/**
 * สีเงา — สีทึบไล่โทนไม่ซ้ำอย่างในแบบ แต่ *เรียงเป็นวงสี* ไม่ใช่สุ่มสลับ
 *
 * ชุดก่อนเป็นสีสวยทีละใบแต่วางสลับกันไปมา (ม่วง → ชมพู → น้ำตาล → น้ำเงิน) ซ้อนกันแล้ว
 * อ่านเป็นเศษสีคนละพวก ไม่ใช่รอยของสิ่งเดียวที่เคลื่อนผ่าน เรียงตามเฉดต่อเนื่องแทน
 * (ม่วง → น้ำเงิน → ฟ้า → เขียว → เหลือง → ส้ม → ชมพู) ตาจึงกวาดไปตามลำดับได้
 *
 * ดัชนี 0 = ใบที่ติดตัวจริงสุด ไล่ออกไปทางหาง
 */
const ECHO_COLORS = [
  '#6c4ff0',
  '#3f6ff2',
  '#2ea8e6',
  '#37c9a8',
  '#7fd657',
  '#ddc63a',
  '#f0963a',
  '#ef6a6a',
  '#e8558f',
  '#b95fd8',
]

const HEAD = new THREE.Vector3()
const DIR = new THREE.Vector3()
const TMP = new THREE.Vector3()
const CENTER = new THREE.Vector3()
const CAM_DIR = new THREE.Vector3()
const CAM_Q = new THREE.Quaternion()
/** ระยะจาก ridePose ถึงกลางภาพที่ถ่ายมา (กรองให้นิ่ง — ดูจุดใช้งาน) */
const OFF = new THREE.Vector3()
const OFF_SM = new THREE.Vector3()
/** ครึ่งขนาดของกล่องครอบตัว — ใช้หาว่าต้องถอยแผ่นเงาไปหลังตัวเท่าไร */
const BOX_HALF = new THREE.Vector3()
/**
 * วัสดุแบนสำหรับตอนถ่ายซิลูเอตต์ — ขาวทึบ ไม่รับแสง ไม่โปร่ง
 *
 * ต้องสลับวัสดุจริงตอนถ่าย ไม่ใช่ใช้อัลฟาของวัสดุเดิม: ริกใช้เชดเดอร์ของตัวเอง (rim light,
 * flatBands) และมีชิ้นโปร่ง (ผม/เสื้อ) อัลฟาที่ออกมาจึงไม่เท่า 1 ทั้งตัว หน้ากากที่ได้เลย
 * เป็นรูปปะ ๆ ขาดเป็นริ้ว — ซึ่งคือเหตุที่เงาชุดก่อนดูเลอะ
 *
 * overrideMaterial ของ three ใช้ได้เฉพาะเมื่อรากที่ส่งไปเป็น Scene ที่นี่ส่งเป็นกิ่งของริก
 * (ย้ายกิ่งไปเข้า Scene ชั่วคราวไม่ได้ Entrance กำลังขยับกิ่งนั้นอยู่) จึงสลับทีละเมชแล้วคืน
 * — ไม่กี่สิบการกำหนดค่าต่อการถ่ายหนึ่งครั้ง ถูกกว่าค่าวาดหนึ่ง draw call
 */
const FLAT = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  toneMapped: false,
  side: THREE.DoubleSide,
})
const BOX_ONE = new THREE.Box3()

/**
 * กล่องครอบที่นับเฉพาะเมชที่ *มองเห็นอยู่จริง*
 *
 * Box3.setFromObject ไล่ลูกทุกตัวไม่สนว่าถูกซ่อนไว้ — ริกนี้มีชิ้นที่ปิดไว้ตามท่า (แก้ว ของถือ)
 * กล่องจึงบานออกกว่าตัวจริงหลายเท่า กรอบภาพเลยกว้างเกินและตัวคนเหลือเนื้อไม่ถึง 10% ของภาพ
 * traverseVisible ตัดกิ่งที่ซ่อนทั้งกิ่งออกให้ ใช้กับกิ่งเดียว (ตัวคน) ราคาเท่าเดิม
 */
function fitBox(root, out) {
  out.makeEmpty()
  root.updateWorldMatrix(true, true)
  root.traverseVisible((o) => {
    const g = o.geometry
    if (!g) return
    if (!g.boundingBox) g.computeBoundingBox()
    BOX_ONE.copy(g.boundingBox).applyMatrix4(o.matrixWorld)
    out.union(BOX_ONE)
  })
}

const PAR_Q = new THREE.Quaternion()
const PAR_S = new THREE.Vector3()
const PAR_P = new THREE.Vector3()

/**
 * แผงตรวจรอยเงา (dev) — ดู "ภาพที่ถ่ายมาจริง" กับตัวเลขที่กำหนดรูปของรอย
 *
 * ของที่ต้องตรวจคือหน้ากากใน render target ซึ่งมองจากในฉากไม่เห็น (มันไม่ได้ถูกวาดลงจอ
 * ตรง ๆ เลย ถูกใช้เป็นหน้ากากของแผ่นเงาอีกที) แผ่นแปะในฉากแบบเดิมบังภาพและอ่านไม่ออกว่า
 * ขอบคมหรือเลอะ จึงอ่านพิกเซลกลับมาวาดลงผ้าใบ DOM ที่ขนาดเต็มแล้วย่อด้วย CSS
 *
 * อ่านพิกเซลกลับจาก GPU เป็นงานหยุดไปป์ไลน์ — ทำเฉพาะโหมดตรวจ และทุก READ_EVERY เฟรม
 */
const DBG_READ_EVERY = 8

function useEchoDebug({ gl, rt, state }) {
  const out = useRef(null)

  /**
   * เปิด/ปิดแผงจากในลูปเฟรม ไม่ผูกกับ re-render
   *
   * แผงจูนยก state ของตัวเอง ฉากไม่ได้วาดใหม่ — ถ้าอ่านสไลเดอร์ตอน render แผงจะไม่โผล่
   * จนกว่าอย่างอื่นจะบังคับให้ re-render (บั๊กแบบเดียวกับที่เจอในสไลเดอร์ขนาดบานพอร์ทัล)
   */
  const build = () => {
    const box = document.createElement('div')
    box.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:60;display:grid;gap:6px;padding:8px;' +
      'border-radius:10px;background:#0b1418ee;color:#d8f4ff;font:11px/1.5 ui-monospace,monospace;' +
      'box-shadow:0 6px 24px #0008;pointer-events:none'
    const shot = document.createElement('canvas')
    shot.width = RT_SIZE
    shot.height = RT_SIZE
    shot.style.cssText =
      'width:180px;height:180px;border-radius:6px;background:' +
      // ตาหมากรุกอ่อน ๆ ข้างหลัง จะได้เห็นว่าส่วนใสเป็นใสจริง ไม่ใช่ดำ
      'repeating-conic-gradient(#22323a 0% 25%, #16242a 0% 50%) 0 0/16px 16px'
    const txt = document.createElement('div')
    box.append(shot, txt)
    document.body.append(box)
    out.current = {
      ctx: shot.getContext('2d'),
      txt,
      buf: new Uint8Array(RT_SIZE * RT_SIZE * 4),
      box,
    }
  }

  const tear = () => {
    out.current?.box.remove()
    out.current = null
  }

  useEffect(() => tear, [])

  useFrame(() => {
    const want = import.meta.env.DEV && getTuner().etDbg > 0.5
    if (want && !out.current) build()
    if (!want && out.current) tear()
    const o = out.current
    if (!o) return
    const s = state.current
    o.frames = (o.frames || 0) + 1
    if (o.frames % DBG_READ_EVERY === 1) {
      gl.readRenderTargetPixels(rt, 0, 0, RT_SIZE, RT_SIZE, o.buf)
      const img = o.ctx.createImageData(RT_SIZE, RT_SIZE)
      // พิกัดของ GL นับจากล่างขึ้นบน ผ้าใบนับจากบนลงล่าง — ไม่พลิกแล้วภาพกลับหัว
      for (let y = 0; y < RT_SIZE; y += 1) {
        const src = (RT_SIZE - 1 - y) * RT_SIZE * 4
        const dst = y * RT_SIZE * 4
        img.data.set(o.buf.subarray(src, src + RT_SIZE * 4), dst)
      }
      o.ctx.putImageData(img, 0, 0)
      /** สัดส่วนพิกเซลที่เป็นเนื้อ — บอกได้ทันทีว่าหน้ากากหาย (0%) หรือเต็มกรอบ (>70%) */
      let ink = 0
      for (let i = 3; i < o.buf.length; i += 4) if (o.buf[i] > 127) ink += 1
      o.ink = ((ink / (RT_SIZE * RT_SIZE)) * 100).toFixed(1)
    }
    if (o.frames % 6 !== 1) return
    const t = getTuner()
    o.txt.textContent =
      `เนื้อในหน้ากาก ${o.ink ?? '?'}% (ภาพ ${RT_SIZE}px + มิปแมป)\n` +
      `ความเร็ว ${s.speed.toFixed(2)} หน่วย/วิ → ยืด ${(s.push * 100).toFixed(0)}% ` +
      `(เต็มที่ ${t.etSpeed}, ค้างตอนจอด ${t.etHold})\n` +
      `กว้างตัว ${s.size.toFixed(2)} → ใบแรกถอย ${(t.etStep * s.size * s.push).toFixed(2)} หน่วย ` +
      `(ใบถัดไป × i^0.8)\n` +
      `ไถล ${(ridePose.p * 100).toFixed(0)}% → โผล่ ${(s.gate * 100).toFixed(0)}% ` +
      `(ทีละใบ ห่าง ${POP_STEP}s ขึ้นใบละ ${POP_RISE}s)\n` +
      `ทิศ [${s.dir.x.toFixed(2)}, ${s.dir.y.toFixed(2)}, ${s.dir.z.toFixed(2)}] · ` +
      `ใบ ${Math.round(t.etCount)} · ฟุ้ง ${t.etSoft} · จาง ${t.etFade}`
    o.txt.style.whiteSpace = 'pre'
  })
}

export function EchoTrail() {
  const { gl, scene, camera, invalidate } = useThree()

  /** กิ่งของตัวละคร — ติดธงไว้ที่ Rider (userData.rider) จะได้ไม่ต้องผูกกับชื่อคอมโพเนนต์ */
  const rider = useRef(null)
  /**
   * กิ่งที่ถ่ายจริง — เฉพาะ *ตัวคน* (userData.echoBody) ไม่รวมบอร์ด
   *
   * บอร์ดยาวกว่าตัวคนและเอียงอยู่ กล่องครอบที่รวมบอร์ดจึงกว้างเกือบเท่าตัวสองเท่า กรอบภาพ
   * เลยต้องซูมออกและตัวคนเหลือเนื้อไม่กี่สิบพิกเซล ตัดบอร์ดออกได้ทั้งความละเอียดและรูปที่
   * อ่านง่ายกว่า — แบบที่อ้างอิงก็เป็นเงาของคน ไม่ใช่เงาของคนบวกอุปกรณ์
   */
  const subject = useRef(null)
  /**
   * กลุ่มของเงา — ต้องถือไว้เพราะทางที่เก็บเป็น *พิกัดโลก* แต่ mesh กินพิกัดของกลุ่มแม่
   *
   * กลุ่มที่เอฟเฟกต์นี้ถูกแขวนไว้มีทั้งการเลื่อน หมุน และสเกลของแถบฉาก ยัดพิกัดโลกลงไป
   * ตรง ๆ เงาจะไปโผล่คนละที่กับตัวละคร (และเอียงตามกลุ่มแม่ด้วย)
   */
  const grp = useRef(null)

  const rt = useMemo(
    () =>
      new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
        depthBuffer: true,
        stencilBuffer: false,
        /**
         * มิปแมป ไม่ใช่ MSAA — เพราะรอยเงาไม่ได้ต้องการขอบคม มันต้องการ *ความฟุ้ง*
         *
         * ระดับมิปแต่ละชั้นคือภาพเดิมที่ถูกเกลี่ยลงครึ่งหนึ่ง สุ่มอ่านชั้นลึก ๆ (textureLod)
         * จึงได้สนามเบลอกว้างด้วยการอ่านสองครั้ง เทียบกับการวนสุ่มจานหลายสิบจุดต่อพิกเซล
         * ที่ทั้งแพงและยังเห็นลายจุดตอนรัศมีกว้าง MSAA ไม่จำเป็นแล้วเพราะการเกลี่ยกินขั้น
         * บันไดที่ขอบไปหมด
         */
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      }),
    [],
  )
  /** กล้องถ่ายซิลูเอตต์ — ออร์โธ เพราะกรอบต้องพอดีตัวเสมอไม่ว่าตัวจะอยู่ไกลแค่ไหน */
  const shotCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200), [])

  /**
   * วัสดุของเงาแต่ละใบ — สนามฟุ้งจากมิปแมป ซ้อนแบบคูณอัลฟาไว้ล่วงหน้า (premultiplied)
   *
   * แบบก่อนตัดขอบหน้ากากให้คม เงาจึงเป็นแผ่นสีทึบวางทับกัน ตรงที่ซ้อนกันเห็นเป็นสีของใบบน
   * ใบเดียว ไม่ใช่สีที่ผสมกัน — ที่ต้องการคือสีกลืนเข้าหากันเป็นเกรเดียนต์
   *
   * สองอย่างที่ทำให้กลืน:
   * 1. อัลฟาเป็น *สนามต่อเนื่อง* (ไล่จากกลางตัวออกไปจนหมด) ไม่ใช่ 0/1 — ขอบจึงไม่มีเส้น
   *    และค่าที่ทับกันอยู่ในช่วงกลางเสมอ ซึ่งเป็นเงื่อนไขที่การผสมสีจะเห็นผล
   * 2. เอาต์พุตคูณอัลฟาไว้แล้ว + blendSrc = One — เท่ากับ over แบบพรีมัลติพลาย ทุกชั้นย้อมสี
   *    ของชั้นที่อยู่ข้างหลังทีละนิด ผลรวมของหกชั้นคือการไล่สีจากหางมาหาตัว ไม่ใช่ปะติดปะต่อ
   *
   * ใช้ GLSL3 เพราะต้องเรียก textureLod ตรง ๆ (ES 1.0 ต้องพึ่งส่วนขยาย)
   */
  const mat = useMemo(
    () =>
      Array.from({ length: MAX_ECHO }, (_, i) => {
        const m = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: {
            uMap: { value: rt.texture },
            uColor: { value: new THREE.Color(ECHO_COLORS[i % ECHO_COLORS.length]) },
            uAlpha: { value: 1 },
            uSoft: { value: 0.55 },
          },
          transparent: true,
          premultipliedAlpha: true,
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor,
          depthWrite: false,
          toneMapped: false,
          vertexShader: `
            out vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            uniform sampler2D uMap;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uSoft;
            in vec2 vUv;
            out vec4 fragColor;

            void main() {
              /**
               * สองชั้นมิป: ชั้นตื้นเก็บรูปร่าง (ยังอ่านออกว่าเป็นคน) ชั้นลึกเป็นก้อนฟุ้ง
               * ผสมกันตามความฟุ้งที่ตั้งไว้ — เลื่อนสไลเดอร์คือเลื่อนระหว่างสองสภาพนั้น
               */
              float form = textureLod(uMap, vUv, 1.5).a;
              /* หนีบก่อนใช้ — ค่าเกิน 1 ทำให้ไปอ่านมิปชั้นที่ภาพเหลือพิกเซลเดียว เงาหายทั้งชุด */
              float soft = clamp(uSoft, 0.0, 1.0);
              float haze = textureLod(uMap, vUv, 3.5 + soft * 3.0).a;
              float m = mix(form, haze, soft);
              /**
               * ไล่กว้าง ไม่ใช่ตัดที่ค่าเดียว: ช่วง 0.05–0.55 ทำให้เนื้อกลางตัวทึบเกือบเต็ม
               * แล้วบางลงเรื่อย ๆ จนหมดรอบนอก = ขอบฟุ้งที่สีของชั้นถัดไปแทรกเข้ามาผสมได้
               */
              float a = smoothstep(0.03, 0.6, m) * uAlpha;
              if (a < 0.004) discard;
              fragColor = vec4(uColor * a, a);
            }
          `,
        })
        return m
      }),
    [rt],
  )

  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  useEffect(
    () => () => {
      rt.dispose()
      geo.dispose()
      for (const m of mat) m.dispose()
    },
    [rt, geo, mat],
  )

  /** เงาแต่ละใบ (mesh) + ทางที่วิ่งมา */
  const echoes = useRef([])
  const path = useMemo(
    () => ({
      count: 0,
      last: new THREE.Vector3(),
      dir: new THREE.Vector3(1, 0, 0),
      speed: 0,
    }),
    [],
  )
  /** dt ของเฟรมล่าสุด — ใช้แปลงระยะที่ขยับเป็นความเร็ว (หน่วย/วินาที) */
  const frameDt = useRef(1 / 60)
  /** ขนาดที่ไล่ตามแบบนุ่ม (ดูหมายเหตุที่จุดใช้งาน) */
  const sizeSm = useRef(0)
  /** คู่ (เมช, วัสดุเดิม) ระหว่างถ่าย — ใช้ซ้ำ ไม่สร้าง array ใหม่ทุกครั้ง */
  const swap = useRef([])
  /**
   * 0..1 ความชัดของรอยเงา — ขึ้นหลัง *ไถลจบ* ไม่ใช่ระหว่างไถล
   *
   * ตอนไถลออกจากพอร์ทัลตัวละครวิ่งเป็นระยะทางไกลและเร็ว รอยเงาที่ไล่ตามระหว่างนั้นกวาดทับ
   * ครึ่งจอและแย่งความสนใจจากตัวการเคลื่อนไหวเอง สิ่งที่ต้องการคือมันเป็น *องค์ประกอบของ
   * ภาพท่าสุดท้าย* จึงกั้นไว้จนกว่า ridePose.p ถึง 1 แล้วค่อยไล่ขึ้นใน GATE_IN วินาที
   * (โผล่ทันทีเห็นเป็นการกระพริบ)
   *
   * ทิศกับความเร็วยังถูกเก็บต่อระหว่างไถล — ไม่งั้นพอถึงท่าสุดท้ายตัวละครจอดอยู่แล้ว ไม่มี
   * การเคลื่อนที่ให้คำนวณแนวเรียง รอยเงาจะกางไปทางค่าเริ่มต้น (แกน x) ซึ่งไม่ใช่ทางที่มันมา
   */
  const gate = useRef(0)
  /** ค่าที่แผงตรวจอ่าน — อ็อบเจกต์เดิมตลอด ไม่สร้างใหม่ต่อเฟรม */
  const state = useRef({ speed: 0, push: 0, size: 0, gate: 0, dir: new THREE.Vector3(1, 0, 0) })
  const box = useMemo(() => new THREE.Box3(), [])
  const sphere = useMemo(() => new THREE.Sphere(), [])
  const frames = useRef(0)

  useFrame((_, delta) => {
    frameDt.current = delta
    const t = getTuner()
    const amt = t.etAmt
    const count = Math.min(MAX_ECHO, Math.round(t.etCount))

    if (!ridePose.live || amt <= 0 || count <= 0) {
      for (const m of echoes.current) if (m) m.visible = false
      return
    }

    if (!rider.current) {
      scene.traverse((o) => {
        if (!rider.current && o.userData?.rider) rider.current = o
      })
      if (!rider.current) return
    }
    if (!subject.current) {
      rider.current.traverse((o) => {
        if (!subject.current && o.userData?.echoBody) subject.current = o
      })
    }
    const shot = subject.current ?? rider.current

    frames.current += 1

    // ── ทิศและความเร็วของตัวละคร ────────────────────────────────────────────
    HEAD.set(ridePose.wx, ridePose.wy, ridePose.wz)
    if (path.count === 0) {
      path.last.copy(HEAD)
      path.count = 1
      return
    }
    TMP.copy(HEAD).sub(path.last)
    const moved = TMP.length()
    path.last.copy(HEAD)
    /**
     * กรองทิศและความเร็วแบบ low-pass — ค่าดิบต่อเฟรมกระตุกจากไหวของ idle (ตัวละครส่าย
     * อยู่กับที่) ถ้าไม่กรอง แนวเรียงของเงาจะสะบัดไปมาทุกเฟรม
     */
    if (moved > 1e-5) {
      DIR.copy(TMP).normalize()
      path.dir.lerp(DIR, 0.12)
      if (path.dir.lengthSq() > 1e-6) path.dir.normalize()
    }
    path.speed += (moved / Math.max(1e-3, frameDt.current) - path.speed) * 0.12
    /**
     * 0..1 — เร็วเต็มที่ = ยืดเต็ม ช้าลงก็สั้นลง แต่ไม่ต่ำกว่า etHold
     * (etHold 1 = ชั้นเงาค้างครบตอนจอด ซึ่งเป็นสิ่งที่ต้องการในท่าสุดท้าย)
     */
    const push = Math.max(
      Math.min(1, Math.max(0, t.etHold)),
      Math.min(1, path.speed / Math.max(0.05, t.etSpeed)),
    )

    // ── โผล่หลังไถลจบ ─────────────────────────────────────────────────────
    /** นับเป็น *วินาที* ไม่ใช่ 0..1 เพราะแต่ละใบมีนาฬิกาของตัวเองที่เหลื่อมกัน */
    const slid = ridePose.p >= 1
    gate.current = slid ? gate.current + delta : 0
    const popAll = (count - 1) * POP_STEP + POP_RISE
    state.current.gate = Math.min(1, gate.current / popAll)
    if (gate.current <= 0) {
      for (const m of echoes.current) if (m) m.visible = false
      // ไม่ถ่ายภาพและไม่วาดระหว่างไถล — ประหยัดทั้งรอบวาดและการอ่านกล่องครอบ
      return
    }

    // ── ถ่ายซิลูเอตต์ของตัวจริง ────────────────────────────────────────────
    if (frames.current % BOX_EVERY === 1) {
      fitBox(shot, box)
      if (!box.isEmpty()) {
        box.getBoundingSphere(sphere)
        box.getSize(BOX_HALF).multiplyScalar(0.5)
      }
    }
    if (sphere.radius <= 0) return

    if (frames.current % REFRESH_EVERY === 1) {
      CENTER.copy(sphere.center)
      camera.getWorldDirection(CAM_DIR)
      /**
       * กล้องถ่ายต้องอยู่ "ฝั่งเดียวกับกล้องจริง" และมองเข้าหาตัว — ไม่ใช่มุมตายตัว
       * ไม่งั้นเงาจะเป็นซิลูเอตต์จากมุมอื่น แล้วไม่ตรงกับตัวที่คนดูเห็นอยู่
       */
      shotCam.position.copy(CENTER).addScaledVector(CAM_DIR, -sphere.radius * 4)
      shotCam.up.copy(camera.up)
      shotCam.lookAt(CENTER)
      /**
       * เผื่อขอบ 35% ไม่ใช่พอดีตัว
       *
       * กรอบพอดีตัวทำให้แขน/บอร์ดแตะขอบภาพ แล้วการขยายหน้ากาก (dilate) ลากค่าที่ขอบ
       * ออกไปจนเต็มขอบ เห็นเป็นแผ่นสี่เหลี่ยมสีทึบติดอยู่ท้ายเงา
       */
      const r = sphere.radius * 1.35
      shotCam.left = -r
      shotCam.right = r
      shotCam.top = r
      shotCam.bottom = -r
      shotCam.near = sphere.radius * 2
      shotCam.far = sphere.radius * 6
      shotCam.updateProjectionMatrix()

      const prevTarget = gl.getRenderTarget()
      const prevAlpha = gl.getClearAlpha()
      // สลับเป็นวัสดุแบนทั้งกิ่ง เก็บของเดิมไว้คืนทีหลัง (ห้ามลืมคืน ไม่งั้นตัวจริงกลายเป็นขาว)
      swap.current.length = 0
      shot.traverse((o) => {
        if (!o.material) return
        swap.current.push(o, o.material)
        o.material = FLAT
      })
      gl.setRenderTarget(rt)
      gl.setClearAlpha(0)
      gl.clear(true, true, false)
      gl.render(shot, shotCam)
      gl.setRenderTarget(prevTarget)
      gl.setClearAlpha(prevAlpha)
      for (let i = 0; i < swap.current.length; i += 2) {
        swap.current[i].material = swap.current[i + 1]
      }
      swap.current.length = 0
    }

    // ── วาดเงาไล่ไปตามทาง ─────────────────────────────────────────────────
    /**
     * จุดยึดเงาต้องเป็น *กลางภาพที่ถ่ายมา* ไม่ใช่ ridePose
     *
     * ridePose คือจุดที่ล้อแตะถนน แต่กรอบภาพถูกจัดกึ่งกลางที่ทรงกลมครอบตัวคน (สูงขึ้นไป
     * ราวครึ่งตัวและเยื้องไปตามท่าที่เอียง) วางแผ่นเงาที่ ridePose ตรง ๆ เงาใบที่ควรทับตัว
     * จริงพอดีจึงลอยไปอยู่เหนือ-เยื้องจากตัว ทั้งชุดเลยอ่านว่า "ไม่ตามตัว"
     *
     * ระยะเยื้องวัดจากกล่องครอบซึ่งอัปเดตทุก BOX_EVERY เฟรม — กรองให้นิ่งแล้วบวกกลับทุกเฟรม
     * เงาจึงเกาะตัวแบบต่อเนื่อง ไม่กระตุกตามจังหวะการวัด
     */
    OFF.copy(sphere.center).sub(HEAD)
    if (OFF_SM.lengthSq() === 0) OFF_SM.copy(OFF)
    else OFF_SM.lerp(OFF, 0.2)
    HEAD.add(OFF_SM)
    HEAD.y += t.etY
    /**
     * ขนาดวัดใหม่ทุก BOX_EVERY เฟรม ค่าที่ได้จึงกระโดดเป็นขั้น — ไล่ตามแบบนุ่ม
     * ไม่งั้นเงาทั้งชุดกระตุกเป็นจังหวะทุกครึ่งวินาที (ระยะห่างก็คิดจากขนาดนี้ด้วย)
     */
    const target = sphere.radius * 2 * 1.35
    sizeSm.current = sizeSm.current > 0 ? sizeSm.current + (target - sizeSm.current) * 0.15 : target
    const size = sizeSm.current
    state.current.speed = path.speed
    state.current.push = push
    state.current.size = size
    state.current.dir.copy(path.dir)
    /**
     * ถอยแผ่นเงาไปให้พ้น *ผิวหลัง* ของตัวละครก่อน ไม่ใช่วางที่กลางตัว
     *
     * แผ่นเงาใบที่ติดตัวถูกวางที่กลางภาพซิลูเอตต์ ซึ่งคือกลางตัวคนพอดี ครึ่งแผ่นจึงโผล่อยู่
     * *หน้า* ตัว ผ่าน depth test แล้ววาดทับหน้าอก/แขน (renderOrder -1 ไม่ช่วย เพราะวัสดุ
     * โปร่งถูกวาดหลังของทึบทั้งฉากอยู่แล้ว ตัวตัดสินคือความลึกล้วน ๆ)
     *
     * ระยะถอยคิดจากด้านที่กล่องครอบยื่นไปตามแนวสายตา (support function ของกล่อง) บวก
     * เผื่อนิดเดียว — มากกว่านี้จะไปโผล่หลังกระจก/ทิวทัศน์ที่อยู่ถัดไป
     */
    camera.getWorldDirection(CAM_DIR)
    const behind =
      Math.abs(BOX_HALF.x * CAM_DIR.x) +
      Math.abs(BOX_HALF.y * CAM_DIR.y) +
      Math.abs(BOX_HALF.z * CAM_DIR.z) +
      0.15
    const parent = grp.current
    /** หันเข้ากล้องในพิกัดของกลุ่มแม่: q_local = inverse(q_parent) · q_camera */
    PAR_S.set(1, 1, 1)
    if (parent) {
      parent.matrixWorld.decompose(PAR_P, PAR_Q, PAR_S)
      PAR_Q.invert()
      CAM_Q.copy(PAR_Q).multiply(camera.quaternion)
    } else {
      CAM_Q.copy(camera.quaternion)
    }
    /** ขนาดที่คิดไว้เป็นหน่วยโลก แต่ scale ของ mesh เป็นของกลุ่มแม่ — ต้องหารสเกลแม่ออก */
    const worldToLocalScale = 1 / Math.max(1e-6, PAR_S.x)
    for (let i = 0; i < MAX_ECHO; i += 1) {
      const m = echoes.current[i]
      if (!m) continue
      const on = i < count
      if (!on) {
        m.visible = false
        continue
      }
      /** นาฬิกาของใบนี้ — ใบ 0 (ติดตัว) เริ่มก่อน ใบถัดไปช้าลงทีละ POP_STEP */
      const ga = Math.min(1, Math.max(0, (gate.current - i * POP_STEP) / POP_RISE))
      m.visible = ga > 0.001
      if (!m.visible) continue
      /** เลยสล็อตไปนิดแล้วผ่อนกลับ — ใบใหม่จึงอ่านว่าถูกสลัดออกมา ไม่ใช่ค่อย ๆ จางเข้ามา */
      const pop = easeOutBack(ga)
      const u = count <= 1 ? 0 : i / (count - 1)
      /** เงาใบที่ i ถอยหลังไปตามทิศที่วิ่ง — ยิ่งเร็วยิ่งยืดออก */
      /**
       * ระยะห่างคิดเป็น "สัดส่วนของความกว้างตัว" ไม่ใช่หน่วยฉากตายตัว
       * — ตัวละครถูกสเกลจากแผงจูนได้ ถ้าใช้หน่วยตายตัว พอย่อตัวเงาจะกระจายห่างเกินตัว
       */
      /**
       * ระยะไม่ได้เพิ่มเป็นเส้นตรง — ยกกำลัง 0.8 ทำให้ใบใกล้ตัวชิดกันแล้วค่อยห่างออกไปทางหาง
       * ซึ่งเป็นรูปเดียวกับรอยที่ของจริงทิ้งไว้ (เพิ่งผ่านไป = ยังซ้อนกัน) แถวที่ห่างเท่ากันหมด
       * อ่านเป็นของวางเรียงเป็นระเบียบ ไม่ใช่รอยของการเคลื่อนที่
       */
      const back = Math.pow(i + 1, 0.8) * t.etStep * size * push * pop
      TMP.copy(HEAD).addScaledVector(path.dir, -back)
      // ใบที่ไกลออกไปเล็กลงและจางลง — ใบแรกคือเงาที่เพิ่งหลุดจากตัว
      /** หุบจากใหญ่กว่าจริงเล็กน้อยตอนโผล่ — ของ githubuniverse ใบใหม่ตัวโตกว่าที่สุดท้าย */
      /**
       * ถอยไปตามแนวสายตาแล้วขยายชดเชยระยะ — ไม่ชดเชยแล้วเงาจะเล็กลงตามเปอร์สเปกทีฟ
       * และหลุดออกจากรูปตัวที่มันควรทับสนิท
       */
      const dist = Math.max(0.001, TMP.distanceTo(camera.position))
      TMP.addScaledVector(CAM_DIR, behind)
      const comp = (dist + behind) / dist
      const shrink = (1 - u * t.etShrink) * (1 + 0.12 * (1 - ga))
      m.scale.setScalar(size * shrink * comp * worldToLocalScale)
      if (parent) parent.worldToLocal(TMP)
      m.position.copy(TMP)
      /**
       * หันเข้ากล้องทุกเฟรม (billboard) เพราะภาพที่แปะเป็นซิลูเอตต์จากมุมกล้อง
       * เอียงตามอย่างอื่นแล้วเงาจะดูเป็นแผ่นกระดาษที่ลอยเฉียง
       */
      m.quaternion.copy(CAM_Q)
      /**
       * 0.78: ไม่เต็มความเข้ม — ชั้นที่ทับกันต้องมองผ่านถึงกันได้ สีจึงผสม ถ้าใบไหนทึบเต็ม
       * มันจะกลืนใบข้างหลังหมดแล้วเห็นเป็นแผ่นสีเดียว ไม่ใช่การไล่สี
       */
      m.material.uniforms.uAlpha.value = 0.78 * ga * amt * push * (1 - u * t.etFade)
      m.material.uniforms.uSoft.value = t.etSoft
    }
    invalidate()
  })

  useEchoDebug({ gl, rt, state })

  return (
    <group ref={grp}>
      {Array.from({ length: MAX_ECHO }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            echoes.current[i] = m
          }}
          geometry={geo}
          material={mat[i]}
          visible={false}
          /* วาดก่อนตัวละคร และไม่เขียนความลึก — เงาจึงอยู่หลังตัวจริงตามจริง ไม่ทับหน้า */
          renderOrder={-1}
          userData={{ noClay: true }}
        />
      ))}
    </group>
  )
}
