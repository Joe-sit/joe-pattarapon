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
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.uniforms.rimColor = { value: new THREE.Color(color) }
    shader.uniforms.rimPower = { value: power }
    shader.uniforms.rimIntensity = { value: intensity }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimIntensity;',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          'float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), rimPower);',
          'outgoingLight += rimColor * rimF * rimIntensity;',
          '#include <opaque_fragment>',
        ].join('\n'),
      )
  }
  material.customProgramCacheKey = () => 'rim'
  return material
}

