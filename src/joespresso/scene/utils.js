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
          'rimF = rimEdge > 0.0 ? smoothstep(rimEdge * (1.0 - rimSoft), rimEdge + rimSoft * (1.0 - rimEdge), rimF) : rimF;',
          // ขึ้นเฉพาะฝั่งที่หันไปหาไฟขอบ (ถ่วงด้วย rimDirMix)
          'rimF *= mix(1.0, saturate(dot(rimN, normalize(rimDir))), rimDirMix);',
          'rimF = rimBands > 1.5 ? step(0.5, rimF) : rimF;',
          'outgoingLight += rimColor * rimF * rimIntensity;',
          '#include <opaque_fragment>',
        ].join('\n'),
      )
  }
  material.customProgramCacheKey = () => 'rim'
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
          '  float celK = smoothstep(celEdge - celSoft, celEdge + celSoft, celR);',
          '  float celH = smoothstep(celHiEdge - celSoft, celHiEdge + celSoft, celR);',
          '  vec3 celSh = diffuseColor.rgb * celShadow * mix(vec3(1.0), vec3(0.86, 0.80, 1.14), celTint);',
          '  vec3 celLt = diffuseColor.rgb * celLit;',
          /**
           * ไฮไลต์ = สีเนื้ออ่อนขึ้น ไม่ใช่ผสมไปหาขาว — ผสมหาขาวทำให้ของสีเข้ม (ผมดำ, บอร์ดเขียวเข้ม)
           * กลายเป็นเทา เพราะอัตราส่วนแสง/สีเนื้อของสีเข้มพุ่งสูงจาก specular กับ rim ที่ไม่ได้
           * คูณกับสีเนื้อ (ผมดำในภาพเวกเตอร์ก็ยังดำ แค่มีแถบอ่อนกว่านิดเดียว)
           */
          '  vec3 celHiC = celLt + celHi * (celLt * 0.8 + 0.06);',
          '  outgoingLight = mix(mix(celSh, celLt, celK), celHiC, celH);',
          '}',
          anchor,
        ].join('\n'),
      )
  }
  const prevKey = material.customProgramCacheKey
  material.customProgramCacheKey = () => `${prevKey ? prevKey.call(material) : ''}|cel`
  return material
}
