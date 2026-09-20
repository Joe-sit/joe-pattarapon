import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useCursorStop } from '@/cursorguide/useCursorStop'
import { cursorShow, cursorWake } from '@/cursorguide/morph'
import { SKILLS } from '@/sections/whatido/WhatIDo'
/* ภาพประกอบสกิล — ไฟล์เดียวกับกระเบื้องของจอ /2026 ฝังเป็น inline เพื่อให้ไล่โผล่ทีละชั้นได้ */
import skillsCursorRaw from '@/assets/v2/skills-cursor.svg?raw'
import skillsPixelsRaw from '@/assets/v2/skills-pixels.svg?raw'
import skillsPencilRaw from '@/assets/v2/skills-pencil.svg?raw'
import { WhiteWrap } from '@/sections/whatidocard/WhiteWrap'
import { getWhatIDoTuner, useWhatIDoTuner, type WhatIDoTuner } from './whatidoTuner'

/**
 * จอ "สิ่งที่ทำ" — คอลลาจตามแบบ เลื่อนไปจอดที่ผังแบ่งครึ่ง แล้วเล่าสกิลทีละอัน
 *
 * ยกเครื่องจากของเดิมทั้งจอ: พอร์ทัลดาวสามมิติกับโมเสกแผ่นสกิลถูกเอาออก (ไฟล์ยังอยู่ครบที่
 * sections/aboutstar) ตัวละครสามมิติกลับมายืนเต็มตัวแทนรูปถ่าย (ดู ./HeroFigure)
 *
 * ### สามช่วง ไม่ใช่แถวยาวที่ไถลไปเรื่อย
 *
 * 1. `HOLD` — คอลลาจยืนนิ่งให้ดู
 * 2. `SLIDE` — คอลลาจไถลไปทางซ้ายจนโมเสกเหลืออยู่แค่แถบซ้าย **แล้วล็อกอยู่ตรงนั้น**
 * 3. `STEP` × จำนวนสกิล — แถบขวาเปลี่ยน *ทีละสกิล* ไม่ใช่เลื่อนแผงผ่านตาไปทั้งแถว
 *
 * ของเดิมเป็นแถวเดียวยาวที่เลื่อนต่อเนื่อง: เห็นสองสกิลครึ่งใบพร้อมกันตลอด ไม่มีใครได้เป็น
 * ตัวเอกของช่วงไหน — เจ้าของงานสั่งให้ล็อกผังแบ่งครึ่งแล้วสลับทีละอัน ช่วงละหนึ่งสกิล
 *
 * ระยะไถลไม่ใช่เลขที่กะไว้: วัดขอบขวาของโมเสกจริงแล้วคิดว่าต้องเลื่อนเท่าไรให้มันไปจบที่
 * `KEEP` ของความกว้างจอ (ดูลูป rAF) — จอกว้างจอแคบหรือย่อจอ ก็จอดที่ผังเดียวกัน
 *
 * ตัวหนังสือทุกตัวอยู่ใน DOM ส่วนโมเสก/ดาว/วงเล็บส้ม/วงแหวนเขียวเป็น element จริงที่คิดจาก
 * ข้อมูลกับสมการ ไม่ใช่รูป export (ดู `GRID`, `blobPath`, `portalClipPath`)
 */

/**
 * ตัวละครสามมิติในคอลลาจ — โหลดเฉพาะตอนจอนี้เข้ามาในสายตา
 *
 * โมเดลตัวละครเป็นไฟล์ก้อนใหญ่ ถ้า import ตรง ๆ มันจะถูกดึงตอนหน้าเปิด ซึ่งคนดูยังอยู่
 * จอแรกที่มีฉาก 3D ของตัวเองอยู่แล้ว
 */
const HeroFigure = lazy(() => import('./HeroFigure').then((m) => ({ default: m.HeroFigure })))

/** แผงจูนของจอนี้ — dev เท่านั้น แยกไฟล์เพราะมันไม่ใช่ของในจอ (ดู ./WhatIDoPanel) */
const WhatIDoPanel = lazy(() =>
  import('./WhatIDoPanel').then((m) => ({ default: m.WhatIDoPanel })),
)

/**
 * จังหวะกับผังทั้งหมดอยู่ใน ./whatidoTuner — ลากได้จากแผงจูน ไม่ใช่ const ในไฟล์นี้
 *
 * ที่ต้องเป็นสโตร์ไม่ใช่ค่าคงที่: ค่าพวกนี้ต้องลองบนจอจริงถึงจะรู้ว่าพอดี (ระยะไถล จังหวะ
 * สลับสกิล ที่ยืนของตัวละครเทียบวงเล็บ) เดิมต้องแก้ไฟล์แล้วรอ reload ทุกครั้ง
 */

/** ระยะที่ท่าปิดจอจุดชนวน — คิดจากจังหวะปัจจุบัน (สกิลใบสุดท้ายเล่าจบแล้ว) */
const wrapAt = (t: WhatIDoTuner) => t.hold + t.step * SKILLS.length + t.tail

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

/**
 * กรอบของแบบ — คอลลาจถูกจัดวางในสัดส่วนนี้ ไม่ใช่ในสัดส่วนของจอผู้ชม
 *
 * ทุกชิ้นวางเป็น % ของกรอบ 1440×779 ตามเลขในไฟล์แบบ แล้วกรอบทั้งอันถูกย่อแบบ contain
 * ให้พอดีจอ — เห็นคอลลาจครบทั้งอันเหมือนในแบบ (ซึ่งมีขอบขาวบน-ล่างและช่องขาวทางซ้าย
 * ให้คำทักทายยืน) ถ้าใช้ cover จอที่สูงกว่าแบบจะซูมจนคำทักทายหลุดออกนอกจอ
 */
const ART_W = 1440
const ART_H = 1024

/** ความกว้างกรอบเป็น px จริงบนจอ — ของที่ต้องคิดเป็น px (ช่องโมเสก, ความหนาวงแหวน) อ้างค่านี้ */
const ART_PX = `min(100svw, calc(100svh * ${ART_W} / 700))`

/* ── ผังของแบบ (โหนด 12822:290) ───────────────────────────────────────────── */

/**
 * ทุกชิ้นในคอลลาจ **ดึงจากไฟล์แบบตรง ๆ** ผ่าน MCP ไม่ใช่กะจากภาพ export
 *
 * ### ระวัง: พิกัด x ที่เครื่องมือคืนมาเป็นภาพกระจก
 *
 * โหนดนี้ (และลูกของมันหลายตัว) มี transform พลิกแกน ผลคือ `left` ในโค้ดอ้างอิงที่ได้จาก
 * Figma เป็นพิกัดของ *ภาพกระจก* — ตรวจได้จากภาพตัวอย่าง: บล็อก 300×300 ที่โค้ดบอก
 * `left: 783` จริง ๆ อยู่ที่ x = 357 ซึ่งคือ 1440 − 783 − 300 พอดี (ตรวจซ้ำกับอีกสี่ชิ้น
 * แล้วเข้าสูตรเดียวกันทั้งหมด) ตัวเลขด้านล่างจึงเป็น **พิกัดที่เห็นจริง** = 1440 − left − w
 * ส่วนพิกัด y ไม่ถูกพลิก ใช้ตามที่ได้มา
 *
 * ### แบบนี้ต่างจากแบบก่อนคนละเรื่อง
 *
 * ของก่อนเป็นตารางโมเสกน้ำเงินหกแถว ตัวคนอยู่ครึ่งซ้าย ของใหม่เป็น **บล็อกเทาหลายขนาด
 * กระจายฝั่งซ้าย** กับ **แผงรูปฝั่งขวา** (วงเล็บส้มกับวงแหวนเขียวย้ายไปอยู่กับแผงรูป) —
 * ผังกลับข้างกันทั้งหมด ไม่ใช่การปรับตัวเลข
 */

/** บล็อกเทา — ขนาดกับที่วางตามไฟล์แบบ ไม่มีมุมมน (เป็น `d9d9d9` ล้วนในไฟล์) */
const BLOCKS = [
  { x: 86, y: 188, w: 271, h: 100 },
  { x: 657, y: 138, w: 150, h: 150 },
  { x: 357, y: 288, w: 300, h: 300 },
  { x: 107, y: 488, w: 100, h: 100 },
  { x: 207, y: 588, w: 150, h: 150 },
  { x: 65, y: 738, w: 142, h: 50 },
  { x: 357, y: 738, w: 271, h: 100 },
]
const BLOCK_FILL = '#d9d9d9'

/** บล็อกที่สัญลักษณ์ประจำสกิลยืนอยู่ — ใบใหญ่สุด (300×300) */
/**
 * บล็อกที่ **กางออกมาเป็นการ์ดเล่าสกิล** — ใบละหนึ่งสกิล เรียงตามลำดับใน `SKILLS`
 *
 * ทุกใบกางไปที่ **กรอบเดียวกัน** (`CARD`) ไม่ใช่คนละที่: ที่อ่านจึงนิ่ง ตาไม่ต้องวิ่งตาม
 * การ์ดที่ย้ายตำแหน่งทุกครั้งที่เปลี่ยนสกิล — สิ่งที่ต่างกันคือ *จุดออกตัว* ซึ่งเป็นกรอบเดิม
 * ของบล็อกใบนั้นในไฟล์แบบ ใบไหนถึงคิวก็ยืดจากที่ของตัวเองเข้ามาเป็นการ์ด
 *
 * เพราะทุกใบอยู่ในชั้นที่ถูกกรองแบบ gooey ใบที่กางออกจะดึงคอเชื่อมกับใบข้าง ๆ ยืดตามไปด้วย
 * แล้วค่อยขาดออกเมื่อยืดไกลพอ — เป็นผลพลอยได้ของตัวกรอง ไม่ได้เขียนท่าไว้
 */
const SKILL_BLOBS = [0, 2, 6]

/** กรอบการ์ด (พิกัดกรอบแบบ) — อยู่ครึ่งซ้าย ไม่ชนกรอบรูปที่ x 807 */
const CARD = { x: 120, y: 214, w: 648, h: 500 }


/** แผงอ่อนหลังรูป — มุมมน 40 ทั้งสี่มุม */
const PANEL = { x: 807, y: 260, w: 499, h: 511, r: 40, fill: '#ecedee' }

/**
 * กรอบรูปในแบบ = ที่ยืนของตัวละครสามมิติ (มุมล่างมน 40 มุมบนเหลี่ยม)
 *
 * ในไฟล์แบบมีรูปสองใบทับกัน: ใบสูง 794 ที่ถูกมุมล่างมนตัด และใบ 414×415 เฉพาะช่วงหัวที่
 * วาด *ทับวงเล็บ* — นั่นคือกลไกที่ทำให้หัวอยู่หน้าวงเล็บแต่ลำตัวอยู่หลัง ที่นี่ใช้วิธีเดิม
 * ของจอนี้แทน (วงเล็บสองสำเนา ใบหน้าถูกตัดใต้เส้น `brSplit`) เพราะตัวละครเป็นแคนวาส 3D
 * จะวาดซ้ำสองใบไม่ได้ถูก ๆ
 */
const PHOTO = { x: 807, y: 41, w: 499, h: 794, r: 40 }

/**
 * วงเล็บส้ม — **พาธจริงจากไฟล์แบบ** (asset `5e78c.svg` ขนาด 155×647 fill #F16A1A)
 *
 * ฝังพาธไว้ในโค้ดเพราะลิงก์ asset ของ Figma หมดอายุใน 7 วัน และของเดิมที่จอนี้ใช้
 * (`portalShape.portalClipPath`) เป็นพหุเหลี่ยมที่ไล่จุดจากโหนดเก่า มุมไม่มนเท่าของจริง
 */
const BRACKET = { x: 807, y: 188, w: 155, h: 647, fill: '#f16a1a' }
const BRACKET_PATH =
  'M0.279234 0H122.424H154.987V9.45777L154.981 323.582L155 355.671L154.994 388.29V485.182V517.426L154.998 614.542C154.999 632.468 140.468 647 122.542 647H0.308381L0.45338 564.207C27.5307 562.928 57.816 563.509 85.1302 563.495L85.1314 457.382C85.1226 439.747 84.1922 407.983 86.9764 391.912C89.0784 379.232 93.8361 367.139 100.939 356.422C105.926 348.94 112.295 342.477 119.705 337.376C123.271 334.908 141.75 325.987 142.371 325.014C141.674 322.988 137.608 322.305 135.623 321.754C77.0177 305.486 85.146 239.616 85.1454 193.487L85.1308 84.1442L0.265936 84.1764C-0.275573 56.8536 0.157632 27.4317 0.279234 0Z'

/**
 * วงแหวนเขียว — พาธจริงจากไฟล์แบบ (asset `91157.svg` 327×299 fill #00FA65)
 *
 * ของเดิมเป็นขอบของ div วงรี ซึ่งได้เสี้ยวเรขาคณิตเป๊ะ ๆ แต่ของในแบบ **วาดมือ** ขอบในนอก
 * ไม่ขนานกันจริง และท้องแถบเบี้ยวเล็กน้อย — ใช้พาธของแบบจึงตรงกว่าและไม่ต้องเถียงเรื่อง
 * ทิศอีก (ท้องแถบโป่งไปทางขวาล่าง ใจกลางความโค้งอยู่มุมซ้ายบนของกรอบ)
 */
const ARC = { x: 979, y: 536, w: 327, h: 299, fill: '#00fa65' }
const ARC_PATH =
  'M226.779 30.936C263.913 13.6721 286.89 6.23448 327 0C326.018 19.5489 327.057 41.8574 326.658 61.6914C326.499 69.6178 325.957 93.2356 326.885 99.4869C291.84 107.241 254.428 122.25 226.122 144.819C205.483 159.281 186.056 179.095 170.305 198.711C158.246 213.96 130.881 254.645 125.58 273.006C121.743 280.445 116.346 290.849 114.359 299H0C5.34778 279.662 18.7004 247.623 27.6788 229.849C32.9143 220.208 37.2099 211.382 42.8203 201.66L43.3782 200.972C61.526 167.646 97.9172 126.26 125.732 100.165L126.627 99.4285C146.451 79.0014 201.081 42.1062 226.779 30.936Z'

/* ── สัญลักษณ์ในโมเสก ───────────────────────────────────────────────────── */

/**
 * ทรงกลีบ — คิดจากสมการ ไม่ใช่ path ที่ก๊อปมาจากไฟล์แบบ
 *
 * รัศมีแกว่งเป็นคลื่นรอบวง: `r(θ) = R/(1+k) · (1 + k·cos(nθ))` คลื่นเดียวจึงได้กลีบ n กลีบ
 * ที่ทั้งยอดและง่ามมนเท่ากันเอง (ไม่ต้องไปมนมุมทีหลัง) — `k` คุมความลึกของกลีบ: อัตราส่วน
 * ยอด:ง่าม = (1+k):(1−k)
 *
 * ค่าจริงของแบบ **วัดด้วยการยิงรัศมีออกจากใจกลางดอกจันทุก 30°** ในโหนด 12822:290 ได้ยอด
 * 106.75px ง่าม 71.1px → อัตราส่วน 1.50 → k = 0.20 (ค่าที่ผมเคยใส่คือ 0.31 จากการกะว่า
 * อัตราส่วนราว 1.9 เท่า กลีบจึงลึกกว่าแบบและดอกจันดูผอมกว่าที่ควร)
 *
 * สร้างเป็นพหุเหลี่ยม 180 จุด: ที่ขนาดบนจอ (ไม่เกินราว 200px) ระยะระหว่างจุดเป็นเศษพิกเซล
 * ตาแยกไม่ออกจากเส้นโค้งจริง และไม่ต้องคิดจุดควบคุมของเบซิเยร์
 *
 * **เฟสของคลื่นต้องบวก π/2 คูณจำนวนกลีบ** ไม่ใช่ปล่อยเป็นศูนย์: เริ่มไล่มุมที่ยอดกรอบ
 * (θ = −π/2) ถ้าไม่เลื่อนเฟส `cos(n·θ)` ที่จุดนั้นเป็น −1 คือ *ง่าม* ไม่ใช่ยอดกลีบ ดอกจัน
 * หกกลีบจึงหมุนไป 30° (กลีบชี้ซ้าย-ขวาแทนขึ้น-ลง) — วัดเทียบไฟล์แบบแล้วเห็นชัด: กรอบของ
 * แบบสูง 213 กว้าง 190 แต่ของเราสูง 186 กว้าง 212 สลับกันพอดี
 */
function blobPath(points: number, depth: number, steps = 180) {
  const R = 50 / (1 + depth)
  const out: string[] = []
  for (let i = 0; i < steps; i += 1) {
    const th = (i / steps) * Math.PI * 2 - Math.PI / 2
    const r = R * (1 + depth * Math.cos(points * (th + Math.PI / 2)))
    const x = 50 + r * Math.cos(th)
    const y = 50 + r * Math.sin(th)
    out.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `${out.join('')}Z`
}

/**
 * สัญลักษณ์ประจำสกิล — ทรงเดียวกันแต่จำนวนกลีบต่างกัน ไล่ตามลำดับสกิลใน `SKILLS`
 *
 * ทำเป็นตระกูลเดียวกันโดยตั้งใจ: มันคือของชิ้นเดิมที่ *เปลี่ยนรูป* ตามสกิลที่กำลังเล่า
 * (ดอกจันหกกลีบ → สี่กลีบ → สามกลีบ) ไม่ใช่ไอคอนสามอันที่สลับกันโผล่ ถ้าใช้ไอคอนคนละ
 * ตระกูล จังหวะสลับจะอ่านเป็น "ภาพเปลี่ยน" ไม่ใช่ "ของชิ้นนี้กลายรูป"
 */
const MARKS = [
  { points: 6, depth: 0.2 },
  { points: 4, depth: 0.2 },
  { points: 3, depth: 0.2 },
]

/* ── ท่าเข้าฉาก ─────────────────────────────────────────────────────────── */

/**
 * ท่าเข้าฉากของคอลลาจ — **ยกมาจาก githubuniverse.com** (section `#cta` ของเว็บนั้น)
 *
 * ค่าถอดจาก CSSRule สด ๆ ของเว็บต้นทาง ไม่ได้กะจากภาพ: ชิ้นส่วนเริ่มที่
 * `opacity: 0; transform: scale(0)` แล้วสลับเป็น 1 ทั้งคู่ ด้วย
 * `transition: opacity .2s ease-out, transform .6s cubic-bezier(0.3,0.41,0.04,1.01)`
 * และแต่ละชิ้นมี `transition-delay` ไล่เป็นขั้นละ 25ms ตามลำดับตำแหน่ง
 *
 * สองอย่างที่ทำให้ท่านี้ "ปัง" และของเดิมของเราไม่:
 *
 * 1. **ความทึบมาก่อนขนาดสามเท่า** (200ms vs 600ms) — ชิ้นส่วนปรากฏตัวเร็วแล้วค่อยคลี่
 *    ขนาดจนเข้าที่ ตาเห็นภาพรวมครบก่อนการเคลื่อนไหวจะจบ ของเดิมผูกทุกอย่างกับระยะเลื่อน
 *    ชิ้นส่วนจึงโผล่ช้าเท่าที่คนเลื่อนช้า
 * 2. **เส้นโค้งเวลามีหางยาว** — เบซิเยร์ (0.3,0.41,0.04,1.01) พุ่งแล้วเลยเป้าเล็กน้อย
 *    (y ปลาย 1.01) แล้วนิ่ง ให้ความรู้สึกของชิ้นที่ "ดีดเข้าที่" ไม่ใช่เลื่อนมาหยุด
 *
 * ท่านี้จุดชนวนครั้งเดียวตอน section เข้าสายตา (คลาส) ไม่ใช่ผูกกับระยะเลื่อน — เพราะเป็น
 * ท่าที่มี *จังหวะของตัวเอง* ถ้าผูกกับล้อเมาส์ ผู้ชมที่เลื่อนช้าจะเห็นทุกชิ้นค้างกลางทาง
 *
 * ### ทิศของการเข้า: ของเราวิ่ง ของเขาคลี่
 *
 * ต้นฉบับไม่มี `translate` เลย (ไล่ CSSRule ทั้งเว็บหาคู่ transition+translate ได้ศูนย์รายการ)
 * ชิ้นส่วนเขาโผล่อยู่ที่เดิมด้วย `scale(0)` → `scale(1)` เท่านั้น ที่นี่เจ้าของงานสั่งทิศเอง:
 * **ช่องโมเสกวิ่งเข้ามาจากทางซ้ายไปบรรจบทางขวา** และ **วงเล็บส้มวิ่งจากขวาออกไปซ้าย** —
 * สองทิศสวนกันทำให้ผังประกอบตัวเองให้ดู ไม่ใช่โผล่พร้อมกันทั้งแผ่น
 *
 * ที่ยกมาทั้งดุ้นคือ *จังหวะ* ของเขา: ความทึบ 200ms ease-out, การเคลื่อน 600ms บนเบซิเยร์
 * ตัวเดียวกัน และหน่วงไล่ขั้นละ 25ms ตามตำแหน่ง — เอาไปใส่กับ `translate` แทน `scale`
 */
/**
 * เส้นโค้งเวลา — **ไม่ใช่เส้นของ githubuniverse** และมีเหตุ
 *
 * ของเขา `cubic-bezier(0.3, 0.41, 0.04, 1.01)` หน้าหนักมาก (ถึง ~90% ตอนเวลาผ่านไป 40%)
 * ซึ่งเหมาะกับช่องเล็กที่ *ขยาย* อยู่กับที่ — ระยะสั้น การกระตุกตอนหยุดจึงไม่มีใครเห็น ที่นี่
 * ช่องยาวครึ่งจอวิ่งข้ามจอ เส้นนั้นให้ท่า "พุ่งแล้วเบรกหัวทิ่ม" ไม่ลื่น
 *
 * เปลี่ยนเป็น ease-out แบบเอ็กซ์โพเนนเชียล: ออกตัวเร็วแล้ว *คลายตัวยาว* จนนิ่ง ไม่มีจุดที่
 * ความเร็วหักมุม — ท่าจึงลื่นทั้งเส้นแม้ระยะไกล จังหวะ (ความทึบมาก่อนการเคลื่อน + ไล่หน่วง
 * ตามตำแหน่ง + ยิงด้วยคลาสครั้งเดียว) ยังเป็นสูตรของเขาทั้งดุ้น
 */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * เยื้องตามแกน x เป็น px ของกรอบแบบ — จุดตั้งต้นของการวิ่งเข้าฉาก
 *
 * **ระยะไม่เท่ากันทุกชิ้น**: แต่ละชิ้นเริ่มจากใกล้ *ขอบ* แล้ววิ่งไปที่ของตัวเอง ชิ้นที่อยู่
 * ขวาไกลจึงวิ่งไกลกว่าและมาถึงช้ากว่า ทั้งผังจึงอ่านเป็น "ของไหลเข้ามาจากทางซ้ายแล้วไป
 * บรรจบกันทางขวา" ตามที่สั่ง — ถ้าทุกชิ้นเยื้องเท่ากัน มันจะเป็นแผ่นเดียวที่ถูกลากเข้ามา
 *
 * `apShift` คือ *สัดส่วน* ของระยะถึงขอบ (100 = เริ่มชิดขอบพอดี) ไม่ใช่ระยะตายตัว
 */
const slideX = (dPx: number) =>
  `translate3d(calc(var(--art) * ${dPx.toFixed(2)} / ${ART_W}), 0, 0)`
/** ของที่อยู่ที่ x (px ของกรอบ) ออกตัวจากทางซ้าย */
const fromLeft = (xPx: number, t: WhatIDoTuner) => slideX(-xPx * (t.apShift / 100))
/** ของที่อยู่ที่ x ออกตัวจากทางขวา — ระยะคือช่องว่างที่เหลือถึงขอบขวาของกรอบ */
const fromRight = (xPx: number, t: WhatIDoTuner) => slideX((ART_W - xPx) * (t.apShift / 100))

const pop = (
  shown: boolean,
  delayMs: number,
  t: WhatIDoTuner,
  extra?: { origin?: string; from?: string },
): React.CSSProperties => ({
  /**
   * มี transition **เฉพาะตอนเข้าฉาก** ตอนถอยกลับที่ตั้งต้นไม่มี
   *
   * เบราว์เซอร์อ่าน `transition` จากสไตล์ *ใหม่* ตอนค่าเปลี่ยน — ใส่ไว้แค่ฝั่ง `shown`
   * ก็ได้ทั้งสองอย่าง: เข้าฉากไหลตามจังหวะ แต่ตอนติดอาวุธใหม่ (ผู้ชมเลื่อนกลับขึ้นจอแรก)
   * ของทุกชิ้นเด้งไปจุดตั้งต้นในเฟรมเดียว ไม่ใช่ค่อย ๆ ลอยกลับออกไปให้เห็นคาตา
   */
  transition: shown
    ? `opacity ${t.apFade}ms ease-out ${delayMs}ms, transform ${t.apDur}ms ${EASE} ${delayMs}ms`
    : 'none',
  opacity: shown ? 1 : 0,
  transform: shown ? 'none' : (extra?.from ?? 'none'),
  transformOrigin: extra?.origin,
  willChange: 'opacity, transform',
})

/* ── จอ ─────────────────────────────────────────────────────────────────── */

export function WhatIDoScroll({ id = 'what-i-do' }: { id?: string }) {
  const section = useRef<HTMLElement>(null)
  /** กลุ่มที่ถูกตรึง — ตัวรับค่า `--step` (ความคืบหน้าเป็นหน่วยสกิล) */
  const pin = useRef<HTMLDivElement>(null)
  /** หมุดเคอร์เซอร์: คำทักทายในคอลลาจ, การ์ดสกิล, ท่าปิดจอ */
  const helloAim = useRef<HTMLDivElement>(null)
  const skillAim = useRef<HTMLDivElement>(null)
  const wrapAim = useRef<HTMLDivElement>(null)
  /** จังหวะของจุดจอด = หัวอ่านที่กี่เท่าความสูงจอ (คิดจากที่ยืนของ section ในหน้า) */
  const [headVh, setHeadVh] = useState(0)
  /**
   * จออยู่ในสายตาหรือยัง — สวิตช์ของฉาก 3D ในคอลลาจ
   *
   * ไม่ให้แคนวาสของตัวละครกินเฟรมตอนคนดูอยู่จออื่น (หน้านี้มีแคนวาสที่วาดทุกเฟรมอยู่แล้ว
   * สองตัว) และทำให้โมเดลถูกดึงตอนใกล้ถึงจอนี้ ไม่ใช่ตอนเปิดหน้า
   */
  const [live, setLive] = useState(false)
  /**
   * จุดชนวนท่าเข้าฉาก — ติดแล้วติดเลย ไม่ย้อน
   *
   * ท่านี้มีจังหวะของตัวเอง (transition ของ CSS ไม่ใช่ค่าที่ผูกกับระยะเลื่อน — ดู `pop`)
   * ถ้าปล่อยให้ปิดตอนเลื่อนออกแล้วเล่นใหม่ตอนเลื่อนกลับ ทุกครั้งที่ผู้ชมเลื่อนขึ้นลงจะเห็น
   * กริดกระพริบทั้งแผ่น — ต้นฉบับก็ยิงครั้งเดียวด้วยคลาสเหมือนกัน
   */
  const [shown, setShown] = useState(false)
  /** ยิงแล้วยิงเลย — ลูปเลื่อนเดินทุกเฟรม ต้องมีตัวกันไม่ให้ setState ซ้ำ */
  const fired = useRef(false)
  /** สกิลที่กำลังเป็นตัวเอก — ใช้เฉพาะของที่ต้องเปลี่ยน *โครงสร้าง* (สัญลักษณ์ในโมเสก) */
  const [act, setAct] = useState(0)
  /**
   * ค่าที่ลากได้ — อ่านสองทาง
   *
   * ตอนเรนเดอร์อ่านผ่าน hook (ผังต้องเรนเดอร์ใหม่เมื่อค่าเปลี่ยน) แต่ในลูป rAF อ่านผ่าน
   * `getWhatIDoTuner()` เพราะลูปถูกติดตั้งครั้งเดียว (deps ว่าง) ถ้าใช้ค่าจาก hook มันจะ
   * ค้างที่ค่าตอนติดตั้ง — และเราไม่ต้องการให้ลูปผูกกับ re-render
   */
  const t = useWhatIDoTuner()
  const wrap = wrapAt(t)

  useEffect(() => {
    const el = section.current
    if (!el) return undefined
    const io = new IntersectionObserver((es) => setLive(es[0].isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /**
   * แปลงระยะเลื่อนเป็นสามค่า อ่านครั้งเดียวต่อเฟรมใน rAF
   *
   * `--in` ท่าเข้าฉาก, `--slide` 0..1 ของการไถลไปจุดล็อก, `--step` ความคืบหน้าเป็นหน่วยสกิล
   * ทุกค่าเขียนลง CSS ของกลุ่มที่ตรึง ไม่ผ่าน state — ค่าเปลี่ยนทุกเฟรมที่เลื่อน การ
   * re-render ทั้งกิ่งทุกเฟรมคือเผาเฟรมเปล่า (state ถูกใช้เฉพาะเลขสกิลที่เปลี่ยนโครงสร้าง)
   */
  useEffect(() => {
    const sec = section.current
    const el = pin.current
    if (!sec || !el) return undefined
    let raf = 0
    const read = () => {
      raf = 0
      const vh = Math.max(1, window.innerHeight)
      const r = sec.getBoundingClientRect()
      const y = Math.max(0, -r.top)
      const tt = getWhatIDoTuner()
      const e = clamp01(y / (vh * tt.inSpan))

      /**
       * จุดชนวนท่าเข้าฉาก — ยิงเมื่อ **ขอบบนของ section มาถึงยอดจอ** ไม่ใช่ตอนโผล่มาบางส่วน
       *
       * เดิมใช้ IntersectionObserver เกณฑ์ 0.34 บนกล่องที่ตรึง ผลคือมันติดตอนคอลลาจยังอยู่
       * ใต้เส้นขอบจอเป็นส่วนใหญ่ — วัดมาแล้ว: ที่ scrollY = 0 ขอบบนของ section อยู่ที่ 810px
       * ของจอสูง 900 (จอแรกสูงไม่ถึงหนึ่งจอเต็ม) กล่องที่ตรึงจึงโผล่อยู่แล้วเกือบหนึ่งในสาม
       * ตั้งแต่ยังไม่เลื่อน เกณฑ์ 0.34 ติดหลังเลื่อนไปแค่ ~220px ซึ่งตอนนั้นเห็นคอลลาจแค่
       * แถบล่างของจอ ท่ายาว ~900ms จึงเล่นจบก่อนที่คอลลาจจะขึ้นมาอยู่ในสายตา = ไม่เห็นท่าเลย
       *
       * เงื่อนไขนี้อ่านจาก `r` ที่ลูปวัดอยู่แล้วทุกเฟรม ไม่ต้องมีผู้สังเกตแยก และถ้าเปิดหน้า
       * ตรงมากลางจอนี้เลย มันยิงตอนอ่านค่ารอบแรก (ลูปเรียก `read()` ครั้งแรกตอนติดตั้ง)
       */
      if (!fired.current && r.top <= vh * 0.12 && r.bottom > vh * 0.4) {
        fired.current = true
        setShown(true)
      } else if (fired.current && r.top > vh * 0.8) {
        /**
         * ติดอาวุธใหม่เมื่อผู้ชมถอยกลับขึ้นไปจอแรก — ท่าเล่นซ้ำได้ทุกครั้งที่ลงมา
         *
         * เส้นปลดต้องต่ำกว่า *ที่ยืนของ section ตอนอยู่ยอดหน้า* ซึ่งวัดได้ 0.9 ของความสูงจอ
         * (จอแรกสูงไม่ถึงหนึ่งจอเต็ม) ถ้าตั้งไว้เกินนั้นมันจะไม่มีวันปลด แล้วท่าเล่นได้ครั้ง
         * เดียวเหมือนเดิม — และต้องสูงพอให้ตอนปลด คอลลาจเหลือโผล่แค่แถบบางที่ขอบล่างของจอ
         * การเด้งกลับที่ตั้งต้นจึงไม่สะดุดตา (ซึ่งเด้งในเฟรมเดียวอยู่แล้ว — ดู `pop`)
         */
        fired.current = false
        setShown(false)
      }
      const hv = (r.top + window.scrollY) / vh + 0.5
      setHeadVh((prev) => (Math.abs(prev - hv) > 0.01 ? hv : prev))

      /**
       * ความคืบหน้าของการเล่าเรื่องเป็นหน่วยสกิล: 0 = ใบแรกกำลังกาง, 2.5 = กลางใบที่สาม
       *
       * ไม่มีการไถลแนวนอนแล้ว (เจ้าของงานสั่งตัดออก) จอนี้จึงมีสองช่วงเท่านั้น: ยืนนิ่งให้ดู
       * ผังหนึ่งช่วง แล้วเล่าสกิลทีละใบด้วยการกางบล็อก — `--lock`/`--slide` กับการวัดขอบขวา
       * ของกลุ่มบล็อกถูกถอดออกทั้งชุด
       */
      const stepF = Math.max(0, (y - vh * tt.hold) / (vh * tt.step))
      el.style.setProperty('--step', Math.min(SKILLS.length, stepF).toFixed(4))
      const idx = Math.max(0, Math.min(SKILLS.length - 1, Math.floor(stepF)))
      setAct((prev) => (prev === idx ? prev : idx))

      /**
       * เคอร์เซอร์ "มี/ไม่มี" บนจอ — โผล่มาพร้อมคอลลาจ
       *
       * เขียนเฉพาะตอนจอนี้ใกล้เข้ามาแล้ว: ลูปนี้เดินทุกครั้งที่เลื่อนหน้า ถ้าเขียนตลอด ค่าจะ
       * เป็นศูนย์ตั้งแต่อยู่จอแรกแล้วไปลบเคอร์เซอร์ของจอแรกทิ้ง — จอแรกคุมช่วงของตัวเอง
       */
      if (r.top < vh * 0.9) {
        cursorShow.v = smooth(clamp01((e - 0.25) / 0.3))
        cursorWake.fn()
      }
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    read()
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /**
   * ลำดับของเคอร์เซอร์ในจอนี้: ชี้คำทักทาย → ย้ายไปอยู่กับแถบสกิล → ท่าปิดจอ
   *
   * *จังหวะ* มาจาก `headVh` ของ section ไม่ใช่จากพิกัดของหมุด — ของในกลุ่มที่ถูกตรึงมีพิกัด
   * หน้าที่เลื่อนตามจอไปด้วย ใช้เป็นจังหวะแล้วจุดจอดจะวิ่งหนีหัวอ่าน
   */
  useCursorStop(helloAim, { id: 'whatido-hello', keyVh: headVh + 0.3, size: 46, tilt: -12 })
  useCursorStop(skillAim, {
    id: 'whatido-skill',
    keyVh: headVh + t.hold + 0.45,
    size: 54,
    tilt: -22,
    lift: 40,
  })
  useCursorStop(wrapAim, {
    id: 'about-wrap',
    keyVh: headVh + wrap + 0.5,
    size: 132,
    tilt: -128,
    lift: 90,
  })

  return (
    <section
      id={id}
      data-screen={id}
      ref={section}
      /* สูงกว่าหนึ่งจอ: ยืนนิ่งให้ดูผัง + กางบล็อกเล่าสกิลทีละใบ + ท่าปิดจอ */
      className="relative w-full bg-white text-black"
      style={{ height: `${(wrap + 1.2) * 100}svh` }}
    >
      <div
        ref={pin}
        className="sticky top-0 h-[100svh] overflow-clip"
        style={{ ['--step' as string]: 0 }}
      >
        {/* คอลลาจอยู่กับที่ — ไม่มีการไถลแนวนอนแล้ว (เจ้าของงานสั่งตัดออก) */}
        <Collage
          helloRef={helloAim}
          cardRef={skillAim}
          live={live}
          shown={shown}
          mark={act}
          t={t}
        />

        {/* แผงจูนของจอนี้ — dev เท่านั้น อยู่นอกของในจอ (ดู ./WhatIDoPanel) */}
        {import.meta.env.DEV && live && (
          <Suspense fallback={null}>
            <WhatIDoPanel />
          </Suspense>
        )}

        {/* ท่าปิดจอ — ขาวห่อฉากจนสนิทแล้วส่งต่อจอถัดไป (ดู whatidocard/WhiteWrap) */}
        <WhiteWrap sectionRef={section} at={wrap} />
      </div>

      {/**
       * หมุดของเคอร์เซอร์ในท่าปิดจอ — อยู่นอกกล่องที่ถูกตรึง
       *
       * ของในกล่อง sticky ค้างอยู่ที่เดิมบนหน้าตลอดช่วงที่ตรึง จังหวะของจุดจอดซึ่งคิดจาก
       * ตำแหน่งในหน้าจึงต้องมาจาก element ที่เลื่อนจริง +0.5 คือครึ่งจอของหัวอ่าน
       */}
      <div
        ref={wrapAim}
        className="pointer-events-none absolute left-[34%] h-0 w-0"
        style={{ top: `${(wrap - 0.06 + 0.5) * 100}svh` }}
        aria-hidden
      />
    </section>
  )
}

/** นิพจน์ `--vis` ของใบที่ i ในรูปสตริง — ใช้ซ้ำกับตัวนับซึ่งไม่ได้อยู่ในใบนั้น */
function slotVis(i: number, last: boolean) {
  /**
   * ขาขึ้นเริ่มที่ `i` พอดี ไม่ใช่ล้ำหน้าไปก่อน
   *
   * เวอร์ชันก่อนให้ขาขึ้นเริ่มที่ i − 0.12 (เพราะตอนนั้นแผงสกิลอยู่คนละที่กับคอลลาจ ไม่มีใคร
   * เห็นว่ามันโผล่ก่อน) พอย้ายมาเป็นบล็อกที่กางออกในผังเดียวกัน ค่านั้นทำให้ใบแรกกางไปแล้ว
   * ครึ่งใบตั้งแต่ยังไม่เลื่อน — เห็นเป็นการ์ดสีค้างอยู่บนผังตอนพัก (เห็นมาแล้วบนจอ)
   */
  const rise = `clamp(0, (var(--step, 0) - ${i}) / 0.4, 1)`
  const fall = last ? '0' : `clamp(0, (var(--step, 0) - ${(i + 0.78).toFixed(2)}) / 0.22, 1)`
  return `calc(${rise} - ${fall})`
}

/**
 * คอลลาจตามแบบ: โมเสก วงเล็บส้ม ตัวละคร วงแหวนเขียว คำทักทาย
 *
 * ตำแหน่งทุกชิ้นเป็น % ที่หารมาจากเลขในไฟล์แบบตรง ๆ (กรอบ 1440×779) ไม่ใช่ค่าที่กะด้วยตา
 * — ของในแบบเยื้องกันแบบตั้งใจ (โมเสกล้นขอบขวา วงเล็บชนขอบล่าง) ถ้ากะเองความเยื้องนั้น
 * จะหายไปหมด
 */
function Collage({
  helloRef,
  cardRef,
  live,
  shown,
  mark,
  t,
}: {
  helloRef: React.RefObject<HTMLDivElement | null>
  /** หมุดเคอร์เซอร์ของการ์ดสกิล */
  cardRef: React.RefObject<HTMLDivElement | null>
  live: boolean
  /** จุดชนวนท่าเข้าฉาก — จอเข้ามาในสายตาแล้วหรือยัง (ครั้งเดียว ไม่ย้อน) */
  shown: boolean
  mark: number
  t: WhatIDoTuner
}) {
  const px = (v: number) => `calc(var(--art) * ${v.toFixed(2)} / ${ART_W})`
  return (
    <div className="relative h-full w-[100svw] overflow-clip bg-white">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          /* `--art` = ความกว้างกรอบเป็น px — ทุกชิ้นคิดพิกัดจากค่านี้ */
          ['--art' as string]: ART_PX,
          width: 'var(--art)',
          aspectRatio: `${ART_W} / ${ART_H}`,
        }}
      >
        {/* ลำดับชั้นตามไฟล์แบบ: บล็อกเทา → แผงอ่อน → รูป → วงเล็บ → วงแหวน */}
        <Blocks t={t} shown={shown} />
        <Panel t={t} shown={shown} />
        <Bracket t={t} shown={shown} />

        {/**
         * ตัวละครสามมิติ — ยืนในกรอบรูปของไฟล์แบบ (807, 41, 499 × 794 มุมล่างมน 40)
         *
         * กรอบตัดขอบ (`overflow-hidden`) ตัวละครจึงถูกมุมมนด้านล่างตัดเหมือนรูปในแบบ
         * กรอบเป็นของแบบเป๊ะ ไม่มีปุ่มลาก — ที่ลากได้คือ *ตัวละครในกรอบ* (`figFill`
         * `figAnchor` `figTurn` ซึ่ง ./HeroFigure อ่านไปใช้) เพราะสัดส่วนของริกไม่ใช่
         * สัดส่วนของคนในรูป จะพอดีกรอบต้องลองบนจอ
         */}
        <div
          className="pointer-events-none absolute overflow-hidden"
          data-part="figure"
          style={{
            left: px(PHOTO.x),
            top: px(PHOTO.y),
            width: px(PHOTO.w),
            height: px(PHOTO.h),
            borderRadius: `0 0 ${px(PHOTO.r)} ${px(PHOTO.r)}`,
            /* ตัวละครวิ่งเข้ามาจากขวาพร้อมแผงรูป — ฝั่งขวาของผังมาจากขอบขวา */
            ...pop(shown, t.apStep * 3, t, { from: fromRight(PHOTO.x, t) }),
          }}
        >
          {live && (
            <Suspense fallback={null}>
              <HeroFigure />
            </Suspense>
          )}
        </div>

        {/* สำเนาวงเล็บที่อยู่ **หน้า** ตัวละคร เห็นแค่ใต้เส้นแบ่ง — หัวจึงโผล่หน้าวงเล็บ */}
        <Bracket t={t} shown={shown} front />

        <Arc t={t} shown={shown} />

        {/* เนื้อหาสกิลในบล็อกที่กางออก — นอกชั้นที่ถูกกรอง (ดู `SkillCards`) */}
        <SkillCards cardRef={cardRef} mark={mark} />

        {/**
         * คำทักทาย — ไฟล์แบบใหม่ไม่มีข้อความเลย (ทั้งเฟรมมีแต่รูปทรง)
         *
         * คงไว้เพราะเป็นคำจริงของเจ้าของงานและเป็นหัวเรื่องเดียวของจอนี้ (และเป็นจุดจอดของ
         * เคอร์เซอร์ `whatido-hello`) ย้ายไปยืนในช่องว่างของผังใหม่: ใต้บล็อกแถบนอนซ้าย
         * บนสุด เหนือบล็อกเล็ก x 107 y 488 — ถ้าจะให้ตรงแบบเป๊ะคือเอาออก บอกมา
         */}
        <div
          ref={helloRef}
          className="absolute leading-[1.35]"
          style={{
            left: px(86),
            top: px(340),
            fontSize: px(28),
            /* หลบให้การ์ดใบแรก — มันกางมาทับที่ยืนของคำทักทายพอดี */
            opacity: 'calc(1 - clamp(0, var(--step, 0) * 2, 1))',
          }}
        >
          {['Hello, I’m Joe', 'A UX/UI Designer'].map((line, i) => (
            <span key={line} className="block overflow-clip">
              {/* ตัวหนังสือไถลขึ้นจากใต้เส้น (กล่องครอบตัดขอบ) ตามหลังบล็อก ทีละบรรทัด */}
              <span
                className="block"
                style={pop(shown, t.apStep * (10 + i * 2), t, {
                  from: 'translate3d(0, 1.15em, 0)',
                })}
              >
                {line}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * บล็อกเทาฝั่งซ้าย — **หลอมเชื่อมกันเป็นก้อนเดียว** ตามเรฟโปสเตอร์ที่เจ้าของงานส่งมา
 *
 * ### ทำไมต้องกรอง ไม่ใช่มนมุมทีละใบ
 *
 * ในไฟล์แบบบล็อกทั้งเจ็ดใบ *แตะกันที่มุม* เป็นขั้นบันได (B0 จบที่ 357,288 ซึ่งเป็นมุมซ้ายบน
 * ของ B2 เป๊ะ ๆ และอีกสี่คู่ก็แบบเดียวกัน) จุดแตะแบบนี้กว้างศูนย์ — จะมนมุมทีละใบเท่าไรก็
 * ไม่เกิด "คอ" ที่เชื่อมกันเหมือนโปสเตอร์ ได้แค่สี่เหลี่ยมมนวางชนมุมกัน
 *
 * `feGaussianBlur` + `feColorMatrix` ที่ดันค่าอัลฟาให้เป็นขั้น (ท่ามาตรฐานชื่อ gooey/
 * metaball filter) ทำให้ขอบที่อยู่ใกล้กันบวมมาบรรจบกันเป็นคอ และมุมด้านในกลายเป็น **มุมเว้า**
 * เอง ซึ่งเป็นหัวใจของแนวนี้ (คำค้น: inverted radius / concave corner) — พิกัดของบล็อกจึงยัง
 * เป็นของไฟล์แบบเป๊ะทุกใบ ไม่ต้องขยับให้ทับกัน
 *
 * ### บล็อกสามใบกางออกมาเป็นการ์ดเล่าสกิล
 *
 * ใบใน `SKILL_BLOBS` ยืดจากกรอบเดิมของตัวเองไปเป็นกรอบการ์ด (`CARD`) ตามความคืบหน้าของ
 * สกิลใบนั้น และเปลี่ยนเป็นสีประจำสกิลไปพร้อมกัน — ตัวหนังสือไม่ได้อยู่ในชั้นนี้ (ดู
 * `SkillCards`) เพราะตัวกรองจะฟุ้งมันจนอ่านไม่ออก
 *
 * ### หน่วยของความฟุ้งผูกกับกรอบ ไม่ใช่พิกเซลจอ
 *
 * `primitiveUnits="objectBoundingBox"` ทำให้ `stdDeviation` เป็น *สัดส่วนของกล่อง* ความ
 * กลมของคอจึงเท่ากันทุกขนาดจอ (ถ้าใส่เป็น px คอจะหนาขึ้นเรื่อย ๆ เมื่อย่อจอ) ค่าสองตัวเพราะ
 * แกน x อ้างความกว้าง (1440) แกน y อ้างความสูง (1024) ต้องหารให้ได้ความฟุ้งเท่ากันจริง
 */
const GOO = 26
const GOO_ID = 'wid-goo'

/** px ของกรอบแบบ → ความยาวจริงบนจอ */
const artPx = (v: number) => `calc(var(--art) * ${v.toFixed(2)} / ${ART_W})`

/**
 * กรอบที่ไหลจาก `a` ไป `b` ตามนิพจน์ `v` (0..1) — คิดใน CSS ไม่ใช่ใน JS
 *
 * ค่าที่ขับคือ `--step` ซึ่งลูปเลื่อนเขียนทุกเฟรม ถ้าคิดใน JS ต้อง re-render ทั้งกิ่งทุกเฟรม
 * ที่นิ้วขยับ — `calc()` ทำให้เบราว์เซอร์คิดเองในชั้น style ไม่แตะ React เลย
 */
function flowBox(a: Box, b: Box, v: string) {
  const at = (k: keyof Box) => `calc(${artPx(a[k])} + (${artPx(b[k])} - ${artPx(a[k])}) * ${v})`
  return { left: at('x'), top: at('y'), width: at('w'), height: at('h') }
}

type Box = { x: number; y: number; w: number; h: number }

function Blocks({ t, shown }: { t: WhatIDoTuner; shown: boolean }) {
  const last = SKILLS.length - 1
  return (
    <>
      <svg className="absolute h-0 w-0" aria-hidden focusable="false">
        <defs>
          <filter
            id={GOO_ID}
            primitiveUnits="objectBoundingBox"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={`${(GOO / ART_W).toFixed(4)} ${(GOO / ART_H).toFixed(4)}`}
              result="blur"
            />
            {/* ดันอัลฟาให้เป็นขั้น: ต่ำกว่า ~0.45 หาย สูงกว่านั้นทึบ — ขอบจึงคมกลับมา */}
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="absolute inset-0"
        data-part="blocks"
        style={{ filter: `url(#${GOO_ID})` }}
        aria-hidden
      >
        {BLOCKS.map((b, i) => {
          const si = SKILL_BLOBS.indexOf(i)
          const v = si < 0 ? null : slotVis(si, si === last)
          return (
            <div
              key={`${b.x}-${b.y}`}
              className="absolute"
              style={{
                ...pop(shown, (b.x / 100) * t.apStep, t, { from: fromLeft(b.x, t) }),
                ...(v ? flowBox(b, CARD, v) : flowBox(b, b, '0')),
                background: BLOCK_FILL,
              }}
            />
          )
        })}
      </div>
    </>
  )
}

/**
 * เนื้อหาสกิลในบล็อกที่กางออก — **อยู่นอกชั้นที่ถูกกรอง** ไม่งั้นตัวหนังสือฟุ้งจนอ่านไม่ออก
 *
 * กรอบของแต่ละใบไหลไปตามบล็อกของมันเป๊ะ ๆ (ใช้ `flowBox` ตัวเดียวกัน) ข้อความจึงติดอยู่กับ
 * แผ่นสีเหมือนเป็นชิ้นเดียวกัน แต่ *โผล่ทีหลัง*: รอให้กางไปแล้วเกินครึ่งก่อน ไม่งั้นตัวหนังสือ
 * วิ่งตามขอบกล่องที่ยังยืดอยู่ (การ์ดของ /2026 ก็หน่วงข้อความไว้ 500ms ด้วยเหตุผลเดียวกัน)
 *
 * สิ่งที่ยกมาจากการ์ด what-i-do ของ /2026: สีประจำสกิล · ภาพประกอบตัวโตเกาะมุมขวาล่าง ·
 * แถบความคืบหน้าที่ก้นกล่องซึ่งเกาะนิ้วที่เลื่อน (ไม่มี transition)
 */
function SkillCards({ cardRef, mark }: { cardRef: React.RefObject<HTMLDivElement | null>; mark: number }) {
  const last = SKILLS.length - 1
  const marks = useMemo(() => MARKS.map((m) => blobPath(m.points, m.depth)), [])
  return (
    <div ref={cardRef} className="pointer-events-none absolute inset-0">
      {SKILLS.map((skill, i) => {
        const v = slotVis(i, i === last)
        const ink = `calc(max(0, (${v} - 0.55) / 0.45))`
        return (
          <div
            key={skill.title}
            className="absolute overflow-hidden text-white"
            style={{
              ...flowBox(BLOCKS[SKILL_BLOBS[i]], CARD, v),
              borderRadius: artPx(28),
              /**
               * แผ่นสีอยู่ **นอกชั้นที่ถูกกรอง** ขอบจึงคม
               *
               * เคยเอาสีไปไว้ในชั้น gooey ผลคือขอบการ์ดฟุ้งเป็นหมอกทั้งใบ (ตัวกรองดันเฉพาะ
               * อัลฟาให้เป็นขั้น ไม่ได้ดันสี) — ชั้นที่ถูกกรองเหลือไว้ทำหน้าที่เดียวคือคอที่
               * ยืดตามบล็อกซึ่งกำลังกางออก ส่วนที่คนอ่านคือแผ่นสีใบนี้
               */
              background: skill.color,
              opacity: v,
            }}
          >
            <div
              className="absolute inset-0 flex flex-col justify-between p-[6%]"
              /* ข้อความรอให้กางไปเกินครึ่งก่อน ไม่งั้นมันวิ่งตามขอบกล่องที่ยังยืดอยู่ */
              style={{ opacity: ink }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="font-semibold tracking-[0.22em]"
                  style={{ fontSize: artPx(15) }}
                >
                  {String(i + 1).padStart(2, '0')} / {String(SKILLS.length).padStart(2, '0')}
                </span>
                {/* สัญลักษณ์ประจำสกิล — ทรงเดียวกันคนละจำนวนกลีบ (ดู `MARKS`) */}
                <svg
                  viewBox="0 0 100 100"
                  role="presentation"
                  style={{ width: artPx(58), height: artPx(58) }}
                >
                  <path d={marks[i % marks.length]} fill="#fff" opacity={i === mark ? 0.9 : 0.4} />
                </svg>
              </div>

              <div>
                <h3
                  className="font-extrabold leading-[0.92] tracking-[-0.03em]"
                  style={{ fontSize: artPx(96) }}
                >
                  {skill.title}
                </h3>
                <p
                  className="mt-[2%] max-w-[26ch] font-medium leading-[1.35] text-white/85"
                  style={{ fontSize: artPx(22) }}
                >
                  {skill.desc}
                </p>
              </div>
            </div>

            {/* ภาพประกอบตัวโต — ไฟล์เดียวกับกระเบื้องของ /2026 เกาะมุมขวาล่าง ล้นออกได้ */}
            <span
              className="v2-in pointer-events-none absolute bottom-[-6%] right-[-3%]"
              style={{ width: artPx(230) }}
              aria-hidden
            >
              <span
                className="v2-layers block opacity-90 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: SKILL_ART[i % SKILL_ART.length] }}
              />
            </span>

            {/* แถบความคืบหน้าในสกิลใบนี้ — เกาะนิ้ว ไม่มี transition (ท่าของการ์ด /2026) */}
            <span
              className="absolute inset-x-0 bottom-0 h-[6px] origin-left bg-white/60"
              style={{ transform: `scaleX(clamp(0, var(--step, 0) - ${i}, 1))` }}
              aria-hidden
            />
          </div>
        )
      })}
    </div>
  )
}

/** แผงอ่อนหลังรูป — สี่เหลี่ยมมุมมน 40 ตามไฟล์แบบ */
function Panel({ t, shown }: { t: WhatIDoTuner; shown: boolean }) {
  const px = (v: number) => `calc(var(--art) * ${v.toFixed(2)} / ${ART_W})`
  return (
    <div
      className="absolute"
      data-part="panel"
      style={{
        ...pop(shown, (PANEL.x / 100) * t.apStep, t, { from: fromRight(PANEL.x, t) }),
        left: px(PANEL.x),
        top: px(PANEL.y),
        width: px(PANEL.w),
        height: px(PANEL.h),
        borderRadius: px(PANEL.r),
        background: PANEL.fill,
      }}
      aria-hidden
    />
  )
}

/**
 * วงเล็บส้ม — พาธของไฟล์แบบ วาดเป็น svg ที่ยืดตามกรอบ (`preserveAspectRatio="none"`)
 *
 * สองสำเนาซ้อนตรงกัน: ใบหลังอยู่ใต้ตัวละคร ใบหน้าถูกตัดเหลือเฉพาะใต้เส้น `brSplit` ผลคือ
 * หัวอยู่ *หน้า* วงเล็บ ลำตัวกับขาอยู่ *หลัง* — เป็นกลไกเดียวกับที่ไฟล์แบบทำด้วยการวางรูป
 * ช่วงหัวอีกใบทับวงเล็บไว้ (ดู `PHOTO`)
 */
function Bracket({
  t,
  shown,
  front = false,
}: {
  t: WhatIDoTuner
  shown: boolean
  front?: boolean
}) {
  const px = (v: number) => `calc(var(--art) * ${v.toFixed(2)} / ${ART_W})`
  return (
    <div
      className="pointer-events-none absolute"
      data-part={front ? 'bracket-front' : 'bracket'}
      style={{
        left: px(BRACKET.x),
        top: px(BRACKET.y),
        width: px(BRACKET.w),
        height: px(BRACKET.h),
        /* ใบหน้าเห็นแค่ใต้เส้นแบ่ง — ตัดด้วยกล่องนอก ตัวรูปถูกตัดอีกชั้นด้วยพาธข้างใน */
        clipPath: front ? `inset(${(t.brSplit * 100).toFixed(2)}% 0 0 0)` : undefined,
        /* วงเล็บวิ่งจากขวาไปซ้าย สวนทางกับบล็อกเทา และออกตัวก่อนใคร */
        ...pop(shown, 0, t, { from: fromRight(BRACKET.x, t) }),
      }}
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${BRACKET.w} ${BRACKET.h}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role="presentation"
      >
        <path d={BRACKET_PATH} fill={BRACKET.fill} />
      </svg>
    </div>
  )
}

/** วงแหวนเขียว — พาธของไฟล์แบบ (วาดมือ ขอบในนอกไม่ขนานกันจริง) */
function Arc({ t, shown }: { t: WhatIDoTuner; shown: boolean }) {
  const px = (v: number) => `calc(var(--art) * ${v.toFixed(2)} / ${ART_W})`
  return (
    <div
      className="pointer-events-none absolute"
      data-part="arc"
      style={{
        ...pop(shown, t.apStep * 9, t, { from: fromRight(ARC.x, t) }),
        left: px(ARC.x),
        top: px(ARC.y),
        width: px(ARC.w),
        height: px(ARC.h),
      }}
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${ARC.w} ${ARC.h}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role="presentation"
      >
        <path d={ARC_PATH} fill={ARC.fill} />
      </svg>
    </div>
  )
}

/**
 * ภาพประกอบประจำสกิล — สร้าง **ครั้งเดียวที่ระดับโมดูล** ไม่ใช่ใน render
 *
 * เหตุผลเดียวกับ sections/whatido/WhatIDo: มันเป็น SVG นิ่งที่ฝังด้วย `innerHTML` ถ้าประกาศ
 * ใน JSX ทุกครั้งที่สกิลที่กำลังเล่าเปลี่ยน React จะยัดเนื้อ SVG ใหม่ทั้งก้อน โหนดใหม่ =
 * อนิเมชัน `v2-layer-in` ตั้งต้นใหม่ ไอคอน *ทุกใบ* จะกะพริบพร้อมกัน ไม่ใช่แค่ใบที่ถึงคิว
 *
 * ชั้นในของไฟล์พวกนี้ถูกไล่โผล่ทีละชิ้นด้วยคลาส `v2-layers` + `v2-in` (ดู styles/index.css)
 * ซึ่งเป็นกลไกเดิมของการ์ด /2026 — ที่นี่ยกมาทั้งชุด ไม่ได้เขียนอนิเมชันใหม่
 */
const SKILL_ART = [skillsCursorRaw, skillsPixelsRaw, skillsPencilRaw]
