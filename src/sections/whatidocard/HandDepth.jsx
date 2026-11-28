import { useEffect, useRef } from 'react'

/**
 * รูปมือที่ขยับตามเมาส์แบบมีความลึก — depth-map parallax (หรือที่เรียกกันว่า 2.5D parallax)
 *
 * ไม่ใช่การเอียงทั้งแผ่น (tilt): แบบนั้นรูปยังแบนอยู่ มันแค่ถูกหมุน ท่านี้เลื่อน *พิกเซล*
 * ไม่เท่ากันตามความลึกของจุดนั้น — ของที่อยู่ใกล้กล้อง (หลังมือ สันแขน) เลื่อนมาก ของที่อยู่
 * ไกล (ขอบเงา ปลายนิ้วที่ทอดลง) เลื่อนน้อย ตาอ่านผลต่างนั้นเป็นปริมาตร รูปเดิมจึงดูนูนขึ้นมา
 * เล็กน้อยโดยไม่ได้มีเรขาคณิตอะไรเพิ่ม
 *
 * ### แผนที่ความลึกมาจากไหน
 *
 * ไม่มีไฟล์ depth map มาให้ (รูปมาจาก Figma เป็น PNG โปร่งใบเดียว) จึงคิดขึ้นจากตัวรูปเอง
 * ตอนโหลดครั้งเดียว สองสัญญาณรวมกัน:
 *
 * 1. ความสว่าง — รูปนี้เป็นงานวาดที่ไล่แสงไว้แล้ว ส่วนที่นูนรับแสงจึงสว่างกว่าร่องและเงา
 * 2. ระยะจากขอบร่าง (จาก alpha) — ใจกลางมือ/แขนอยู่ใกล้กว่าขอบซึ่งเป็นด้านที่ม้วนหายไป
 *    สัญญาณนี้สำคัญกว่าข้อแรกที่ขอบ เพราะขอบที่ติดแสงจ้าจะหลอกให้ "ขอบลอยขึ้นมา" ซึ่งอ่าน
 *    เป็นกระดาษตัด ไม่ใช่ของหนา
 *
 * เบลอด้วยกล่องสามรอบก่อนใช้ — แผนที่ที่ยังมีรายละเอียดของผิวหนังทำให้พิกเซลเพื่อนบ้านเลื่อน
 * คนละระยะ ภาพจะเป็นคลื่นย่น ไม่ใช่ของนูน
 *
 * ### ทำไมเป็น WebGL
 *
 * การเลื่อนพิกเซลไม่เท่ากันในรูปเดียวคือการอ่านพิกเซลที่ตำแหน่งใหม่ต่อพิกเซล — CSS ทำไม่ได้
 * เลย (transform ทำกับทั้งชั้น) และ canvas 2D ต้องวนลูปทุกพิกเซลบน CPU ทุกเฟรม
 *
 * วาดเฉพาะตอนเมาส์ยังไถลเข้าที่ (ลูปหยุดตัวเองเมื่อค่าเข้าที่แล้ว) ไม่ใช่วาดทุกเฟรมตลอดเวลา
 * — หน้านี้มีแคนวาสที่วาดทุกเฟรมอยู่แล้วหลายตัว
 */

/** ระยะเลื่อนสูงสุดที่ความลึก 1 (สัดส่วนของกรอบรูป) — มากกว่านี้ขอบรูปจะแหว่ง */
const SHIFT = 0.022
/** ซูมเผื่อไว้กันขอบแหว่งตอนพิกเซลถูกเลื่อน */
const OVER = 1.035
/** ความหนืดของการตามเมาส์ (ต่อวินาที) — สูงคือตามไว */
const EASE = 7

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec2 uMouse;
uniform float uShift;
uniform float uOver;

void main() {
  /* uv ของรูปหลังซูมเผื่อ — y กลับด้านเพราะรูปถูกอัปโหลดตามแนวของไฟล์ */
  vec2 uv = (vUv - 0.5) / uOver + 0.5;
  uv.y = 1.0 - uv.y;
  /**
   * ความลึกอ่านจากตำแหน่ง *ก่อน* เลื่อน แล้วเลื่อนครั้งเดียว
   *
   * อ่านสองรอบ (เลื่อนแล้วอ่านความลึกใหม่) ให้ผลที่ถูกกว่าแต่ขอบของแผนที่จะไปดึงพิกเซล
   * ข้ามร่างมาด้วย เห็นเป็นเนื้อยืดออกนอกขอบมือ
   */
  float d = texture2D(uDepth, uv).r;
  vec2 off = uMouse * uShift * d;
  vec4 c = texture2D(uImg, uv + off);
  /* คูณ alpha ของตำแหน่งเดิมด้วย — ร่างของมือไม่ควรเลื่อนตามไปทั้งใบ มีแต่เนื้อข้างในที่ไหล */
  c.a *= texture2D(uImg, uv + off * 0.35).a;
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}
`

/**
 * แผนที่ความลึกจากตัวรูป — ความสว่าง + ระยะจากขอบร่าง แล้วเบลอ
 *
 * ทำที่ความละเอียดหนึ่งในสี่: แผนที่ถูกเบลอหนักอยู่แล้ว ความละเอียดเต็มไม่ได้เพิ่มอะไรนอกจาก
 * เวลาโหลด (รูปนี้ 991×461 → 248×116)
 */
function depthFrom(img) {
  const w = Math.max(1, Math.round(img.width / 4))
  const h = Math.max(1, Math.round(img.height / 4))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h)
  const px = src.data
  const n = w * h

  /* ระยะจากขอบร่าง — แผ่ออกจาก alpha ด้วยการวนซ้ำ ไม่ใช่ distance transform เต็มรูปแบบ:
     ที่ต้องการคือ "ข้างในลึกกว่าขอบ" ไม่ใช่ระยะที่ถูกต้องทุกพิกเซล */
  const inside = new Float32Array(n)
  for (let i = 0; i < n; i++) inside[i] = px[i * 4 + 3] > 20 ? 1 : 0
  const grow = new Float32Array(n)
  const ROUNDS = 6
  for (let r = 0; r < ROUNDS; r++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (inside[i] === 0) continue
        const l = x > 0 ? inside[i - 1] : 0
        const rt = x < w - 1 ? inside[i + 1] : 0
        const u = y > 0 ? inside[i - w] : 0
        const dn = y < h - 1 ? inside[i + w] : 0
        grow[i] = Math.min(l, rt, u, dn) > 0 ? 1 : 0
      }
    }
    for (let i = 0; i < n; i++) if (inside[i] > 0) inside[i] = grow[i] > 0 ? inside[i] + 1 : inside[i]
  }

  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255
    if (a < 0.08) {
      out[i] = 0
      continue
    }
    const luma = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255
    /* ความสว่างของงานวาดนี้อยู่ช่วงแคบ (ผิวคนทั้งใบ) — ยืดช่วงก่อนใช้ ไม่งั้นความลึกแบนราบ */
    const lift = Math.min(1, Math.max(0, (luma - 0.45) / 0.45))
    const core = Math.min(1, (inside[i] - 1) / ROUNDS)
    out[i] = (0.42 * lift + 0.58 * core) * a
  }

  /* เบลอกล่องสามรอบ — แผนที่ที่ยังมีลายผิวทำให้ภาพย่นเป็นคลื่น ไม่ใช่นูน */
  const tmp = new Float32Array(n)
  const R = 2
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0
        let k = 0
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          s += out[y * w + xx]
          k++
        }
        tmp[y * w + x] = s / k
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let s = 0
        let k = 0
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          s += tmp[yy * w + x]
          k++
        }
        out[y * w + x] = s / k
      }
    }
  }

  const bytes = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.min(1, out[i]) * 255)
    bytes[i * 4] = v
    bytes[i * 4 + 1] = v
    bytes[i * 4 + 2] = v
    bytes[i * 4 + 3] = 255
  }
  return { w, h, bytes }
}

/**
 * @param props - elRef: ref ของ <canvas> ที่ชั้นนอกใช้สั่ง transform/opacity ของท่าเลื่อนเข้า
 *   (ดู WhiteWrap) ตัวคอมโพเนนต์นี้ดูแลแค่เนื้อในรูป ไม่ได้ดูแลว่ามันเข้าฉากตอนไหน
 */
export function HandDepth({ src, elRef, className, style }) {
  const own = useRef(null)

  useEffect(() => {
    const cv = elRef?.current ?? own.current
    if (!cv) return undefined
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
    if (!gl) return undefined

    const prog = gl.createProgram()
    const add = (type, source) => {
      const sh = gl.createShader(type)
      gl.shaderSource(sh, source)
      gl.compileShader(sh)
      gl.attachShader(prog, sh)
      return sh
    }
    add(gl.VERTEX_SHADER, VERT)
    add(gl.FRAGMENT_SHADER, FRAG)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const u = {
      img: gl.getUniformLocation(prog, 'uImg'),
      depth: gl.getUniformLocation(prog, 'uDepth'),
      mouse: gl.getUniformLocation(prog, 'uMouse'),
      shift: gl.getUniformLocation(prog, 'uShift'),
      over: gl.getUniformLocation(prog, 'uOver'),
    }

    const mkTex = (unit) => {
      const t = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return t
    }
    const texImg = mkTex(0)
    const texDepth = mkTex(1)
    gl.uniform1i(u.img, 0)
    gl.uniform1i(u.depth, 1)
    gl.uniform1f(u.shift, SHIFT)
    gl.uniform1f(u.over, OVER)
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    /* รูปถูกคูณ alpha มาแล้วในเชดเดอร์ — ผสมแบบ premultiplied ไม่งั้นขอบมือมีขอบดำ */
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    let ready = false
    let raf = 0
    const aim = { x: 0, y: 0 }
    const at = { x: 0, y: 0 }
    let last = 0

    const size = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      if (cv.width !== w || cv.height !== h) {
        cv.width = w
        cv.height = h
      }
      gl.viewport(0, 0, cv.width, cv.height)
    }

    const draw = (now) => {
      raf = 0
      if (!ready) return
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016)
      last = now
      /* ไล่เข้าหาเป้าแบบไม่ผูกกับอัตราเฟรม (ดู 1 - exp(-k·dt)) */
      const k = 1 - Math.exp(-EASE * dt)
      at.x += (aim.x - at.x) * k
      at.y += (aim.y - at.y) * k
      size()
      gl.uniform2f(u.mouse, at.x, at.y)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      /* วาดต่อเฉพาะตอนยังไถลเข้าที่ — เข้าที่แล้วหยุด ไม่กินเฟรมของฉากอื่น */
      if (Math.abs(aim.x - at.x) > 0.001 || Math.abs(aim.y - at.y) > 0.001) kick()
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    /* คนที่ตั้งเครื่องว่าไม่เอาการเคลื่อนไหว ได้รูปนิ่ง — ของชิ้นนี้เป็นการตกแต่ง ไม่ใช่เนื้อหา */
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const onMove = (ev) => {
      if (still) return
      const vw = window.innerWidth || 1
      const vh = window.innerHeight || 1
      /* เมาส์เทียบ *จอ* ไม่ใช่เทียบกรอบรูป: มือกินพื้นที่ครึ่งจอและช่วงนี้ผู้ชมกำลังไถเมาส์
         อยู่ทั่วจอ (ท่าเปิดรูปจริงของจอนี้) ถ้าเทียบกรอบรูป ค่าจะกระโดดตอนเมาส์ออกนอกกรอบ */
      aim.x = (ev.clientX / vw) * 2 - 1
      aim.y = (ev.clientY / vh) * 2 - 1
      kick()
    }

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texImg)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      const d = depthFrom(img)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texDepth)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, d.w, d.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, d.bytes)
      ready = true
      kick()
    }
    img.src = src

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', kick)
      if (raf) cancelAnimationFrame(raf)
      gl.deleteTexture(texImg)
      gl.deleteTexture(texDepth)
      gl.deleteBuffer(quad)
      gl.deleteProgram(prog)
      /**
       * ไม่เรียก WEBGL_lose_context ตอนเก็บของ
       *
       * React เรียก effect สองรอบใน dev (StrictMode) บน element *ใบเดิม* — คอนเท็กซ์ที่ถูก
       * สั่งทิ้งตอนรอบแรกคลีนอัป คือคอนเท็กซ์ใบเดียวกับที่ getContext คืนให้รอบสอง แล้วทุกอย่าง
       * หลังจากนั้นล้มเงียบ ๆ (วัดมาแล้ว: isContextLost = true, shader log เป็น null ทั้งชุด
       * รูปไม่ขึ้นเลย) ปล่อยให้ GC เก็บคอนเท็กซ์เองตอน canvas ถูกถอดจาก DOM
       */
    }
  }, [src, elRef])

  return <canvas ref={elRef ?? own} className={className} style={style} aria-hidden />
}
