import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { damp, LOW_END } from './utils'
import { scrollState } from '../scroll'

/**
 * Curvilinear perspective — บิดภาพแบบเลนส์ fisheye อ่อน ๆ
 * กลางภาพขยาย ขอบบีบ → เส้นตรง (ขอบฟ้า, panel) โค้งรอบจุดกลางเหมือนภาพ ref
 *
 * ทำท้ายสุดหลัง render ปกติ:  RenderPass → distort → OutputPass (tone map + sRGB)
 */
const DistortShader = {
  uniforms: {
    tDiffuse: { value: null },
    k: { value: 0.15 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float k;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      p.x *= aspect;
      // normalize ให้มุมภาพ r2 = 1 พอดี -> หาร (1+k) แล้วมุมยังอยู่ในเฟรม ไม่มีขอบดำ
      float r2 = dot(p, p) / (1.0 + aspect * aspect);
      vec2 q = p * (1.0 + k * r2) / (1.0 + k);
      q.x /= aspect;
      gl_FragColor = texture2D(tDiffuse, q * 0.5 + 0.5);
    }`,
}

export function Curvilinear({ strength = 0.15, lensPunch = 0.16 }) {
  const { gl, scene, camera, size } = useThree()

  // debugger: จูนความโค้งเลนส์สด ๆ (ค่าเริ่มตาม prop)
  const { lensK, lensPunch: punch } = useControls('Curve Perspective', {
    lensK: { value: strength, min: -0.4, max: 0.5, step: 0.005, label: 'lens barrel k' },
    lensPunch: { value: lensPunch, min: 0, max: 0.5, step: 0.005, label: 'บวกตอน zoom' },
  }, { collapsed: true })

  const composer = useMemo(() => {
    const dpr = gl.getPixelRatio()
    const rt = new THREE.WebGLRenderTarget(size.width * dpr, size.height * dpr, {
      // MSAA 4x เต็มจอบนมือถือกิน bandwidth หนัก — เครื่องเบาใช้ 2x
      samples: LOW_END ? 2 : 4,
      type: THREE.HalfFloatType,
    })
    const c = new EffectComposer(gl, rt)
    c.addPass(new RenderPass(scene, camera))
    const distort = new ShaderPass(DistortShader)
    c.addPass(distort)
    c.addPass(new OutputPass())
    c.userData = { distort }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
    composer.userData.distort.uniforms.aspect.value = size.width / size.height
  }, [composer, gl, size])

  // ความโค้งเลนส์เป็นปุ่ม "ความอึดอัด" ของบีต zoom ด้วย — ยิ่ง scroll เข้าไปใกล้
  // ขอบภาพยิ่งบีบ เหมือนเลนส์ไวด์จ่อหน้า ไม่ต้องเพิ่ม effect ตัวใหม่ให้จ่าย pass เพิ่ม
  const distortion = useRef(lensK)
  useFrame((_, delta) => {
    const d = composer.userData.distort
    const want = lensK + scrollState.b.zoom * punch
    distortion.current = damp(distortion.current, want, 0.12, Math.min(delta, 0.05))
    d.uniforms.k.value = distortion.current
    // k = 0 ทำให้สูตรกลายเป็น q = p (ภาพเท่าเดิมเป๊ะ) แต่ยังจ่าย fullscreen pass เต็มจอ
    // โหมดปั้นส่ง strength = 0 มาตลอดและไม่มีบีต — ข้าม pass ไปเลย
    d.enabled = Math.abs(distortion.current) > 0.0005
  }, 0)

  useEffect(() => () => composer.dispose(), [composer])

  // priority 1 = ยึด render loop แทนตัว default ของ R3F
  useFrame(() => composer.render(), 1)

  return null
}
