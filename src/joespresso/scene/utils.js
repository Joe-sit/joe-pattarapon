import * as THREE from 'three'

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

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * ฉีด rim light (fresnel) เข้า material — ขอบวัตถุติดแสงขาวนวลแบบภาพ ref
 * ทำที่ shader เพราะแสงจริงให้ขอบคมแบบนี้กับผิวด้านไม่ได้
 */
export function addRim(material, { color = '#FFF3DC', power = 2.4, intensity = 0.6 } = {}) {
  if (material.userData.rimApplied) return material
  material.userData.rimApplied = true
  material.onBeforeCompile = (shader) => {
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
