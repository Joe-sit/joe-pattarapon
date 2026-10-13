import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * คอมไพล์ shader + อัปโหลดเท็กซ์เจอร์ของทั้งฉากล่วงหน้า ใต้ผ้าคลุมของด่านโหลด — ไม่ใช่ตอนของโผล่กลางอินโทร
 *
 * three คอมไพล์โปรแกรมของวัสดุครั้งแรกที่วัตถุถูกวาด ของหลายชิ้นซ่อนไว้จนถึงจังหวะของมัน (ริบบิ้น แก้ว พอร์ทัล
 * ตัวอักษร) คอมไพล์จึงไปตกในเฟรมที่อินโทรกำลังเล่น — วัดได้ onFirstUse รวม 280ms กระจุกตอนด่านเปิด
 *
 * ทำเป็นรอบ ๆ จนนิ่ง ไม่ใช่ยิงตามเวลาตายตัว: ของในฉากมาไม่พร้อมกัน (GLB ใน Suspense, env map ของ Environment
 * อบในเฟรมแรกที่วาด — วัสดุที่คอมไพล์ก่อนมี env map ต้องคอมไพล์ใหม่ทั้งชุด) ทุกรอบ:
 *   1. สั่งวาดหนึ่งเฟรม (แคนวาสแบบวาดตามสั่งจะได้อบ env map / รันท่าในเฟรมแรก)
 *   2. เปิดของที่ซ่อนอยู่ชั่วคราว → คอมไพล์สองแบบ: วาดลงจอ และวาดลง render target
 *      (แก้ว transmission วาดฉากลงบัฟเฟอร์ทุกเฟรม — ทุกวัสดุมีโปรแกรมชุดที่สองที่ไม่มี tone mapping)
 *   3. อัปโหลดเท็กซ์เจอร์ทุกช่องของทุกวัสดุขึ้น GPU · อ่าน uniform ของทุกโปรแกรมไว้ก่อน (onFirstUse)
 * จำนวนโปรแกรมไม่เพิ่มติดกันพักหนึ่ง = ฉากนี้อุ่นครบ — ด่านโหลดรอทุกแคนวาสที่ลงทะเบียนไว้ (warmSettled)
 *
 * ใช้ compileAsync: รอโปรแกรมคอมไพล์เสร็จแบบไม่บล็อกเธรดหลัก (KHR_parallel_shader_compile) จุดโหลดยังเต้นลื่น
 * ปิด checkShaderErrors นอก dev — ค่าเริ่มต้นของ three เรียก getProgramInfoLog ทุกโปรแกรมใหม่ บังคับคอมไพล์จบเดี๋ยวนั้น
 */
const pending = new Set<object>()

/** ทุกแคนวาสที่มี WarmShaders อุ่นครบแล้ว (ไม่มีใครลงทะเบียน = ครบ) */
export function warmSettled() {
  return pending.size === 0
}

/** จังหวะระหว่างรอบ · ต้องนิ่งนานเท่านี้ · อย่างน้อยกี่รอบ · เพดานรอ (กันค้างถ้ามีอะไรพัง) */
const STEP = 160
const QUIET = 700
const MIN_PASSES = 3
const GIVE_UP = 9000

export function WarmShaders() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    gl.debug.checkShaderErrors = import.meta.env.DEV
    const token = {}
    pending.add(token)
    const done = () => {
      pending.delete(token)
    }
    const target = new THREE.WebGLRenderTarget(1, 1)
    const uploaded = new WeakSet<THREE.Texture>()
    let alive = true
    let timer = 0
    let passes = 0
    let count = -1
    let quietSince = performance.now()
    const t0 = performance.now()

    const warm = async () => {
      const hidden: THREE.Object3D[] = []
      const mats = new Set<THREE.Material>()
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o)
          o.visible = true
        }
        const m = (o as THREE.Mesh).material
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x))
      })
      let jobs: Promise<unknown>[] = []
      try {
        jobs = [gl.compileAsync(scene, camera)]
        const prev = gl.getRenderTarget()
        gl.setRenderTarget(target)
        jobs.push(gl.compileAsync(scene, camera))
        gl.setRenderTarget(prev)
      } finally {
        for (const o of hidden) o.visible = false
      }
      /* เท็กซ์เจอร์ทุกช่องของวัสดุ (map, normalMap, envMap, uniform ของ ShaderMaterial …) */
      mats.forEach((m) => {
        const slots = Object.values(m as unknown as Record<string, unknown>)
        const u = (m as THREE.ShaderMaterial).uniforms
        if (u) Object.values(u).forEach((x) => slots.push(x?.value))
        slots.forEach((v) => {
          if (v instanceof THREE.Texture && !uploaded.has(v) && v.image) {
            uploaded.add(v)
            gl.initTexture(v)
          }
        })
      })
      await Promise.all(jobs)
      /*
       * ใช้ครั้งแรกของแต่ละโปรแกรม three ยังต้องอ่านรายชื่อ uniform จาก GPU (onFirstUse — dev ตรวจ log ด้วย)
       * ซึ่งเกิดในเฟรมแรกที่วาดจริง ไม่ใช่ตอนคอมไพล์ — เรียก getUniforms ให้มันเกิดตอนนี้ (ทั้งชุดจอและชุด render target)
       */
      mats.forEach((m) => {
        const progs = (gl.properties.get(m) as { programs?: Map<string, { getUniforms?: () => unknown }> }).programs
        progs?.forEach((pr) => pr.getUniforms?.())
      })
    }

    /* Safari ไม่มี requestIdleCallback — ตกไปที่ setTimeout */
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const idle = (fn: () => void) => (ric ? ric(fn, { timeout: 400 }) : window.setTimeout(fn, 0))
    const round = () => {
      if (!alive) return
      invalidate()
      idle(async () => {
        if (!alive) return
        await warm().catch(() => {})
        if (!alive) return
        passes += 1
        const now = performance.now()
        const n = gl.info.programs?.length ?? 0
        if (n !== count) {
          count = n
          quietSince = now
        }
        if ((passes >= MIN_PASSES && now - quietSince >= QUIET) || now - t0 > GIVE_UP) {
          done()
          return
        }
        timer = window.setTimeout(round, STEP)
      })
    }
    timer = window.setTimeout(round, STEP)
    return () => {
      alive = false
      window.clearTimeout(timer)
      target.dispose()
      done()
    }
  }, [gl, scene, camera, invalidate])

  return null
}
