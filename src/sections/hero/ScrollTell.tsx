import { useEffect, useRef } from 'react'
import { WIPE_FULL } from '@/components/CloudWipe'
import { cursorPress } from '@/cursorguide/press'
import { useCursorStop } from '@/cursorguide/useCursorStop'

/**
 * ช่วงเล่าเรื่องบนพื้นขาว — บทสนทนา คั่นระหว่างจอแรกกับจอ "สิ่งที่ทำ"
 *
 * ผังตามแบบที่ส่งมา: ฟองข้อความสองฝั่งชิดขอบจอ มีรูปตัวแทนกับชื่อกำกับอยู่ *นอก* ฟอง
 * (ไม่ใช่ในฟอง) ฝั่งซ้ายคือเจ้าของหน้า ฝั่งขวาคือผู้ชม
 *
 * ฝั่งเจ้าของหน้าเล่น "แบบ AI": ข้อความไล่ขึ้นทีละคำเหมือนคำตอบที่กำลังถูกสร้าง และมีจุด
 * กำลังคิดขึ้นก่อนทุกครั้ง ฝั่งผู้ชมเป็นฟองที่ผุดมาทั้งใบ เพราะคนพิมพ์เสร็จแล้วจึงกดส่ง
 * ความต่างของสองฝั่งจึงอยู่ที่ "วิธีที่ข้อความมาถึง" ไม่ใช่แค่สีกับด้าน
 *
 * ### การส่งต่อไปจอถัดไป
 *
 * ผู้ชมถามว่าเขาทำอะไร คำตอบสุดท้ายไม่ใช่ข้อความ — เป็น *ลิงก์* แล้วเคอร์เซอร์นำสายตาของ
 * หน้า (ดู cursorguide/) บินมากดมันจริง ๆ (สั่งท่ากดผ่าน cursorguide/press) จากนั้นฟอง
 * ของลิงก์นั้นแปลงร่างเป็นการ์ดของจอถัดไป การเปลี่ยนจอจึงเป็น "ผลของการกด" ไม่ใช่การเลื่อน
 * ไปเจอจอใหม่เฉย ๆ
 *
 * การแปลงร่างทำที่ชั้นนี้ด้วยกล่อง DOM ใบเดียว ไม่ได้ไปยุ่งกับการ์ด 3D ของจอถัดไป: กล่อง
 * เริ่มที่กรอบจริงของฟองลิงก์ (วัดจาก DOM) แล้วไล่ไปหยุดที่กรอบที่การ์ดใบจริงยืนอยู่ พอถึง
 * ปลายทางชั้นนี้ปิดตัวเอง การ์ดใบจริงจึงรับช่วงที่กรอบเดียวกัน — จอถัดไปต้องไม่ยกการ์ดขึ้นมา
 * จากใต้จออีกรอบ (ดู LIFT.stage ใน sections/whatidocard/WhatIDoCard)
 *
 * ### ข้อความมาจากไหน
 *
 * ทุกบรรทัดฝั่งเจ้าของหน้ายกมาจากข้อความจริงที่มีอยู่แล้วในหน้านี้ (ประโยคปิดของจอแรกใน
 * i18n/dict, คำอธิบายสกิลใน sections/whatido/WhatIDo, วุฒิการศึกษาในจอประสบการณ์)
 * ไม่ได้แต่งประวัติหรือคำพูดขึ้นใหม่ ส่วนฝั่งผู้ชมเป็นคำถาม ไม่ใช่ข้อมูลเกี่ยวกับใคร
 *
 * ### ทำไมเป็น section ของตัวเอง
 *
 * ม่านเมฆของจอแรกถมจนขาวทึบแล้วตัดตัวเองทิ้ง (ดู WIPE_FULL ใน components/CloudWipe)
 * ของที่อยู่ใต้ม่านตรงนั้นคือจอนี้ ซึ่งพื้นขาวเหมือนกัน ผู้ชมจึงเห็นเป็น "ฟ้าถูกเมฆกลบจนขาว
 * แล้วบทสนทนาเริ่มขึ้นบนความขาวนั้น" ไม่ใช่ของที่ลอยทับฉากเดิม
 *
 * ตัวสนทนาตรึงแบบ fixed ไม่ใช่ sticky ในกล่องที่สูงกว่าหนึ่งจอ — sticky ต้องเหลือระยะให้
 * แผ่นไถลออกเต็มหนึ่งจอเสมอ ระหว่างนั้นบทสนทนาเลื่อนหายไปแล้วแต่จอถัดไปยังไม่มา เห็นเป็น
 * จอขาวเปล่า ๆ หนึ่งจอเต็ม (วัดมาแล้ว) แบบ fixed คือเล่าจบแล้วปิดทิ้งตรงนั้น จอถัดไปมาพอดี
 *
 * ### การเลื่อนของสาย
 *
 * สายไม่ได้อยู่นิ่งแล้วให้ข้อความโผล่ทีละอัน — มันเลื่อนตามอันใหม่สุดเหมือนแชตจริง
 * (อันใหม่ดันอันเก่าขึ้นไป) ตำแหน่งจึงคิดจากความสูงจริงที่วัดจาก DOM ไม่ใช่ค่าคงที่ต่ออัน
 * เพราะแต่ละอันสูงไม่เท่ากันตามความยาวข้อความและความกว้างจอ
 *
 * เขียน transform/opacity ลง DOM ใน rAF ไม่ผ่าน state: ค่าพวกนี้เปลี่ยนทุกเฟรมที่เลื่อน
 * ถ้าเป็น state หน้าทั้งหน้า (รวมแคนวาส 3D สามตัว) จะ re-render ตามการเลื่อน
 */

/** ความสูงของช่วงนี้ (เท่าของความสูงจอ) = ความช้าของการเล่า */
const TELL_VH = 2.6

/**
 * บทสนทนา — `ai: true` คือฝั่งเจ้าของหน้า (ชิดขวา) `ai: false` คือฝั่งผู้ชม (ชิดซ้าย)
 *
 * เจ้าของหน้าอยู่ขวาเพราะเป็น "เรา" ในแอปแชต และฟองแรกของเรื่องคือฟองของเขา ซึ่งเปิดฉาก
 * ที่กลางจอก่อนแล้วค่อยไปเข้าที่ของตัวเองทางขวา (ดู INTRO_TO)
 *
 * อันสุดท้ายเป็นลิงก์ของเจ้าของหน้า ไม่ใช่คำถามของผู้ชม — เขาเป็นคนเสนอจะพาไปดู
 * แล้วเคอร์เซอร์นำสายตาก็กดตามนั้น
 */
const CHAT: { text: string; ai: boolean; link?: boolean }[] = [
  { text: "Hey there! I'm Joe.", ai: true },
  { text: 'Welcome to my site — feel free to explore.', ai: true },
  { text: "Well… I'm not sure where to start.", ai: false },
  /* ประโยคปิดเป็นลิงก์ ไม่ใช่ประโยค — ของที่กดได้ และเป็นตัวเปิดจอถัดไป */
  { text: 'No worries — let me walk you through what I do.', ai: true, link: true },
]

/**
 * ช่วงที่ใช้เดินบทสนทนา — เหลือหัวไว้ให้จอขาวตั้งตัวก่อน และเหลือท้ายไว้ให้คำถาม
 * อันสุดท้ายค้างให้อ่านก่อนส่งต่อ ไม่ใช่ถามแล้วจอเปลี่ยนในเฟรมเดียวกัน
 */
const RUN_AT = 0.04
const RUN_TO = 0.7

/**
 * ท่าเปิดฉาก: ฟองแรกขึ้นเป็น "กำลังพิมพ์" ซูมอยู่กลางจอ แล้วค่อยย่อไปเข้าที่ทางขวา
 *
 * ฟองใบแรกไม่ได้โผล่ในสายเลย — มันเป็นของชิ้นเดียวบนจอขาว ตาจึงไปอยู่ที่มันก่อนจะรู้ว่า
 * นี่คือบทสนทนา พอมันเลื่อนไปเข้าแถว สายที่เหลือก็อ่านต่อได้เอง
 *
 * ค่านี้คือจุดจบของท่าเปิด (สัดส่วนของช่วงนี้) — สายเริ่มเดินต่อจากตรงนี้ โดยใบแรกเข้าที่
 * เรียบร้อยแล้ว
 */
const INTRO_TO = 0.26
/** ค้างอยู่กลางจอถึงจังหวะนี้ก่อน แล้วจึงออกเดินทางไปเข้าแถว */
const INTRO_HOLD = 0.15
/** ฟองกำลังพิมพ์อยู่กลางจอโตกว่าตอนเข้าแถวกี่เท่า */
const INTRO_ZOOM = 1.75

/** จังหวะที่เคอร์เซอร์กดลิงก์ และช่วงที่ฟองแปลงร่างเป็นการ์ด (สัดส่วนของช่วงนี้) */
const PRESS_AT = 0.74
const PRESS_SPAN = 0.06
const MORPH_AT = 0.78

/**
 * กรอบที่หน้าต่างใบจริงของจอถัดไปยืนอยู่บนจอ — สัดส่วนของวิวพอร์ต
 *
 * วัดจากภาพจริงของจอนั้นตอนเข้าที่ (1440x900: หน้าต่างอยู่ราว x 345..1120, y 150..765)
 * ไม่ได้กะจากสายตา ถ้าจูนกล้องหรือขนาดหน้าต่างใน CardStage ค่าคู่นี้ต้องวัดใหม่
 */
const CARD = { w: 0.538, h: 0.684 }
/** ความสูงแถบหัวของหน้าต่าง เทียบความสูงหน้าต่าง (จาก BAR_T/CARD_H ใน CardStage) */
const CARD_BAR = 0.148

/** อันหนึ่งใช้ระยะกี่ "ช่อง" ในการเข้ามา — มากกว่า 1 = อันข้าง ๆ ขยับต่อเนื่องกัน ไม่กระตุก */
const SOFT = 1.35
/** อันใหม่สุดหยุดอยู่ที่ความสูงเท่าไรของจอ */
const FOCUS = 0.62
/** ระยะที่ข้อความไถลขึ้นมาตอนเข้า (พิกเซล) */
const RISE = 24
/** คำหนึ่งของคำตอบ AI ใช้ระยะกี่ "ช่องคำ" ในการขึ้น — กว้างกว่า 1 คือคลื่นนุ่ม ไม่ใช่ไฟกระพริบ */
const WORD_SOFT = 1.6

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

export function ScrollTell() {
  const section = useRef<HTMLElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  /** ฟอง "กำลังพิมพ์" ของท่าเปิดฉาก — อยู่กลางจอก่อนจะไปเข้าแถว */
  const intro = useRef<HTMLDivElement>(null)
  /** ฟองของลิงก์ — ทั้งจุดจอดของเคอร์เซอร์ และจุดเริ่มของการแปลงร่าง */
  const link = useRef<HTMLDivElement>(null)
  /** กล่องที่แปลงร่างจากฟองลิงก์ไปเป็นการ์ดของจอถัดไป */
  const card = useRef<HTMLDivElement>(null)

  /**
   * จุดจอดของเคอร์เซอร์นำสายตาที่ลิงก์ — จังหวะตั้งเองเพราะของอยู่ในชั้นที่ตรึงไว้
   *
   * ชั้นนี้เป็น fixed ตำแหน่งบนหน้าของมันจึงเลื่อนไปตามการเลื่อนจอ ถ้าปล่อยให้จังหวะมาจาก
   * ตำแหน่ง เคอร์เซอร์จะวิ่งตามไม่ทัน จังหวะคิดจากผังจริง: จอแรกกินระยะ WIPE_FULL แล้วจอนี้
   * กิน TELL_VH ต่อจากนั้น หัวอ่านอยู่กลางจอจึงบวกครึ่งจอ
   */
  useCursorStop(link, {
    id: 'tell-link',
    keyVh: WIPE_FULL + TELL_VH * PRESS_AT + 0.5,
    dy: -0.05,
    size: 62,
    tilt: -6,
    lift: 90,
  })

  useEffect(() => {
    const sec = section.current
    const el = wrap.current
    const list = thread.current
    if (!sec || !el || !list) return undefined
    const rows = [...list.querySelectorAll<HTMLElement>('[data-row]')]
    /** คำของคำตอบ AI แต่ละอัน — เก็บไว้ล่วงหน้า ไม่ query ใหม่ทุกเฟรม */
    const words = rows.map((r) => [...r.querySelectorAll<HTMLElement>('[data-word]')])
    const dots = list.querySelector<HTMLElement>('[data-typing]')
    let raf = 0
    const read = () => {
      raf = 0
      const vh = Math.max(1, window.innerHeight)
      const top = sec.getBoundingClientRect().top
      /** ความคืบหน้าในช่วงนี้ — 0 ตอนขอบบนแตะขอบบนจอ, 1 ตอนขอบล่างถึงขอบบนจอ */
      const p = clamp01(-top / Math.max(1, vh * TELL_VH))
      /* พ้นช่วงแล้วปิดทิ้ง — ของที่ตรึงแบบ fixed ไม่หายไปเองเหมือนของในโฟลว์ */
      el.style.visibility = p >= 1 || top > vh ? 'hidden' : ''
      /**
       * ขึ้นมาแล้วทึบตลอด ไม่จางตอนจบ
       *
       * ตอนท้ายชั้นนี้ไม่ได้ "หายไป" แต่ส่งไม้ต่อ: กล่องที่แปลงร่างไปหยุดตรงกรอบเดียวกับ
       * การ์ดใบจริงของจอถัดไป และพื้นก็ขาวเท่ากันทั้งสองฝั่ง การตัดทิ้งตรงนั้นจึงไม่มีรอย
       * ถ้าจางออก จะเห็นการ์ดใบจริงทะลุขึ้นมาระหว่างที่กล่องยังแปลงร่างไม่เสร็จ (วัดมาแล้ว)
       */
      const show = smooth(clamp01(p / RUN_AT))
      el.style.opacity = show.toFixed(3)

      /**
       * ท่าเปิดฉาก: ฟองกำลังพิมพ์ซูมอยู่กลางจอ แล้วเลื่อน+ย่อไปทับที่ของฟองใบแรก
       *
       * ปลายทางอ่านจากกรอบจริงของฟองใบแรก (สายถูกวางผังไว้แล้วแม้ยังไม่แสดง) ไม่ได้กะ
       * พิกัด — ฟองใบแรกยาวเท่าไรก็ไปจบตรงที่ของมันเอง
       */
      /* ขึ้นเร็ว ค้างกลางจอให้เห็นว่ากำลังพิมพ์ แล้วจึงออกเดินทาง */
      const ia = smooth(clamp01((p - RUN_AT) / 0.05))
      const iu = smooth(clamp01((p - INTRO_HOLD) / Math.max(0.01, INTRO_TO - INTRO_HOLD)))
      const introEl = intro.current
      if (introEl) {
        const first = rows[0]?.querySelector('p')
        introEl.style.visibility = iu >= 1 ? 'hidden' : ''
        if (iu < 1 && first) {
          const b = first.getBoundingClientRect()
          const cx = window.innerWidth / 2
          const cy = vh * 0.5
          const tx = b.left + b.width / 2
          const ty = b.top + b.height / 2
          const k = INTRO_ZOOM + (1 - INTRO_ZOOM) * iu
          introEl.style.opacity = ia.toFixed(3)
          introEl.style.transform = `translate3d(${(cx + (tx - cx) * iu).toFixed(1)}px, ${(cy + (ty - cy) * iu).toFixed(1)}px, 0) translate(-50%,-50%) scale(${k.toFixed(3)})`
        }
      }
      /* ฟองใบแรกเข้าที่พอดีตอนท่าเปิดจบ สายจึงเริ่มนับจากใบที่หนึ่ง ไม่ใช่ใบที่ศูนย์ */
      const head =
        SOFT + clamp01((p - INTRO_TO) / (RUN_TO - INTRO_TO)) * (rows.length - 1 + SOFT)
      /* ระหว่างท่าเปิด สายยังไม่โผล่ — ของที่ตาต้องมองคือฟองที่กลางจอใบเดียว */
      list.style.visibility = iu >= 1 ? '' : 'hidden'
      /** ก้นของอันใหม่สุด — ใช้เลื่อนสายให้อันนั้นมาหยุดที่ระดับ FOCUS */
      let anchor = 0
      for (let i = 0; i < rows.length; i++) {
        const u = smooth(clamp01((head - i) / SOFT))
        const r = rows[i]
        const w = words[i]
        if (w.length) {
          /**
           * คำตอบ AI ขึ้นทีละคำเหมือนคำตอบที่กำลังถูกสร้าง — ตัวแถวไม่จาง ให้คำเป็นคนจาง
           * (ถ้าจางทั้งแถวด้วย คำที่ขึ้นครบแล้วจะยังซีดอยู่ตามค่าของแถว)
           */
          r.style.opacity = u > 0 ? '1' : '0'
          r.style.transform = `translate3d(0, ${((1 - u) * RISE).toFixed(1)}px, 0)`
          const wh = u * (w.length + WORD_SOFT)
          for (let j = 0; j < w.length; j++) {
            w[j].style.opacity = smooth(clamp01((wh - j) / WORD_SOFT)).toFixed(3)
          }
        } else {
          r.style.opacity = u.toFixed(3)
          /* ฟองของผู้ชมผุดจากเล็กไปเต็ม — ของที่โผล่มาเฉย ๆ อ่านเป็นข้อความที่ถูกวาง ไม่ใช่ส่ง */
          r.style.transform = `translate3d(0, ${((1 - u) * RISE).toFixed(1)}px, 0) scale(${(0.96 + 0.04 * u).toFixed(3)})`
        }
        /* ก้นของอันนี้ ถ่วงตามว่ามันเข้ามาแค่ไหน สายจึงเลื่อนต่อเนื่อง ไม่ใช่กระตุกทีละอัน */
        anchor += r.offsetHeight * u
      }
      list.style.transform = `translate3d(0, ${(vh * FOCUS - anchor).toFixed(1)}px, 0)`

      /**
       * เคอร์เซอร์กดลิงก์ — ขึ้นแล้วลงเป็นครึ่งคลื่น ไม่ใช่กดแล้วค้าง
       *
       * ค่านี้ไปที่ตัวลูกศรของหน้า (cursorguide/press) ไม่ได้วาดอะไรเองที่นี่ ลูกศรจึง
       * เป็นตัวเดิมที่กดของในจอนี้จริง ๆ
       */
      const pu = clamp01((p - PRESS_AT) / PRESS_SPAN)
      cursorPress.v = pu <= 0 || pu >= 1 ? 0 : Math.sin(pu * Math.PI)

      /**
       * แปลงร่างแบบ genie: แผ่นถูกดึงออกมาจากจุดเดียวแล้วคลี่เป็นการ์ด
       *
       * สามอย่างที่ทำให้มันอ่านเป็น genie ไม่ใช่กล่องที่ค่อย ๆ โตขึ้น:
       *
       * 1. ขอบสี่ด้าน ease คนละจังหวะ — ขอบบนพุ่งไปถึงที่ก่อน ขอบล่างตามมาช้าสุด ระหว่างทาง
       *    แผ่นจึงสูงและแคบ (ถูก "ยืด") ไม่ใช่กล่องสัดส่วนเดิมที่ขยายขึ้น
       * 2. ก้นคอดเข้าหาจุดที่ถูกกด แล้วคลี่ออกเป็นขอบเต็ม — ทำด้วย clip-path หลายจุด
       *    ที่ไล่ความกว้างด้วยเส้นโค้ง ด้านข้างจึงเป็นคอโค้ง ไม่ใช่สามเหลี่ยมขอบตรง
       * 3. เอียงเล็กน้อยตอนต้นแล้วคลายเป็นศูนย์ — คอของ genie ไม่ได้ตั้งฉากกับ dock
       *
       * ทำที่กรอบจริง (left/top/width/height) ไม่ใช่ scale เพราะสเกลไม่เท่ากันสองแกนจะบิด
       * มุมโค้งกับเงาให้เห็นว่าเป็นของที่ถูกยืด ส่วน clip-path ไม่บิดอะไรเลย มันแค่ตัด
       */
      const m = smooth(clamp01((p - MORPH_AT) / Math.max(0.01, 1 - MORPH_AT)))
      const cardEl = card.current
      const linkEl = link.current
      if (cardEl && linkEl) {
        const b = linkEl.getBoundingClientRect()
        /** จุดที่ถูกกด = ก้นของ genie */
        const sx = b.left + b.width * 0.32
        const sy = b.top + b.height * 0.5
        const tw = window.innerWidth * CARD.w
        const th = vh * CARD.h
        const tl = (window.innerWidth - tw) / 2
        const tt = (vh - th) / 2

        /* ขอบบนไปถึงที่เร็ว (ยกกำลังน้อย) ขอบล่างช้าสุด — ระหว่างทางแผ่นจึงถูกยืด */
        const eTop = 1 - (1 - m) ** 3
        const eSide = 1 - (1 - m) ** 2
        const eBot = m ** 1.6
        const top = sy + (tt - sy) * eTop
        const bot = sy + (tt + th - sy) * eBot
        const left = sx + (tl - sx) * eSide
        const right = sx + (tl + tw - sx) * eSide
        cardEl.style.opacity = clamp01(m * 5).toFixed(3)
        cardEl.style.left = `${left.toFixed(1)}px`
        cardEl.style.top = `${top.toFixed(1)}px`
        cardEl.style.width = `${Math.max(1, right - left).toFixed(1)}px`
        cardEl.style.height = `${Math.max(1, bot - top).toFixed(1)}px`
        cardEl.style.borderRadius = `${(10 + 34 * m).toFixed(1)}px`
        /* เอียงตามทิศที่ถูกดึงออกมา แล้วคลายเป็นศูนย์ตอนเข้าที่ */
        cardEl.style.transform = `skewX(${(-7 * (1 - m) * m * 4).toFixed(2)}deg)`

        /**
         * ก้นคอดเข้าหาจุดที่ถูกกด — คิดเป็นสัดส่วนของกรอบปัจจุบัน ไม่ใช่พิกเซล
         * (กรอบเปลี่ยนขนาดทุกเฟรม ถ้าคิดเป็นพิกเซลค่าจะไม่ตรงกับที่ตาเห็น)
         */
        const w2 = Math.max(1, right - left)
        /**
         * จุดคอดไม่ถูกหนีบให้อยู่ในกรอบ — ตอนต้นทางจุดที่ถูกกดอยู่นอกกรอบของแผ่นก็ได้
         *
         * เคยหนีบไว้ที่ 0..100 ผลคือค่ากลางเพี้ยนไปติดขอบ แล้วขอบขวาไปจบที่ 48.5% ตอน
         * m ใกล้ 1 — แผ่นถูกตัดค้างไว้ครึ่งใบตลอด (เห็นในภาพ) คิดจากปลายทางแทน: ที่ m = 1
         * ต้องเป็น 0% กับ 100% พอดีเสมอ ไม่ว่าจุดคอดจะอยู่ที่ไหน
         */
        const cx = ((sx - left) / w2) * 100
        const l2 = cx - 1.5 + (0 - (cx - 1.5)) * m
        const r2 = cx + 1.5 + (100 - (cx + 1.5)) * m
        const N = 8
        const lhs: string[] = []
        const rhs: string[] = []
        for (let k = 0; k <= N; k++) {
          const t = k / N
          /* เส้นโค้งของคอ: ยกกำลังสองทำให้ช่วงบนกว้างค้างไว้แล้วคอดเร็วตอนใกล้ก้น */
          const c = t * t
          const y = (t * 100).toFixed(2)
          lhs.push(`${(0 + (l2 - 0) * c).toFixed(2)}% ${y}%`)
          rhs.push(`${(100 + (r2 - 100) * c).toFixed(2)}% ${y}%`)
        }
        cardEl.style.clipPath = `polygon(${[...lhs, ...rhs.reverse()].join(',')})`

        /* สายแชตจางหายตอนแผ่นเริ่มถูกดึงออกมา ไม่รอถึงตอนจบ เหลือของชิ้นเดียวบนจอ */
        list.style.opacity = (1 - clamp01(m * 2.2)).toFixed(3)
      }

      if (dots) {
        /**
         * จุดกำลังคิดอยู่ก่อนคำตอบ AI อันถัดไป — โผล่ตอนคำตอบยังไม่มา แล้วหายพร้อมกับที่
         * มันเริ่มขึ้น (ของจริงก็ทำงานแบบนี้: เห็นจุดก่อน แล้วจุดถูกแทนด้วยข้อความ)
         */
        const i = Math.min(rows.length - 1, Math.floor(head) + 1)
        const gap = i - head
        dots.style.opacity = CHAT[i]?.ai === true && gap > 0.12 && gap < 0.9 ? '1' : '0'
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

  return (
    <section
      ref={section}
      className="relative w-full"
      /* พื้นขาวเดียวกับที่ม่านเมฆถมไว้ และเดียวกับจอถัดไป — รอยต่อทั้งสองฝั่งจึงไม่มีให้เห็น */
      style={{ background: '#ffffff', height: `${TELL_VH * 100}svh` }}
    >
      {/**
       * ตรึงเต็มจอ z-10 — ต้องสูงกว่าจอถัดไป (ระดับ auto) ระหว่างที่ยังเล่าอยู่
       *
       * จอถัดไปพื้นทึบและเลื่อนเข้ามาจากขอบล่างตั้งแต่ยังเล่าไม่จบ ถ้าไม่ตั้ง z มันจะกิน
       * บทสนทนาจากด้านล่างขึ้นมาทีละบรรทัด (วัดมาแล้ว) ชั้นนี้ปิดตัวเองตอนเล่าจบพอดีกับ
       * ที่ขอบบนของจอถัดไปมาถึงขอบบนจอ จึงไม่ไปค้างทับใคร
       *
       * เว้นซ้ายเท่าที่ราวจุดนำสายตา (AnchorNav อยู่ที่ left 24px) กินที่อยู่ ขวาเว้นแค่ขอบ —
       * ทั้งสองฝั่งชิดขอบจอ ไม่ได้อยู่ในคอลัมน์กลางเหมือนเนื้อหาส่วนอื่นของหน้า
       */}
      <div
        ref={wrap}
        className="pointer-events-none fixed inset-0 z-10 overflow-clip pl-[clamp(68px,5vw,104px)] pr-[clamp(20px,2.4vw,48px)]"
        /**
         * พื้นขาวทึบของตัวเอง ไม่ใช่แค่ตัวหนังสือลอย ๆ
         *
         * จอถัดไปเลื่อนเข้ามาจากขอบล่างตั้งแต่ยังเล่าไม่จบ ถ้าชั้นนี้โปร่ง การ์ดใบจริงจะโผล่
         * ขึ้นมาให้เห็นก่อนที่ฟองลิงก์จะแปลงร่างเสร็จ — เห็นการ์ดสองใบพร้อมกัน (วัดมาแล้ว)
         * พื้นขาวนี้สีเดียวกับม่านเมฆและจอถัดไป จึงไม่มีรอยต่อให้เห็นทั้งหัวและท้าย
         */
        style={{ visibility: 'hidden', opacity: 0, background: '#ffffff' }}
      >
        <div ref={thread} className="w-full will-change-transform">
          {CHAT.map((m, i) => (
            <div
              // ข้อความซ้ำกันได้ ลำดับจึงเป็นส่วนหนึ่งของคีย์
              key={`${m.text}-${i}`}
              data-row
              className={`mt-[clamp(12px,2svh,28px)] flex items-end gap-[clamp(10px,1.1vw,18px)] ${
                m.ai ? 'justify-end' : 'justify-start'
              }`}
              style={{ opacity: 0, transformOrigin: m.ai ? '100% 100%' : '0% 100%' }}
            >
              {!m.ai && <Who />}
              <p
                /* ฟองของลิงก์เป็นจุดจอดของเคอร์เซอร์ และจุดเริ่มของการแปลงร่าง */
                ref={m.link ? link : undefined}
                className={`max-w-[68%] text-[clamp(20px,2.3vw,38px)] leading-[1.2] tracking-tight ${
                  m.link
                    ? /* ลิงก์: ขีดเส้นใต้และใช้สีของแบรนด์ — ของที่กดได้ ไม่ใช่ประโยคอีกใบ
                         (ชั้นนี้ไม่รับเมาส์ คนกดคือเคอร์เซอร์นำสายตา ไม่ใช่นิ้วของผู้ชม) */
                      'rounded-[clamp(18px,1.8vw,30px)] rounded-br-[8px] bg-[#f1f3f7] px-[clamp(18px,1.7vw,30px)] py-[clamp(12px,1.2vw,20px)] font-semibold text-[var(--v3-orange)] underline decoration-[max(2px,0.08em)] underline-offset-[0.18em]'
                    : m.ai
                      ? 'rounded-[clamp(18px,1.8vw,30px)] rounded-br-[8px] bg-[#f1f3f7] px-[clamp(18px,1.7vw,30px)] py-[clamp(12px,1.2vw,20px)] font-medium text-[#16181f]'
                      : 'rounded-[clamp(18px,1.8vw,30px)] rounded-bl-[8px] bg-[var(--v3-orange)] px-[clamp(18px,1.7vw,30px)] py-[clamp(12px,1.2vw,20px)] font-medium text-white'
                }`}
              >
                {m.ai
                  ? m.text
                      .split(' ')
                      .map((w, j) => (
                        <span key={`${w}-${j}`} data-word style={{ opacity: 0, whiteSpace: 'nowrap' }}>
                          {w}
                        </span>
                      ))
                      /* ช่องว่างเป็น text node นอก span — จุดที่เบราว์เซอร์ขึ้นบรรทัดใหม่ได้ */
                      .flatMap((node, j) => (j === 0 ? [node] : [' ', node]))
                  : m.text}
              </p>
              {m.ai && <Who ai />}
            </div>
          ))}
          {/* จุดกำลังคิด — อยู่ฝั่งเจ้าของหน้าเสมอ จึงชิดขวาเหมือนฟองของเขา */}
          <div
            data-typing
            className="mt-[clamp(12px,2svh,28px)] flex items-end justify-end gap-[clamp(10px,1.1vw,18px)]"
            style={{ opacity: 0 }}
          >
            <span className="flex gap-[6px] rounded-[clamp(18px,1.8vw,30px)] rounded-br-[8px] bg-[#f1f3f7] px-[clamp(18px,1.7vw,30px)] py-[clamp(16px,1.5vw,24px)]">
              <i className="v3-typing-dot size-[clamp(8px,0.7vw,11px)] rounded-full bg-[#c3cad6]" />
              <i className="v3-typing-dot size-[clamp(8px,0.7vw,11px)] rounded-full bg-[#c3cad6]" />
              <i className="v3-typing-dot size-[clamp(8px,0.7vw,11px)] rounded-full bg-[#c3cad6]" />
            </span>
            <Who ai />
          </div>
        </div>

        {/**
         * ท่าเปิดฉาก — ฟองกำลังพิมพ์ใบเดียวกลางจอ ก่อนจะไปเข้าที่ของฟองใบแรก
         *
         * แยกจากสาย ไม่ได้อยู่ในแถว เพราะตอนนั้นมันไม่ใช่ "ข้อความในบทสนทนา" แต่เป็น
         * ของชิ้นเดียวบนจอขาวที่ตาต้องไปอยู่กับมันก่อน
         */}
        <div
          ref={intro}
          className="pointer-events-none fixed top-0 left-0"
          style={{ opacity: 0, transformOrigin: '50% 50%' }}
        >
          <span className="flex gap-[8px] rounded-[clamp(18px,1.8vw,30px)] rounded-br-[8px] bg-[#f1f3f7] px-[clamp(20px,1.9vw,32px)] py-[clamp(18px,1.7vw,26px)]">
            <i className="v3-typing-dot size-[clamp(9px,0.8vw,13px)] rounded-full bg-[#c3cad6]" />
            <i className="v3-typing-dot size-[clamp(9px,0.8vw,13px)] rounded-full bg-[#c3cad6]" />
            <i className="v3-typing-dot size-[clamp(9px,0.8vw,13px)] rounded-full bg-[#c3cad6]" />
          </span>
        </div>

        {/**
         * กล่องที่แปลงร่างจากฟองลิงก์ไปเป็นการ์ดของจอถัดไป
         *
         * เป็นเงาของการ์ด ไม่ใช่การ์ดใบจริง (ใบจริงเป็นของใน 3D ของจอถัดไป) — กรอบขาว
         * มุมโค้งกับช่องรูปสีอุ่นด้านใน คือสองอย่างที่ตาใช้จำการ์ดใบนั้น เมื่อถึงปลายทาง
         * ชั้นนี้ปิดตัวเองแล้วใบจริงรับช่วงที่กรอบเดียวกัน
         */}
        <div
          ref={card}
          className="pointer-events-none fixed"
          style={{
            opacity: 0,
            background: '#f4f4f5',
            boxShadow: '0 30px 80px rgba(22,24,31,0.12)',
          }}
        >
          {/* แถบหัวหน้าต่างกับจุดสามจุด — สองอย่างที่ทำให้ตาอ่านว่านี่คือหน้าต่าง */}
          <div
            className="absolute inset-x-0 top-0 flex items-center gap-[0.9%] pl-[2.4%]"
            style={{ height: `${CARD_BAR * 100}%`, background: '#eceef2' }}
          >
            <i className="aspect-square w-[1.7%] rounded-full bg-[#ff5f57]" />
            <i className="aspect-square w-[1.7%] rounded-full bg-[#febc2e]" />
            <i className="aspect-square w-[1.7%] rounded-full bg-[#28c840]" />
          </div>
          {/* เนื้อหน้าต่าง — ขอบบางเท่ากันสามด้านเหมือนใบจริง */}
          <div
            className="absolute inset-x-[1.6%] bottom-[2.2%] rounded-[2%]"
            style={{
              top: `${CARD_BAR * 100 + 1.6}%`,
              background: 'linear-gradient(180deg,#ffe9d2 0%,#ff7a3c 100%)',
            }}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * รูปตัวแทนกับชื่อกำกับ อยู่นอกฟองตามแบบ
 *
 * ฝั่งเจ้าของหน้าใช้เครื่องหมายประกายบนพื้นสีของแบรนด์ — ตัวแทนของ "ฝั่งที่ตอบแบบ AI"
 * ฝั่งผู้ชมเป็นวงเทาว่าง ไม่ใส่หน้าใคร เพราะมันคือผู้ชมคนไหนก็ได้ที่กำลังอ่านอยู่
 *
 * ชื่อที่กำกับคือ "joe" กับ "you" ไม่ใช่ชื่อผลิตภัณฑ์หรือชื่อโมเดลที่ไม่มีอยู่จริง
 */
function Who({ ai = false }: { ai?: boolean }) {
  return (
    <span className="flex w-[clamp(34px,3.4vw,56px)] shrink-0 flex-col items-center gap-[4px]">
      <span
        className={`grid aspect-square w-full place-items-center rounded-full text-[clamp(14px,1.3vw,22px)] leading-none ${
          ai ? 'bg-[var(--v3-orange)] text-white' : 'bg-[#e6e9f0] text-[#8b93a3]'
        }`}
      >
        {ai ? '✦' : ''}
      </span>
      <span className="text-[clamp(9px,0.72vw,12px)] font-semibold tracking-[0.14em] uppercase text-[#a8b0c0]">
        {ai ? 'joe' : 'you'}
      </span>
    </span>
  )
}
