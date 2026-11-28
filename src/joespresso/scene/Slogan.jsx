import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { introState } from '../intro'
import { useDevMode } from '../mode'

/**
 * สโลแกนของ intro — เป็นวัตถุ 3D ในฉาก ไม่ใช่ตัวหนังสือ DOM ที่ลอยทับ canvas
 *
 * ทำไมไม่ใช้ drei <Text>: troika ต้องการไฟล์ฟอนต์ (ttf/woff) ส่วนหน้านี้โหลด Satoshi
 * มาเป็น CSS จาก fontshare การชี้ troika ไปที่ไฟล์ของ CDN โดยตรงเสี่ยงพัง (รูปแบบ/CORS)
 * และตัวหนังสือจะเพี้ยนจากที่เห็นในหน้าเว็บ
 *
 * วาดลง canvas 2D ด้วยฟอนต์ตัวเดียวกับที่หน้าเว็บใช้ แล้วเอาเป็น texture แปะบนระนาบแทน
 * ได้ตัวอักษรตรงกับแบบเป๊ะ คุมสีทีละคำได้ และเป็นวัตถุในฉากจริง ๆ
 *
 * ท่าเข้า: depth text (อ้างจาก reactbits/DepthText) + ตัวอักษรโผล่ทีละตัว
 * ตัวหนังสือถูกซ้อนหลายชั้นถอยลึกไปข้างหลังทีละนิด ไล่สีจากสีจริงไปหาสีม่วงของเครื่องมือ
 * ได้ตัวอักษรที่มี "เนื้อ" แล้วทั้งก้อนส่ายช้า ๆ ให้ตาเห็นความลึกนั้น
 *
 * ต่างจากต้นฉบับตรงที่ของเขาซ้อน DOM ด้วย translateZ ส่วนอันนี้เป็นระนาบซ้อนกันในฉากจริง —
 * ความลึกจึงเป็นความลึกของฉาก โดนบัง โดนหมอก และเข้ากับเปอร์สเปคทีฟของกล้องเอง
 *
 * ## ทำไมเป็น InstancedMesh
 *
 * ตัวอักษรต้องโผล่ทีละตัว = แต่ละตัวต้องมี transform ของตัวเอง คูณด้วยชั้นความลึก 17 ชั้น
 * และตัวอักษรราว 32 ตัว = 544 ชิ้น ถ้าทำเป็น mesh ละชิ้นคือ 544 draw call ต่อเฟรม
 * อัดเป็น InstancedMesh บรรทัดละก้อน (2 draw call) แล้วให้แต่ละ instance เลือก "ช่องของตัวเอง"
 * บน texture ของบรรทัดนั้นผ่าน attribute aUvRect (ดู patchUv) — texture ใบเดียวใช้ได้ทุกตัวอักษร
 */

/**
 * บรรทัด: ลิสต์ของ [ข้อความ, สีโหมด design, สีโหมด dev, เป็นคำที่ crop tool ครอบไหม]
 *
 * ต้องมีสองสีเพราะ #1C1C1E บนฟ้ากลางคืนสีครามคืออ่านไม่ออกเลย โหมด dev จึงพลิกเป็นสีอ่อน
 * ส่วนสีที่เป็นสีแบรนด์ (น้ำเงิน/ส้ม) แค่สว่างขึ้นให้สู้พื้นหลังเข้มได้ ไม่เปลี่ยนตัวสี
 *
 * ธงตัวสุดท้ายมีได้คำเดียวในทั้งบล็อก — ปลายทางของ crop tool คือ "ครอบคำนั้น" ตามแบบ
 * ไม่ใช่ครอบทั้งสองบรรทัด (เครื่องมือกำลังเลือกของชิ้นหนึ่ง ไม่ได้เลือกทั้งหน้า)
 */
const LINES = [
  [
    ['Turning ', '#1C1C1E', '#E7EAFF'],
    ['Vision', '#2F6BFF', '#7E9BFF', true],
  ],
  [
    ['into ', '#1C1C1E', '#E7EAFF'],
    ['{Experiences}', '#F2604A', '#FF8A6E'],
  ],
]

const FONT = '600 128px Satoshi, system-ui, sans-serif'
/** ความสูงตัวอักษรในหน่วยโลก — ทั้งบล็อกถูกสเกลจากค่านี้ */
const LINE_H = 0.62
/** วาด texture ใหญ่กว่าที่ใช้จริงเท่านี้ กันขอบฟุ้งตอนกล้องเข้าใกล้ */
const RES = 2

/** จำนวนชั้นความลึกต่อบรรทัด — มากขึ้นเนียนขึ้นแต่จ่ายเป็นจำนวน instance ตรง ๆ */
const LAYERS = 14
/**
 * ระยะห่างระหว่างชั้น — รวมแล้วหนา ~0.06 หรือ 10% ของความสูงตัวอักษร
 *
 * เคยตั้งไว้ 0.012 (หนารวม 0.19 = 30%) ซึ่งเป็นสัดส่วนของงาน depth text แบบมองตรงหน้า
 * แต่ตัวหนังสือก้อนนี้อยู่ในฉากจริงและกล้องมองจากด้านล่าง ชั้นหลัง ๆ เลยเลื่อนออกมาพ้นตัวอักษร
 * กลายเป็นคำสีเข้มอีกคำลอยเยื้องอยู่ข้างหลัง ไม่ใช่ "เนื้อ" ของตัวอักษร
 * บางลงแล้วชั้นทั้งกองเกาะกันเป็นสันหนา ๆ ติดขอบตัวอักษร ซึ่งคือสิ่งที่ต้องการแต่แรก
 */
const LAYER_GAP = 0.0045
/** สีเนื้อด้านลึก — สีเดียวกับกรอบ crop ให้อ่านเป็นของชุดเดียวกัน */
const DEPTH_COLOR = new THREE.Color('#7C5CFC')
/** มุมส่ายสูงสุด (เรเดียน) และความเร็ววงส่าย */
const TILT = 0.13
const ORBIT = 0.32

/**
 * rim light: สำเนาตัวอักษรสีอ่อนวางเยื้องไปทาง "ต้นแสง" แล้ววาดไว้หลังชั้นหน้าสุด
 *
 * ตัวหนังสือใช้ basic material (ไม่รับไฟ) ด้วยเหตุผลเรื่องสีที่คุมเองทั้งชุด แสงจริงจึงส่องไม่ถึง
 * แต่ขอบสว่างทำได้ตรง ๆ แบบงาน 2D: วางสำเนาที่สว่างกว่าเยื้องไปด้านที่แสงมา ให้มันโผล่พ้น
 * ชั้นหน้าสุดออกมาเป็นเส้นบาง ๆ ด้านเดียว = ขอบรับแสง
 *
 * ทิศเอาจากไฟหลักของฉากจริง (directionalLight ที่ [-5, 4, 13] สีอุ่น) = ส่องมาจากซ้ายบน
 * ขอบสว่างจึงต้องอยู่ซ้ายบนของตัวอักษร ไม่ใช่ขวาล่าง
 */
const RIM_COLOR = new THREE.Color('#FFF6E8')
/**
 * เยื้องน้อย ๆ แล้วชดเชยด้วยการขยายอีกนิด — ไม่ใช่เยื้องเยอะ ๆ
 *
 * เคยดันไป 4.5% ของความสูงตัวอักษรเพื่อให้ขอบหนาพอมองเห็น ผลคือมันอ่านเป็น "คำซ้อนสองชั้น"
 * ไม่ใช่ขอบรับแสง เพราะสำเนาหลุดออกมาทั้งตัวจนเห็นเป็นตัวอักษรอีกตัว
 * เยื้องแค่ 1.3% แล้วขยายสำเนา 2.5% แทน: ขอบโผล่รอบตัวเสมอกันโดยหนากว่าทางซ้ายบน
 * = ขอบรับแสงที่มีทิศ แต่ไม่มีเงาซ้อนให้เห็นเป็นคำที่สอง
 */
const RIM_OFFSET = [-0.008, 0.008]
const RIM_SCALE = 1.025
/** rim อยู่หลังชั้นหน้าสุดแค่นิดเดียว — ลึกกว่านี้จะกลายเป็นเงาซ้อน ไม่ใช่ขอบ */
const RIM_Z = -0.004

/** ตัวอักษรตัวถัดไปโผล่ห่างจากตัวก่อนหน้าเท่านี้ (ส่วนของช่วงเข้าบรรทัด) และตัวหนึ่งใช้เวลาเท่านี้ */
const CHAR_STEP = 0.045
const CHAR_DUR = 0.3

/**
 * วาดหนึ่งบรรทัดลง canvas ทีละตัวอักษร แล้วคืน "ช่องของแต่ละตัว" บน texture
 *
 * วาดทีละตัวโดยเลื่อน x ตามความกว้างที่วัดมา (ไม่ใช่ fillText ทั้งก้อน) เพื่อให้ช่อง uv ที่บันทึกไว้
 * ตรงกับหมึกที่วาดจริงเป๊ะ — ถ้าวาดทั้งก้อนแล้วมาเดาตำแหน่งทีหลัง kerning จะทำให้เหลื่อม
 */
function drawLine(parts) {
  const pad = 24
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = FONT
  /**
   * ต้องตั้ง textBaseline ให้ตรงกับตอนวาดจริง
   *
   * actualBoundingBoxAscent/Descent วัดเทียบกับ "เส้นฐานของ context นั้น" ไม่ใช่ค่าสัมบูรณ์
   * probe ที่ปล่อย default (alphabetic) จะได้ ascent ที่สูงกว่าตอนวาดด้วย middle อยู่ราวครึ่ง em
   * ผลคือกล่องที่คำนวณได้ลอยสูงกว่าคำจริง (เจอมาแล้ว: กรอบ crop เยื้องขึ้น 9.5px บนจอ)
   */
  probe.textBaseline = 'middle'

  const partW = parts.map(([t]) => probe.measureText(t).width)
  const w = Math.ceil(partW.reduce((a, b) => a + b, 0)) + pad * 2
  const h = 190

  const canvas = document.createElement('canvas')
  canvas.width = w * RES
  canvas.height = h * RES
  const ctx = canvas.getContext('2d')
  ctx.scale(RES, RES)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  /**
   * วาดตัวอักษรเป็นสีขาวล้วน สีจริงไปใส่ทีหลังที่ instanceColor
   *
   * ถ้าอบสีลง texture ตั้งแต่ตอนวาด การเปลี่ยนสีตามโหมดจะต้องวาด canvas ใหม่ทั้งใบทุกครั้ง
   * ขาวคูณสีที่ instance = ได้สีอะไรก็ได้จาก texture ใบเดียว เปลี่ยนตอนไหนก็ได้ ไม่ต้องวาดใหม่
   */
  const chars = []
  let focus = null
  let x = pad
  ctx.fillStyle = '#FFFFFF'
  parts.forEach(([text, color, devColor, isFocus], pi) => {
    const start = x
    for (const ch of text) {
      const cw = probe.measureText(ch).width
      // เว้นวรรคไม่มีหมึก ข้ามไปเลย จะได้ไม่เปลือง instance และไม่กินคิวจังหวะโผล่
      if (ch !== ' ') {
        ctx.fillText(ch, x, h / 2)
        chars.push({
          // ช่องบน texture (0..1) และตำแหน่ง/ขนาดในหน่วยความสูงระนาบ
          u0: x / w,
          du: cw / w,
          cx: (x + cw / 2 - w / 2) / h,
          w: cw / h,
          color,
          devColor: devColor ?? color,
        })
      }
      x += cw
    }
    if (isFocus) {
      const fm = probe.measureText(text)
      focus = {
        cx: (start + partW[pi] / 2 - w / 2) / h,
        w: partW[pi] / h,
        top: fm.actualBoundingBoxAscent / h,
        bottom: fm.actualBoundingBoxDescent / h,
      }
    }
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, chars, focus }
}

/** สีของชั้นที่ d — ชั้นหน้าสุด (d = 0) เป็นสีตัวอักษรเอง ชั้นลึกไล่ไปหาสีม่วงแบบไม่เป็นเชิงเส้น */
function layerColor(base, d) {
  if (d === 0) return base
  const p = d / LAYERS
  return base.clone().lerp(DEPTH_COLOR, p * p * 0.85 + 0.15)
}

/**
 * ให้ instance เลือกช่องของตัวเองบน texture
 *
 * map ปกติใช้ uv ของ geometry ตรง ๆ ทุก instance จึงได้ภาพเดียวกันหมด แทรก aUvRect
 * (xy = จุดเริ่ม, zw = ความกว้าง/สูงของช่อง) เข้าไปคูณกับ uv ตอน vertex — instance ละตัวอักษร
 * โดยไม่ต้องมี texture หรือ material แยก
 */
function patchUv(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aUvRect;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n\tvMapUv = uv * aUvRect.zw + aUvRect.xy;',
      )
  }
  return material
}

/**
 * หนึ่งบรรทัด = หนึ่ง InstancedMesh
 *
 * ลำดับ instance สำคัญ: material โปร่งใสและปิด depthWrite ภายในก้อนเดียวกันจึงวาดไล่ตาม index
 * ต้องเรียงจากชั้นลึกสุดมาหน้าสุด (ลึก -> rim -> หน้า) ไม่งั้นชั้นลึกจะทับชั้นหน้า
 */
function Line({ data, index }) {
  const mesh = useRef()
  const dev = useDevMode()
  const { tex, chars } = data
  const n = chars.length
  // ชั้นทั้งหมดเรียงจากลึกไปหน้า: d = LAYERS..1, แล้ว rim, แล้ว d = 0
  const slots = useMemo(() => {
    const out = []
    for (let d = LAYERS; d >= 1; d--) out.push({ d, rim: false })
    out.push({ d: 0, rim: true })
    out.push({ d: 0, rim: false })
    return out
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    const plane = new THREE.PlaneGeometry(1, 1)
    g.index = plane.index
    g.attributes = plane.attributes
    const rect = new Float32Array(n * slots.length * 4)
    for (let s = 0; s < slots.length; s++) {
      for (let i = 0; i < n; i++) {
        const o = (s * n + i) * 4
        rect[o] = chars[i].u0
        rect[o + 1] = 0
        rect[o + 2] = chars[i].du
        rect[o + 3] = 1
      }
    }
    g.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(rect, 4))
    plane.dispose()
    return g
  }, [chars, n, slots])

  const material = useMemo(
    () =>
      patchUv(
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          toneMapped: false,
          depthWrite: false,
        }),
      ),
    [tex],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  /**
   * สีมาจาก instance ไม่ใช่จาก texture — ตั้งใหม่เมื่อสลับโหมดเท่านั้น ไม่ใช่ทุกเฟรม
   * (texture เป็นตัวอักษรขาวล้วน ดู drawLine)
   */
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const base = new THREE.Color()
    slots.forEach((s, si) => {
      for (let i = 0; i < n; i++) {
        base.set(dev ? chars[i].devColor : chars[i].color)
        m.setColorAt(si * n + i, s.rim ? RIM_COLOR : layerColor(base, s.d))
      }
    })
    m.instanceColor.needsUpdate = true
  }, [slots, n, chars, dev])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const t = introState.playing || introState.done ? introState.b.title : 0
    // ไล่ทีละบรรทัด — บรรทัดล่างออกตัวช้ากว่าเล็กน้อย
    const k = Math.min(1, Math.max(0, (t - index * 0.18) / 0.7))
    m.visible = k > 0.001
    if (!m.visible) return
    const e = 1 - Math.pow(1 - k, 3)
    material.opacity = Math.min(1, k * 4)

    for (let i = 0; i < n; i++) {
      /**
       * ตัวอักษรโผล่ทีละตัวจากซ้ายไปขวา
       *
       * โผล่ด้วย "ขนาด" ไม่ใช่ความจาง: instance ทั้งก้อนใช้ material เดียวกันจึงมี opacity
       * ร่วมกัน ตัวไหนยังไม่ถึงคิวก็ย่อไว้ที่ 0 (ไม่มีพื้นที่ = มองไม่เห็น) พอถึงคิวค่อยผุดขึ้นมา
       * เกินนิดแล้วตกลงที่ (easeOutBack) ให้มีน้ำหนัก ไม่ใช่โผล่มาเฉย ๆ
       */
      const ck = Math.min(1, Math.max(0, (k - i * CHAR_STEP) / CHAR_DUR))
      const back = 1.7
      const p = 1 - ck
      const pop = ck <= 0 ? 0 : 1 + (back + 1) * p * p * p - back * p * p
      const ch = chars[i]
      for (let s = 0; s < slots.length; s++) {
        const slot = slots[s]
        const rs = slot.rim ? RIM_SCALE : 1
        TMP_S.set(ch.w * LINE_H * pop * rs, LINE_H * pop * rs, 1)
        TMP_P.set(
          ch.cx * LINE_H + (slot.rim ? RIM_OFFSET[0] : 0),
          slot.rim ? RIM_OFFSET[1] : 0,
          slot.rim ? RIM_Z : -slot.d * LAYER_GAP * e,
        )
        TMP_M.makeScale(TMP_S.x, TMP_S.y, TMP_S.z).setPosition(TMP_P)
        m.setMatrixAt(s * n + i, TMP_M)
      }
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, n * slots.length]}
      renderOrder={9}
      /* keepColor: โหมดปั้นทาเทาทั้งฉาก ถ้าโดนด้วย ตัวอักษรจะกลายเป็นแผ่นเทา
         — ตัวหนังสือไม่ใช่ "ทรง" ที่ต้องปั้น เว้นไว้ */
      userData={{ keepColor: true }}
      frustumCulled={false}
    />
  )
}

const TMP_M = new THREE.Matrix4()
const TMP_P = new THREE.Vector3()
const TMP_S = new THREE.Vector3()

export function Slogan({ position = [0, 0, 0] }) {
  const group = useRef()
  const [lines, setLines] = useState(null)

  // รอฟอนต์โหลดเสร็จก่อนวาด ไม่งั้นได้ system font ค้างไปทั้งรอบ
  useEffect(() => {
    let alive = true
    const draw = () => alive && setLines(LINES.map(drawLine))
    if (document.fonts?.ready) document.fonts.ready.then(draw)
    else draw()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => () => lines?.forEach(({ tex }) => tex.dispose()), [lines])

  const tilt = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    const g = group.current
    if (!g || !lines) return
    const dt = Math.min(delta, 0.05)
    const t = introState.playing || introState.done ? introState.b.title : 0

    g.children.forEach((line, i) => {
      const k = Math.min(1, Math.max(0, (t - i * 0.18) / 0.7))
      const e = 1 - Math.pow(1 - k, 3)
      // ทั้งบรรทัดไหลขึ้นเข้าที่ ส่วนตัวอักษรผุดทีละตัวอยู่ข้างใน (ดู Line)
      line.position.y = line.userData.y + (1 - e) * LINE_H * 0.35
    })

    // ส่ายช้า ๆ ให้ตาเห็นความลึก + เอียงตามเมาส์นิดหน่อย (ต้นฉบับ DepthText ทำแบบเดียวกัน)
    const now = state.clock.elapsedTime
    const aimX = -state.pointer.y * TILT * 0.5 + Math.sin(now * ORBIT) * TILT * 0.45
    const aimY = state.pointer.x * TILT * 0.5 + Math.cos(now * ORBIT * 0.85) * TILT * 0.45
    const s = 1 - Math.exp(-dt / 0.35)
    tilt.current.x += (aimX - tilt.current.x) * s
    tilt.current.y += (aimY - tilt.current.y) * s
    g.rotation.x = tilt.current.x * t
    g.rotation.y = tilt.current.y * t

    /**
     * กล่อง "ขอบหมึก" ของคำที่ crop tool ต้องครอบ (คำว่า Vision) ในสเปซแม่
     *
     * ไม่ใช้ Box3.setFromObject: มันได้กล่องของ "ระนาบ" ซึ่งมีช่องว่างรอบตัวอักษรติดมาเพียบ
     * (สูงเกินคำจริงเกือบเท่าตัว) และเป็นกล่องของทั้งบรรทัด ไม่ใช่ของคำเดียว
     * คิดจากขอบหมึกที่วัดไว้ตอนวาด canvas + ตำแหน่ง y จริงของบรรทัดนั้นในเฟรมนี้
     * (จึงตามท่าเข้าของสโลแกนไปด้วย ไม่ใช่ค่าคงที่)
     */
    if (t > 0) {
      const fi = lines.findIndex((l) => l.focus)
      const line = fi >= 0 ? g.children[fi] : null
      if (line?.visible !== false && fi >= 0) {
        const f = lines[fi].focus
        if (!introState.slogan) {
          introState.slogan = {
            centre: new THREE.Vector3(),
            size: new THREE.Vector3(),
            quat: new THREE.Quaternion(),
          }
        }
        /**
         * ต้องหมุนจุดกึ่งกลางตามท่าส่ายของบล็อกด้วย
         *
         * ทั้งก้อนส่ายช้า ๆ อยู่ตลอด (TILT/ORBIT) ถ้ารายงานแต่ตำแหน่งตอนยังไม่หมุน กรอบจะเล็ง
         * ไปที่ "ที่ที่คำจะอยู่ถ้าไม่ส่าย" คำจริงบนจอเลยเยื้องออกจากกรอบเรื่อย ๆ ตามจังหวะส่าย
         * ส่ง quat ไปด้วย กรอบจะได้เอียงระนาบตามคำ ไม่ใช่แค่ตามตำแหน่ง
         */
        introState.slogan.centre
          .set(f.cx * LINE_H, line.position.y + ((f.top - f.bottom) / 2) * LINE_H, 0)
          .applyQuaternion(g.quaternion)
          .add(g.position)
        introState.slogan.size.set(f.w * LINE_H, (f.top + f.bottom) * LINE_H, 0.01)
        introState.slogan.quat.copy(g.quaternion)
      }
    }
  })

  if (!lines) return null

  return (
    <group ref={group} position={position}>
      {lines.map((data, i) => {
        const y = (LINES.length / 2 - i - 0.5) * LINE_H * 1.12
        return (
          <group key={i} position={[0, y, 0]} userData={{ y }}>
            <Line data={data} index={i} />
          </group>
        )
      })}
    </group>
  )
}
