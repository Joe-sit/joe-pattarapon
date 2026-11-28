import * as THREE from 'three'

/**
 * รูป (png หรือ svg) → texture ที่ใช้แปะหน้ากระเบื้องได้
 *
 * โหลดผ่าน <img> แล้ววาดลงแคนวาส ไม่ใช่ TextureLoader ตรง ๆ เพราะโลโก้ครึ่งหนึ่งในโปรเจกต์
 * เป็น SVG ซึ่ง TextureLoader อ่านไม่ได้ แต่ <img> ให้เบราว์เซอร์แรสเตอร์ให้เอง
 * วาดบนพื้นโปร่ง จัดกึ่งกลาง คงสัดส่วนเดิม — โลโก้ที่ไม่ใช่สี่เหลี่ยมจัตุรัสจึงไม่ยืด
 */
/**
 * mode 'mask' = ทำโลโก้เป็นเงาขาวบนกระเบื้องสีธีม · 'cover' = รูปงานจริงเต็มช่อง (ครอบตัด)
 */
export function loadTileTexture(
  src: string,
  size = 256,
  bg = '#1a3fa8',
  mode: 'mask' | 'cover' = 'mask',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (mode === 'cover') {
      // รูปผลงานจริง: เติมเต็มช่องแบบครอบตัด แล้วอาบสีธีมบาง ๆ ให้เข้ากับผนัง
      const k = Math.max(size / img.width, size / img.height)
      const w = img.width * k
      const h = img.height * k
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(120,170,255,0.55)'
      ctx.fillRect(0, 0, size, size)
      ctx.globalCompositeOperation = 'source-over'
      tex.needsUpdate = true
      return
    }

    const pad = size * 0.18
    const box = size - pad * 2
    const k = Math.min(box / img.width, box / img.height)
    const w = img.width * k
    const h = img.height * k

    // โลโก้ถูกทำเป็นเงาขาวก่อน ไม่ใช่วางสีจริงลงบนกระเบื้อง — ผนังอุโมงค์มีโลโก้หลายเจ้า
    // ถ้าปล่อยสีแบรนด์ทุกอันมันจะกลายเป็นสติกเกอร์ปะกัน ไม่ใช่ผนังชิ้นเดียวกันตามธีมน้ำเงิน
    const mask = document.createElement('canvas')
    mask.width = size
    mask.height = size
    const mctx = mask.getContext('2d')
    if (!mctx) return
    mctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    mctx.globalCompositeOperation = 'source-in'
    mctx.fillStyle = '#ffffff'
    mctx.fillRect(0, 0, size, size)

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(mask, 0, 0)
    tex.needsUpdate = true
  }
  img.src = src

  return tex
}

/**
 * ข้อความ → texture — ใช้กับที่ทำงานที่เราไม่มีไฟล์โลโก้ของเขา
 *
 * เอาโลโก้ที่ไม่ใช่ของจริงมาแปะไม่ได้ (ทั้งผิดและเป็นของปลอม) ชื่อจริงบนกระเบื้องจึงเป็น
 * คำตอบที่ซื่อสัตย์กว่า — วาดด้วยฟอนต์เดียวกับหน้าเว็บ ตัดบรรทัดตามคำ
 */
export function makeLabelTexture(text: string, size = 256, bg = '#fd5000'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return tex

  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  ctx.font = `700 ${size * 0.16}px 'Momo Trust Display', 'Mona Sans', system-ui, sans-serif`
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > size * 0.82 && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = size * 0.19
  lines.forEach((l, i) => {
    ctx.fillText(l, size / 2, size / 2 + (i - (lines.length - 1) / 2) * lh)
  })
  tex.needsUpdate = true
  return tex
}
