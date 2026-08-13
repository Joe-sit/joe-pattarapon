import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { LOW_END } from './utils'

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

export function Curvilinear({ strength = 0.15 }) {
  const { gl, scene, camera, size } = useThree()

  // debugger: จูนความโค้งเลนส์สด ๆ (ค่าเริ่มตาม prop)
  const { lensK } = useControls('Curve Perspective', {
    lensK: { value: strength, min: -0.4, max: 0.5, step: 0.005, label: 'lens barrel k' },
  })

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

  useEffect(() => {
    composer.userData.distort.uniforms.k.value = lensK
  }, [composer, lensK])

  useEffect(() => () => composer.dispose(), [composer])

  // priority 1 = ยึด render loop แทนตัว default ของ R3F
  useFrame(() => composer.render(), 1)

  return null
}
