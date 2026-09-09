import { useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'

/**
 * คืน GPU buffer ของ geometry/texture ที่ถูกสร้างใหม่
 *
 * useMemo ที่ผูกกับ slider ของ leva จะปั้นของใหม่ทุกครั้งที่ลากค่า
 * three ไม่เก็บกวาดให้เอง — ของเก่าค้างบน GPU จนเบราว์เซอร์บวมตอนปั้นทรง
 *
 * ห้ามใช้กับของที่ cache ไว้ระดับ module (bushGeo/leafTexture/shadowTex) —
 * ตัวนั้นถูกแชร์ข้าม instance การ dispose ตอน component เดียว unmount จะทำให้ตัวอื่นจอดำ
 */
export function useDisposable(target) {
  useEffect(
    () => () => {
      for (const o of Array.isArray(target) ? target : [target]) o?.dispose?.()
    },
    [target],
  )
}

/**
 * หยุดคำนวณ matrix ของ subtree ที่ไม่เคยขยับ
 *
 * ทุกเฟรม three จะไล่ updateMatrixWorld ลงทั้ง scene graph ฉากส่วนที่นิ่งสนิท
 * (ฟ้า/เนิน/ต้นไม้) จ่ายค่านั้นฟรี ๆ — ปิด recursion แล้วคำนวณเองครั้งเดียวตอน mount
 *
 * เงื่อนไข: ห้ามมี useFrame ขยับอะไรใน subtree นี้ (Panels มี — ห้ามใช้)
 */
export function useStaticSubtree(ref) {
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    o.updateMatrixWorld(true)
    o.matrixWorldAutoUpdate = false
    return () => {
      o.matrixWorldAutoUpdate = true
    }
  }, [ref])
}

/**
 * สร้าง texture ไล่สีจาก canvas — ใช้แทน texture ไฟล์
 * stops: [[ตำแหน่ง 0-1, สี], ...]
 */
export function gradientTexture(stops, { vertical = true, size = 256 } = {}) {
  const c = document.createElement('canvas')
  c.width = vertical ? 4 : size
  c.height = vertical ? size : 4
  const ctx = c.getContext('2d')
  const g = vertical
    ? ctx.createLinearGradient(0, 0, 0, size)
    : ctx.createLinearGradient(0, 0, size, 0)
  for (const [t, color] of stops) g.addColorStop(t, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** สุ่มแบบ deterministic — scene จะได้เหมือนเดิมทุกครั้งที่ reload */
export function makeRandom(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * เครื่องเบา = มือถือ/แท็บเล็ต หรือ CPU น้อยคอร์
 * ใช้ตัดงบ pixel ratio / ขนาด shadow map / MSAA — ฉากนี้เป็น PBR + post ทั้งจอ
 * ที่ dpr 3 บนมือถือคือวาด pixel มากกว่าเดสก์ท็อป 2 เท่าโดยไม่ได้อะไรกลับมา
 */
export const LOW_END =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4)

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * หน่วงแบบไม่ผูกกับ frame rate
 *
 * `lerp(x, target, a)` ทุกเฟรมจะเร็วเป็นสองเท่าบนจอ 120Hz และช้าลงครึ่งหนึ่งตอนเฟรมตก
 * ตัวนี้รับ `a` ชุดเดิม (ค่าที่จูนไว้ตอน 60fps) แล้วแปลงเป็นค่าคงที่ต่อวินาที
 * ผลลัพธ์ที่ 60fps เท่าเดิมเป๊ะ แต่จอเร็ว/ช้าจะได้ความรู้สึกเดียวกัน
 */
export function damp(x, target, alphaAt60, dt) {
  if (alphaAt60 >= 1) return target
  return THREE.MathUtils.damp(x, target, -60 * Math.log(1 - alphaAt60), dt)
}

/**
 * ฉีด rim light (fresnel) เข้า material — ขอบวัตถุติดแสงขาวนวลแบบภาพ ref
 * ทำที่ shader เพราะแสงจริงให้ขอบคมแบบนี้กับผิวด้านไม่ได้
 */
export function addRim(material, { color = '#FFF3DC', power = 2.4, intensity = 0.6 } = {}) {
  if (material.userData.rimApplied) return material
  material.userData.rimApplied = true
  /**
   * สร้างออบเจกต์ uniform ไว้ "ก่อน" compile แล้วยัดตัวเดียวกันนี้เข้า shader
   *
   * ของเดิมเก็บตัวอ้างอิงตอน onBeforeCompile ซึ่งใช้ไม่ได้จริง: customProgramCacheKey
   * คืนค่าเท่ากันทุกวัสดุ three จึงคอมไพล์โปรแกรมครั้งเดียวแล้วใช้ซ้ำ วัสดุตัวที่สองเป็นต้นไป
   * ไม่ถูกเรียก onBeforeCompile เลย — ตัวอ้างอิงเลยว่าง ปรับค่าทีหลังไม่ขยับสักชิ้น
   * ทำแบบนี้ทุกวัสดุถือ uniform ชุดเดียวกัน เขียน .value ทีเดียวเปลี่ยนพร้อมกันหมด
   */
  const u = {
    rimColor: { value: new THREE.Color(color) },
    rimPower: { value: power },
    rimIntensity: { value: intensity },
    /** จำนวนชั้นของแสง — 0 หรือ 1 = ไล่เฉดต่อเนื่องตามปกติ, 2-4 = แบนแบบเวกเตอร์ */
    rimBands: { value: 0 },
    /**
     * ขอบเขตของขอบ — ตัด fresnel ด้วย smoothstep รอบ rimEdge กว้าง ±rimSoft
     * fresnel ดิบ ๆ ไล่จากศูนย์ถึงหนึ่งทั่วทั้งผิว ผิวที่เอียงนิดเดียวก็ได้แสงมาบ้าง
     * รวมกันแล้ว "ทั้งตัว" สว่างขึ้นแทนที่จะเป็นเส้นขอบ ตัดด้วยเกณฑ์แล้วเหลือแต่ผิวที่
     * เกือบขนานกับสายตาจริง ๆ (rimEdge 0 = ไม่ตัด)
     */
    rimEdge: { value: 0 },
    rimSoft: { value: 0.1 },
    /**
     * ทิศของไฟขอบใน view space (ชี้จากผิวไปหาไฟ) กับน้ำหนักของมัน
     * rim จริงมาจากไฟหลัง จึงควรขึ้นเฉพาะด้านที่หันไปหาไฟ ไม่ใช่รอบตัวเท่ากันหมด
     * rimDirMix 0 = ไม่สนทิศ (รอบตัว), 1 = ขึ้นเฉพาะฝั่งไฟ
     */
    rimDir: { value: new THREE.Vector3(0, 0, -1) },
    rimDirMix: { value: 0 },
  }
  material.userData.rimU = u
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.uniforms.rimColor = u.rimColor
    shader.uniforms.rimPower = u.rimPower
    shader.uniforms.rimIntensity = u.rimIntensity
    shader.uniforms.rimBands = u.rimBands
    shader.uniforms.rimEdge = u.rimEdge
    shader.uniforms.rimSoft = u.rimSoft
    shader.uniforms.rimDir = u.rimDir
    shader.uniforms.rimDirMix = u.rimDirMix
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimIntensity;\nuniform float rimBands;\nuniform float rimEdge;\nuniform float rimSoft;\nuniform vec3 rimDir;\nuniform float rimDirMix;',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          /**
           * ตัดแสงเป็นชั้น ๆ ก่อนใส่ rim — ได้หน้าตาแบบเวกเตอร์แบน
           *
           * ปัดเฉพาะ "ความสว่าง" แล้วคูณกลับเข้าสีเดิม ไม่ได้ปัดทีละช่องสี
           * ปัดทีละช่องสีแล้วเนื้อสีจะเพี้ยน (ส้มเลื่อนไปแดง เขียวเลื่อนไปเหลือง)
           * วิธีนี้เนื้อสีคงเดิม เปลี่ยนแค่จำนวนระดับความสว่าง
           */
          'if (rimBands > 1.5) {',
          '  float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));',
            '  float q = (floor(lum * rimBands) + 0.5) / rimBands;',
          '  outgoingLight *= lum > 1e-4 ? q / lum : 1.0;',
          '}',
          'vec3 rimN = normalize(normal);',
          'float rimF = pow(1.0 - saturate(dot(rimN, normalize(vViewPosition))), rimPower);',
          /**
           * ตัดให้เหลือแต่ขอบ: ต่ำกว่าเกณฑ์ = ศูนย์ สูงกว่า = เต็ม ไล่นุ่มตาม rimSoft
           * ขอบล่างของช่วงต้องไม่หลุดต่ำกว่าศูนย์ — ของเดิมใช้ rimEdge - rimSoft ตรง ๆ
           * พอ rimSoft > rimEdge ช่วงเริ่มที่ค่าลบ ผิวที่ fresnel เป็นศูนย์ (หันหากล้องตรง ๆ)
           * ก็ได้แสงติดมาด้วย ทั้งหัวเลยสว่างขึ้นเป็นเทา ๆ โดยเฉพาะผมสีดำ
           * ช่วงนี้ยึดกับเกณฑ์: ล่าง = เกณฑ์ × (1 - soft), บน = เกณฑ์ + soft × (1 - เกณฑ์)
           */
          /**
           * ขอบกว้างอย่างน้อยหนึ่งพิกเซลเสมอ — ขอบที่เกิดจาก "การแรเงา" ไม่มีอะไรมาลบรอยหยัก
           *
           * MSAA ของแคนวาสสุ่มตัวอย่างเฉพาะขอบเรขาคณิต ขอบที่เกิดกลางเนื้อสามเหลี่ยม (rim,
           * รอยต่อชั้นแสงของ cel) จึงเป็นขั้นบันไดเต็ม ๆ fwidth คือระยะที่ค่านั้นเปลี่ยนไปต่อ
           * หนึ่งพิกเซล เกลี่ยเท่านั้นพอดี = คมที่สุดเท่าที่จอทำได้โดยไม่หยัก และไม่เบลอเกิน
           * หนึ่งพิกเซลไม่ว่าจะซูมแค่ไหน (three 0.182 ใช้ WebGL2 อย่างเดียว fwidth จึงมีเสมอ
           * ไม่ต้องประกาศ extension แบบสมัย WebGL1)
           */
          'float rimAA = fwidth(rimF);',
          'rimF = rimEdge > 0.0 ? smoothstep(min(rimEdge * (1.0 - rimSoft), rimEdge - rimAA), max(rimEdge + rimSoft * (1.0 - rimEdge), rimEdge + rimAA), rimF) : rimF;',
          // ขึ้นเฉพาะฝั่งที่หันไปหาไฟขอบ (ถ่วงด้วย rimDirMix)
          'rimF *= mix(1.0, saturate(dot(rimN, normalize(rimDir))), rimDirMix);',
          'rimF = rimBands > 1.5 ? smoothstep(0.5 - rimAA, 0.5 + rimAA, rimF) : rimF;',
          'outgoingLight += rimColor * rimF * rimIntensity;',
          '#include <opaque_fragment>',
        ].join('\n'),
      )
  }
  /**
   * กุญแจต้องเปลี่ยนเมื่อซอร์สของ shader เปลี่ยน
   *
   * three แคชโปรแกรมตามกุญแจนี้ ค่าคงที่เดิมแปลว่าแก้ shader แล้วมันยังหยิบโปรแกรมเก่ามาใช้
   * (เห็นชัดตอน HMR: แก้ไฟล์นี้ทั้งฉากหายเพราะวัสดุใหม่ไปเจอโปรแกรมที่ไม่ตรงกัน)
   */
  material.customProgramCacheKey = () => 'rim-aa1'
  return material
}


/**
 * uniform ชุดกลางของ cel shading — ทุกวัสดุในฉากถือชุดเดียวกัน เขียน .value ทีเดียวเปลี่ยนหมด
 * (เหตุผลเดียวกับ addRim: โปรแกรมถูกแชร์ ตัวอ้างอิงจาก onBeforeCompile ใช้ไม่ได้)
 */
export function makeCelUniforms() {
  return {
    celOn: { value: 0 },
    /** เกณฑ์ (แสง/สีเนื้อ) ที่ผิวเปลี่ยนจากเงาเป็นสว่าง และจากสว่างเป็นไฮไลต์ */
    celEdge: { value: 0.5 },
    celHiEdge: { value: 1.15 },
    /** ความนุ่มของรอยต่อระหว่างชั้น (0 = คมแบบเวกเตอร์) */
    celSoft: { value: 0.05 },
    /** ความสว่างของชั้นเงา / ชั้นสว่าง (เทียบกับสีเนื้อ) และความขาวของไฮไลต์ */
    celShadow: { value: 0.62 },
    celLit: { value: 1 },
    celHi: { value: 0.22 },
    /** เงาเอียงไปทางม่วง/น้ำเงินแบบภาพเวกเตอร์ (0 = เงาเป็นสีเนื้อเข้มเฉย ๆ) */
    celTint: { value: 0.35 },
  }
}

/**
 * ฉีด cel shading (แบน 3 ชั้น) เข้า material — หน้าตาแบบภาพเวกเตอร์: สีเนื้อ / เงาเข้ม / ไฮไลต์
 *
 * ไม่ได้ปัดสีที่คำนวณแล้วทีละช่อง (เนื้อสีเพี้ยน) แต่วัด "อัตราส่วนแสงต่อสีเนื้อ" แล้วเลือกชั้น
 * ผลลัพธ์จึงเป็นสีเนื้อเดิมคูณค่าคงที่ต่อชั้น — ไม่มีไล่เฉด ไม่มี specular โผล่
 * ทำงานร่วมกับ addRim ได้ (rim ถูกบวกก่อน แล้วค่อยถูกตัดชั้น)
 * ปิดด้วย celOn = 0 โดยไม่ต้อง compile ใหม่
 */
export function addCel(material, u) {
  if (material.userData.celApplied) return material
  material.userData.celApplied = true
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    for (const k in u) shader.uniforms[k] = u[k]
    /**
     * ถ้ามี rim (addRim) อยู่แล้ว ให้ตัดชั้นก่อนบวก rim — rim จะได้ยังโผล่บนผิวที่แบนแล้ว
     * ไม่ใช่ถูกทิ้งไปตอนแทนค่า outgoingLight
     */
    const anchor = shader.fragmentShader.includes('vec3 rimN') ? 'vec3 rimN' : '#include <opaque_fragment>'
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float celOn;\nuniform float celEdge;\nuniform float celHiEdge;\nuniform float celSoft;\nuniform float celShadow;\nuniform float celLit;\nuniform float celHi;\nuniform float celTint;',
      )
      .replace(
        anchor,
        [
          'if (celOn > 0.5) {',
          '  const vec3 celW = vec3(0.2126, 0.7152, 0.0722);',
          '  float celBase = max(dot(diffuseColor.rgb, celW), 1e-4);',
          '  float celR = dot(outgoingLight, celW) / celBase;',
          /**
           * เกลี่ยอย่างน้อยหนึ่งพิกเซลเหมือน rim — celSoft = 0 คือขอบที่หยักที่สุด
           * ชื่อ celAA ไม่ใช่ celW: celW ถูกใช้ไปแล้วเป็นเวกเตอร์ถ่วงน้ำหนักความสว่างข้างบน
           */
          '  float celAA = max(celSoft, fwidth(celR));',
          '  float celK = smoothstep(celEdge - celAA, celEdge + celAA, celR);',
          '  float celH = smoothstep(celHiEdge - celAA, celHiEdge + celAA, celR);',
          '  vec3 celSh = diffuseColor.rgb * celShadow * mix(vec3(1.0), vec3(0.86, 0.80, 1.14), celTint);',
          '  vec3 celLt = diffuseColor.rgb * celLit;',
          /**
           * ไฮไลต์ = สีเนื้ออ่อนขึ้น ไม่ใช่ผสมไปหาขาว — ผสมหาขาวทำให้ของสีเข้ม (ผมดำ, บอร์ดเขียวเข้ม)
           * กลายเป็นเทา เพราะอัตราส่วนแสง/สีเนื้อของสีเข้มพุ่งสูงจาก specular กับ rim ที่ไม่ได้
           * คูณกับสีเนื้อ (ผมดำในภาพเวกเตอร์ก็ยังดำ แค่มีแถบอ่อนกว่านิดเดียว)
           */
          '  vec3 celHiC = celLt + celHi * (celLt * 0.8 + 0.06);',
          /**
           * บวก emissive กลับเข้าไป — ชั้นสีของ cel คิดจาก diffuseColor ล้วน ๆ ซึ่งทิ้งแสงที่
           * ผิวปล่อยเองไปทั้งหมด (three รวม totalEmissiveRadiance ไว้ใน outgoingLight
           * ก่อนหน้านี้แล้ว) ของที่ตั้งใจให้ "ติดไฟ" เช่นช่องคอมมิตบนถนน จึงดับสนิทเมื่อเปิด
           * โหมดแบน ทั้งที่ควรสว่างได้ไม่ว่าจะเฉดแบนหรือไม่
           */
          '  outgoingLight = mix(mix(celSh, celLt, celK), celHiC, celH) + totalEmissiveRadiance;',
          '}',
          anchor,
        ].join('\n'),
      )
  }
  const prevKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}|cel`
  return material
}


/**
 * ลายผ้าของเสื้อ — วาดเป็นภาพจริงด้วย canvas ไม่ใช่คำนวณจากคลื่น/นอยส์
 *
 * ลายในแบบเป็นริบบิ้นหนาที่ลากโค้งม้วนแบบวาดมือ ความหนาสม่ำเสมอตลอดเส้น ปลายมน — ของแบบนี้
 * เกิดจาก "เส้นที่วาด" ไม่ใช่เส้นระดับของฟังก์ชัน (นอยส์ให้ก้อนที่หนาบางไม่เท่ากันเสมอ)
 *
 * ภาพต่อกันได้ทั้งสองแกน: เส้นเป็นคลื่นที่ครบรอบพอดีในหนึ่งผืน (ขอบซ้าย=ขอบขวา) และวาดซ้ำ
 * เลื่อนขึ้น/ลงหนึ่งผืน เส้นที่ล้นขอบบน-ล่างจึงโผล่กลับมาอีกฝั่ง — ลายพันรอบตัวได้ไม่มีรอยต่อ
 */
export function shirtPrintTexture({
  size = 1024,
  cream = '#ede2cf',
  ink = '#211e1c',
  accent = '#c2703c',
  /** เมล็ดสุ่ม — เลขเดิมได้ลายเดิมเสมอ (ปุ่มสุ่มในแผงเปลี่ยนแค่เลขนี้) */
  seed = 7,
} = {}) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  g.fillStyle = cream
  g.fillRect(0, 0, size, size)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  /**
   * ริบบิ้นหนึ่งเส้น — คลื่นที่หนาบางไม่เท่ากันตลอดเส้น
   *
   * วาดเป็นรูปปิด ไม่ใช่เส้นตวัด: เดินไปตามแกนกลางแล้วถอยกลับตามอีกฝั่ง ระยะจากแกนกลาง
   * เปลี่ยนไปเรื่อย ๆ ตามทาง (ครบรอบพอดีในหนึ่งผืน) — เส้นจึงบวมตรงกลางท้องคลื่นและคอดตรง
   * คอ ได้ความรู้สึกแบบพู่กัน/แอ็บสแตรกต์ ซึ่ง lineWidth ของ canvas ทำไม่ได้ (มันคงที่ทั้งเส้น)
   *
   * ทุกพจน์เป็น "เดินตรงหนึ่งผืน + คลื่นครบรอบ" ปลายเส้นจึงบรรจบจุดเดิมของผืนถัดไป ลายต่อกัน
   * ได้ทุกทิศเมื่อภาพถูกปูซ้ำ และแอมพลิจูดแกน x ต่ำกว่า 1/2π เส้นจึงไม่ถอยกลับมาทับตัวเอง
   */
  const TAU = Math.PI * 2
  /** ผลรวมของฮาร์มอนิก [[แอมพลิจูด, จำนวนรอบ, เฟส], ...] และอนุพันธ์ของมัน */
  const wave = (hs, t) => hs.reduce((s, [a, k, p]) => s + a * Math.sin(TAU * k * t + p), 0)
  const dWave = (hs, t) => hs.reduce((s, [a, k, p]) => s + a * TAU * k * Math.cos(TAU * k * t + p), 0)
  const d2Wave = (hs, t) =>
    hs.reduce((s, [a, k, p]) => s - a * TAU * k * TAU * k * Math.sin(TAU * k * t + p), 0)

  const ribbon = (x0, y0, rise, hx, hy, color, width, taper, phW, lobes, off = 0) => {
    const N = 480
    const base = (t) => [x0 + t + wave(hx, t), y0 + rise * t + rise * wave(hy, t)]
    /**
     * เลื่อนแกนกลางออกด้านข้าง (off) — ใช้วางเส้นส้มให้วิ่งเลียบก้อนดำอย่างในแบบ
     * ไม่ใช่วางเป็นเลนของตัวเองซึ่งจะอ่านเป็นลายทางสองสี
     */
    const mid = (t) => {
      const [bx, by] = base(t)
      if (!off) return [bx, by]
      const dx = 1 + dWave(hx, t)
      const dy = rise * (1 + dWave(hy, t))
      const len = Math.hypot(dx, dy) || 1
      // ระยะเลื่อนก็ห้ามเกินรัศมีความโค้งเช่นกัน ตรงหัวโค้งจึงขยับเข้ามาชิดก้อนดำแทนที่จะพับ
      const o = Math.sign(off) * Math.min(Math.abs(off), radius(t) * 0.8)
      return [bx - (dy / len) * o, by + (dx / len) * o]
    }
    /** ความเร็วของแกนกลาง ณ จุดนั้น — ใช้ทั้งหาแนวตั้งฉากและคุมความหนาตรงหัวโค้ง */
    const vel = (t) => {
      const dx = 1 + dWave(hx, t)
      const dy = rise * (1 + dWave(hy, t))
      return [dx, dy, Math.hypot(dx, dy) || 1]
    }
    const vMax = (() => {
      let m = 0
      for (let i = 0; i <= 64; i++) m = Math.max(m, vel(i / 64)[2])
      return m
    })()
    /**
     * รัศมีความโค้ง ณ จุดนั้น — เพดานของทุกระยะที่วัดออกด้านข้างจากเส้นแกน
     *
     * ขอบของรูป (และแกนของเส้นที่เลื่อนออกไป) จะพับทับตัวเองทันทีที่ระยะออกด้านข้างเกินรัศมี
     * ความโค้ง นี่คือสาเหตุเดียวที่ลายเคยทับกัน — ไม่ใช่แค่ความหนามากไป จึงคุมเป็นราย
     * ตำแหน่ง ไม่ใช่หั่นความหนาทั้งเส้นให้บางตามจุดที่โค้งที่สุด (ซึ่งทำให้เส้นเหลือแต่เส้นผม)
     */
    const radius = (t) => {
      const [dx, dy, len] = vel(t)
      const ddx = d2Wave(hx, t)
      const ddy = rise * d2Wave(hy, t)
      const cross = Math.abs(dx * ddy - dy * ddx)
      return cross < 1e-6 ? Infinity : (len * len * len) / cross
    }
    /**
     * ครึ่งความหนาที่ตำแหน่ง t — หัวใจของหน้าตาแบบในแบบ
     *
     * โปรไฟล์ความหนาแกว่งจนถึงศูนย์ได้ (ตัดค่าลบทิ้ง) เส้นจึงไม่ใช่ริบบิ้นหนาเท่ากันทั้งเส้น แต่
     * เป็นก้อนที่บวมกลางแล้วเรียวจนแหลมเป็นปลาย คั่นด้วยช่องว่าง — ตรงกับลายในแบบที่เป็นก้อนโค้ง
     * ปลายแหลม ไม่ใช่เส้นพาด (lobes = จำนวนก้อนต่อหนึ่งผืน)
     *
     * คูณด้วยความเร็วที่ปรับให้เป็นสัดส่วนด้วย: ช่วงที่เส้นเลี้ยวหักที่สุดคือช่วงที่เดินช้าที่สุด
     * ถ้าหนาเท่ากันตรงนั้น ขอบสองฝั่งจะไขว้กันเองเป็นรอยหยิก (รัศมีความโค้งเล็กกว่าครึ่งความหนา)
     */
    const half = (t) => {
      const lobe = Math.cos(TAU * lobes * t + phW)
      // ยกฐานด้วย (1 - taper): taper สูง = ก้อนแยกขาดจากกัน, ต่ำ = เส้นต่อเนื่องที่หนาบางไม่เท่า
      const prof = Math.max(0, (1 - taper) + taper * lobe)
      const nominal = width * 0.5 * prof * Math.max(0.3, Math.min(1, vel(t)[2] / vMax))
      // เหลือระยะให้แกนที่ถูกเลื่อนออกไปแล้ว (off) ด้วย ไม่งั้นเส้นส้มจะพับตรงหัวโค้ง
      return Math.min(nominal, Math.max(0, radius(t) * 0.8 - Math.abs(off)))
    }
    /** แนวตั้งฉากของเส้น ณ จุดนั้น — ได้จากทิศการเดินของแกนกลาง */
    const side = (t, s) => {
      const [mx, my] = mid(t)
      const [dx, dy, len] = vel(t)
      const h = half(t) * s
      return [(mx - (dy / len) * h) * size, (my + (dx / len) * h) * size]
    }
    g.fillStyle = color
    // เส้นล้นออกนอกผืนได้ทุกด้าน จึงต้องวาดซ้ำรอบผืนทั้งเก้าช่อง ไม่ใช่แค่บน-ล่าง
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        g.beginPath()
        for (let i = 0; i <= N; i++) {
          const [px, py] = side(i / N, 1)
          if (i === 0) g.moveTo(px + dx, py + dy)
          else g.lineTo(px + dx, py + dy)
        }
        for (let i = N; i >= 0; i--) {
          const [px, py] = side(i / N, -1)
          g.lineTo(px + dx, py + dy)
        }
        g.closePath()
        g.fill()
      }
    }
  }

  /**
   * ตามแบบ: เส้นไม่กี่เส้น วางห่างกัน ไม่ทับกัน — ดำเป็นตัวหลัก ส้มบางกว่าราวสองเท่าครึ่ง
   *
   * วางทีละช่องเรียงลงมา (ช่องละ 1/4 ผืน) แล้วขยับได้ไม่เกินครึ่งของระยะที่เหลือหลังหักความ
   * หนาของเส้นเอง — เส้นจึงห่างกันเสมอทุกเมล็ด ไม่มีเมล็ดที่สองเส้นมาซ้อนกัน
   */
  const rnd = makeRandom(seed)
  // จำนวนเส้นก็สุ่มด้วย (3-5) — ลายห่างหรือแน่นต่างกันตามเมล็ด ไม่ใช่จังหวะเดิมทุกครั้ง
  const lanes = 4
  /**
   * ทุกเส้นใช้รูปคลื่นเดียวกัน ต่างกันแค่ "เลื่อนลงมา" — ระยะห่างแนวตั้งของสองเส้นจึงคงที่เท่า
   * ช่องเสมอ ไม่ว่าคลื่นจะบิดแรงแค่ไหน เส้นจึงไม่มีทางตัดกันเลย และตรงนี้เองที่ทำให้ใส่ความโค้ง
   * ได้เต็มที่ (ถ้าแต่ละเส้นมีคลื่นของตัวเอง สองเส้นจะไล่มาบรรจบกันได้เสมอ ต้องกดแอมพลิจูดลง)
   *
   * สามฮาร์มอนิกต่อแกน: ลูกใหญ่ให้ทรงรวม ลูกที่สอง/สามหักโค้งกลับระหว่างทาง เส้นเลยพลิ้วแบบ
   * แอ็บสแตรกต์ ไม่ใช่คลื่นไซน์ลูกเดียวซึ่งอ่านเป็นเส้นแข็ง ๆ ซ้ำ ๆ
   *
   * ผลรวมของ (แอมพลิจูด × จำนวนรอบ × 2π) ต้องน้อยกว่า 1 ทั้งสองแกน — ความเร็วตามแกนจึงไม่เคย
   * ติดลบ เส้นเดินหน้าตลอด ไม่ย้อนกลับมาทับตัวเอง
   */
  /**
   * โค้งให้สุดโดยไม่ทับตัวเอง: ปล่อยแกน x แกว่งแรงจนความเร็วติดลบได้ (เกิดหัวม้วน) แต่กด
   * แกน y ไว้ให้เดินหน้าตลอด — y เพิ่มขึ้นเสมอตลอดเส้น เส้นจึงไม่มีทางย้อนมาเจอตัวเองแม้ x
   * จะพาถอยไปมาแค่ไหน (เงื่อนไขของ y: ผลรวมของ แอมพลิจูด × จำนวนรอบ × 2π ต้องน้อยกว่า 1)
   */
  const hx = [
    [0.13 + rnd() * 0.04, 1, rnd() * TAU],
    [0.05 + rnd() * 0.02, 2, rnd() * TAU],
    [0.02 + rnd() * 0.01, 3, rnd() * TAU],
  ]
  const hy = [
    [0.055 + rnd() * 0.015, 1, rnd() * TAU],
    [0.018 + rnd() * 0.008, 2, rnd() * TAU],
    [0.006 + rnd() * 0.004, 3, rnd() * TAU],
  ]
  const x0 = rnd()
  // ทิศเฉียงของลายทั้งผืน: ลง (1) หรือขึ้น (-1) — ยังต่อขอบได้ทั้งคู่เพราะเลื่อนเต็มผืนเท่ากัน
  const rise = rnd() < 0.5 ? 1 : -1

  /**
   * แต่ละสีอยู่คนละเลน ไม่ใช่เส้นส้มเลื่อนออกข้างก้อนดำ
   *
   * เลนคือเส้นเดียวกันเลื่อนลงมา ระยะห่างแนวตั้งจึงคงที่เท่าช่องเสมอ และรูปที่วาดออกด้านข้าง
   * จากเส้นโค้งกินที่แนวตั้งไม่เกินความหนาจริงของมัน — ตราบใดที่ความหนา < ช่อง สองเลนไม่มีทาง
   * แตะกันเลย ไม่ว่าคลื่นจะบิดแรงแค่ไหน (การเลื่อนออกด้านข้างทำแบบนี้ไม่ได้ ตรงหัวโค้งแกนที่
   * เลื่อนไปจะพับเข้ามาทับก้อนข้าง ๆ)
   */
  const hInk = 0.085
  const hAcc = 0.034
  for (let i = 0; i < lanes; i++) {
    const dark = i % 2 === 0
    // ก้อนน้อย = ก้อนใหญ่และอ้วน อย่างในแบบ ไม่ใช่ใบไม้แหลม ๆ เรียงถี่
    const lobes = 1 + Math.floor(rnd() * 2)
    // taper ราวสี่ในสิบ = เรียวจนแหลมที่ปลายแต่ยังอ้วนตลอดช่วงกลาง
    ribbon(
      x0,
      (i + 0.5) / lanes,
      rise,
      hx,
      hy,
      dark ? ink : accent,
      (dark ? hInk : hAcc) * 2,
      0.4 + rnd() * 0.15,
      rnd() * TAU,
      lobes,
    )
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

/**
 * ยูนิฟอร์มของลายเสื้อ — ชุดเดียวใช้ร่วมทุกวัสดุที่ใส่ลาย (เหตุผลเดียวกับ addRim/addCel:
 * three แคชโปรแกรมตามกุญแจ วัสดุตัวที่สองจะไม่ถูกเรียก onBeforeCompile เลย)
 *
 * พิกัดของลายมาจากแอตทริบิวต์ aPrint ที่อบไว้กับ geometry (ดู bakePrintCoords) ไม่ใช่จาก
 * เมทริกซ์ตอนรัน — ลายจึงติดไปกับเนื้อผ้า ขยับแขนแล้วลายขยับตาม ไม่ไหลผ่านตัว
 */
export function makePrintUniforms(map) {
  return {
    uPrintMap: { value: map },
    uPrintOn: { value: 1 },
    /** ขนาดลาย — สูงขึ้น = ลายเล็กลง (หน่วยเดียวกันทุกแกน) */
    uPrintScale: { value: 0.7 },
  }
}

export function bakePrintCoords(mesh, rootInverse) {
  const geo = mesh.geometry
  if (!geo || geo.getAttribute('aPrint')) return
  const pos = geo.attributes.position
  const out = new Float32Array(pos.count * 3)
  mesh.updateWorldMatrix(true, false)
  const m = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m)
    out[i * 3] = v.x
    out[i * 3 + 1] = v.y
    out[i * 3 + 2] = v.z
  }
  geo.setAttribute('aPrint', new THREE.BufferAttribute(out, 3))
}

/**
 * ผ้าพลิ้ว — เสื้อของโมเดลเป็นกล่องล้วน (ตัวเสื้อ 60 vertex แขนข้างละ 84) จึงต้องซอยก่อน
 *
 * ซอยแบบกลางด้าน: สามเหลี่ยมหนึ่งใบกลายเป็นสี่ใบต่อรอบ ตำแหน่งยังอยู่บนหน้าเดิมทุกจุด
 * รูปทรงกล่องจึงไม่เปลี่ยนเลย ได้มาแค่จุดให้คลื่นเกาะ — ทำครั้งเดียวตอนประกอบฉาก
 *
 * ทำงานบน geometry แบบไม่มี index เพื่อไม่ต้องหาเพื่อนบ้าน/เชื่อมจุดซ้ำ ผิวเป็นกล่องอยู่แล้ว
 * normal ต่อหน้าจึงถูกต้องตามเดิม (คำนวณใหม่ตอนท้าย)
 */
export function subdivideCloth(geometry, levels = 3) {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry
  for (let n = 0; n < levels; n++) {
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    const tris = pos.count / 3
    const outP = new Float32Array(tris * 4 * 3 * 3)
    const outN = nor ? new Float32Array(tris * 4 * 3 * 3) : null
    const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const pm = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const q = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const qm = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    let k = 0
    let kn = 0
    const push = (v, w) => {
      outP[k++] = v.x
      outP[k++] = v.y
      outP[k++] = v.z
      if (!outN) return
      outN[kn++] = w.x
      outN[kn++] = w.y
      outN[kn++] = w.z
    }
    for (let t = 0; t < tris; t++) {
      for (let i = 0; i < 3; i++) {
        p[i].fromBufferAttribute(pos, t * 3 + i)
        if (nor) q[i].fromBufferAttribute(nor, t * 3 + i)
      }
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3
        pm[i].addVectors(p[i], p[j]).multiplyScalar(0.5)
        // normal ของจุดกลางคือค่าเฉลี่ยของสองปลาย ไม่ใช่ normal ที่คำนวณใหม่จากหน้า —
        // ผิวที่ไล่เงานุ่ม (ผม) จะกลายเป็นเหลี่ยมทันทีถ้าคำนวณใหม่ ทรงเดิมดูเปลี่ยนไปเลย
        if (nor) qm[i].addVectors(q[i], q[j]).multiplyScalar(0.5).normalize()
      }
      push(p[0], q[0]); push(pm[0], qm[0]); push(pm[2], qm[2])
      push(pm[0], qm[0]); push(p[1], q[1]); push(pm[1], qm[1])
      push(pm[2], qm[2]); push(pm[1], qm[1]); push(p[2], q[2])
      push(pm[0], qm[0]); push(pm[1], qm[1]); push(pm[2], qm[2])
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(outP, 3))
    if (outN) next.setAttribute('normal', new THREE.BufferAttribute(outN, 3))
    if (geo !== geometry) geo.dispose()
    geo = next
  }
  if (!geo.attributes.normal) geo.computeVertexNormals()
  return geo
}

export function makeWindUniforms() {
  return {
    /** นาฬิกาของลม เดินเองในหน่วยวินาที (เขียนครั้งเดียวต่อเฟรม ใช้ร่วมทุกวัสดุ) */
    uWindTime: { value: 0 },
    /** ทิศลม และแกนขึ้น — เวกเตอร์หนึ่งหน่วยใน "พิกัดรากของโมเดล" คิดจากฝั่ง CPU เฟรมละครั้ง */
    uWindDirL: { value: new THREE.Vector3(1, 0, 0) },
    uWindUpL: { value: new THREE.Vector3(0, 1, 0) },
    /** แรง (หน่วยพิกัดราก), ความถี่คลื่น, ความเร็วคลื่น */
    uWind: { value: new THREE.Vector3(0.2, 3.2, 2.6) },
    /**
     * ช่วงความสูงของผ้าในพิกัดราก (ชายเสื้อ, คอ) — วัดจาก aPrint ของจริงตอนประกอบ
     *
     * ต้องเรียงน้อยไปมาก: smoothstep ที่ edge0 > edge1 เป็นพฤติกรรมไม่นิยามใน GLSL
     * (ได้ 0 ตลอดบนไดรเวอร์ที่เจอ = ผ้าไม่ขยับเลย) น้ำหนักจึงกลับด้านเอาในสมการแทน
     */
    uWindSpan: { value: new THREE.Vector2(-1, 0) },
    /** แปลงออฟเซ็ตจากพิกัดรากเข้าสู่พิกัดกล้อง — viewMatrix × rootWorld เฟรมละครั้ง */
    uRootToView: { value: new THREE.Matrix3() },
    /**
     * โลก → รากของโมเดล — ใช้หา "ตำแหน่งจริงตอนนี้" ของ vertex ในพิกัดราก
     *
     * ใช้ aPrint แทนไม่ได้: มันคือค่าที่ bake ครั้งเดียวตอนประกอบ พอลำตัวบิด/เอียงตามท่า
     * ตำแหน่งจริงก็ไม่ตรงกับค่านั้นแล้ว การทดสอบชนจะไปเทียบกับจุดที่เสื้อไม่ได้อยู่
     */
    uWorldToRoot: { value: new THREE.Matrix4() },
    /**
     * ตัวกันทะลุ 3 ก้อน เป็นแคปซูล: A = ปลายหนึ่ง (w = รัศมี), B = อีกปลาย — พิกัดราก
     * 0,1 = ต้นขาซ้าย/ขวา (แกนตั้ง)  2 = สะโพก (แกนนอน) ซึ่งชายเสื้อพาดอยู่พอดี
     */
    uLegA: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uLegB: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    /**
     * ถ่วงน้ำหนักปลาย: ยิ่งสูงยิ่งกองไปที่ปลายอย่างเดียว โคนนิ่งสนิท
     * ผ้า ~1 (ไล่เรียบตลอดตัว) ผม >2 ไม่งั้นทั้งก้อนขยับ อ่านเป็นวิกหลุดจากหัว
     */
    uWindBias: { value: 1 },
    /** ความหนาของผ้า — ชายเสื้อลอยเหนือผิวขาเท่านี้ ไม่ใช่แนบสนิทจนดูเป็นสติกเกอร์ */
    uCloth: { value: 0.06 },
  }
}

/**
 * ผ้าพลิ้วตามลม แล้วถูกดันออกจากขา — ทั้งสองอย่างคิดใน "พิกัดรากของโมเดล"
 *
 * ทำไมไม่ขยับ transformed ในพิกัดของแต่ละชิ้น: ตัวเสื้อกับแขนเป็นคนละ mesh ที่หมุนคนละมุม
 * ลมจะพัดคนละทางกันทั้งที่เป็นเสื้อตัวเดียว และขาก็อยู่คนละพิกัดกับเสื้ออีก จะเทียบการชนไม่ได้
 *
 * ทำไมไม่ขยับในพิกัดกล้องล้วน ๆ: การชนต้องคิดในที่ที่ขากับเสื้ออยู่ร่วมกัน กล้องขยับเมื่อไร
 * ผ้าจะเลื่อนตามกล้อง จึงคิดทุกอย่างในพิกัดราก (เดียวกับ aPrint) แล้วแปลงออฟเซ็ตรวมเข้าสู่
 * พิกัดกล้องด้วย mat3 ตัวเดียวตอนท้าย — ไม่ต้องกลับเมทริกซ์ต่อ vertex
 *
 * คลื่นเป็นฟังก์ชันของ aPrint (พิกัด bake) ล้วน จุดที่ทับกันสนิทของสองหน้าจึงได้ค่าเท่ากัน
 * เสมอ กล่องไม่แตกตะเข็บ และเป็นพิกัดชุดเดียวกับที่ลายใช้ ลายจึงเคลื่อนไปกับผ้าเอง
 */
export function addWind(material, u) {
  if (material.userData.windApplied) return material
  material.userData.windApplied = true
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    for (const k in u) shader.uniforms[k] = u[k]
    const head = [
      shader.vertexShader.includes('attribute vec3 aPrint') ? '' : 'attribute vec3 aPrint;',
      'uniform float uWindTime;',
      'uniform vec3 uWindDirL;',
      'uniform vec3 uWindUpL;',
      'uniform vec3 uWind;',
      'uniform vec2 uWindSpan;',
      'uniform mat3 uRootToView;',
      'uniform mat4 uWorldToRoot;',
      'uniform vec4 uLegA[3];',
      'uniform vec4 uLegB[3];',
      'uniform float uCloth;',
      'uniform float uWindBias;',
    ]
      .filter(Boolean)
      .join('\n')
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${head}`)
      .replace(
        '#include <project_vertex>',
        [
          '#include <project_vertex>',
          '{',
          // ตรึงที่คอ/ไหล่ พลิ้วสุดที่ชายเสื้อ — ไล่ตามความสูงจริงของผ้า ไม่ใช่ตัวเลขเดา
          '  float hem = pow(1.0 - smoothstep(uWindSpan.x, uWindSpan.y, aPrint.y), uWindBias);',
          '  float ph = dot(aPrint, uWindDirL) * uWind.y - uWindTime * uWind.z;',
          // สองชั้น: ก้อนใหญ่ช้า (ผ้าพอง) + ริ้วเล็กเร็วที่ไล่ตามความสูง (ผ้าสะบัด)
          '  float wave = sin(ph) * 0.66 + sin(ph * 2.3 + aPrint.y * 5.0) * 0.34;',
          // ลมกระโชก: สองคลื่นความถี่ต่ำคูณกัน จังหวะจึงไม่ซ้ำรอบสั้น ๆ ให้ตาจับได้
          '  float gust = 0.62 + 0.38 * sin(uWindTime * 0.37) * sin(uWindTime * 0.23 + 1.7);',
          '  float amt = hem * uWind.x * gust;',
          // ยกขึ้นระหว่างสะบัด บวกแรงดันตามทิศลมที่ค้างไว้ = ผ้าถูกลมยก ไม่ใช่แค่สั่น
          // ตำแหน่งจริงของจุดนี้ ณ เฟรมนี้ ในพิกัดราก — ไม่ใช่ aPrint ที่ bake ค้างไว้
          '  vec3 p0 = (uWorldToRoot * modelMatrix * vec4(transformed, 1.0)).xyz;',
          '  vec3 p = p0 + (uWindDirL + uWindUpL * 0.32) * (wave * amt) + uWindDirL * (amt * 0.45);',
          /**
           * ดันจุดที่จมเข้าไปในต้นขาออกมาที่ผิว + ความหนาผ้า
           *
           * ดันตามแนวรัศมีของแคปซูล ผ้าจึงไถลไปตามผิวขา ไม่ใช่ถูกตัดตรงรอยสัมผัส —
           * ขายกขึ้นชายเสื้อก็ถูกยกตาม ขาลงก็ตกลง อ่านเป็นผ้าที่วางอยู่บนขาจริง ๆ
           *
           * step แทน if: การแตกสาขาบน GPU แพงกว่าการคำนวณทั้งสองทางแล้วเลือก
           */
          '  for (int i = 0; i < 3; i++) {',
          '    vec3 ab = uLegB[i].xyz - uLegA[i].xyz;',
          '    float denom = max(dot(ab, ab), 1e-6);',
          '    float t = clamp(dot(p - uLegA[i].xyz, ab) / denom, 0.0, 1.0);',
          '    vec3 c = uLegA[i].xyz + ab * t;',
          '    vec3 d = p - c;',
          '    float len = max(length(d), 1e-4);',
          '    float r = uLegA[i].w + uCloth;',
          '    p = mix(p, c + d * (r / len), step(len, r));',
          '  }',
          '  mvPosition.xyz += uRootToView * (p - p0);',
          '  gl_Position = projectionMatrix * mvPosition;',
          '}',
        ].join('\n'),
      )
  }
  const prevKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}|wind`
  return material
}

export function addPrint(material, u) {
  if (material.userData.printApplied) return material
  material.userData.printApplied = true
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    for (const k in u) shader.uniforms[k] = u[k]
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        // ลมประกาศแอตทริบิวต์ตัวเดียวกันไว้แล้วได้ (addWind) — ประกาศซ้ำคือ compile error
        shader.vertexShader.includes('attribute vec3 aPrint')
          ? '#include <common>\nvarying vec3 vPrintW;'
          : '#include <common>\nattribute vec3 aPrint;\nvarying vec3 vPrintW;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintW = aPrint;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        [
          '#include <common>',
          'varying vec3 vPrintW;',
          'uniform sampler2D uPrintMap;',
          'uniform float uPrintOn;',
          'uniform float uPrintScale;',
        ].join('\n'),
      )
      .replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>',
          '{',
          /**
           * ฉายลายจากระนาบเดียว (หน้าตรง XY) ทั้งเสื้อ — ไม่ใช่สามระนาบผสมตามทิศของผิว
           *
           * โมเดลไม่มี UV ที่วางลายได้ จึงต้องฉายเอา แบบสามระนาบให้ลายไม่ยืดก็จริง แต่แต่ละหน้า
           * ไปหยิบลายมาคนละระนาบ เส้นจึงเปลี่ยนทิศตรงสันกล่องและไม่ต่อกัน — เหมือนตัดผ้าคนละผืน
           * มาเย็บ ระนาบเดียวคือผ้าผืนเดียวคลุมทั้งตัว: ตัวเสื้อ แขนเสื้อ ทุกหน้าอ่านลายต่อกันหมด
           * (แลกกับหน้าที่เกือบขนานแนวฉาย ซึ่งลายจะถูกรีดยาว — บนตัวละครทรงกล่องหน้าพวกนั้นแคบ)
           */
          '  vec2 pp = vPrintW.xy * uPrintScale;',
          '  vec3 pcol = texture2D(uPrintMap, pp).rgb;',
          '  diffuseColor.rgb = mix(diffuseColor.rgb, pcol, uPrintOn);',
          '}',
        ].join('\n'),
      )
  }
  const prevKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}|print`
  return material
}
