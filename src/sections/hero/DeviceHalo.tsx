import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { deviceSpot, smooth } from './workMotion'

/**
 * แสงรอบร่างเครื่อง (ฟองหัวเรื่องที่คลี่เป็นจอมือถือแก้ว — ./BubbleTraveler) แบบภาพอ้างอิง: ขอบมนซ้อนสองชั้นค่อย ๆ ขยาย
 * ออกเป็นระลอก บวกเรืองนุ่มชิดขอบ — ระยะเป็น px ที่ z 0 (= หน่วยโลกของฉาก ./WorkStory) ตามขนาด/การยุบ/การหมุนของเครื่อง
 *
 * วาดด้วยสนามระยะบนแผ่นเดียว ขนาดเครื่องเปลี่ยนไม่ต้องปั้นเรขาคณิตใหม่ · ตัวเครื่องอยู่อีกแคนวาสซ้อนข้างบน
 */
function haloMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uHalf: { value: new THREE.Vector2(1, 1) }, uR: { value: 0 }, uK: { value: 0 }, uT: { value: 0 }, uS: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform vec2 uHalf;
      varying vec2 vP;
      void main() {
        /* แผ่นหน่วยเดียว → ขนาดเครื่อง + ขอบ 120 px */
        vP = position.xy * (uHalf + 120.0) * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uHalf;
      uniform float uR;
      uniform float uK;
      uniform float uT;
      uniform float uS;
      varying vec2 vP;
      float box(vec2 p, vec2 h, float r) {
        vec2 q = abs(p) - (h - r);
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        float d = box(vP, uHalf, uR);
        if (d < 0.0) discard;
        float a = 0.0;
        /* ระลอกสองชั้นวิ่งออกจากขอบ จางตามระยะ · ระยะทั้งหมดตามขนาดเครื่อง (uS = 1 ที่จอนอนทั่วไป) */
        for (int i = 0; i < 2; i++) {
          float off = (10.0 + fract(uT * 0.18 + float(i) * 0.5) * 70.0) * uS;
          float fade = 1.0 - smoothstep(10.0 * uS, 80.0 * uS, off);
          a += (1.0 - smoothstep(0.0, 1.6, abs(d - off))) * 0.28 * fade;
        }
        /* เรืองนุ่มชิดขอบ */
        a += exp(-d / (26.0 * uS)) * 0.12;
        gl_FragColor = vec4(vec3(1.0), a * uK);
        #include <colorspace_fragment>
      }`,
  })
}

export function DeviceHalo() {
  const mat = useMemo(haloMat, [])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    /* โผล่ตอนเครื่องคลี่เกือบเสร็จ · ยุบพร้อมเครื่อง (ย่อทั้งแผ่น — สนามระยะคิดในขนาดเต็ม) */
    /* เครื่องหงายลง (อีกแคนวาส ออร์โธ) แสงแบนนี้ตามมุมไม่ได้ — จางออกระหว่างหงาย */
    const k = smooth((deviceSpot.k - 0.55) / 0.45) * (1 - smooth(deviceSpot.tilt / 0.5))
    m.visible = k > 0.002
    if (!m.visible) return
    mat.uniforms.uHalf.value.set(deviceSpot.hw, deviceSpot.hh)
    mat.uniforms.uR.value = deviceSpot.r
    mat.uniforms.uK.value = k
    mat.uniforms.uT.value = clock.elapsedTime
    mat.uniforms.uS.value = Math.min(1, deviceSpot.hh / 260)
  })
  return <mesh ref={ref} geometry={geo} material={mat} position={[0, 0, -4]} visible={false} />
}
