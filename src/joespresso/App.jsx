import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from './scene/Sky'
import { Terrain } from './scene/Terrain'
import { Foliage } from './scene/Foliage'
import { Panels } from './scene/Panels'
import { Mascot } from './scene/Mascot'
import { Curvilinear } from './scene/Curvilinear'
import { OrbitControls } from '@react-three/drei'
import { button, levaStore, useControls } from 'leva'
import { addRim, clamp, damp, lerp, LOW_END } from './scene/utils'
import { BEATS, scrollState } from './scroll'
import { setSceneReady } from '@/stores/ready'

/** ใส่ rim light ให้วัตถุทึบทั้งฉาก — ขอบติดแสงขาวนวล (layer 09) */
function RimLight({ color = '#FFF3DC', intensity = 0.5, power = 4.2 }) {
  const { scene } = useThree()
  useEffect(() => {
    const apply = () => {
      scene.traverse((o) => {
        if (!o.isMesh) return
        const m = o.material
        // เว้นของโปร่งแสง (panel แก้ว) กับของที่ไม่ใช่ standard (ฟ้า/ดวงอาทิตย์)
        if (!m || !m.isMeshStandardMaterial || m.transparent) return
        addRim(m, { color, intensity, power })
        m.needsUpdate = true
      })
    }
    apply()
    // ของที่โหลด/ mount ทีหลัง (GLB, Suspense) — วนเก็บซ้ำ (addRim กันฉีดซ้ำให้แล้ว)
    const t1 = setTimeout(apply, 1500)
    const t2 = setTimeout(apply, 4000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [scene, color, intensity, power])
  return null
}

/**
 * โหมดปั้นโมเดล — ทั้งฉากกลายเป็นดินเหนียวสีเทา แสงเป็นสตูดิโอกลาง ๆ
 *
 * ฉากจริงมีสีอุ่น + rim light + fog + จอโค้ง ซึ่งกลบรูปทรงจนดูไม่ออกว่าชิ้นไหนเบี้ยว
 * โหมดนี้ตัดทุกอย่างที่ไม่ใช่ "รูปทรงกับเงา" ออก
 *
 * ทาสีทับด้วยการสลับ material (เก็บของเดิมไว้ที่ userData) ไม่ใช่แก้ของเดิม —
 * material ถูกใช้ร่วมกันหลาย mesh แก้ทีเดียวโดนหมด และย้อนกลับไม่ได้
 * วนซ้ำเป็นระยะเพราะ Mascot ปั้น mesh ใหม่หลังโหลด GLB เสร็จ (บ่า/ท่อนแขน/นิ้ว/แก้ว)
 */
function ClayMode({ enabled }) {
  const { scene } = useThree()
  const next = useRef(0)
  const clay = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b9b6b1', roughness: 0.9, metalness: 0 }),
    [],
  )
  // ผมเทาโทนเข้มกว่าหน่อย — ทาโทนเดียวกับหัวแล้วแผ่นผมท้ายทอยกลืนหายไปกับกล่องหัว
  const clayHair = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8e8b86', roughness: 0.9, metalness: 0 }),
    [],
  )

  // ตาปล่อยสีเดิมอย่างเดียว — เป็นตัวบอกว่าหัวหันไปทางไหน
  // (ผมเคยเว้นไว้ด้วย แต่ก้อนดำทับหน้าจนอ่านทรงหัวไม่ออก)
  // ใช้ธง keepColor จาก Mascot ไม่ใช่การเดาจากสี — ผมกับตาสีใกล้กันมาก แยกด้วยสีไม่ได้
  // เช็คทุกรอบที่กวาด เพราะ Mascot ติดธงหลัง GLB โหลดเสร็จ (ทาไปแล้วก็ย้อนคืนให้)
  const paintOne = (o) => {
    if (!o.isMesh || !o.material) return
    if (o.userData.keepColor) {
      // คืนของเดิมเฉพาะกรณีที่เราทาเทาไปก่อนหน้าแล้ว — ถ้ามันถือสีอื่นอยู่ (เช่นสี debug แยกชิ้นแขน)
      // ห้ามแตะ แค่เลิกจำของเดิมไว้ ปล่อยให้เจ้าของสีจัดการเอง
      if (o.userData.clayFrom) {
        if (o.material === clay || o.material === clayHair) o.material = o.userData.clayFrom
        delete o.userData.clayFrom
      }
      return
    }
    if (o.material === clay || o.material === clayHair) return
    if (!o.userData.clayFrom) o.userData.clayFrom = o.material
    o.material = o.userData.clayFrom.color?.getHexString?.() === '232224' ? clayHair : clay
  }

  useEffect(() => {
    const paint = () => scene.traverse(paintOne)
    const restore = () => {
      scene.traverse((o) => {
        if (o.userData?.clayFrom) {
          o.material = o.userData.clayFrom
          delete o.userData.clayFrom
        }
      })
    }
    if (enabled) paint()
    else restore()
  }, [scene, clay, clayHair, enabled])

  useFrame((_, dt) => {
    if (!enabled) return
    next.current -= dt
    if (next.current > 0) return
    next.current = 0.5
    // Mascot ปั้น mesh เพิ่มหลัง GLB โหลดเสร็จ (บ่า/ท่อนแขน/นิ้ว/แก้ว) — กวาดซ้ำเป็นระยะ
    scene.traverse(paintOne)
  })

  useEffect(
    () => () => {
      clay.dispose()
      clayHair.dispose()
    },
    [clay, clayHair],
  )
  return null
}

/** วางกล้องตั้งต้นให้เห็น "ด้านหน้า" ตอนเข้าโหมดปั้น — ของหน้าเว็บเล็งมาจากด้านหลัง (mascot หันหลังให้) */
function ClayCam() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(4.2, 3.6, -7.6)
    camera.fov = 32
    camera.updateProjectionMatrix()
    camera.lookAt(0, 2.3, 0.9)
  }, [camera])
  return null
}

/** แสงสตูดิโอสำหรับโหมดปั้น — key หนึ่งดวงให้เงาอ่านทรงได้ + fill กันด้านมืดตัน */
function ClayLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#8f8f8f', 0.5]} />
      <directionalLight
        castShadow
        position={[6, 11, 7]}
        intensity={1.9}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={40}
      />
      <directionalLight position={[-8, 4, -6]} intensity={0.55} />
    </>
  )
}

/** กล้องเอียงตามเมาส์เล็กน้อย — ให้ฉากมีมิติโดยไม่ต้องหมุนวัตถุ */
function CameraRig({ strength = 1 }) {
  const { camera } = useThree()
  const target = useRef({ x: 0, y: 0 })
  const cur = useRef({ x: 0, y: 0 })
  const look = useRef(new THREE.Vector3(0, 1.9, 0))

  const sp = useRef(0) // scroll progress แบบหน่วง ให้กล้อง glide

  // debugger: จูนมุมกล้อง/perspective สด ๆ
  const cam = useControls('Camera', {
    camY: { value: 4.1, min: 1, max: 10, step: 0.1 },
    camZ: { value: 14.5, min: 8, max: 30, step: 0.25 },
    fov: { value: 24, min: 12, max: 60, step: 1 },
    lookY: { value: 1.9, min: -2, max: 5, step: 0.1 },
    // พับเก็บไว้ — แผง debug ยาวจนต้อง scroll หา folder ล่าง ๆ กลุ่มที่ปรับบ่อยควรอยู่บนสุดและกางไว้
  }, { collapsed: true })

  // ปลายทางตอน scroll สุด — วนมาหน้า mascot มุมเฉียง, mascot ชิดซ้าย เหลือที่ว่างขวา
  // หน้าของ mascot ชี้ไปทาง -Z (วัดจากตำแหน่ง mesh ตา) กล้องเลยต้องวนไปฝั่ง -Z
  // แล้วเยื้อง ~30° ให้ได้มุม 3/4; เป้ามองเยื้องขวา+ต่ำกว่าหัว เพื่อดันตัวไปซ้ายและหัวขึ้นบน
  const fc = useControls('Focus Cam', {
    focusX: { value: 2.48, min: -8, max: 8, step: 0.1 },
    focusY: { value: 2.87, min: 0, max: 8, step: 0.1 },
    focusZ: { value: -4.12, min: -12, max: 12, step: 0.1 },
    focusLookX: { value: -0.85, min: -5, max: 5, step: 0.05 },
    focusLookY: { value: 2.25, min: 0, max: 6, step: 0.05 },
    focusLookZ: { value: 0.48, min: -6, max: 6, step: 0.05 },
    focusFov: { value: 24, min: 12, max: 60, step: 1 },
  }, { collapsed: true })

  // debugger: จูนการขยับตามเมาส์ — ส่วนของกล้อง (ของหัว mascot อยู่ในกลุ่มเดียวกัน ที่ Mascot.jsx)
  const fol = useControls('Follow Cursor', {
    camSwayX: { value: 1.5, min: 0, max: 6, step: 0.05, label: 'กล้อง ซ้ายขวา' },
    camSwayY: { value: 0.7, min: 0, max: 6, step: 0.05, label: 'กล้อง บนล่าง' },
    camEase: { value: 0.045, min: 0.005, max: 0.3, step: 0.005, label: 'กล้อง หน่วง' },
    focusSway: { value: 0.25, min: 0, max: 1, step: 0.01, label: 'ตอน focus' },
  })

  // บีต zoom — กล้องดันเข้าไปอีกหลังจาก focus เข้าที่แล้ว ภาพอึดอัดขึ้นเรื่อย ๆ
  // ดันตามแนวสายตา (ตำแหน่ง -> เป้ามอง) ไม่ใช่ตามแกน z ของโลก มุมภาพจะได้ไม่เพี้ยน
  const zm = useControls('Zoom (ฉาก 2)', {
    zoomIn: { value: 0.1, min: 0, max: 0.9, step: 0.01, label: 'ดันเข้า (สัดส่วนระยะ)' },
    zoomFov: { value: 5, min: 0, max: 18, step: 0.5, label: 'บีบ fov (องศา)' },
    // ดันเข้าแล้วเฟรมแคบลง เป้ามองเดิม (ต่ำกว่าหัว) จะพาหน้าหลุดขอบบน — ยกเป้าตามไปด้วย
    zoomRise: { value: 0.45, min: -1, max: 1, step: 0.01, label: 'เป้ามอง เลื่อนขึ้น' },
    zoomEase: { value: 0.1, min: 0.02, max: 0.5, step: 0.01, label: 'หน่วง' },
    zoomPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'พรีวิว (ไม่ต้อง scroll)' },
  }, { collapsed: true })
  const zoom = useRef(0)

  useFrame(({ pointer }, delta) => {
    // dt ตัดเพดานไว้ — สลับแท็บกลับมาแล้ว delta ก้อนใหญ่จะทำให้กล้องกระโดด
    const dt = Math.min(delta, 0.05)
    target.current.x = clamp(pointer.x, -1, 1)
    target.current.y = clamp(pointer.y, -1, 1)
    cur.current.x = damp(cur.current.x, target.current.x, fol.camEase, dt)
    cur.current.y = damp(cur.current.y, target.current.y, fol.camEase, dt)

    // scroll blend: smoothstep + หน่วงเล็กน้อย
    sp.current = damp(sp.current, scrollState.b.focus, 0.12, dt)
    const t = sp.current
    const k = t * t * (3 - 2 * t)
    zoom.current = damp(
      zoom.current,
      Math.max(scrollState.b.zoom, zm.zoomPreview),
      zm.zoomEase,
      dt,
    )
    const z = zoom.current * zoom.current * (3 - 2 * zoom.current)
    // ตอน focus ลด parallax ลงเหลือตาม focusSway (ระยะใกล้ ขยับนิดเดียวก็เหวี่ยงแรง)
    const sway = strength * (1 - k * (1 - fol.focusSway))

    const bx = cur.current.x * fol.camSwayX * sway
    const by = cam.camY + cur.current.y * fol.camSwayY * sway
    const bz = cam.camZ

    camera.position.x = lerp(bx, fc.focusX + cur.current.x * fol.camSwayX * 0.23 * sway, k)
    camera.position.y = lerp(by, fc.focusY + cur.current.y * fol.camSwayY * 0.29 * sway, k)
    camera.position.z = lerp(bz, fc.focusZ, k)

    look.current.set(lerp(0, fc.focusLookX, k), lerp(cam.lookY, fc.focusLookY, k), lerp(0, fc.focusLookZ, k))
    look.current.y += z * zm.zoomRise

    // ดันกล้องเข้าหาเป้ามองตามสัดส่วนของระยะที่เหลือ — ใกล้แค่ไหนก็ไม่ทะลุ
    if (z > 0.0001) {
      camera.position.lerp(look.current, z * zm.zoomIn)
    }

    const fov = lerp(cam.fov, fc.focusFov, k) - z * zm.zoomFov
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(look.current)
  })
  return null
}

/**
 * ฉากกลืนเป็นสีเดียว — บีต fill
 *
 * ทำด้วยหมอกกับสีพื้นหลังของ three ไม่ใช่แผ่นสีทับใน DOM แบบเดิม
 * แผ่น DOM ทับ mascot เป็นภาพแบน ๆ เหมือนแปะสติกเกอร์ ส่วนหมอกหุบเข้าหากล้อง
 * จะกลืนของไกลก่อนแล้วค่อยถึงตัว mascot — ยังเหลือแสงกับความลึกจนวินาทีสุดท้าย
 * และไม่ต้องแตะ material สักตัว (ไม่เพิ่ม draw call, ไม่พัง material ที่แชร์กันอยู่)
 *
 * far คือตัวหลัก: ลากจากระยะปกติเข้ามาจนสั้นกว่าระยะกล้อง-ตัวละคร ทุกอย่างจึงจมสีหมด
 */
const FILL_COLOR = new THREE.Color('#2B1A12')
function SceneFill() {
  const { scene } = useThree()
  const base = useRef(null)
  const fill = useRef(0)

  const f = useControls('Fill (ฉาก 2)', {
    fillNear: { value: 0.02, min: 0.01, max: 6, step: 0.01, label: 'หมอก near ปลายทาง' },
    fillFar: { value: 1.6, min: 0.2, max: 20, step: 0.1, label: 'หมอก far ปลายทาง' },
    fillEase: { value: 0.14, min: 0.02, max: 0.5, step: 0.01, label: 'หน่วง' },
    fillPreview: { value: 0, min: 0, max: 1, step: 0.01, label: 'พรีวิว (ไม่ต้อง scroll)' },
  }, { collapsed: true })

  useFrame((_, delta) => {
    const fog = scene.fog
    // โหมดปั้นถอด fog ออก — ไม่มีอะไรให้กลืน ข้ามไป
    if (!fog) {
      base.current = null
      return
    }
    // จำค่าตั้งต้นไว้ครั้งเดียว เพื่อคืนกลับได้เป๊ะตอน scroll ย้อนขึ้น
    if (!base.current) {
      base.current = {
        near: fog.near,
        far: fog.far,
        fog: fog.color.clone(),
        bg: scene.background?.isColor ? scene.background.clone() : null,
      }
    }
    const b = base.current
    const dt = Math.min(delta, 0.05)
    fill.current = damp(fill.current, Math.max(scrollState.b.fill, f.fillPreview), f.fillEase, dt)
    const t = fill.current
    const v = t * t * (3 - 2 * t)

    // ไล่แบบคูณ ไม่ใช่แบบบวก — fog ตั้งต้นไว้ที่ 30/64 หน่วย ส่วนกล้องตอน focus
    // ห่างตัวละครแค่ ~3 หน่วย ถ้า lerp เชิงเส้นครึ่งทางยังได้ near 15 ซึ่งยังไม่แตะอะไรเลย
    // แล้วทั้งฉากจะมาจมสีรวดเดียวที่ปลายบีต — log-lerp กระจายช่วงที่ "เห็นผล" ให้ทั่วบีต
    fog.near = b.near * Math.pow(Math.max(f.fillNear, 0.01) / b.near, v)
    fog.far = b.far * Math.pow(f.fillFar / b.far, v)
    fog.color.copy(b.fog).lerp(FILL_COLOR, v)
    // พื้นหลังต้องไปสีเดียวกับหมอก ไม่งั้นขอบฟ้ายังเป็นสีส้มค้างอยู่หลังม่าน
    if (b.bg) scene.background.copy(b.bg).lerp(FILL_COLOR, v)
  })
  return null
}

/**
 * บอกสปแลชว่าฉากพร้อมแล้ว — ต้องอยู่ "ข้างใน" <Suspense> เท่านั้น
 *
 * ที่นี่ mount ได้ก็ต่อเมื่อทุก promise ในขอบเขตนั้น resolve ครบ (GLB ของ mascot)
 * ซึ่งเป็นสัญญาณที่ไม่กำกวม ต่างจาก useProgress().active ที่เป็นเท็จได้ระหว่างช่วงว่าง
 *
 * โหลดเสร็จยังไม่พอ — เฟรมแรกที่ material ถูกใช้จริงจะไปค้างรอ compile shader
 * (ฉากนี้ทุกชิ้นเป็น PBR + rim light ที่ฉีด onBeforeCompile เข้าไป) compileAsync
 * ดันงานนั้นมาทำตอนสปแลชยังบังอยู่ คนดูจึงไม่เห็นเฟรมแรกกระตุก
 */
function SceneReady() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    const done = () => alive && setSceneReady()
    // compileAsync มีตั้งแต่ three r152 — กันไว้เผื่อ renderer ที่ไม่มีให้
    if (typeof gl.compileAsync === 'function') {
      gl.compileAsync(scene, camera).then(done, done)
    } else {
      gl.compile(scene, camera)
      done()
    }
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  return null
}

function Lights() {
  return (
    <>
      {/* เงานุ่มด้วย PCFSoft (shadows="soft" ที่ Canvas) — PCSS ของ drei ใช้กับ three r182 ไม่ได้แล้ว
          (shadow map เปลี่ยนเป็น depth texture, unpackRGBAToDepth ใช้ไม่ได้ → shader ทึบทั้งฉาก compile พัง) */}

      {/* ambient อุ่นแรงขึ้น — ref โดมเรืองแสงฟุ้ง เงาไม่จม */}
      <ambientLight intensity={0.95} color="#FFE4D2" />
      <hemisphereLight args={['#FFDDC0', '#7BA184', 0.7]} />

      {/* key — ย้อนแสงจากตำแหน่งดวงอาทิตย์ (หลังบน) เงาทอดยาวเข้าหากล้อง
          normalBias กัน shadow acne — ลายขั้นบันไดเห็นชัดมากตอนกล้อง focus เข้าใกล้หน้า */}
      <directionalLight
        castShadow
        position={[1.5, 8.5, -13]}
        intensity={2.6}
        color="#FFD9A8"
        shadow-mapSize={LOW_END ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-far={60}
      />
      {/* fill หน้า — bounce อุ่นจากฝั่งกล้อง ไม่ให้ด้านหน้าจมมืด */}
      <directionalLight position={[-5, 4, 13]} intensity={1.0} color="#FFDFC8" />
      {/* fill เย็นจาง ๆ จากซ้าย เพิ่มมิติ */}
      <directionalLight position={[-11, 2, -2]} intensity={0.3} color="#D9C8FF" />
    </>
  )
}

/**
 * หยุด render ตอนฉากถูกบังจนมิด
 *
 * ฉากนี้เป็น PBR + shadow map + post ทั้งจอ — พอ scroll ลงไปอ่านส่วนล่างของหน้า
 * มันยังวาดครบทุกเฟรมทั้งที่ไม่มีใครเห็น กิน GPU/แบตแล้วแย่ง frame budget กับ
 * animation ของ DOM ที่กำลังเลื่อนอยู่จริง ๆ
 *
 * IntersectionObserver ใช้ไม่ได้กับหน้านี้: .jp-page เป็น position: fixed; inset: 0
 * ทั้งหน้าเลยไม่เคยเลื่อน canvas อยู่ในจอเสมอ (วัดแล้ว — draw call ตอน scroll สุดราง
 * เท่ากับตอนมองอยู่) สิ่งที่ทำให้ไม่มีอะไรให้ดูคือบีต fill: พอหมอกหุบจนสุด
 * ทั้งเฟรมเหลือสีเดียวนิ่ง ๆ วาดต่อไปก็ได้ภาพเดิมทุกเฟรม
 *
 * คำนวณตำแหน่งเองจาก scrollY ไม่อ่าน scrollState เพราะ effect ของลูกรันก่อนของพ่อ
 * (Scene อยู่ใน Page) listener ตัวนี้จะได้ค่าช้าไปหนึ่ง event ถ้าไปพึ่งของ Page
 */
const FILL_BEAT = BEATS.find(([name]) => name === 'fill')
/** หน่วงก่อนหยุด — กล้อง glide ด้วย camEase 0.045 ใช้เวลาราว 1 วิเข้าที่ */
const FREEZE_DELAY = 1200
function useCoveredFrameloop() {
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    let timer = 0
    const read = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      const raw = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0
      if (raw >= FILL_BEAT[2]) {
        // หยุดช้าไว้ก่อน: ถ้ากระโดดมาทันที (anchor link / เบราว์เซอร์คืนตำแหน่ง scroll)
        // แล้วหยุดเลย กล้องจะค้างกลางทาง พอเลื่อนกลับขึ้นมาต้องไล่ต่อให้เห็น
        // ปล่อยให้วาดต่ออีกครู่จนเข้าที่ แล้วค่อยแช่แข็งที่ท่าสุดท้าย
        if (!timer) timer = window.setTimeout(() => setCovered(true), FREEZE_DELAY)
      } else {
        // กลับมาวาดทันที ไม่หน่วง — ผู้ใช้กำลังเลื่อนขึ้นมาดู
        window.clearTimeout(timer)
        timer = 0
        setCovered(false)
      }
    }
    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])
  return covered ? 'never' : 'always'
}

export function Scene() {
  // โหมดทำงาน: ปิดสี/บรรยากาศทั้งหมด เหลือแต่ทรงกับเงา — จูนโมเดลได้โดยไม่ถูกสีหลอกตา
  const { clay, clayScene, clayGrid, clayOrbit } = useControls('Workspace', {
    // เปิดเองเฉพาะตอน dev — ถ้า default เป็น true ติดไปกับ build เว็บจริงจะกลายเป็นดินเทาทั้งหน้า
    // (แผง leva ถูกซ่อนตอน production แต่ "ค่า" ยังทำงานอยู่ ปิดเองไม่ได้)
    clay: { value: import.meta.env.DEV, label: 'โหมดปั้น (เทา)' },
    // ฉากประกอบยังอยู่ (แค่กลายเป็นเทา) — ปิดได้ถ้าอยากเหลือแต่ตัว mascot กับพื้น
    clayScene: { value: true, label: 'ฉากประกอบ (ฟ้า/เนิน/ต้นไม้/panel)' },
    clayGrid: { value: false, label: 'พื้น + กริด (แทนเนิน)' },
    // scroll ยังคุมกล้องเหมือนหน้าเว็บจริง — เปิดอันนี้เมื่อจะหมุนดูรอบตัวเท่านั้น
    clayOrbit: { value: false, label: 'กล้องหมุนรอบ (ปิด scroll cam)' },
    // คัดลอกค่าทุก slider ทุก folder เป็น JSON — จูนเสร็จแล้วแปะกลับมาให้ตั้งเป็น default ได้เลย
    // อ่านจาก levaStore ตรง ๆ ไม่ใช่จาก useControls ของแต่ละไฟล์ (ค่าอยู่กระจายหลาย component)
    'คัดลอกค่าทั้งหมด': button(() => {
      const out = {}
      for (const [path, input] of Object.entries(levaStore.getData())) {
        if (input?.type === 'BUTTON' || input?.type === 'FOLDER') continue
        if (input && 'value' in input) out[path] = input.value
      }
      const text = JSON.stringify(out, null, 2)
      navigator.clipboard?.writeText(text).catch(() => {})
      console.log(text)
    }),
  })

  const frameloop = useCoveredFrameloop()

  return (
    <Canvas
      frameloop={frameloop}
      shadows="soft"
      dpr={[1, LOW_END ? 1.5 : 2]}
      // การ์ดขยายเต็มจอระหว่าง scroll (--sp ยุบ padding) ขนาดกล่องจึงเปลี่ยนทุกเฟรม
      // default ของ R3F หน่วงการวัดไว้ 50ms ตอน scroll → buffer ค้าง aspect เก่า ถูก CSS ยืดใส่กล่องใหม่
      // ภาพเลยบีบแนวนอนตลอดช่วง scroll แล้วดีดกลับตอนหยุด เหมือนเปลี่ยนเลนส์ — วัดทันทีไม่หน่วง
      resize={{ scroll: false, debounce: 0 }}
      camera={{ position: [0, 4.1, 14.5], fov: 24, near: 0.1, far: 120 }}
      // ภาพสุดท้ายออกจาก EffectComposer — AA มาจาก MSAA ของ render target ไม่ใช่ของ canvas
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={[clay ? '#cfcdc9' : '#F8D9BC']} />
      {/* fog ในโหมดปั้นทำให้ทรงไกล ๆ จาง อ่านสัดส่วนยาก — ถอดทิ้ง */}
      {!clay && <fog attach="fog" args={['#F6CDA8', 30, 64]} />}

      {clay ? <ClayLights /> : <Lights />}
      {/* CameraRig ขับกล้องจาก scroll — ต้องปิดตอน orbit ไม่งั้นสองตัวแย่งกันคุมกล้อง */}
      {!(clay && clayOrbit) && <CameraRig />}
      {clay && clayOrbit && <ClayCam />}
      {clay && clayOrbit && (
        <OrbitControls makeDefault target={[0, 2.3, 0.9]} enableDamping dampingFactor={0.12} />
      )}
      {/* จอโค้งบิดเส้นตรงทั้งฉาก — ปิดตอนปั้น ไม่งั้นแยกไม่ออกว่าโมเดลเบี้ยวเองหรือโดนโค้ง */}
      {/* ความโค้งตอนพักเป็น 0 — งานโค้งของฉากนิ่งไปอยู่ที่ screenCurve ของ panel แล้ว
          เลนส์ตัวนี้เหลือหน้าที่เดียวคือบีบขอบภาพตอนบีต zoom (lensPunch) */}
      <Curvilinear strength={0} />
      {/* ฉากกลืนเป็นสีเดียว — ปิดตอนปั้น (โหมดปั้นถอด fog ออกอยู่แล้ว) */}
      {!clay && <SceneFill />}
      {!clay && <RimLight />}
      <ClayMode enabled={clay} />

      <group visible={!clay || clayScene}>
        <Sky />
        <Terrain />
        <Foliage />
        <Panels />
      </group>

      {/* พื้นเรียบ + กริด แทนเนินทราย — ใช้เช็คว่าฝ่าเท้าแตะพื้นจริงและตัวไม่เอียง */}
      {clay && clayGrid && !clayScene && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color="#c8c6c2" roughness={1} metalness={0} />
          </mesh>
          <gridHelper args={[60, 60, '#9a9894', '#b5b3af']} position={[0, 0, 0]} />
        </>
      )}

      <Suspense fallback={null}>
        {/* y: ยืดขาตาม comp แล้วฝ่าเท้าลงไปอีก 0.68 หน่วยโมเดล (×0.55 = 0.374) ยกตัวขึ้นชดเชย */}
        <Mascot position={[0, 2.61, 0.9]} scale={0.55} rotation={[0, -0.32, 0]} facingAway />
        {/* อยู่ในขอบเขตเดียวกับ Mascot — mount ได้แปลว่า GLB มาครบแล้ว */}
        <SceneReady />
      </Suspense>

      {/* <ContactShadows
        position={[0, -0.12, 2.2]}
        opacity={0.32}
        scale={9}
        blur={2.6}
        far={4}
        color="#8A4A2A"
      /> */}
    </Canvas>
  )
}
