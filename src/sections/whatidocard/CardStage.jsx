import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { HeroRider } from '@/newhero/HeroRider'
import { HeroLights } from '@/newhero/heroLights'
import { Palette } from '@/newhero/palette'
import { Switch } from '@/newhero/Switch'
import { InsidePortal, PortalMask, roundedFrameGeo, roundedPlane, roundedRectShape } from '@/newhero/stencilPortal'
import { useDisposable } from '@/joespresso/scene/utils'
import { Magnifier } from './Magnifier'
import { REPLICA_ORDER, Replica } from './Replica'
import { CARD_H, CARD_W, SKIN, VIEW_H, stackCenter, stageIn, useStageTuner } from './stageTuner'

/**
 * จอ "สิ่งที่ทำ" — หน้าต่างโปรแกรมเป็นของสามมิติ เนื้อหน้าต่างเป็นพอร์ทัลทะลุไปอีกฉาก
 *
 * เป็นหน้าต่างแบบ mac ตามแบบที่สั่ง: แถบหัวมีจุดสามจุด ขอบรอบบาง มุมมนไม่มาก — ไม่ใช่
 * การ์ดโพสต์ IG แบบเดิม (กรอบหนา ก้นหนาเป็นที่ว่างใต้รูป) รูปทรงนี้ยังต่อกับท่า genie
 * ที่จอก่อนหน้าใช้ส่งมา (ดู sections/hero/ScrollTell) เพราะ genie ของ mac คือท่าที่
 * "หน้าต่าง" ถูกดึงออกมาจากจุดเดียว
 *
 * หน้าต่างคือของหนาจริง (ไม่ใช่ div) วางเอียงเล็กน้อย
 *
 * เนื้อหน้าต่างไม่ได้เป็นรูปนิ่ง: มันเป็นช่องมองทะลุที่ทำด้วย stencil (ดู newhero/stencilPortal)
 * ข้างในเป็นอีกฉากที่อยู่หลังการ์ด และตัวละครยืน "คร่อม" ขอบช่อง — ครึ่งตัวอยู่หน้าการ์ด
 * ครึ่งตัวทับช่อง จึงอ่านว่าโผล่ออกมาจากพอร์ทัล ไม่ใช่รูปที่แปะอยู่ในกรอบ
 *
 * ตัวละคร = `HeroRider` เปล่า ๆ ไม่ปิดอะไรเลย: ท่าสเก็ต บอร์ด แขน lumberjack ลายเสื้อ
 * ไฟขอบ ทุกอย่างมาจากแผงจูนชุดเดียวกับ /2026-final — เป็น "ตัวเดียวกันเป๊ะ ๆ" รวมถึง
 * ชุดไฟ (HeroLights) เพราะผิวแบบดินน้ำมันมาจากแผงไฟนุ่ม ไม่ได้มาจากตัวโมเดล
 */

/* ── ผังหน้าต่าง (หน่วยโลกของฉากนี้) ───────────────────────────────────────── */
/* ขนาดนอก (CARD_W/CARD_H) กับความสูงของกรอบที่เห็น (VIEW_H) อยู่ใน ./stageTuner —
   จอก่อนหน้าต้องใช้ตัวเลขชุดเดียวกันนี้เล็งปลายทางของท่า genie ถ้าเก็บไว้ที่นี่ อีกจอต้อง
   คัดลอกไปไว้ซ้ำ แล้ววันหนึ่งสองจอจะไม่ตรงกัน */
/** แถบหัวหน้าต่าง (ที่อยู่ของจุดสามจุด) */
const BAR_T = 0.95
/** ขอบรอบเนื้อหน้าต่าง — บางเท่ากันสามด้าน */
const BAR = 0.14
const CARD_D = 0.4
const CARD_R = 0.34

/** เนื้อหน้าต่าง = ส่วนที่เหลือใต้แถบหัว */
const BODY_H = CARD_H - BAR_T
/** กลางเนื้อหน้าต่างเยื้องลงครึ่งแถบหัว */
const HOLE_Y = -BAR_T / 2
/**
 * ช่องทะลุ = รู *ของกรอบเนื้อจริง ๆ* เผื่อซ้อนขอบไม่ให้เห็นรอยต่อ
 *
 * ต้องคิดจากกรอบที่ส่งให้ roundedFrameGeo (สูง BODY_H + CARD_R และจุดกลางเยื้องลง
 * CARD_R/2) ไม่ใช่จาก BODY_H เปล่า ๆ: คิดผิดแล้วรูของกรอบใหญ่กว่าหน้ากากไป 0.32 หน่วย
 * ตรงก้น ช่องแถบนั้นจึงไม่มีใครวาด — กรอบก็ไม่ได้ทึบตรงนั้น (มันคือรู) และฉากในช่องก็ถูก
 * stencil ห้ามไว้ เห็นเป็นแถบทะลุไปถึงพื้นหน้าเว็บ (วัดมาแล้ว: ทาพื้นเป็นสีแดงแล้วแถบนั้น
 * เป็นสีแดง)
 */
const HOLE_W = CARD_W - BAR * 2 + 0.04
const HOLE_H = BODY_H + CARD_R - BAR * 2 + 0.04
/** จุดกลางของรู — เท่ากับจุดกลางของกรอบเนื้อ ไม่ใช่จุดกลางของเนื้อหน้าต่าง */
const HOLE_CY = HOLE_Y - CARD_R / 2

/** จุดสามจุดบนแถบหัว — สีชุดเดียวกับปุ่มหน้าต่างของ mac */
const DOTS = ['#ff5f57', '#febc2e', '#28c840']
const DOT_R = 0.15
const DOT_GAP = 0.46

/**
 * หน้าต่างที่ซ้อนอยู่ข้างหลังใบหน้า — ของตกแต่ง ไม่มีพอร์ทัล
 *
 * ใบหลังไม่มีช่องทะลุ: พอร์ทัลหนึ่งช่องคือ stencil หนึ่งรอบกับฉากที่วาดซ้ำ ทำสี่ช่องเพื่อ
 * ของที่ถูกใบหน้าบังเกือบหมดไม่คุ้ม ใบหลังจึงเป็นแผ่นทึบที่มีหน้าจอเป็นสีเรียบ
 *
 * เรียงให้ยื่นออกคนละมุมและเล็กลงตามความลึก — กองที่ยื่นไปทางเดียวกันหมดอ่านเป็นเงาซ้อน
 * ไม่ใช่กองหน้าต่าง
 */
/**
 * หน้าตาของหน้าต่างที่ไม่ใช่ใบพอร์ทัล — สามใบ รวมกับใบพอร์ทัลเป็นสี่ใบพอดี
 *
 * ทุกบานเป็นสีดำ ต่างกันแค่ระดับความดำของตัวแผ่นกับของหน้าจอ: ดำเท่ากันเป๊ะทุกใบบนพื้นขาว
 * มันรวมเป็นก้อนเดียว ไม่เห็นว่ามีกี่ใบ (เป็นปัญหาเดิมของตอนที่ทุกใบขาว) ผัง (ตำแหน่ง/สเกล/
 * หมุน) ไม่ได้อยู่ที่นี่ — มันมาจากสโตร์ที่แผงจูนเขียน
 * (ดู ./stageTuner) เพราะเป็นค่าที่ต้องลากดูบนจอจริง
 *
 * ใบที่สี่อยู่ *หน้า* ของในฉาก ไม่ใช่หลัง — นี่คือสิ่งที่ทำให้กองอ่านเป็นหน้าต่างที่ซ้อนกัน
 * อยู่บนโต๊ะ ไม่ใช่แผ่นสามแผ่นเรียงลึกอยู่หลังใบเดียว
 */
/**
 * สีหน้าจอ — ค่าเดียวสำหรับทุกบาน *รวมบานพอร์ทัล*
 *
 * เดิมไล่เข้มลงตามความลึกทีละใบ ซึ่งอ่านเป็น "สามใบคนละสี" มากกว่าเป็นกองหน้าต่างชุดเดียวกัน
 * ความต่างระหว่างใบให้ตัวแผ่นเป็นตัวบอก (ดู shell) ไม่ใช่หน้าจอ
 *
 * บานพอร์ทัลใช้สีนี้ด้วย: เนื้อในช่องของมันคือ *พื้นของฉากข้างใน* ไม่ใช่วัสดุของแผ่น จึงต้อง
 * ไปตั้งที่แผ่นรองในพอร์ทัล (ดู Card) ไม่ใช่ที่นี่ — แต่ค่าต้องเป็นตัวเดียวกัน ไม่งั้นสองจอ
 * เขียวไม่เท่ากัน
 */
const SCREEN = SKIN.screen

/**
 * ค่า stencil — ใช้เป็น *บิต* ไม่ใช่เลขเรียง
 *
 * บัฟเฟอร์ stencil เก็บได้ค่าเดียวต่อพิกเซล แต่ที่นี่มีสองคำถามซ้อนกันในพิกเซลเดียว:
 * "นี่เป็นพื้นที่หน้าจอไหม" (ตัวละครโผล่ได้) และ "นี่เป็นช่องพอร์ทัลไหม" (ฉากในช่องโผล่ได้)
 *
 * บิต 2 = พื้นที่หน้าจอ · บิต 1 = ช่องพอร์ทัล ช่องพอร์ทัลเขียน 3 (ทั้งสองบิต) เพราะมันเป็น
 * ทั้งสองอย่าง แต่ละฝ่ายทดสอบด้วย stencilFuncMask ของบิตตัวเอง จึงไม่เห็นบิตของอีกฝ่าย
 *
 * ที่ต้องเป็นบิต ไม่ใช่ "ไม่เท่ากับ 0": เทียบแบบไม่เท่ากับศูนย์แล้วตัวละครไปโผล่นอกจอ
 * (วัดมาแล้ว — พิสูจน์ด้วยการสลับไปเทียบ "เท่ากับ 2" แล้วรอยรั่วหายสนิท)
 */
const SCREEN_BIT = 2
const PORTAL_BIT = 1
/** ช่องพอร์ทัลเป็นทั้งหน้าจอและช่อง — เขียนสองบิตพร้อมกัน */
const PORTAL_MARK = SCREEN_BIT | PORTAL_BIT

const SKINS = [
  { key: 'w2', shell: '#0d0e11', label: 'research.png' },
  { key: 'w3', shell: '#0a0b0d', label: 'final.png' },
  { key: 'w4', shell: '#101115', label: 'lastfinal.png' },
]

const RAD = Math.PI / 180

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const outCubic = (v) => 1 - (1 - v) ** 3

/**
 * จุดตั้งต้นของท่ากางกอง — บานหลังออกมาจาก *หลังใบพอร์ทัล* บานหน้าเลื่อนเข้ามาจากใต้กรอบ
 *
 * บานหลังซ้อนอยู่ที่ใบพอร์ทัลพอดีตอนระยะเป็นศูนย์ จึงถูกใบพอร์ทัลบังหมดทั้งใบ = ไม่ต้องหรี่
 * ความทึบของมันเลย (ความทึบของวัสดุที่แชร์กันทั้งกองคือของที่แก้ยากในฉากที่มี stencil)
 * บานหน้าทำอย่างนั้นไม่ได้เพราะมันถูกวาดทับใบพอร์ทัล — มันจึงมาจากนอกกรอบแทน
 */
const fanFrom = (key, t) =>
  key === 'w4'
    ? { pos: [t.w4x + 1.6, t.w4y - 9.5, t.w4z], scale: t.w4s }
    : { pos: [t.w1x, t.w1y, t[`${key}z`]], scale: t.w1s }

/** ลำดับการกางของแต่ละใบ — ไล่กันทีละใบ ไม่ใช่กางพร้อมกันทั้งกอง */
const FAN_ORDER = { w1: 0, w2: 1, w3: 2, w4: 3 }

/** ผังของหน้าต่างใบหนึ่ง = หน้าตาคงที่ + ค่าที่ลากได้จากแผง */
const laidOut = (skin, t) => ({
  ...skin,
  from: fanFrom(skin.key, t),
  delay: FAN_ORDER[skin.key],
  /**
   * อยู่หน้าหรือหลังใบพอร์ทัล ตัดสินจาก z ที่ลากมา ไม่ใช่ค่าที่เขียนตายไว้ในสกิน
   *
   * ฉากในพอร์ทัลถูกวาดโดยปิดการทดสอบความลึก (ดู Order) ของที่ถูกสั่งให้วาดทีหลังจึงทาทับ
   * เนื้อในช่องได้แม้ตัวมันอยู่ลึกกว่า — ลากบานไปไว้ข้างหลังแล้วมันจะยังบังพอร์ทัลอยู่ ถ้า
   * ลำดับวาดไม่เปลี่ยนตาม
   */
  order: t[`${skin.key}z`] < 0 ? -3 : 10,
  pos: [t[`${skin.key}x`], t[`${skin.key}y`], t[`${skin.key}z`]],
  scale: t[`${skin.key}s`],
  /* แกน x กับ z เป็นศูนย์เสมอ — บานต้องแบนเข้ากล้อง เหลือแค่การหันซ้ายขวาที่ลากได้จากแผง
     (ค่าเริ่มต้นของมันก็ศูนย์ ใครอยากลองเอียงก็ยังลากได้) */
  rot: [0, t[`${skin.key}ry`] * RAD, 0],
})

/**
 * ไม่เอียงทั้งกอง — ทุกบานหันหน้าตรงเข้ากล้อง
 *
 * เดิมเอียงทั้งก้อนเล็กน้อยให้อ่านเป็นแผ่นวางในอวกาศ แต่แบบที่สั่งคือหน้าต่างแบนเต็มหน้า
 * อย่างภาพจับหน้าจอ — ความลึกมาจากการซ้อนกันและเงา ไม่ใช่จากการเอียง
 */
const CARD_ROT = [0, 0, 0]

/** ของสกิล: ตำแหน่ง + ขนาด + การหมุน — เกาะขอบหน้าต่างทั้งสามมุม */
/* ของสกิลเล็กลงจากเดิมราวหนึ่งในสี่ — กล้องออร์โธไม่ย่อของที่ลอยอยู่หน้าฉากให้ (z 2.2 เคย
   ถูกเพอร์สเปกทีฟย่อ) ถาดสีขนาดเดิมกินคำบรรยาย Design ไปทั้งก้อน (วัดมาแล้ว) */
const PROPS = {
  /* Research — แว่นขยาย มุมซ้ายบน */
  glass: { pos: [-5.2, 2.7, 2.2], scale: 0.82, rot: [0.1, 0.35, 0.3] },
  /* Design — ถาดสีใบเดียวกับที่ลอยอยู่ใน hero */
  palette: { pos: [-5.0, -2.7, 2.4], scale: 0.95, rot: [0.22, -0.38, -0.55] },
  /* Coding — สวิตช์โหมดนักพัฒนาตัวเดียวกับใน hero */
  toggle: { pos: [5.2, -1.5, 2.2], scale: 0.46, rot: [0.12, -0.5, 0.2] },
}

/** ห่วงที่พาดรอบตัวละคร — สีส้มโลโก้ */
const HOOP = { r: 2.6, tube: 0.15, rot: [1.3, 0.12, 0.2], pos: [0, 0.5, 0.4] }

export function CardStage() {
  return (
    <Canvas
      /**
       * กล้องออร์โธ ไม่ใช่เพอร์สเปกทีฟ
       *
       * "หันหน้าตรงเข้ากล้องไม่มีเอียง" ทำด้วยการตั้ง rotation เป็นศูนย์ไม่พอ: เพอร์สเปกทีฟ
       * ทำให้ของที่อยู่นอกแกนกลางเห็นด้านข้างของตัวเองอยู่ดี (บานขวาสองบานเอียงชัด — วัดมาแล้ว)
       * ออร์โธไม่มีจุดรวมสายตา ทุกบานจึงแบนเท่ากันหมดไม่ว่าอยู่ตรงไหนของจอ
       */
      orthographic
      camera={{ position: [0, 0, 40], zoom: 1, near: 1, far: 400 }}
      dpr={[1, 2]}
      /* stencil: ช่องรูปเป็นพอร์ทัลที่ทำด้วย stencil buffer ซึ่ง r3f ไม่ได้ขอมาให้เอง
         alpha: การ์ดลอยบนพื้นไล่สีของ section ซึ่งเป็น CSS ไม่ใช่ของในฉาก */
      gl={{ antialias: true, alpha: true, stencil: true }}
    >
      <Fit />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}

/**
 * ตั้ง zoom ของกล้องออร์โธตามความสูงของกรอบ
 *
 * ออร์โธคิดเป็น "พิกเซลต่อหน่วย" ถ้าตั้งค่าคงที่ไว้ จอที่เตี้ยกว่าจะเห็นกองหน้าต่างถูกตัด
 * (เพอร์สเปกทีฟตัวเดิมพอดีตามความสูงให้เอง) — ผูกกับความสูงจริงของกรอบแทน
 */
function Fit() {
  const { camera, size } = useThree()
  const zoom = size.height / VIEW_H
  if (camera.zoom !== zoom) {
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }
  return null
}

/**
 * ชั้นหน้ากาก stencil ของทุกบาน — เขียนก่อนใครทั้งหมด เรียงจาก *บานไกลไปบานใกล้*
 *
 * ลำดับคือหัวใจ: stencil ไม่รู้เรื่องความลึก ถ้าเขียนพื้นที่หน้าจอของทุกบานลงไปเฉย ๆ ตัวละคร
 * (ซึ่งวาดโดยไม่ทดสอบความลึก) จะไปโผล่ทับ *กรอบ* ของบานที่อยู่หน้ากว่าด้วย — เห็นเป็นตัวละคร
 * ทะลุออกนอกจอ (วัดมาแล้ว)
 *
 * แต่ละบานจึงเขียนสองครั้ง: แผ่นทั้งใบล้างเป็น 0 ก่อน แล้วพื้นที่หน้าจอเขียนค่าของตัวเองทับ
 * ไล่จากไกลไปใกล้ บานที่อยู่หน้ากว่าจึงล้างรอยของบานหลังที่มันบังไว้เสมอ ผลคือทุกพิกเซลถือค่า
 * ของ "บานที่อยู่หน้าสุดที่จุดนั้น" เท่านั้น
 *
 * ค่าที่เขียนเป็นบิต (ดู SCREEN_BIT / PORTAL_BIT) — ช่องพอร์ทัลเขียนทั้งสองบิต
 */
/**
 * กลุ่มที่พาหน้าต่างใบหนึ่งเข้าที่ตามระยะเลื่อน — ท่ากางกองหลังจากท่า genie ส่งของมาถึง
 *
 * จอก่อนหน้าดึงไฟล์ออกมาเป็นหน้าต่าง *ใบเดียว* (ดู sections/hero/ScrollTell) ถ้าเฟรมถัดมา
 * มีสี่ใบพร้อมกันหมด การแปลงร่างทั้งอันถูกกินทิ้งด้วยการตัดภาพ — ใบที่เหลือจึงกางออกมาทีหลัง
 * โดยเริ่มจากที่ซ่อนอยู่หลังใบพอร์ทัล (ดู fanFrom)
 *
 * เขียนลงวัตถุใน useFrame ตรง ๆ ไม่ผ่าน state: ค่าเปลี่ยนทุกเฟรมที่เลื่อนจอ และค่าต้นทาง
 * (stageIn) ก็เป็นกล่องที่จอเขียนทับ ไม่ใช่สโตร์ที่เรนเดอร์ใหม่
 */
const FAN_STEP = 0.13
const FAN_SPAN = 0.52

function FanGroup({ from, to, scale, rotation, delay = 0, children }) {
  const g = useRef()
  useFrame(() => {
    const o = g.current
    if (!o) return
    const e = outCubic(clamp01((stageIn.v - delay * FAN_STEP) / FAN_SPAN))
    o.position.set(
      from.pos[0] + (to[0] - from.pos[0]) * e,
      from.pos[1] + (to[1] - from.pos[1]) * e,
      /* ความลึกไม่ถูกไล่: ลำดับหน้า/หลังของกองต้องนิ่งตลอดท่า ไม่งั้นบานจะสลับกันบัง */
      to[2],
    )
    o.scale.setScalar(from.scale + (scale - from.scale) * e)
  })
  return (
    <group ref={g} rotation={rotation}>
      {children}
    </group>
  )
}

/**
 * ตัวละครโผล่ขึ้นมาในช่องหลังหน้าต่างเข้าที่ — ไม่ใช่ยืนรออยู่แล้วตั้งแต่เฟรมแรก
 *
 * ท่า genie ของจอก่อนหน้าส่งมาเป็น "หน้าต่างเปล่า" (เงาของมันเป็น DOM ไม่มีตัวละคร) ถ้าเฟรม
 * ถัดมามีคนยืนอยู่เต็มช่องแล้ว ตาจะเห็นของโผล่มาหนึ่งชิ้นทั้งที่หน้าต่างไม่ได้เปลี่ยนอะไร —
 * ให้เขาขึ้นมาจากใต้ขอบช่อง (ซึ่งถูก mask อยู่แล้ว) จึงอ่านเป็น "เดินเข้ามาในจอ"
 */
const CHAR_LIFT = 7.2

function Rising({ y, lift, children }) {
  const g = useRef()
  useFrame(() => {
    const o = g.current
    if (!o) return
    const e = outCubic(clamp01(stageIn.v / FAN_SPAN))
    o.position.y = y - (1 - e) * lift
  })
  return <group ref={g}>{children}</group>
}

function Masks({ list }) {
  const slab = useMemo(() => new THREE.PlaneGeometry(CARD_W, CARD_H), [])
  useDisposable(slab)
  const screen = useMemo(() => roundedPlane(CARD_W - BAR * 2, BODY_H - BAR, CARD_R * 0.5), [])
  useDisposable(screen)
  const hole = useMemo(() => roundedPlane(HOLE_W, HOLE_H, CARD_R * 0.5), [])
  useDisposable(hole)

  return (
    <group>
      {list.map((w, i) => (
        <FanGroup key={w.key} from={w.from} to={[w.x, w.y, w.z]} scale={w.s} delay={w.delay}>
          {/* ล้างรอยของบานที่อยู่หลังกว่าในพื้นที่ที่แผ่นนี้บังไว้ */}
          <mesh geometry={slab} renderOrder={-40 + i * 2}>
            <PortalMask mark={0} />
          </mesh>
          {w.portal ? (
            <mesh geometry={hole} position={[0, HOLE_CY, 0]} renderOrder={-40 + i * 2 + 1}>
              <PortalMask mark={PORTAL_MARK} />
            </mesh>
          ) : (
            <mesh geometry={screen} position={[0, HOLE_Y, 0]} renderOrder={-40 + i * 2 + 1}>
              <PortalMask mark={SCREEN_BIT} />
            </mesh>
          )}
        </FanGroup>
      ))}
    </group>
  )
}

function Scene() {
  /* ค่าที่ลากจากแผง (dev) — ผู้ชมได้ค่าเริ่มต้นซึ่งเป็นค่าที่เขียนไว้ใน stageTuner */
  const t = useStageTuner()
  /* ประตูให้สคริปต์ตรวจงานอ่านฉากได้ — dev เท่านั้น (ท่าเดียวกับ window.__tuner) */
  const { scene } = useThree()
  useEffect(() => {
    if (import.meta.env.DEV) window.__cardScene = scene
  }, [scene])
  const laid = useMemo(() => SKINS.map((k) => laidOut(k, t)), [t])
  const back = laid.filter((k) => k.order < 0)
  const front = laid.filter((k) => k.order > 0)
  /** กองทั้งก้อนถูกเลื่อนกลับมาให้กรอบรวมอยู่กลางจอ (ดู stackCenter ใน ./stageTuner) */
  const c = useMemo(() => stackCenter(t), [t])
  /** ผังของทุกบานสำหรับชั้นหน้ากาก — เรียงจากไกลไปใกล้ (ดู Masks) */
  const masks = useMemo(
    () =>
      ['w1', 'w2', 'w3', 'w4']
        .map((key) => ({
          key,
          portal: key === 'w1',
          x: t[`${key}x`],
          y: t[`${key}y`],
          z: t[`${key}z`],
          s: t[`${key}s`],
          /* หน้ากากต้องเดินทางเหมือนบานของมันเป๊ะ ๆ ไม่งั้นช่องจะไม่อยู่ตรงกับหน้าจอ */
          from: fanFrom(key, t),
          delay: FAN_ORDER[key],
        }))
        .sort((a, b) => a.z - b.z),
    [t],
  )

  return (
    <>
      <HeroLights />
      <group rotation={CARD_ROT} position={[-c.x, -c.y, 0]}>
        <Masks list={masks} />
        <StackWindows list={back} order={-3} />
        {/* ใบพอร์ทัล — ผังมาจากแผงเหมือนใบอื่น ค่าเริ่มต้นคือ "อยู่ที่เดิม" (0/1) เพราะกรอบของมัน
            ถูกวัดไว้คู่กับปลายทางของท่า genie จากจอก่อนหน้า (ดู w1 ใน ./stageTuner) */}
        <group
          position={[t.w1x, t.w1y, t.w1z]}
          rotation={[0, t.w1ry * RAD, 0]}
          scale={t.w1s}
        >
          <Card />
        </group>
        <Order n={10}>
          {/* ห่วง — วางหน้าการ์ดแต่หลังตัวละคร ครึ่งหน้าจึงถูกตัวบังเอง */}
          {t.hoop > 0.5 && (
            <mesh position={HOOP.pos} rotation={HOOP.rot}>
              <torusGeometry args={[HOOP.r, HOOP.tube, 14, 60]} />
              <meshStandardMaterial color="#fd5000" roughness={0.4} />
            </mesh>
          )}

          {/*
            ตัวละคร — อยู่หน้าการ์ด ทับขอบล่างของช่องรูป = โผล่ออกมาจากพอร์ทัล

            สเกลกับตำแหน่งคิดจากกล่องขอบเขตจริงของริก: ในสเปซของตัวเอง ฝ่าเท้าอยู่ที่
            y -4.86 ยอดหัว +0.72 (วัดจากไฟล์ที่หน้า /rig-export อบออกมา) และ Rider
            ยกตัวขึ้นอีก mascotLift ก่อนถึงกลุ่มนี้
          */}

          {/* หน้าต่างใบที่คร่อมหน้าของในฉาก — อยู่ในกิ่งเดียวกับของหน้าการ์ด ลำดับวาดจึงเป็น 10 */}
          <StackWindows list={front} order={10} />

          {/* ของสกิล */}
          {t.skills > 0.5 && (
            <>
              <group position={PROPS.glass.pos} rotation={PROPS.glass.rot} scale={PROPS.glass.scale}>
                <Magnifier />
              </group>
              <group position={PROPS.palette.pos} rotation={PROPS.palette.rot} scale={PROPS.palette.scale}>
                <Palette />
              </group>
              <group position={PROPS.toggle.pos} rotation={PROPS.toggle.rot} scale={PROPS.toggle.scale}>
                {/* glass = 0: สวิตช์ของ hero เป็นแก้วหักเห ซึ่งบังคับให้วาดฉากซ้ำอีกรอบ
                    ของชิ้นเท่านี้บนพื้นเรียบ มองไม่เห็นการหักเหอยู่แล้ว */}
                <Switch glass={0} pos={1} />
              </group>
            </>
          )}
        </Order>

        {/**
         * ตัวละคร + ฉากหลังในจอ — อยู่ *นอก* กิ่ง Order 10
         *
         * สองชั้นนี้สั่งลำดับวาดของตัวเองทุกเฟรม (ดู InsideScreen / REPLICA_ORDER) การถูก
         * Order กวาดทับให้เป็น 10 ในช่วงเฟรมแรก ๆ ทำให้ฉากหลัง (11) ขึ้นมาทับตัวละครอยู่
         * สองวินาทีแรกของจอ
         */}
          {/**
           * ตัวละคร — ครึ่งตัวหันเฉียง อยู่ *ใน* จอของหน้าต่าง
           *
           * ริกตัวเดิมทั้งตัว ไม่ได้ตัดครึ่ง: เลื่อนลงจนฝ่าเท้าพ้นขอบช่องแล้วขยาย เท่ากับกล้อง
           * ซูมเข้าที่ท่อนบน — ตัดชิ้นส่วนออกคือทำให้มันเป็นตัวละครคนละตัวกับจอแรก
           * ขอบล่างของภาพคือขอบช่อง ไม่ใช่ขอบจอ (ดู InsideScreen)
           * ค่าทั้งชุดลากได้จากแผง (ดู ./stageTuner)
           */}
          {t.char > 0.5 && (
            <Rising y={t.chY} lift={CHAR_LIFT}>
            <group
              position={[t.chX, 0, t.chZ]}
              rotation={[t.chRotX * RAD, t.chRotY * RAD, t.chRotZ * RAD]}
              scale={t.chScale}
            >
              {/* วาดหลังฉากหลังในจอ (REPLICA_ORDER) — ตัวละครยืนอยู่หน้าทุ่ง ไม่ใช่ในทุ่ง */}
              <InsideScreen order={REPLICA_ORDER + 3}>
                {/**
                 * `noLean` = ริกท่าสเก็ตตัวเดียวกับ hero แต่ไม่เอียงลำตัวตามบอร์ด · `noBoard` เอาบอร์ดออก
                 *
                 * ไม่ใช้โหมด `stand`: แขน lumberjack ถูกแขวนตามแกนข้อต่อของริกท่าสเก็ต โหมดยืน
                 * ปั้นริกคนละแบบ แขนจึงเหลื่อมเห็นรอยต่อที่ศอก (วัดมาแล้ว) ส่วนแขนของริกเอง
                 * (noLumber) ไม่ใช่แขนเดียวกับ hero
                 */}
                <HeroRider
                  noLean
                  noBoard
                  /**
                   * ไม่มีลม — เสื้อไม่ปริว
                   *
                   * ฉากนี้เป็นภาพนิ่ง (หัวไม่ตามเมาส์ ตัวไม่ไถล) ผ้าที่สะบัดอยู่ตัวเดียวจึงอ่าน
                   * เป็นของที่หลุดออกมาจากฉากอื่น ไม่ใช่ลมของฉากนี้
                   *
                   * วัดมาแล้วว่าตัวสวิตช์ทำงานจริง: ปิดลม+ปิดไหวตัว = ไม่มีพิกเซลไหนขยับเลย
                   * ส่วนปิดแค่ไหวตัวยังเหลือผ้าสะบัด 6–12 พันพิกเซลต่อเฟรม ความไหวของ *ตัว*
                   * (หายใจ/โยก) ยังอยู่ ไม่ได้ปิดไปด้วย — ที่สั่งคือเสื้อ ไม่ใช่ทั้งตัว
                   */
                  noWind
                  /**
                   * ท่าหัวคงที่ ไม่ตามเมาส์ — จอนี้เป็นภาพนิ่งตามรูปอ้างอิง
                   *
                   * headFollow 0 = ไม่ตามเมาส์เลย ค่าที่เหลือคือท่าตั้งต้นของหัว (เรเดียน)
                   */
                  followOverride={{
                    headYaw: 0,
                    headPitch: 0,
                    headRoll: 0,
                    headEase: 1,
                    headBaseYaw: t.chHeadYaw * RAD,
                    headBasePitch: t.chHeadPitch * RAD,
                    headBaseRoll: t.chHeadRoll * RAD,
                    headFollow: 0,
                    headCurve: 1,
                    headDead: 0,
                    headBounce: 0,
                    headIdleBack: 0,
                  }}
                />
              </InsideScreen>
            </group>
            </Rising>
          )}
      </group>

      {/**
       * ฉากหลังในจอ — อยู่นอกกลุ่มที่เลื่อนกองหน้าต่างให้อยู่กลางจอ
       *
       * มันวาดในพิกัดของ *จอ* (uv เดียวกับรูปจริงที่รอยสาดเปิดเผย — ดู ./Replica) ไม่ใช่
       * พิกัดของกองหน้าต่าง ถ้าเอาไปไว้ในกลุ่มนั้น ฉากจะเลื่อนตามกองแล้วไม่ทับกับรูปจริง
       */}
      {t.replica > 0.5 && <Replica stencilRef={SCREEN_BIT} stencilFuncMask={SCREEN_BIT} />}

    </>
  )
}


/**
 * กองหน้าต่างที่ซ้อนอยู่รอบใบพอร์ทัล — ทุกใบใช้เรขาคณิตชุดเดียวกัน
 *
 * สร้างสามชุดสำหรับสามใบคือ GPU buffer สามเท่าของของที่หน้าตาเหมือนกัน ต่างกันแค่ตำแหน่ง
 * กับสเกล ซึ่งเป็นเรื่องของ matrix ไม่ใช่ของเรขาคณิต
 *
 * จุดสามจุดของใบหลังเป็นแผ่นเดียวที่แปะเท็กซ์เจอร์ ไม่ใช่วงกลมสามชิ้นอย่างใบหน้า —
 * สามใบคูณสามจุดคือเก้า draw call ที่จ่ายไปกับของกว้างไม่ถึงหนึ่งหน่วย
 */
function StackWindows({ list, order }) {
  const slab = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(CARD_W, CARD_H, CARD_R), {
      depth: CARD_D,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
      curveSegments: 10,
    })
    g.translate(0, 0, -CARD_D / 2)
    return g
  }, [])
  useDisposable(slab)
  const screen = useMemo(() => roundedPlane(CARD_W - BAR * 2, BODY_H - BAR, CARD_R * 0.5), [])
  useDisposable(screen)
  /**
   * แผ่นสี่เหลี่ยมธรรมดา ไม่ใช่ roundedPlane
   *
   * roundedPlane สร้างจาก Shape ซึ่ง UV ของมันเป็นพิกัดของรูปร่าง ไม่ได้ไล่ 0..1 ตามกรอบ
   * เท็กซ์เจอร์จุดจึงถูกลากเพี้ยนและถูกมุมมนกินไปด้วย (วัดมาแล้ว — เห็นเป็นเศษสามเหลี่ยม)
   *
   * ใหญ่กว่าจุดของใบหน้าหนึ่งในสาม เพราะใบหลังถูกย่อด้วยสเกลของตัวเองอยู่แล้ว
   */
  const dots = useMemo(() => new THREE.PlaneGeometry((DOT_GAP * 2 + DOT_R * 2) * 1.34, DOT_R * 2.68), [])
  useDisposable(dots)
  const dotTex = useMemo(() => dotsTexture(), [])
  useDisposable(dotTex)
  const label = useMemo(() => new THREE.PlaneGeometry(CARD_W * 0.5, BAR_T * 0.72), [])
  useDisposable(label)
  /** ชื่อไฟล์เป็นเท็กซ์เจอร์ใบละอัน — ตัวหนังสือไม่กี่ตัว ไม่คุ้มลาก text geometry มาทั้งชุด */
  const labels = useMemo(() => list.map((b) => labelTexture(b.label)), [list])
  useDisposable(labels)

  return (
    <group>
      {list.map((b, i) => (
        <FanGroup key={i} from={b.from} to={b.pos} scale={b.scale} rotation={b.rot} delay={b.delay}>
          {/* วาดก่อนทุกอย่าง — ฉากในพอร์ทัลของใบหน้าวาดโดยปิดการทดสอบความลึก ถ้าใบหลัง
              ไม่ได้ถูกสั่งให้ไปก่อน มันจะไปทาทับเนื้อในช่องของใบหน้า */}
          <mesh geometry={slab} renderOrder={order}>
            {/**
             * ผิวดำด้าน ไม่ยกพื้นด้วย emissive
             *
             * ของขาวต้องยก emissive เพราะแผ่นตั้งฉากกล้องรับ key light เฉียง ๆ น้อย ใส่ขาว
             * ล้วนแล้วออกมาเทา ของดำกลับกัน: ยกพื้นเท่าไรก็กลายเป็นเทา สีดำที่ยังอ่านเป็นวัตถุ
             * มาจาก roughness สูงกับแสงขอบ ไม่ใช่จากการเปล่งแสง
             */}
            <meshStandardMaterial color={b.shell} roughness={0.62} />
          </mesh>
          {/* พ้นทั้งความหนาและ bevel ของแผ่น — bevel ยื่นออกไปอีก bevelThickness จากหน้าแผ่น
              ตั้งไว้แค่ +0.02 หน้าจอกับจุดจะจมอยู่ในแผ่น มองไม่เห็นเลย (วัดมาแล้ว) */}
          <mesh geometry={screen} position={[0, HOLE_Y, CARD_D / 2 + 0.12]} renderOrder={order}>
            {/* ไม่รับแสงของฉาก — แผ่นแต่ละใบหันรับไฟไม่เท่ากัน ถ้าใช้วัสดุที่รับแสง เขียวของ
                แต่ละบานจะออกมาคนละเฉด ทั้งที่เป็นค่าสีเดียวกัน */}
            <meshBasicMaterial color={SCREEN} toneMapped={false} />
          </mesh>

          <mesh
            geometry={dots}
            position={[-CARD_W / 2 + 0.62 + DOT_GAP, CARD_H / 2 - BAR_T / 2, CARD_D / 2 + 0.14]}
            renderOrder={order}
          >
            <meshBasicMaterial map={dotTex} transparent toneMapped={false} />
          </mesh>

          {/* ชื่อไฟล์กลางแถบหัว — ของที่ทำให้แผ่นอ่านเป็น "หน้าต่างที่เปิดอยู่" ไม่ใช่กรอบเปล่า */}
          <mesh
            geometry={label}
            position={[0, CARD_H / 2 - BAR_T / 2, CARD_D / 2 + 0.14]}
            renderOrder={order}
          >
            <meshBasicMaterial map={labels[i]} transparent toneMapped={false} />
          </mesh>
        </FanGroup>
      ))}
    </group>
  )
}

/** จุดสามจุดของใบหลัง — วาดลงผ้าใบครั้งเดียวแล้วทุกใบใช้ร่วมกัน */
function dotsTexture() {
  const cv = document.createElement('canvas')
  cv.width = 384
  cv.height = 96
  const ctx = cv.getContext('2d')
  const r = 48
  DOTS.forEach((c, i) => {
    ctx.beginPath()
    ctx.arc(r + i * (r * 2 + 48), 48, r * 0.74, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * ขังของในกิ่งให้โผล่เฉพาะในช่องหน้าจอ (บนสำเนาของวัสดุ)
 *
 * ตัวละครอยู่ *หลังกระจกทุกบาน* — เห็นเฉพาะส่วนที่ทับพื้นที่หน้าจอของบานใดบานหนึ่ง
 * ส่วนที่พ้นออกไปหายสนิท ตัวคัดคือ stencil: หน้าจอของทุกบานเขียนค่าไว้ (ดู SCREEN_REF)
 * ตัวละครทดสอบว่า "ไม่เท่ากับ 0" จึงโผล่ได้ทุกบานโดยไม่ต้องรู้ว่ามีกี่บาน
 *
 * ตัวละครวางไว้หน้าแผ่นกระจกทุกบาน (chZ) การทดสอบความลึกจึงเปิดไว้ได้ — ชิ้นส่วนของมันเอง
 * ต้องบังกันตามความลึกถูกต้อง ส่วนบานที่ต้องอยู่ *หน้า* ตัวละครใช้ลำดับวาดเป็นตัวบัง
 * (order 10 — วาดหลังตัวละคร)
 *
 * ทำบน *สำเนา* ของวัสดุ ไม่ใช่ตัวเดิม: วัสดุของริกถูกแคชไว้ระดับโมดูล ตัวเดียวกับที่ฉากจอแรก
 * ใช้ เขียนธงทับของที่แชร์กันอยู่คือไปพังอีกจอ (ดูคำเตือนใน joespresso/scene/utils)
 *
 * renderOrder สูงกว่าของในช่อง (แผ่นรอง 2 / ก้อนลอย 3) ตัวละครจึงทาทับฉากในช่องได้
 */
function InsideScreen({ children, order = 5 }) {
  const g = useRef()
  /** วัสดุเดิม -> สำเนาที่ตั้งธงแล้ว — ใบเดียวต่อวัสดุหนึ่งใบ ไม่ว่าจะถูกยัดกลับมากี่รอบ */
  const copies = useRef(new WeakMap())
  const made = useRef([])

  useFrame(() => {
    const root = g.current
    if (!root) return
    root.traverse((o) => {
      if (!o.material) return
      o.renderOrder = order
      const list = Array.isArray(o.material) ? o.material : [o.material]
      let hit = false
      const out = list.map((m) => {
        if (m.userData.screenClone) return m
        let c = copies.current.get(m)
        if (!c) {
          c = m.clone()
          c.stencilWrite = true
          c.stencilRef = SCREEN_BIT
          c.stencilFunc = THREE.EqualStencilFunc
          c.stencilFuncMask = SCREEN_BIT
          /* คงการทดสอบความลึกไว้ — ปิดแล้วชิ้นส่วนของตัวละครเองไม่บังกันตามความลึก
             เห็นเสื้อทับคาง แขนทับหน้า (วัดมาแล้ว) ตัวละครอยู่หน้าแผ่นกระจกทุกบานตาม
             ค่า chZ อยู่แล้ว จึงไม่ต้องปิด */
          c.depthTest = true
          c.userData.screenClone = true
          copies.current.set(m, c)
          made.current.push(c)
        }
        hit = true
        return c
      })
      if (hit) o.material = Array.isArray(o.material) ? out : out[0]
    })
  })

  /* คืน GPU buffer ของสำเนาทั้งหมดตอนออกจากจอ — ของที่โคลนเองต้องเก็บกวาดเอง */
  useEffect(() => () => made.current.forEach((m) => m.dispose()), [])

  return <group ref={g}>{children}</group>
}

/**
 * สั่งลำดับวาดให้ทุกชิ้นในกิ่ง
 *
 * จำเป็นเพราะฉากในพอร์ทัลวาดโดยปิดการทดสอบความลึก (ดู InsidePortal overlay) ถ้าไม่กำหนด
 * ลำดับ ของในช่องจะทาทับของที่อยู่หน้าการ์ดด้วย — ตัวละครหายเข้าไปในช่องทั้งตัว
 *
 * ลำดับที่ใช้: แผ่นการ์ด (-1) -> ฉากในช่อง (2..) -> ของหน้าการ์ด (10)
 * ของหน้าการ์ดยังทดสอบความลึกตามปกติ จึงบังกันเองถูกต้องอยู่
 */
function Order({ n, children }) {
  const g = useRef()
  const left = useRef(120)
  useFrame(() => {
    const root = g.current
    if (!root || left.current <= 0) return
    left.current -= 1
    root.traverse((o) => {
      if (o.material || o.isMesh) o.renderOrder = n
    })
  })
  return <group ref={g}>{children}</group>
}

/** ตัวหน้าต่าง: แถบหัว + กรอบเนื้อที่กลางเป็นรูจริง + ฉากข้างในที่มองทะลุรูไปเห็น */
function Card() {
  /**
   * แถบหัวกับกรอบเนื้อเป็นสองชิ้น ไม่ใช่กรอบเดียวที่ขอบบนหนา
   *
   * roundedFrameGeo ผูกความหนาขอบข้างไว้กับความหนาขอบบน (รูของมันคือ w - bar*2) ทำ
   * หน้าต่างที่ "หัวหนา ข้างบาง" ด้วยชิ้นเดียวไม่ได้ จึงวางแถบหัวเป็นแผ่นของตัวเองแล้วให้
   * กรอบเนื้อซ้อนใต้มันเล็กน้อย รอยต่ออยู่ใต้แถบซึ่งไม่มีใครเห็น
   */
  const frame = useMemo(
    () => roundedFrameGeo(CARD_W, BODY_H + CARD_R, BAR, CARD_D, CARD_R, 0.06, BAR),
    [],
  )
  useDisposable(frame)
  const bar = useMemo(() => {
    /* มุมมนรัศมีเดียวกับตัวหน้าต่าง — ขอบบนของหน้าต่างคือขอบบนของแถบนี้ */
    const g = new THREE.ExtrudeGeometry(roundedRectShape(CARD_W, BAR_T + CARD_R, CARD_R), {
      depth: CARD_D,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 12,
    })
    g.translate(0, 0, -CARD_D / 2)
    return g
  }, [])
  useDisposable(bar)
  /**
   * แผ่นรองฉากข้างใน — ใหญ่กว่าช่องมาก เผื่อไม่ให้เห็นขอบแผ่น
   *
   * PlaneGeometry ไม่ใช่ roundedPlane: roundedPlane สร้างจาก Shape ซึ่ง UV เป็น *พิกัด
   * ของรูปร่าง* ไม่ได้ไล่ 0..1 ตามกรอบ พื้นไล่สีจึงถูกลากผิดสัดส่วนและขอบที่เลย 0..1 ถูก
   * clamp เป็นสีแถวแรกของเท็กซ์เจอร์ — เห็นเป็นแถบขาวคาดอยู่ในช่อง (วัดมาแล้ว ตอนกรอบยัง
   * ขาวอยู่มันกลืนไปกับกรอบ พอกรอบเป็นดำจึงโผล่)
   */
  const back = useMemo(() => new THREE.PlaneGeometry(HOLE_W * 2.2, HOLE_H * 2.2), [])
  useDisposable(back)

  return (
    <group>
      {/**
       * แถบหัว — สูงกว่าที่เห็นอยู่ CARD_R เพราะครึ่งล่างของมันมุดไปอยู่ใต้กรอบเนื้อ
       * ขอบบนของมันคือขอบบนของหน้าต่างพอดี (ไม่ใช่ล้นขึ้นไป) มุมล่างที่มนอยู่ถูกกรอบเนื้อ
       * ซึ่งทึบตรงนั้นบังไว้หมด
       */}
      <mesh geometry={bar} position={[0, CARD_H / 2 - (BAR_T + CARD_R) / 2, 0]}>
        <meshStandardMaterial color={SKIN.bar} roughness={0.6} />
      </mesh>

      {/* กรอบเนื้อหน้าต่าง — ขอบบางเท่ากันสามด้าน ส่วนที่เกินขึ้นไปซ่อนอยู่ใต้แถบหัว */}
      <mesh geometry={frame} position={[0, HOLE_Y - CARD_R / 2, 0]}>
        {/* กรอบดำเข้มกว่าแถบหัว — สองระดับนี้คือสิ่งที่แยกแถบหัวออกจากตัวกรอบในหน้าต่างสีดำ
            ที่ไม่มีเงาตกกระทบมาช่วย */}
        <meshStandardMaterial color={SKIN.frame} roughness={0.55} />
      </mesh>

      {/* จุดสามจุด — ลอยหน้าแถบหัวเล็กน้อย ไม่ใช่สีที่ทาอยู่บนระนาบเดียวกัน */}
      {DOTS.map((c, i) => (
        <mesh
          key={c}
          position={[
            -CARD_W / 2 + 0.62 + i * DOT_GAP,
            /* กลางแถบที่ *มองเห็น* (CARD_H/2 ลงมาครึ่งแถบ) ไม่ใช่กลางแผ่นแถบซึ่งจมลงไปใต้กรอบ */
            CARD_H / 2 - BAR_T / 2,
            /* พ้นทั้งความหนาและ bevel ของแถบ — bevel ยื่นออกไปอีก bevelThickness จากหน้าแผ่น
               ตั้งไว้แค่ +0.02 จุดจะจมอยู่ในแถบ มองไม่เห็นเลย (วัดมาแล้ว) */
            CARD_D / 2 + 0.12,
          ]}
        >
          <circleGeometry args={[DOT_R, 24]} />
          <meshStandardMaterial color={c} roughness={0.45} emissive={c} emissiveIntensity={0.25} />
        </mesh>
      ))}

      {/* ฉากข้างใน — โผล่เฉพาะในกรอบช่อง และถูกตัวละครที่ยืนหน้ากรอบบังตามความลึกจริง */}
      {/**
       * overlay: ฉากในช่องถูกคัดด้วย stencil เท่านั้น ไม่ใช่ด้วยความลึก
       *
       * บานอื่นย้ายความลึกได้อิสระจากแผงจูน (w4 ลงไปได้ถึง z -10) ถ้าฉากในช่องยังถูกคัดด้วย
       * ความลึก บานที่บังเอิญไปอยู่ระดับเดียวกับแผ่นรอง (z -4) จะโผล่เข้ามาในช่องเป็นหย่อม ๆ
       * (วัดมาแล้ว: research.png ที่ z -4.2 หน้าจอของมันอยู่ที่ -4.0 พอดี เห็นเป็นสี่เหลี่ยม
       * ดำคาทับพื้นในช่อง) เนื้อในช่องเป็นของ *หน้าต่างใบนั้น* ไม่ใช่ของในระดับความลึกของกอง
       *
       * แลกมาด้วยการต้องสั่งลำดับวาดของข้างในเอง: แผ่นรองก่อน ของลอยทีหลัง
       */}
      <InsidePortal overlay>
        {/**
         * พื้นของฉากในช่อง — เขียวเรียบค่าเดียวกับหน้าจอของบานอื่น (ดู SCREEN)
         *
         * เดิมเป็นพื้นไล่สีส้มกับก้อนลอย ซึ่งทำให้บานพอร์ทัลเป็นจอคนละสีกับที่เหลือ
         * meshBasicMaterial: พื้นจอไม่ควรรับแสงของฉาก ไม่งั้นเขียวของแต่ละบานไม่เท่ากันตาม
         * มุมที่มันหันรับไฟ
         *
         * stencilFuncMask: ดูแค่บิตของช่องพอร์ทัล ไม่สนบิตของพื้นที่หน้าจอ (ดู SCREEN_BIT)
         */}
        <mesh geometry={back} position={[0, HOLE_CY, -4]} renderOrder={2}>
          <meshBasicMaterial color={SCREEN} toneMapped={false} stencilFuncMask={PORTAL_BIT} />
        </mesh>
      </InsidePortal>
    </group>
  )
}

/** ชื่อไฟล์บนแถบหัว — วาดลงผ้าใบเล็ก ๆ ใบละอัน */
function labelTexture(text) {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 96
  const ctx = cv.getContext('2d')
  ctx.font = '600 46px ui-sans-serif, system-ui, sans-serif'
  /* เทาอ่อน ไม่ใช่ขาว — ชื่อไฟล์บนแถบหัวของ mac ไม่เคยเป็นตัวหนังสือที่เด่นกว่าเนื้อหา */
  ctx.fillStyle = '#9aa3b2'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 52)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default CardStage
